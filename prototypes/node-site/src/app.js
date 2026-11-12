import express from 'express';
import session from 'express-session';
import crypto from 'node:crypto';
import * as db from './db.js';
import { loginView, homeView, logView, notBuiltView, page } from './views.js';
import { fileURLToPath } from 'node:url';

export const LOGIN_TRIES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const WATER_TARGET = 8;

export function createApp({ database, secret = crypto.randomBytes(32).toString('hex'),
                            now = () => new Date(), secureCookies = false } = {}) {
  const app = express();
  const failures = new Map(); // username -> [timestamps of wrong PINs]

  app.disable('x-powered-by');
  // The real site's stylesheet, font and icon, straight from the Flask app (no copies to keep in step).
  app.use(express.static(fileURLToPath(new URL('../../../server/static/', import.meta.url)), {
    maxAge: '1d', index: false,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }));
  app.use((req, res, next) => {
    // Health data: never cache pages, never allow framing, never sniff types.
    res.set({ 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY',
              'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: '2kb' }));
  app.use(express.json({ limit: '1kb' }));
  app.use(session({
    name: 'sb.sid', secret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: secureCookies, maxAge: 1000 * 60 * 60 * 12 },
  }));

  // Every form and fetch must carry the session's CSRF token.
  function csrfToken(req) {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
    return req.session.csrf;
  }
  function csrfOk(req) {
    const sent = req.body?.csrf || req.get('X-CSRF-Token') || '';
    const want = req.session.csrf || '';
    return sent.length > 0 && want.length > 0 && sent.length === want.length
      && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(want));
  }
  function requireLogin(req, res, next) {
    const user = req.session.userId ? db.findUserById(database, req.session.userId) : null;
    if (!user) return res.redirect('/login');
    req.user = user;
    next();
  }
  function takeFlash(req) {
    const f = req.session.flash ?? null;
    delete req.session.flash;
    return f;
  }
  const today = () => db.dayIn(now());

  app.get('/', (req, res) => res.redirect(req.session.userId ? '/home' : '/login'));

  app.get('/login', (req, res) => {
    res.send(loginView({ csrf: csrfToken(req), error: takeFlash(req)?.text ?? null }));
  });

  app.post('/login', (req, res) => {
    if (!csrfOk(req)) return res.status(403).send(page('Refused', '<p>Please reload and try again.</p>'));
    const username = String(req.body.username ?? '').trim().toLowerCase();
    const recent = (failures.get(username) ?? []).filter((t) => now().getTime() - t < LOGIN_LOCK_MS);
    if (recent.length >= LOGIN_TRIES) {
      return res.status(429).send(loginView({ csrf: csrfToken(req), username, error: 'Too many wrong PINs. Try again in 15 minutes.' }));
    }
    const user = db.findUserByName(database, username);
    // Same message for "no such user" and "wrong PIN": don't reveal which usernames exist.
    if (!user || !db.checkPin(req.body.pin, user.pin_hash)) {
      failures.set(username, [...recent, now().getTime()]);
      return res.status(401).send(loginView({ csrf: csrfToken(req), username, error: "That username or PIN isn't right." }));
    }
    failures.delete(username);
    req.session.regenerate((err) => {          // new session id after login (no session fixation)
      if (err) return res.status(500).send('Something went wrong.');
      req.session.userId = user.id;
      res.redirect('/home');
    });
  });

  app.post('/logout', (req, res) => {
    if (!csrfOk(req)) return res.status(403).end();
    req.session.destroy(() => res.redirect('/login'));
  });

  app.get('/home', requireLogin, (req, res) => {
    const day = today();
    const goal = req.user.daily_goal;
    res.send(homeView({
      user: req.user, csrf: csrfToken(req), today: day,
      steps: db.stepsOn(database, req.user.id, day), goal,
      week: db.thisWeek(database, req.user.id, day, goal),
      streak: db.streak(database, req.user.id, day, goal),
      cups: db.waterOn(database, req.user.id, day), waterTarget: WATER_TARGET,
      flash: takeFlash(req),
    }));
  });

  app.get('/log', requireLogin, (req, res) => {
    const day = today();
    const dates = db.daysBack(day, 7).reverse();
    res.send(logView({
      user: req.user, csrf: csrfToken(req), today: day, dates,
      current: { day, steps: db.stepsOn(database, req.user.id, day) || '' },
      recent: db.recentSteps(database, req.user.id, day, req.user.daily_goal, 7),
      flash: takeFlash(req),
    }));
  });

  app.post('/log', requireLogin, (req, res) => {
    if (!csrfOk(req)) return res.status(403).end();
    const day = String(req.body.day ?? '');
    const steps = Number(req.body.steps);
    const allowed = db.daysBack(today(), 7);
    if (!allowed.includes(day)) {
      req.session.flash = { kind: 'error', text: 'You can log the last 7 days only.' };
      return res.redirect('/log');
    }
    if (!Number.isInteger(steps) || steps < 0 || steps > 200000) {
      req.session.flash = { kind: 'error', text: 'Steps must be a whole number from 0 to 200,000.' };
      return res.redirect('/log');
    }
    db.saveSteps(database, req.user.id, day, steps);
    req.session.flash = { kind: 'ok', text: `Saved ${steps.toLocaleString('en-US')} steps for ${day}.` };
    res.redirect('/log');
  });

  app.post('/log/water', requireLogin, (req, res) => {
    if (!csrfOk(req)) return res.status(403).json({ ok: false, error: 'Please reload the page.' });
    const change = req.body?.change ?? 'plus';
    if (change !== 'plus' && change !== 'minus') return res.status(400).json({ ok: false, error: 'Unknown change.' });
    const cups = change === 'plus'
      ? db.addWaterCup(database, req.user.id, today(), 20)
      : db.removeWaterCup(database, req.user.id, today());
    res.json({ ok: true, cups, target: WATER_TARGET });
  });

  // The other tabs exist on the real site; the prototype shows a placeholder so the nav still works.
  for (const [path, title] of [['/leaderboard', 'Leaderboards'], ['/challenges', 'Challenges'], ['/insights', 'Weekly Wrap-Up']]) {
    app.get(path, requireLogin, (req, res) => res.send(notBuiltView({ user: req.user, csrf: csrfToken(req), title, path })));
  }

  app.use((req, res) => res.status(404).send(page('Not found', '<p>Nothing here.</p>')));
  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).send(page('Error', '<p>Something went wrong. Please try again.</p>'));
  });

  return app;
}

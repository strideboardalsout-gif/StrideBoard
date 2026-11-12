import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openDb, createUser, dayIn } from '../src/db.js';

let server, base, database, clock;
const NOW = new Date('2026-11-11T06:00:00Z'); // 10:00 in Dubai

before(async () => {
  database = openDb(':memory:');
  createUser(database, { username: 'sam', display: 'Sam', pin: '1234', dailyGoal: 8000 });
  clock = { t: NOW };
  const app = createApp({ database, now: () => clock.t });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Minimal cookie-keeping client, so each test has its own session.
function client() {
  let cookie = '';
  const req = async (path, { method = 'GET', form, json, headers = {} } = {}) => {
    const h = { ...headers, ...(cookie ? { Cookie: cookie } : {}) };
    let body;
    if (form) { h['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    const res = await fetch(base + path, { method, headers: h, body, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, location: res.headers.get('location'), text: await res.text(), headers: res.headers };
  };
  const csrf = async () => (await req('/login')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  return { req, csrf };
}

async function signedIn() {
  const c = client();
  const token = await c.csrf();
  await c.req('/login', { method: 'POST', form: { csrf: token, username: 'sam', pin: '1234' } });
  return c;
}

test('pages are never cached and cannot be framed', async () => {
  const r = await client().req('/login');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

test('home needs a login', async () => {
  const r = await client().req('/home');
  assert.equal(r.location, '/login');
});

test('a wrong PIN is refused with the same message as a wrong username', async () => {
  const c = client();
  const token = await c.csrf();
  const wrongPin = await c.req('/login', { method: 'POST', form: { csrf: token, username: 'sam', pin: '0000' } });
  const wrongUser = await c.req('/login', { method: 'POST', form: { csrf: token, username: 'nobody', pin: '1234' } });
  assert.equal(wrongPin.status, 401);
  assert.ok(wrongPin.text.includes("That username or PIN isn&#39;t right."));
  assert.ok(wrongUser.text.includes("That username or PIN isn&#39;t right."));
});

test('five wrong PINs lock the account, even for the right PIN', async () => {
  const c = client();
  const token = await c.csrf();
  for (let i = 0; i < 5; i++) {
    await c.req('/login', { method: 'POST', form: { csrf: token, username: 'lockme', pin: '0000' } });
  }
  const r = await c.req('/login', { method: 'POST', form: { csrf: token, username: 'lockme', pin: '1234' } });
  assert.equal(r.status, 429);
});

test('login without the CSRF token is refused', async () => {
  const c = client();
  await c.csrf();
  const r = await c.req('/login', { method: 'POST', form: { username: 'sam', pin: '1234' } });
  assert.equal(r.status, 403);
});

test('right PIN logs in and Home shows today and the goal', async () => {
  const c = await signedIn();
  const r = await c.req('/home');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('<span>/ 8,000</span>'));
  assert.ok(r.text.includes('Hi,'));
});

test('logging steps saves them and they show on Home', async () => {
  const c = await signedIn();
  const token = (await c.req('/log')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  const today = dayIn(NOW);
  const saved = await c.req('/log', { method: 'POST', form: { csrf: token, day: today, steps: '5432' } });
  assert.equal(saved.location, '/log');
  assert.ok((await c.req('/home')).text.includes('5,432'));
});

test('steps for a day outside the last 7 are refused', async () => {
  const c = await signedIn();
  const token = (await c.req('/log')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  await c.req('/log', { method: 'POST', form: { csrf: token, day: '2020-01-01', steps: '999' } });
  const page = (await c.req('/log')).text;
  assert.ok(page.includes('You can log the last 7 days only.'));
});

test('bad step numbers are refused', async () => {
  const c = await signedIn();
  const token = (await c.req('/log')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  for (const bad of ['-5', '1.5', 'abc', '999999']) {
    await c.req('/log', { method: 'POST', form: { csrf: token, day: dayIn(NOW), steps: bad } });
  }
  const page = (await c.req('/log')).text;
  assert.ok(page.includes('Steps must be a whole number'));
});

test('water button adds a glass without a page reload and caps at 20', async () => {
  const c = await signedIn();
  const token = (await c.req('/home')).text.match(/data-csrf="([0-9a-f]+)"/)[1];
  const first = await c.req('/log/water', { method: 'POST', json: {}, headers: { 'X-CSRF-Token': token } });
  assert.equal(JSON.parse(first.text).cups, 1);
  for (let i = 0; i < 25; i++) await c.req('/log/water', { method: 'POST', json: {}, headers: { 'X-CSRF-Token': token } });
  const last = await c.req('/log/water', { method: 'POST', json: {}, headers: { 'X-CSRF-Token': token } });
  assert.equal(JSON.parse(last.text).cups, 20);
});

test('water without the CSRF header is refused', async () => {
  const c = await signedIn();
  const r = await c.req('/log/water', { method: 'POST', json: {} });
  assert.equal(r.status, 403);
});

test('logout ends the session', async () => {
  const c = await signedIn();
  const token = (await c.req('/home')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  await c.req('/logout', { method: 'POST', form: { csrf: token } });
  assert.equal((await c.req('/home')).location, '/login');
});

test('a user never sees another user\'s steps', async () => {
  createUser(database, { username: 'other', display: 'Other', pin: '4321', dailyGoal: 5000 });
  const a = await signedIn();
  const bClient = client();
  const t = await bClient.csrf();
  await bClient.req('/login', { method: 'POST', form: { csrf: t, username: 'other', pin: '4321' } });
  const token = (await a.req('/log')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  await a.req('/log', { method: 'POST', form: { csrf: token, day: dayIn(NOW), steps: '7777' } });
  assert.ok(!(await bClient.req('/home')).text.includes('7,777'));
});

test('water can go back down, but never below zero', async () => {
  const c = await signedIn();
  const token = (await c.req('/home')).text.match(/data-csrf="([0-9a-f]+)"/)[1];
  const h = { 'X-CSRF-Token': token };
  // Start from zero whatever earlier tests did today.
  for (let i = 0; i < 25; i++) await c.req('/log/water', { method: 'POST', json: { change: 'minus' }, headers: h });
  await c.req('/log/water', { method: 'POST', json: { change: 'plus' }, headers: h });
  const down = await c.req('/log/water', { method: 'POST', json: { change: 'minus' }, headers: h });
  assert.equal(JSON.parse(down.text).cups, 0);
  const again = await c.req('/log/water', { method: 'POST', json: { change: 'minus' }, headers: h });
  assert.equal(JSON.parse(again.text).cups, 0);
  const bad = await c.req('/log/water', { method: 'POST', json: { change: 'lots' }, headers: h });
  assert.equal(bad.status, 400);
});

test('the StrideBoard stylesheet and font are served', async () => {
  const css = await client().req('/css/style.css');
  assert.equal(css.status, 200);
  assert.ok(css.text.includes('--sage: #C9DCCC'));
  const font = await client().req('/fonts/outfit.woff2');
  assert.equal(font.status, 200);
});

test('tabs that are not built yet show a placeholder, not an error', async () => {
  const c = await signedIn();
  const r = await c.req('/leaderboard');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Not in the prototype yet'));
});

test('the Log page lists saved days, newest first', async () => {
  const c = await signedIn();
  const token = (await c.req('/log')).text.match(/name="csrf" value="([0-9a-f]+)"/)[1];
  await c.req('/log', { method: 'POST', form: { csrf: token, day: dayIn(NOW), steps: '9100' } });
  const page = (await c.req('/log')).text;
  assert.ok(page.includes('class="history"'));
  assert.ok(page.includes('9,100'));
});

// Storage for the prototype: SQLite via Node's built-in node:sqlite (no native build step).
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      daily_goal INTEGER NOT NULL DEFAULT 10000 CHECK (daily_goal > 0)
    );
    CREATE TABLE IF NOT EXISTS steps (
      user_id INTEGER NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      steps INTEGER NOT NULL CHECK (steps >= 0),
      PRIMARY KEY (user_id, day)
    );
    CREATE TABLE IF NOT EXISTS water (
      user_id INTEGER NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      cups INTEGER NOT NULL CHECK (cups >= 0),
      PRIMARY KEY (user_id, day)
    );
  `);
  return db;
}

// PINs are stored as scrypt hashes with a random salt, never in plain text.
export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pin), salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function checkPin(pin, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(pin ?? ''), Buffer.from(saltHex, 'hex'), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createUser(db, { username, display, pin, dailyGoal = 10000 }) {
  const info = db.prepare(
    'INSERT INTO users (username, display, pin_hash, daily_goal) VALUES (?, ?, ?, ?)'
  ).run(username, display, hashPin(pin), dailyGoal);
  return Number(info.lastInsertRowid);
}

export function findUserByName(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) ?? null;
}

export function findUserById(db, id) {
  return db.prepare('SELECT id, username, display, daily_goal FROM users WHERE id = ?').get(id) ?? null;
}

export function saveSteps(db, userId, day, steps) {
  db.prepare(`INSERT INTO steps (user_id, day, steps) VALUES (?, ?, ?)
              ON CONFLICT (user_id, day) DO UPDATE SET steps = excluded.steps`)
    .run(userId, day, steps);
}

export function stepsOn(db, userId, day) {
  return db.prepare('SELECT steps FROM steps WHERE user_id = ? AND day = ?').get(userId, day)?.steps ?? 0;
}

export function addWaterCup(db, userId, day, max = 20) {
  db.prepare(`INSERT INTO water (user_id, day, cups) VALUES (?, ?, 1)
              ON CONFLICT (user_id, day) DO UPDATE SET cups = MIN(cups + 1, ?)`)
    .run(userId, day, max);
  return waterOn(db, userId, day);
}

export function removeWaterCup(db, userId, day) {
  db.prepare('UPDATE water SET cups = MAX(cups - 1, 0) WHERE user_id = ? AND day = ?').run(userId, day);
  return waterOn(db, userId, day);
}

export function waterOn(db, userId, day) {
  return db.prepare('SELECT cups FROM water WHERE user_id = ? AND day = ?').get(userId, day)?.cups ?? 0;
}

// Monday to Sunday of the week containing `today`, like the current site's Home chart.
export function thisWeek(db, userId, today, goal) {
  const [y, m, d] = today.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(t); monday.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday); dt.setUTCDate(monday.getUTCDate() + i);
    const day = dt.toISOString().slice(0, 10);
    const steps = day > today ? 0 : stepsOn(db, userId, day);
    out.push({
      day, steps,
      label: dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      future: day > today, today: day === today, met: steps >= goal,
      percent: Math.min(100, Math.round((steps * 100) / goal)),
      realPercent: Math.round((steps * 100) / goal),
    });
  }
  return out;
}

// Days in a row the goal was met, counting back from today (or yesterday if today isn't done yet).
export function streak(db, userId, today, goal) {
  const days = daysBack(today, 366).reverse();
  let i = stepsOn(db, userId, days[0]) >= goal ? 0 : 1;
  let n = 0;
  for (; i < days.length && stepsOn(db, userId, days[i]) >= goal; i++) n++;
  return n;
}

// The last `n` days that have steps, newest first, for the Log page list.
export function recentSteps(db, userId, today, goal, n = 7) {
  const from = daysBack(today, n)[0];
  return db.prepare(`SELECT day, steps FROM steps WHERE user_id = ? AND day BETWEEN ? AND ?
                     ORDER BY day DESC`).all(userId, from, today)
    .map((r) => ({ day: r.day, steps: r.steps, met: r.steps >= goal }));
}

// "YYYY-MM-DD" for a Date in Dubai time (the server must not use UTC for dates).
export function dayIn(date, tz = 'Asia/Dubai') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function daysBack(today, n) {
  const [y, m, d] = today.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

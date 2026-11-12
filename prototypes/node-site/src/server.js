import { createApp } from './app.js';
import { openDb, createUser, findUserByName, saveSteps, daysBack, dayIn } from './db.js';

// Prototype start-up: a local demo database with one demo user. Never use these PINs for real data.
const database = openDb(process.env.DB_PATH ?? ':memory:');
if (!findUserByName(database, 'demo')) {
  createUser(database, { username: 'demo', display: 'Demo', pin: '1234', dailyGoal: 10000 });
}
// Demo data only (fake step counts), so the screenshots look like a real week.
if (process.env.DEMO_DATA === '1') {
  const user = findUserByName(database, 'demo');
  const sample = [6120, 9840, 11250, 4300, 8760, 10420, 7310];
  daysBack(dayIn(new Date()), 7).forEach((day, i) => saveSteps(database, user.id, day, sample[i]));
}
const port = Number(process.env.PORT ?? 3000);
createApp({ database, secureCookies: process.env.NODE_ENV === 'production' })
  .listen(port, () => console.log(`prototype on http://localhost:${port}`));

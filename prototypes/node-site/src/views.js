// HTML for the prototype, built on the StrideBoard site's own stylesheet (server/static/css/style.css):
// same layout (side nav, top bar, bottom tab bar), cards, icons and logo as the Flask templates.
// Plain template strings, every value escaped.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const num = (n) => Number(n || 0).toLocaleString('en-US');

// Same paths as the icon() macro in server/templates/_macros.html (only the ones these pages use).
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  star: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  foot: '<path d="M7 3c1.7 0 2.5 2 2.5 4.5S8.7 12 7 12 4.5 10 4.5 7.5 5.3 3 7 3z"/><path d="M4.8 15.5h4.4l-.4 2.5a2 2 0 0 1-3.6 0z"/><path d="M17 7c1.7 0 2.5 2 2.5 4.5S18.7 16 17 16s-2.5-2-2.5-4.5S15.3 7 17 7z"/><path d="M14.8 19.5h4.4"/>',
  glass: '<path d="M6 3h12l-1.6 16.2A2 2 0 0 1 14.4 21H9.6a2 2 0 0 1-2-1.8z"/><path d="M6.6 9h10.8"/>',
  flame: '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5z"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  play: '<path d="M7 4l12 8-12 8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

export function icon(name, size = 22) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.info}</svg>`;
}

// The logo: three slanted bars, like strides (same as the logo() macro).
export function logo(size = 40) {
  return `<svg width="${size}" height="${Math.round(size * 0.85)}" viewBox="0 0 40 34" aria-hidden="true"><g transform="translate(6.8 0)"><rect x="5" y="9" width="7" height="23" rx="3.5" transform="skewX(-18)" fill="currentColor"/><rect x="17" y="2" width="7" height="30" rx="3.5" transform="skewX(-18)" fill="#A9B4F7"/><rect x="29" y="13" width="7" height="19" rx="3.5" transform="skewX(-18)" fill="currentColor"/></g></svg>`;
}

function pageHead(light, bold, sub = null, actions = '') {
  return `<header class="page-head">
  <div>
    <h1><span class="light">${esc(light)}</span> ${esc(bold)}</h1>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
  </div>
  ${actions ? `<div class="head-actions">${actions}</div>` : ''}
</header>`;
}

// Same drawing as the water_glass() macro: the level follows --fill.
function waterGlass(n, target) {
  const fill = Math.min((n || 0) / (target || 8), 1);
  let ticks = '';
  for (let i = 1; i < target; i++) {
    const y = 158 - (144 * i) / target;
    ticks += `<line class="wg-tick" x1="${104 + (10 * i) / target}" x2="${95 + (10 * i) / target}" y1="${y}" y2="${y}"/>`;
  }
  return `<div class="water-glass${n >= target ? ' full' : ''}${!n ? ' empty' : ''}" data-water-glass style="--fill: ${fill.toFixed(3)}" aria-hidden="true">
  <svg viewBox="0 0 140 170" width="140" height="170">
    <defs><clipPath id="wg-inside"><path d="M24 14 H116 L106 150 Q105 158 97 158 H43 Q35 158 34 150 Z"/></clipPath></defs>
    <g clip-path="url(#wg-inside)">
      <g class="wg-level">
        <path class="wg-wave wg-back" d="M-140 6 q17.5 -9 35 0 t35 0 t35 0 t35 0 t35 0 t35 0 t35 0 t35 0 V200 H-140 Z"/>
        <path class="wg-wave wg-front" d="M-140 8 q17.5 -9 35 0 t35 0 t35 0 t35 0 t35 0 t35 0 t35 0 t35 0 V200 H-140 Z"/>
        <circle class="wg-bubble" cx="56" cy="60" r="3"/><circle class="wg-bubble b2" cx="84" cy="80" r="2.2"/><circle class="wg-bubble b3" cx="70" cy="100" r="2.6"/>
      </g>
    </g>
    ${ticks}
    <path class="wg-shine" d="M34 26 L42 140"/>
    <path class="wg-outline" d="M20 10 H120 L110 150 Q108 162 97 162 H43 Q32 162 30 150 Z"/>
  </svg>
</div>`;
}

// "2026-11-11" -> "Today", or "Wed 11 Nov" (same as the nice_date filter).
export function niceDate(day, today) {
  if (day === today) return 'Today';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const mon = dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${wd} ${d} ${mon}`;
}

// "Wednesday 11 November" for the page header (same as today_label).
export function longDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const mon = dt.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${wd} ${d} ${mon}`;
}

const NAV = [
  ['/home', 'Home', 'Dashboard', 'home'],
  ['/log', 'Log', 'Log your day', 'plus'],
  ['/leaderboard', 'Ranks', 'Leaderboards', 'trophy'],
  ['/challenges', 'Challenges', 'Challenges', 'star'],
  ['/insights', 'Wrap-Up', 'Weekly Wrap-Up', 'chart'],
];

function flashHtml(flash) {
  if (!flash) return '';
  const cls = flash.kind === 'error' ? ' flash-error' : '';
  const ic = flash.kind === 'error' ? 'info' : 'check';
  return `<div class="flashes" role="status"><p class="flash${cls}">${icon(ic, 20)}<span>${esc(flash.text)}</span></p></div>`;
}

export function page(title, body, { user = null, csrf = '', flash = null, path = '' } = {}) {
  const current = (href) => (path === href ? ' active" aria-current="page' : '');
  const side = user ? `
  <nav class="side" aria-label="Main">
    <a href="/home" class="side-logo" aria-label="StrideBoard home">${logo(38)}</a>
    ${NAV.map(([href, , long, ic]) =>
      `<a href="${href}" class="side-link${current(href)}" aria-label="${esc(long)}" title="${esc(long)}">${icon(ic)}</a>`).join('\n    ')}
    <span class="side-spacer"></span>
    <form method="post" action="/logout" class="logout-form">
      <input type="hidden" name="csrf" value="${esc(csrf)}">
      <button type="submit" class="side-link" aria-label="Log out" title="Log out">${icon('logout')}</button>
    </form>
  </nav>` : '';
  const topbar = user ? `
    <div class="topbar">
      <a href="/home" class="topbar-logo" aria-label="StrideBoard home">${logo(30)}<span>StrideBoard</span></a>
      <div class="topbar-actions">
        <form method="post" action="/logout" class="logout-form">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <button type="submit" class="round-btn" aria-label="Log out" title="Log out">${icon('logout', 20)}</button>
        </form>
      </div>
    </div>` : '';
  const bottom = user ? `
<nav class="bottom-nav" aria-label="Main">
  ${NAV.map(([href, short, , ic]) =>
    `<a href="${href}" class="${path === href ? 'active' : ''}"${path === href ? ' aria-current="page"' : ''}>${icon(ic, 22)}<span>${esc(short)}</span></a>`).join('\n  ')}
</nav>` : '';

  return `<!doctype html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)} · StrideBoard</title>
  <meta name="theme-color" content="#C9DCCC" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0A1222" media="(prefers-color-scheme: dark)">
  <link rel="icon" type="image/png" href="/icons/icon-192.png">
  <link rel="preload" href="/fonts/outfit.woff2" as="font" type="font/woff2" crossorigin>
  <style>
    @font-face { font-family: "Outfit"; font-style: normal; font-weight: 100 900; font-display: swap;
                 src: url("/fonts/outfit.woff2") format("woff2"); }
  </style>
  <script>(function (h, n) {
    // Apple devices get the frosted "glass" look; low-memory phones drop the costly effects (as on the real site).
    if (/Mac|iPhone|iPad|iPod/.test(n.userAgent)) h.classList.add("glass");
    var c = n.connection;
    if ((n.deviceMemory && n.deviceMemory <= 4) || (c && c.saveData)) h.classList.add("lite");
  })(document.documentElement, navigator);</script>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="app${user ? '' : ' app-solo'}">${side}
  <main class="main" id="main">${topbar}
    ${flashHtml(flash)}
    ${body}
    <footer class="footer">
      <p>Goals are general suggestions, not medical advice. · Prototype: Home and Log only.</p>
    </footer>
  </main>
</div>${bottom}
</body>
</html>`;
}

export function loginView({ csrf, error, username = '' }) {
  return page('Log in', `
<div class="login-wrap">
  <div class="login-brand"><span class="mark">${logo(34)}</span> StrideBoard</div>
  <div>
    <h1 class="hero"><span class="light">Every step</span> counts here.</h1>
    <p class="muted hero-sub">Log your steps, keep your streak going and level up from Bronze to Platinum.</p>
  </div>
  <div class="login-tiles" aria-hidden="true">
    <span style="background:var(--bronze)"></span><span style="background:var(--silver)"></span>
    <span style="background:var(--gold)"></span><span style="background:var(--platinum)"></span>
  </div>
  <form method="post" action="/login" class="card card-soft form" novalidate>
    <input type="hidden" name="csrf" value="${esc(csrf)}">
    <div class="field">
      <label for="username">Username</label>
      <input class="input" id="username" name="username" value="${esc(username)}" autocomplete="username"
             autocapitalize="none" autocorrect="off" spellcheck="false" required>
    </div>
    <div class="field">
      <label for="pin">PIN</label>
      <input class="input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required>
    </div>
    <button class="btn btn-dark btn-block" type="submit">Log in ${icon('play', 16)}</button>
  </form>
</div>`, { flash: error ? { kind: 'error', text: error } : null });
}

export function homeView({ user, csrf, today, steps, goal, week, streak, cups, waterTarget, flash }) {
  const realPct = Math.round((steps * 100) / goal);
  const pct = Math.min(realPct, 100);
  const on = Math.min(Math.floor(realPct / 10), 10);
  const blocks = Array.from({ length: 10 }, (_, i) =>
    `<span class="block${i < on ? ' on' : ''}" style="--i: ${i}"></span>`).join('');
  let note;
  if (steps === 0) note = '<p class="small">No steps yet today. Add them on the <a href="/log">Log</a> page.</p>';
  else if (realPct >= 100) note = '<p class="small"><strong>Goal reached!</strong> Anything extra still counts towards your weekly tier.</p>';
  else note = `<p class="small"><strong>${num(goal - steps)} to go.</strong> Moving more is linked to better mood and sleep, and a short walk all adds up.</p>`;

  const anySteps = week.some((w) => w.steps > 0);
  const weekLabel = week.filter((w) => !w.future).map((w) => `${w.label} ${num(w.steps)}`).join(', ');
  const cols = week.map((w, i) => `
        <div class="week-col">
          <div class="week-track">
            ${!w.future && w.steps ? `<div class="week-fill${w.met ? ' met' : ''}" style="--h: ${Math.max(w.percent, 6)}%; --i: ${i}">${w.today ? `<span class="tag">${w.realPercent}%</span>` : ''}</div>` : ''}
          </div>
          <span class="week-day${w.today ? ' today' : ''}">${esc(w.label)}</span>
          <span class="week-steps">${w.future ? '–' : num(w.steps)}</span>
        </div>`).join('');
  let weekNote;
  if (!anySteps) weekNote = '<p class="small muted">No steps yet this week. They\'ll appear here once you log them.</p>';
  else if (streak === 0) weekNote = `<p class="small">Hit ${num(goal)} steps today to start a streak.</p>`;
  else weekNote = `<p class="small">You've hit your goal ${streak} day${streak === 1 ? '' : 's'} in a row. Keep the streak going!</p>`;

  const waterChip = cups >= waterTarget ? 'Done for today' : `${waterTarget - cups} to go`;
  const first = String(user.display).split(/\s+/)[0];

  return page('Dashboard', `
${pageHead('Hi,', first, longDate(today), `<a class="btn btn-soft" href="/log">${icon('plus', 18)} Log your day</a>`)}

<div class="row row-even" style="margin-top:0">
  <section class="card card-peri" aria-labelledby="steps-h">
    <div class="card-head">
      <span class="icon-circle">${icon('foot')}</span>
      <h2 id="steps-h">Today's steps</h2>
      <span class="chip chip-dark">${realPct}% of goal</span>
    </div>
    <div class="steps-top">
      <div class="big-num"><strong id="today-steps">${num(steps)}</strong><span>/ ${num(goal)}</span></div>
      <div class="ring" role="img" aria-label="${realPct}% of today's goal">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle class="track" cx="46" cy="46" r="38" fill="none" stroke-width="10"/>
          <circle class="fill" cx="46" cy="46" r="38" fill="none" stroke-width="10"
                  stroke-dasharray="238.8" style="stroke-dashoffset: ${(238.8 * (1 - pct / 100)).toFixed(1)}"/>
        </svg>
        <span class="ring-label">${realPct >= 100 ? icon('check', 26) : `${realPct}%`}</span>
      </div>
    </div>
    <div class="blocks blocks-10" aria-hidden="true">${blocks}</div>
    ${note}
  </section>

  <section class="card card-blue" aria-labelledby="water-h" data-water data-csrf="${esc(csrf)}" data-target="${waterTarget}">
    <div class="card-head">
      <span class="icon-circle">${icon('glass')}</span>
      <h2 id="water-h">Water</h2>
      <span class="chip chip-dark" data-water-chip>${waterChip}</span>
    </div>
    <div class="steps-top">
      <div class="big-num"><strong data-water-count aria-live="polite">${cups}</strong><span>/ ${waterTarget} glasses</span></div>
      <div class="stepper">
        <button class="icon-btn" type="button" aria-label="Remove a glass" data-water-change="minus"${cups ? '' : ' disabled'}>${icon('minus')}</button>
        <button class="icon-btn dark" type="button" aria-label="Add a glass" data-water-change="plus">${icon('plus')}</button>
      </div>
    </div>
    ${waterGlass(cups, waterTarget)}
    <p class="small">Tap + each time you finish a glass. A bottle on your desk makes it easy.</p>
  </section>
</div>

<div class="row">
  <section class="card card-soft" aria-labelledby="week-h">
    <div class="card-title-row">
      <h2 id="week-h" class="card-title">This week</h2>
      <span class="chip"><span class="dot" style="background:var(--peri)"></span>Goal met</span>
      <span class="chip"><span class="dot" style="background:var(--blue)"></span>Under goal</span>
      <span class="chip right">${icon('flame', 17)} ${streak}-day streak</span>
    </div>
    <div class="inner">
      <div class="week" role="img" aria-label="Steps per day this week: ${esc(weekLabel)}">${cols}
      </div>
    </div>
    ${weekNote}
  </section>
</div>

<script>
  // Water updates in place (no page reload), like the current site's quick water buttons.
  (function () {
    var card = document.querySelector('[data-water]');
    if (!card) return;
    var target = Number(card.dataset.target);
    function show(cups) {
      card.querySelector('[data-water-count]').textContent = cups;
      card.querySelector('[data-water-chip]').textContent = cups >= target ? 'Done for today' : (target - cups) + ' to go';
      card.querySelector('[data-water-change="minus"]').disabled = cups === 0;
      var g = card.querySelector('[data-water-glass]');
      g.style.setProperty('--fill', Math.min(cups / target, 1).toFixed(3));
      g.classList.toggle('empty', cups === 0);
      g.classList.toggle('full', cups >= target);
    }
    card.querySelectorAll('[data-water-change]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
          var res = await fetch('/log/water', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': card.dataset.csrf },
            body: JSON.stringify({ change: btn.dataset.waterChange }) });
          if (res.ok) show((await res.json()).cups);
        } finally {
          if (btn.dataset.waterChange === 'plus') btn.disabled = false;
        }
      });
    });
  })();
</script>`, { user, csrf, flash, path: '/home' });
}

export function logView({ user, csrf, today, dates, current, recent, flash }) {
  const options = dates.map((d) =>
    `<option value="${esc(d)}"${d === current.day ? ' selected' : ''}>${esc(niceDate(d, today))}</option>`).join('');
  const list = recent.length
    ? `<ul class="history">${recent.map((r) => `
      <li>
        <span class="h-date">${esc(niceDate(r.day, today))}</span>
        ${r.met ? `<span class="chip" style="background:var(--peri-bg)">${icon('check', 15)} Goal</span>` : ''}
        <span class="src">By hand</span>
        <span class="h-steps">${num(r.steps)}</span>
      </li>`).join('')}
    </ul>`
    : `<div class="empty"><span class="icon-circle">${icon('foot')}</span><strong>No steps yet this week</strong><p class="small muted">Steps you save show up in this list.</p></div>`;

  return page('Log', `
${pageHead('Log your', 'day', 'Add your steps for any of the last 7 days.')}

<div class="row row-even" style="margin-top:0">
  <section class="card card-peach" aria-labelledby="log-h">
    <div class="card-head">
      <span class="icon-circle">${icon('foot')}</span>
      <h2 id="log-h">Steps</h2>
    </div>
    <form method="post" action="/log" class="form" style="gap:12px">
      <input type="hidden" name="csrf" value="${esc(csrf)}">
      <div class="field">
        <label for="day">Day</label>
        <select class="input" id="day" name="day">${options}</select>
      </div>
      <div class="field">
        <label for="steps">Steps</label>
        <input class="input" id="steps" name="steps" type="number" inputmode="numeric" min="0" max="200000"
               value="${esc(current.steps)}" required>
      </div>
      <button class="btn btn-dark btn-block" type="submit">${icon('check', 18)} Save steps</button>
    </form>
  </section>

  <section class="card card-soft" aria-labelledby="recent-h">
    <h2 id="recent-h" class="card-title">Last 7 days</h2>
    ${list}
  </section>
</div>`, { user, csrf, flash, path: '/log' });
}

export function notBuiltView({ user, csrf, title, path }) {
  return page(title, `
${pageHead(title, '', 'Not in the prototype yet. Only Home and Log are built.')}
<section class="card card-soft"><p class="small">The current site has this page. <a href="/home">Back to Home</a></p></section>`,
  { user, csrf, path });
}

# StrideBoard Node prototype (side project)

A small Node + Express rewrite of two screens (Home and Log), made to compare with the Flask site.
We decided to stay on Flask; this is kept for reference. It is not deployed and the live site never runs it.

## Run
    cd prototypes/node-site
    npm install              # packages are not kept in the repo
    npm test                 # 17 tests
    npm start                # demo user: demo / PIN 1234 (fake data only)
    npm run shots            # phone, iPhone, dark mode and desktop screenshots into ./screenshots

## Look
Uses the StrideBoard site's own stylesheet, font and icon, served straight from `server/static/`
(no copies), so it always matches the real site.
The HTML follows the Flask templates: side nav on desktop, top bar and bottom tab bar on phones,
the same cards, icons, logo, ring, step blocks, water glass and week chart. Apple devices get the
glass look and dark mode follows the system, both from the real stylesheet.

Steps and water sit side by side, with the week full width below, because the real Home page's
third card (tier and daily reward) isn't in the prototype.

Found while doing this: in the real stylesheet, `.glass .block` comes after `.block.on` with the
same specificity, so on iPhone and Mac the filled step blocks show as faint glass instead of the
periwinkle fill. Fix in the real repo: add `.glass .block.on { background: var(--peri); }` after it.

## What it keeps from the current site's rules
- PINs stored as salted scrypt hashes, never in plain text.
- Five wrong PINs lock the account for 15 minutes; wrong username and wrong PIN give the same message.
- CSRF token on every form and on the water button.
- Session ID changes on login; cookies are HttpOnly and SameSite=Lax (Secure in production).
- Pages send `Cache-Control: no-store` and `X-Frame-Options: DENY`.
- Dates use Dubai time.
- The water button updates in place with a fetch call, so there's no full reload.

## Not done (so don't read the demo as a finished site)
- Only Home and Log. No leaderboard, challenges, settings, admin, backups, sign-up or Android/iPhone links.
- Sessions are kept in memory, so they're lost on restart. A real version needs a proper session store.
- No HTTPS setup, no rate limit beyond login, and no security review.
- The phone-token PIN gate and the under-13 changes are not included.

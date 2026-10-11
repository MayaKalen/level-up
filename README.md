# LEVEL UP

A gamified personal productivity app with missions, habits, goals, sales tracking, XP, levels, streaks and achievements. It is mobile-first and works offline.

## Run it

```bash
python3 serve.py
```

Then open http://localhost:5173. Logic tests are at http://localhost:5173/tests/.

**Try it on your phone (same Wi-Fi):**

```bash
python3 serve.py --lan
```

It prints an address like `http://192.168.1.20:5173` to open on your phone. Anyone on the same Wi-Fi can reach it while it runs, so stop it (Ctrl+C) when you're done. Data saved on the phone stays on the phone. On iPhone, use Share → Add to Home Screen for a full-screen app icon.

Nothing needs to be installed. The app is plain HTML, CSS and JavaScript (ES modules), with no build step and no dependencies. `serve.py` is Python's built-in static server plus a `Cache-Control: no-cache` header, so the browser picks up changed files. Opening `index.html` directly from disk will **not** work, because browsers block ES modules on `file://`.

## How data is stored

- Everything is saved in **this browser's localStorage** under the key `levelup:state:v1`.
- Data survives refreshes and browser restarts on the same device and browser.
- It is **not** synced across devices, and there is **no login**. Clearing site data deletes it, so use **Settings → Export JSON backup** regularly. You can restore with **Import JSON backup**.
- If two tabs are open, a save in one reloads the other, so they can't overwrite each other.
- If localStorage is blocked (some private modes), the app falls back to memory and warns you.
- Storage goes through one adapter interface in `js/storage.js` (`load / save / clear / subscribe`). A cloud backend such as Supabase with Row Level Security can be added by implementing that interface. Nothing else needs to change.

## XP rules (the ledger)

All XP is recorded in an append-only ledger. Every entry has a key, such as `task:<id>` or `habit:<id>:<day>`.

- A key can hold only one award. Double-taps, refreshes and two open tabs can't award XP twice.
- Unchecking a mission or habit adds a reversal dated to the **original** day. Re-completing restores the same amount, so XP can't be farmed.
- Editing a completed mission doesn't change XP already earned. Deleting a completed mission keeps its XP as history.
- The "all daily missions done" bonus applies to today only, when at least N missions are planned. It is reversed if a mission is reopened or added.
- Achievements are calculated from records, awarded once, and never revoked.
- Level curve: L1 0 · L2 100 · L3 250 · L4 450 · L5 700 … (`base·n + step·n(n+1)/2`, configurable).

## Streaks and dates

- Each completion stores the calendar day it happened, in your configured timezone. Streaks are recomputed from that history, so refreshing can't reset or double-count them, and changing timezone doesn't rewrite past days.
- Today in progress never breaks a streak. Optional streak protection forgives one missed day per week.
- "New day starts at" (0–5 am) lets late-night activity count toward the previous day.
- Day arithmetic is done on calendar dates in UTC, so DST changes can't skip or repeat a day.

## Features

- **Dashboard**: character card, today's progress ring, daily motivation, quick actions, missions grouped by category with filters, habits, and upcoming items.
- **Missions**: create, edit, duplicate, complete, skip, start and delete missions. Supports subtasks, notes, goal links, repeats (daily / weekdays / weekly / custom days), search, filter, sort, and Today / Upcoming / Overdue / Anytime / Completed tabs.
- **Habits**: build or avoid habits, scheduled daily, on selected days, or N times per week. Numeric targets, one-tap completion, backfill for the last 7 days, current and best streaks, and reminders.
- **Goals**: reason, milestones timeline, numeric targets, linked missions and habits, status, and celebrations.
- **Sales**: daily entries (revenue, deals, leads, follow-ups, meetings) and per-month targets, in INR, USD, EUR, GBP, AED or SGD. Shows pace, conversion and average deal size only when the data supports them, plus charts, history, best month, month-over-month change, and optional XP.
- **Statistics**: XP by day or week, heatmap, completion and habit consistency, category breakdown, focus time, personal bests, and a weekly review with wins, attention items and suggested priorities.
- **Achievements**: 16 badges with progress and the date earned.
- **Plan & Review**: top three priorities, daily XP target, focus theme, and an end-of-day review with a private journal.
- **Focus timer**: 25, 45 or 60 minutes, kept across refreshes.
- **Motivation**: 60 original affirmations across 10 themes, personalised with your actual progress. Includes favorites and your own quotes. None are falsely attributed to anyone.
- **Settings**: XP values, level curve, active-day rules, streak protection, currency, themes and tone, categories, timezone, theme, reduced motion, export to JSON or CSV, import, removing starter examples, and reset.

## Known limitations

- No accounts and no cross-device sync, because storage is local only (see above).
- Habit reminders use browser notifications and fire **only while the app is open in a tab**. There is no push server.
- Motivation uses the built-in library. No AI service is called and no API keys exist anywhere in the code.
- Changing currency relabels amounts; it doesn't convert them.

## Project layout

```
index.html, css/app.css      Shell and styles (dark/light tokens, mobile-first)
js/main.js                   Router, shell, actions, background checks
js/store.js                  State, commit pipeline, all mutations
js/xp.js                     Levels and the idempotent XP ledger
js/dates.js                  Timezone-aware day keys, DST-safe arithmetic
js/tasks.js habits.js streaks.js goals.js sales.js achievements.js motivation.js
js/views/*.js                One module per page
js/forms.js ui.js charts.js  Sheets/forms, dialogs/toasts, SVG/CSS charts
tests/                       Browser-run logic tests
```

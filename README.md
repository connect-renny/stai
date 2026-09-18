# STAI 2026 — Future World

Static, single-page website for STAI 2026 (Science · Technology · Innovation).
Dark, instrument-panel aesthetic: a gated landing screen with an **Enter the Future**
button, a short boot sequence, then an iris transition into the main site.

## Run

Open `index.html` in a browser, or serve the folder (any static server):

```
npx serve .          # or: python -m http.server 8000
```

## Structure

```
index.html            all sections, in scroll order
scss/                 source styles (compile → assets/css/style.css)
  base/_root.scss     design tokens (colours, type, spacing, motion)
  components/_gate    landing screen + boot sequence
  pages/_*.scss       one partial per section (theme, worlds, lab, mission,
                      makers, vote, countdown, live, outro)
assets/js/main.js     all behaviour (gate, cursor, smooth scroll, reveals,
                      panels, poll, countdown, live mode, slider)
```

Compile styles with `npm run build` (needs `npm install`) or directly:

```
sass scss/style.scss assets/css/style.css --style=expanded --no-source-map
```

## Editing the content

- **Event date / venue** — `EVENT_START` and friends at the top of `assets/js/main.js`;
  the countdown, live-mode switch and the "15 October 2026" copy in `index.html`.
- **Mission Control numbers** — the `data-count` values in the `#mission` section.
- **Future Lab categories, Future Makers, poll percentages, leaderboard** — plain
  HTML in their sections; each row/card carries its own `--accent` colour.
- **Registration link** — every `href="#register"` scrolls to the outro; the main
  CTA there is a `mailto:` you can point at a form instead.

## Handy URL flags

- `index.html?skip` — bypass the landing screen (deep links, QA).
- `index.html?live` — preview the event-day dashboard. It switches on automatically
  on 15 Oct 2026, and the "Preview live mode" button toggles it any time.

## Third-party

Bootstrap 5 (grid + Reboot), Bootstrap Icons, Swiper 10, Lenis 1.1.
Fonts: Syne, Manrope, JetBrains Mono via Google Fonts.

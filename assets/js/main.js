/* ═══════════════════════════════════════════════════════════════════════════
   STAI 2026 — Future World
   main.js — every interactive piece of the site, in one namespace.

   Boot order (see App.init at the bottom):
     cursor → reveal → gate → preloader → clocks → header/drawer → panels →
     lab → counters → makers → poll → countdown → live → outroField → returnTop
   The preloader holds the gate (title reveal + video) until it lifts;
   Lenis smooth scroll starts only once the gate has opened.
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Event constants — one place to change when the date or venue moves.
  const EVENT_START = new Date(2026, 9, 15, 9, 0, 0); // 15 Oct 2026, 09:00 local
  const EVENT_DAY_START = new Date(2026, 9, 15, 0, 0, 0);
  const EVENT_DAY_END = new Date(2026, 9, 16, 0, 0, 0);

  const App = {};
  let lenis = null;
  let navScrollUntil = 0; // header stays put while an anchor scroll is running

  /* ─── Custom cursor ──────────────────────────────────────────────────── */
  App.cursor = () => {
    if (!FINE_POINTER || REDUCED) return;
    const el = $(".cursor");
    if (!el) return;
    document.documentElement.classList.add("has-cursor");

    const dot = $(".cursor__dot", el);
    const ring = $(".cursor__ring", el);
    let x = -100, y = -100, rx = -100, ry = -100;

    window.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.setProperty("--x", `${x}px`);
      dot.style.setProperty("--y", `${y}px`);
      el.classList.remove("is-out");
    }, { passive: true });

    document.addEventListener("mouseleave", () => el.classList.add("is-out"));
    window.addEventListener("mousedown", () => el.classList.add("is-down"));
    window.addEventListener("mouseup", () => el.classList.remove("is-down"));

    // Hover growth for anything interactive
    const hoverSel = "a, button, [data-cursor], .panel, .opt";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverSel)) el.classList.add("is-hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverSel)) el.classList.remove("is-hover");
    });

    const tick = () => {
      rx = lerp(rx, x, 0.18);
      ry = lerp(ry, y, 0.18);
      ring.style.setProperty("--x", `${rx}px`);
      ring.style.setProperty("--y", `${ry}px`);
      requestAnimationFrame(tick);
    };
    tick();
  };

  /* ─── Gate: particles, magnetic button, boot sequence ────────────────── */
  App.gate = () => {
    const gate = $("#gate");
    const site = $("#site");
    const canvas = $("#gateCanvas");
    const video = $("#gateVideo");
    const enterBtn = $("#enterBtn");
    if (!gate || !site) return;

    // ── Landing video ──
    // Respect reduced motion: hold on the first frame instead of looping.
    if (video && REDUCED) {
      video.removeAttribute("autoplay");
      video.pause();
    }

    // ── Black hole ──
    // A lensed accretion disk, drawn on one canvas:
    //   · the horizon — a dark sphere sitting on the skyline
    //   · the band    — the disk seen edge-on: a blazing line across the sky
    //   · the ribbon  — the far side of the disk, bent over the top of the
    //                   sphere as a thick arc of streaming particles
    //   · stars, a faint reflection below the band, and cursor parallax
    // `pull` ramps up when the visitor presses Enter: everything streams
    // faster and flares before the iris collapses into the horizon.
    let raf = 0;
    let pull = 1;
    let pullTarget = 1;
    if (canvas && !REDUCED) {
      const ctx = canvas.getContext("2d");
      let W = 0, H = 0, R = 0, cx = 0, cy = 0, yBand = 0;
      let stars = [], ribbon = [], band = [], dust = [];
      let mx = 0, my = 0, tx = 0, ty = 0;
      let last = performance.now();
      let t = 0;
      const rand = (a, b) => a + Math.random() * (b - a);
      const TAU = Math.PI * 2;

      // Ribbon geometry: inner edge hugs the sphere, outer edge swells at the top
      const RX_I = 1.3, RY_I = 1.06;
      const RX_O = 1.78, RY_O = 1.95;
      const PHI0 = Math.PI - 0.88, PHI1 = TAU + 0.88; // from left foot, over the top, to right foot

      const ribbonPoint = (phi, k) => {
        // k: 0 = inner edge, 1 = outer edge. Density is biased inward.
        const rx = lerp(RX_I, RX_O, k) * R;
        const ry = lerp(RY_I, RY_O, k) * R;
        return [rx * Math.cos(phi), ry * Math.sin(phi), rx, ry];
      };

      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        R = H * 0.3;
        cx = W / 2;
        cy = H * 0.6;
        yBand = cy + R * 0.78;

        stars = Array.from({ length: clamp(Math.floor((W * H) / 5000), 100, 380) }, () => ({
          x: Math.random() * W, y: Math.random() * yBand,
          r: rand(0.2, 1.3), o: rand(0.1, 0.65), tw: rand(0, TAU), z: rand(0.2, 0.8),
        }));

        const nR = clamp(Math.floor((W * H) / 520), 1200, 3400);
        ribbon = Array.from({ length: nR }, () => ({
          phi: rand(PHI0, PHI1),
          k: Math.pow(Math.random(), 1.7),
          w: rand(0.16, 0.3),
          s: Math.random() < 0.08 ? rand(1.2, 1.8) : rand(0.5, 1),
          o: rand(0.35, 1),
          drift: rand(-0.02, 0.02),
        }));

        const nB = clamp(Math.floor(W / 2.2), 260, 800);
        band = Array.from({ length: nB }, () => ({
          x: Math.random() * W,
          dy: rand(-1, 1) * rand(0, 1) * 5,
          v: rand(60, 220) * (Math.random() < 0.5 ? -1 : 1),
          s: rand(0.5, 1.3),
          o: rand(0.3, 1),
        }));

        // loose dust escaping upward off the ribbon
        dust = Array.from({ length: clamp(Math.floor(W / 6), 60, 240) }, () => ({
          phi: rand(PHI0 + 0.3, PHI1 - 0.3), k: rand(1, 1.5), w: rand(0.05, 0.12),
          s: rand(0.3, 0.9), o: rand(0.1, 0.45), tw: rand(0, TAU),
        }));
      };

      const draw = (now) => {
        const dt = clamp((now - last) / 1000, 0, 0.05);
        last = now;
        t += dt;
        pull = lerp(pull, pullTarget, 0.03);
        mx = lerp(mx, tx, 0.05);
        my = lerp(my, ty, 0.05);
        const ox = mx * 24, oy = my * 12;
        const hx = cx + ox, hy = cy + oy;
        const yb = yBand + oy;
        const flare = 1 + (pull - 1) * 0.35;

        ctx.clearRect(0, 0, W, H);
        ctx.lineCap = "round";

        // 1. Stars
        for (const s of stars) {
          s.tw += dt * 1.3;
          ctx.beginPath();
          ctx.arc(s.x + ox * s.z * 0.5, s.y + oy * s.z * 0.5, s.r, 0, TAU);
          ctx.fillStyle = `rgba(205,222,255,${s.o * (0.55 + 0.45 * Math.sin(s.tw))})`;
          ctx.fill();
        }

        // 2. Ribbon bloom — soft glow under the particle stream
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 5; i++) {
          const k = 0.08 + i * 0.2;
          const rx = lerp(RX_I, RX_O, k) * R, ry = lerp(RY_I, RY_O, k) * R;
          ctx.beginPath();
          ctx.ellipse(hx, hy, rx, ry, 0, PHI0 + 0.08, PHI1 - 0.08);
          ctx.strokeStyle = i === 0
            ? `rgba(120,240,255,${0.22 * flare})`
            : `rgba(140,130,255,${(0.09 - i * 0.016) * flare})`;
          ctx.lineWidth = R * (0.14 + i * 0.11);
          ctx.stroke();
        }
        // the hot inner edge where the stream is densest
        ctx.beginPath();
        ctx.ellipse(hx, hy, RX_I * R, RY_I * R, 0, PHI0 + 0.05, PHI1 - 0.05);
        ctx.strokeStyle = `rgba(236,253,255,${0.28 * flare})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hx, hy, RX_I * R, RY_I * R, 0, PHI0 + 0.05, PHI1 - 0.05);
        ctx.strokeStyle = `rgba(94,242,255,${0.2 * flare})`;
        ctx.lineWidth = 16;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";

        // 3. Ribbon — thousands of fine streaks flowing along the arc
        ctx.globalCompositeOperation = "lighter";
        for (const p of ribbon) {
          const speed = p.w * pull * (1.35 - p.k * 0.7);
          p.phi += speed * dt;
          p.k = clamp(p.k + p.drift * dt, 0, 1);
          if (p.phi > PHI1) p.phi = PHI0 + (p.phi - PHI1);
          const [x, y, rx, ry] = ribbonPoint(p.phi, p.k);
          // tangent for the streak
          const txn = -rx * Math.sin(p.phi), tyn = ry * Math.cos(p.phi);
          const tl = Math.hypot(txn, tyn) || 1;
          const len = (10 + 24 * (1 - p.k)) * (0.6 + 0.4 * pull) * (H / 900);
          // feet fade into the band; inner edge is hottest
          const foot = clamp(Math.min(p.phi - PHI0, PHI1 - p.phi) / 0.5, 0, 1);
          const heat = 1 - p.k;
          const o = Math.min(1, p.o * (0.35 + 0.8 * heat) * (0.45 + 0.55 * foot) * flare);
          ctx.strokeStyle = heat > 0.8
            ? `rgba(236,253,255,${o})`
            : heat > 0.5
              ? `rgba(94,242,255,${o * 0.9})`
              : `rgba(157,123,255,${o * 0.7})`;
          ctx.lineWidth = p.s;
          ctx.beginPath();
          ctx.moveTo(hx + x - (txn / tl) * len, hy + y - (tyn / tl) * len);
          ctx.lineTo(hx + x, hy + y);
          ctx.stroke();
        }

        // loose dust drifting above the ribbon
        for (const d of dust) {
          d.phi += d.w * pull * dt;
          d.tw += dt;
          if (d.phi > PHI1 - 0.3) d.phi = PHI0 + 0.3;
          const rx = RX_O * d.k * R, ry = RY_O * d.k * R;
          ctx.beginPath();
          ctx.arc(hx + rx * Math.cos(d.phi), hy + ry * Math.sin(d.phi), d.s, 0, TAU);
          ctx.fillStyle = `rgba(190,215,255,${d.o * (0.5 + 0.5 * Math.sin(d.tw * 2))})`;
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        // 4. The horizon — dark sphere with a faint limb
        const sphere = ctx.createRadialGradient(hx, hy, R * 0.55, hx, hy, R * 1.02);
        sphere.addColorStop(0, "#010207");
        sphere.addColorStop(0.93, "#010207");
        sphere.addColorStop(0.985, "#0b1326");
        sphere.addColorStop(1, "rgba(94,242,255,0.35)");
        ctx.fillStyle = sphere;
        ctx.beginPath();
        ctx.arc(hx, hy, R * 1.02, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, hy, R, Math.PI + 0.2, TAU - 0.2);
        ctx.strokeStyle = `rgba(160,245,255,${0.35 * flare})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 5. The band — the disk edge-on, blazing across the skyline
        ctx.globalCompositeOperation = "lighter";
        const half = W * 0.62;
        // elliptical glow: a radial gradient stretched horizontally
        ctx.save();
        ctx.translate(hx, yb);
        ctx.scale(half / (R * 0.5), 1);
        const bandGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.5);
        bandGlow.addColorStop(0, `rgba(236,253,255,${0.85 * flare})`);
        bandGlow.addColorStop(0.06, `rgba(150,245,255,${0.5 * flare})`);
        bandGlow.addColorStop(0.2, `rgba(94,242,255,${0.16 * flare})`);
        bandGlow.addColorStop(0.55, `rgba(157,123,255,${0.06 * flare})`);
        bandGlow.addColorStop(1, "rgba(157,123,255,0)");
        ctx.fillStyle = bandGlow;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 0.5, R * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        // squash the glow vertically so it reads as a horizon, not a blob
        ctx.save();
        ctx.translate(hx, yb);
        ctx.scale(half / (R * 0.5), 0.34);
        ctx.fillStyle = bandGlow;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 0.5, R * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();

        // the hot core line
        const core = ctx.createLinearGradient(hx - half, 0, hx + half, 0);
        core.addColorStop(0, "rgba(236,253,255,0)");
        core.addColorStop(0.5, `rgba(255,255,255,${0.95 * Math.min(flare, 1.1)})`);
        core.addColorStop(1, "rgba(236,253,255,0)");
        ctx.strokeStyle = core;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(hx - half, yb);
        ctx.lineTo(hx + half, yb);
        ctx.stroke();

        // band particles racing along the line
        for (const b of band) {
          b.x += b.v * pull * dt;
          if (b.x < -20) b.x = W + 20;
          if (b.x > W + 20) b.x = -20;
          const dist = clamp(1 - Math.abs(b.x - hx) / half, 0, 1);
          const o = b.o * dist * dist;
          ctx.strokeStyle = Math.abs(b.dy) < 1.5 ? `rgba(255,255,255,${o})` : `rgba(94,242,255,${o * 0.8})`;
          ctx.lineWidth = b.s;
          ctx.beginPath();
          ctx.moveTo(b.x - b.v * 0.05 * pull, yb + b.dy);
          ctx.lineTo(b.x, yb + b.dy);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";

        // 6. Ground — everything below the band sinks into darkness, with a reflection
        const ground = ctx.createLinearGradient(0, yb, 0, H);
        ground.addColorStop(0, `rgba(94,242,255,${0.16 * flare})`);
        ground.addColorStop(0.1, "rgba(6,9,19,0.7)");
        ground.addColorStop(0.35, "rgba(4,6,14,0.98)");
        ground.addColorStop(1, "#04060e");
        ctx.fillStyle = ground;
        ctx.fillRect(0, yb + 1, W, H - yb);

        raf = requestAnimationFrame(draw);
      };

      size();
      raf = requestAnimationFrame(draw);
      window.addEventListener("resize", size);
      window.addEventListener("mousemove", (e) => {
        tx = e.clientX / window.innerWidth - 0.5;
        ty = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
    }

    // ── Magnetic enter button ──
    if (enterBtn && FINE_POINTER && !REDUCED) {
      window.addEventListener("mousemove", (e) => {
        const r = enterBtn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        const reach = 140;
        if (d < reach) {
          const f = (1 - d / reach) * 0.35;
          enterBtn.style.setProperty("--mx", `${dx * f}px`);
          enterBtn.style.setProperty("--my", `${dy * f}px`);
        } else {
          enterBtn.style.setProperty("--mx", "0px");
          enterBtn.style.setProperty("--my", "0px");
        }
      }, { passive: true });
    }

    // ── Boot sequence ──
    const boot = $("#boot");
    const log = $("#bootLog");
    const num = $("#bootNum");
    const bar = $("#bootBar");
    const status = $("#bootStatus");
    let started = false;

    const LINES = [
      ["Entering Future World", "…", 0],
      ["Calibrating six worlds", "OK", 560],
      ["Linking Future Lab", "OK", 1100],
      ["Syncing Mission Control", "OK", 1650],
      ["Loading 500+ future builders", "OK", 2200],
    ];

    const addLine = (text, tag) => {
      const row = document.createElement("div");
      row.innerHTML = `<span><span class="prompt">&gt;</span>${text}</span><b>${tag}</b>`;
      log.appendChild(row);
    };

    const finish = () => {
      gate.classList.add("is-opening");
      site.classList.add("is-live");
      document.body.classList.remove("is-gated");
      window.scrollTo(0, 0);
      App.startScroll();
      App.reveal.refresh();
      setTimeout(() => {
        gate.classList.add("is-done");
        cancelAnimationFrame(raf);
        video?.pause();
      }, 1500);
    };

    const run = () => {
      if (started) return;
      started = true;
      gate.classList.add("is-booting");
      pullTarget = 3.2;

      if (REDUCED) {
        // No theatrics — straight in.
        setTimeout(finish, 200);
        return;
      }

      const t0 = performance.now() + 350;
      LINES.forEach(([t, tag, at]) => setTimeout(() => addLine(t, tag), 350 + at));

      // Counter: ease to 96, hold, then snap to 100 — the "96%" beat from the brief.
      const D1 = 2600;
      const step = (now) => {
        const e = now - t0;
        if (e < 0) { requestAnimationFrame(step); return; }
        let p;
        if (e < D1) p = easeOut(e / D1) * 96;
        else if (e < D1 + 600) p = 96;
        else p = 100;
        num.textContent = String(Math.floor(p)).padStart(3, "0");
        bar.style.setProperty("--p", (p / 100).toFixed(3));
        if (p < 100) requestAnimationFrame(step);
        else {
          status.classList.add("is-on");
          setTimeout(finish, 1500);
        }
      };
      requestAnimationFrame(step);
    };

    enterBtn?.addEventListener("click", run);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !started) run();
    });

    // ?skip — jump straight to the site (handy for sharing deep links / QA).
    if (new URLSearchParams(location.search).has("skip")) {
      started = true;
      gate.classList.add("is-booting", "is-opening", "is-done");
      site.classList.add("is-live");
      document.body.classList.remove("is-gated");
      cancelAnimationFrame(raf);
      video?.pause();
      App.startScroll();
      App.reveal.refresh();
    }
  };

  /* ─── Preloader ──────────────────────────────────────────────────────── */
  // Counter rolls 000 → 100 over a filling bar while the page loads. The
  // overlay wipes up once `load` has fired AND the counter has landed (min
  // 2.4s) — or at 5s regardless, so a stalled asset never traps a visitor.
  // Lifting it drops `.is-held` from the gate, which releases the title's
  // blur reveal, and starts the landing video, so both play in view rather
  // than behind the overlay.
  App.preloader = () => {
    const overlay = $("#loader");
    const gate = $("#gate");
    const video = $("#gateVideo");
    const num = $("#loaderNum");
    const bar = $("#loaderBar");

    const release = () => {
      if (!gate || gate.classList.contains("is-done")) return; // ?skip
      gate.classList.remove("is-held");
      if (video && !REDUCED) video.play().catch(() => {});
    };

    if (!overlay) { release(); return; }

    const skip = new URLSearchParams(location.search).has("skip");
    const MIN_SHOW = REDUCED || skip ? 0 : 2400;
    const COUNT_D = 2000;
    const FONT_WAIT = 1000; // failsafe: don't hold the intro on a slow font CDN
    let start = performance.now();
    let done = false;
    let raf = 0;

    const setProgress = (p) => {
      if (num) num.textContent = String(Math.round(p * 100)).padStart(3, "0");
      if (bar) bar.style.setProperty("--p", p.toFixed(3));
    };

    const hide = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      setProgress(1);

      overlay.classList.add("is-hidden");
      release();

      // Drop it from the DOM (and the a11y tree) once the wipe has finished.
      let removed = false;
      const remove = () => {
        if (removed) return;
        removed = true;
        overlay.remove();
      };
      overlay.addEventListener("transitionend", remove, { once: true });
      setTimeout(remove, 1200); // failsafe if the transition never reports
    };

    // Counter + bar, eased so the last few percent linger before 100.
    // Starts once the display/mono fonts are in (see `ready` below) so the
    // wordmark and counter don't paint in the fallback font and jump when
    // the web font swaps in.
    const startCount = () => {
      if (REDUCED || skip) {
        setProgress(1);
        return;
      }
      const step = (now) => {
        const p = clamp((now - start) / COUNT_D, 0, 1);
        setProgress(easeOut(p));
        if (p < 1 && !done) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    let readied = false;
    const ready = () => {
      if (readied || done) return;
      readied = true;
      start = performance.now();
      overlay.classList.add("is-ready");
      startCount();
    };

    const fontsReady = document.fonts
      ? Promise.all([
          document.fonts.load('800 1em "Syne"'),
          document.fonts.load('600 1em "Syne"'),
          document.fonts.load('400 1em "JetBrains Mono"'),
        ])
      : Promise.resolve();
    fontsReady.then(ready, ready);
    setTimeout(ready, FONT_WAIT);

    const hideAfterMin = () => {
      const remaining = MIN_SHOW - (performance.now() - start);
      setTimeout(hide, Math.max(skip ? 0 : 300, remaining));
    };

    // Whichever comes first: the load event (past the minimum hold) or the failsafe.
    if (document.readyState === "complete") hideAfterMin();
    else window.addEventListener("load", hideAfterMin, { once: true });
    setTimeout(hide, 5000);
  };

  /* ─── Lenis smooth scroll + anchor handling ──────────────────────────── */
  App.startScroll = () => {
    if (lenis) return;
    if (window.Lenis && !REDUCED) {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  };

  // Programmatic scroll that respects Lenis when it's running.
  App.scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, opts);
    else if (typeof target === "number") window.scrollTo({ top: target, behavior: REDUCED ? "auto" : "smooth" });
    else target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
  };

  App.anchors = () => {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      App.drawer.close();
      navScrollUntil = performance.now() + 1800;
      App.scrollTo(target, { offset: id === "#top" ? 0 : -60, duration: 1.4 });
    });
  };

  /* ─── Header: scrolled state, hide-on-scroll, progress, active link ──── */
  App.header = () => {
    const header = $("#header");
    const progress = $("#scrollProgress");
    const links = $$(".nav__link");
    if (!header) return;
    let lastY = 0;

    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 40);
      const navScrolling = performance.now() < navScrollUntil;
      header.classList.toggle("is-hidden", !navScrolling && y > 400 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
      lastY = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress?.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Active section → nav link
    const map = new Map(links.map((l) => [l.getAttribute("href").slice(1), l]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.remove("is-active"));
        map.get(en.target.id)?.classList.add("is-active");
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    map.forEach((_, id) => { const s = $(`#${id}`); if (s) io.observe(s); });
  };

  /* ─── Mobile drawer ──────────────────────────────────────────────────── */
  App.drawer = {
    init() {
      this.el = $("#drawer");
      this.btn = $("#burger");
      if (!this.el || !this.btn) return;
      this.btn.addEventListener("click", () => (this.isOpen ? this.close() : this.open()));
      window.addEventListener("keydown", (e) => e.key === "Escape" && this.close());
    },
    open() {
      this.isOpen = true;
      this.el.classList.add("is-open");
      this.el.setAttribute("aria-hidden", "false");
      this.btn.setAttribute("aria-expanded", "true");
      lenis?.stop();
    },
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.el.classList.remove("is-open");
      this.el.setAttribute("aria-hidden", "true");
      this.btn.setAttribute("aria-expanded", "false");
      lenis?.start();
    },
  };

  /* ─── Reveal on scroll + split headlines ─────────────────────────────── */
  App.reveal = {
    init() {
      // Split each .line into word spans with a staggered delay
      $$("[data-split]").forEach((h) => {
        let i = 0;
        const wrap = (node) => {
          if (node.nodeType === 3) {
            const frag = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
              const w = document.createElement("span");
              w.className = "word";
              w.textContent = part;
              w.style.setProperty("--d", `${i++ * 55}ms`);
              frag.appendChild(w);
            });
            node.replaceWith(frag);
          } else if (node.nodeType === 1) {
            Array.from(node.childNodes).forEach(wrap);
          }
        };
        $$(".line", h).forEach((line) => Array.from(line.childNodes).forEach(wrap));
      });

      this.io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-revealed");
            this.io.unobserve(en.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

      this.targets = $$("[data-reveal], [data-split]");
    },
    // Called once the gate opens — nothing should animate under the gate.
    refresh() {
      this.targets.forEach((t) => this.io.observe(t));
    },
  };

  /* ─── Six worlds: expanding panels ───────────────────────────────────── */
  App.panels = () => {
    const panels = $$(".panel");
    if (!panels.length) return;
    const activate = (p) => {
      panels.forEach((x) => x.classList.toggle("is-active", x === p));
    };
    panels.forEach((p) => {
      p.addEventListener("mouseenter", () => activate(p));
      p.addEventListener("click", () => activate(p));
      p.addEventListener("focusin", () => activate(p));
    });
  };

  /* ─── Future Lab: cursor-following preview ───────────────────────────── */
  App.lab = () => {
    const preview = $("#labPreview");
    const list = $("#labList");
    if (!preview || !list || !FINE_POINTER) return;
    const icon = $(".lab__preview-icon i", preview);
    const text = $(".lab__preview-text", preview);

    list.addEventListener("mousemove", (e) => {
      preview.style.setProperty("--x", `${e.clientX}px`);
      preview.style.setProperty("--y", `${e.clientY}px`);
    }, { passive: true });

    $$(".lab__row", list).forEach((row) => {
      row.addEventListener("mouseenter", () => {
        preview.style.setProperty("--accent", getComputedStyle(row).getPropertyValue("--accent"));
        icon.className = $(".lab__icon i", row).className;
        text.textContent = row.dataset.preview || "";
        preview.classList.add("is-on");
      });
      row.addEventListener("mouseleave", () => preview.classList.remove("is-on"));
    });
  };

  /* ─── Count-up numbers ───────────────────────────────────────────────── */
  App.counters = () => {
    const els = $$("[data-count]");
    if (!els.length) return;
    const run = (el) => {
      const end = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const D = 1600;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / D, 0, 1);
        el.textContent = Math.round(easeOut(p) * end) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      if (REDUCED) { el.textContent = end + suffix; return; }
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        run(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  };

  /* ─── Live clocks (gate HUD + console) ───────────────────────────────── */
  App.clocks = () => {
    const els = [$("#gateClock"), $("#consoleClock")].filter(Boolean);
    if (!els.length) return;
    const tick = () => {
      const d = new Date();
      const s = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      els.forEach((el) => (el.textContent = s));
    };
    tick();
    setInterval(tick, 1000);
  };

  /* ─── Future Makers slider ───────────────────────────────────────────── */
  App.makers = () => {
    const el = $("#makersSwiper");
    if (!el || !window.Swiper) return;
    const idx = $("#makersIndex");
    const total = $("#makersTotal");
    const slides = $$(".swiper-slide", el).length;
    if (total) total.textContent = pad(slides);

    new window.Swiper(el, {
      slidesPerView: "auto",
      spaceBetween: 20,
      grabCursor: true,
      speed: 700,
      navigation: { nextEl: ".makers__next", prevEl: ".makers__prev" },
      keyboard: { enabled: true },
      on: {
        slideChange(s) { if (idx) idx.textContent = pad(s.activeIndex + 1); },
      },
    });
  };

  /* ─── Build the Future — orbital poll ────────────────────────────────── */
  App.poll = () => {
    const opts = $$(".opt");
    if (!opts.length) return;
    const core = $("#pollCore");
    const ring = $("#pollRing");
    const eyebrow = $("#pollEyebrow");
    const choice = $("#pollChoice");
    const pct = $("#pollPct b");
    const bars = $$(".signal__bars li");
    const CIRC = 339.3;
    const KEY = "stai26_vote";

    const choose = (opt, silent = false) => {
      opts.forEach((o) => o.classList.toggle("is-chosen", o === opt));
      const label = opt.dataset.label;
      const value = parseInt(opt.dataset.pct, 10);
      const accent = getComputedStyle(opt).getPropertyValue("--accent").trim();

      core.style.setProperty("--accent", accent);
      core.classList.add("is-set");
      eyebrow.textContent = "You chose";
      choice.textContent = label;
      ring.style.strokeDashoffset = CIRC - (CIRC * value) / 100;

      // Count the percentage up
      const from = parseInt(pct.textContent, 10) || 0;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 900, 0, 1);
        pct.textContent = Math.round(lerp(from, value, easeOut(p)));
        if (p < 1) requestAnimationFrame(step);
      };
      REDUCED ? (pct.textContent = value) : requestAnimationFrame(step);

      bars.forEach((b) => b.classList.toggle("is-mine", $("span", b).textContent === label));
      if (!silent) {
        try { localStorage.setItem(KEY, label); } catch (_) { /* private mode */ }
      }
    };

    opts.forEach((o) => o.addEventListener("click", () => choose(o)));

    // Remember a returning visitor's choice
    try {
      const saved = localStorage.getItem(KEY);
      const prev = opts.find((o) => o.dataset.label === saved);
      if (prev) choose(prev, true);
    } catch (_) { /* ignore */ }
  };

  /* ─── Countdown ──────────────────────────────────────────────────────── */
  App.countdown = () => {
    const units = {
      days: $("#cdDays span"),
      hours: $("#cdHours span"),
      minutes: $("#cdMin span"),
      seconds: $("#cdSec span"),
    };
    const note = $("#cdNote");
    if (!units.days) return;

    const set = (el, v) => {
      const s = pad(v);
      if (el.textContent === s) return;
      el.textContent = s;
      if (!REDUCED) {
        el.classList.remove("is-rolling");
        void el.offsetWidth; // restart the animation
        el.classList.add("is-rolling");
      }
    };

    const tick = () => {
      const diff = EVENT_START - new Date();
      if (diff <= 0) {
        Object.values(units).forEach((el) => set(el, 0));
        if (note) note.textContent = "The future is happening now.";
        return;
      }
      set(units.days, Math.floor(diff / 86400000));
      set(units.hours, Math.floor((diff % 86400000) / 3600000));
      set(units.minutes, Math.floor((diff % 3600000) / 60000));
      set(units.seconds, Math.floor((diff % 60000) / 1000));
    };
    tick();
    setInterval(tick, 1000);
  };

  /* ─── On the day: scheduled ↔ live dashboard ─────────────────────────── */
  App.live = () => {
    const dash = $("#dash");
    if (!dash) return;
    const title = $("#liveTitle");
    const body = $("#liveBody");
    const tagText = $("#liveTagText");
    const tag = $("#liveTag");
    const nowLabel = $("#nowLabel");
    const resultMain = $("#resultMain span");
    const resultSub = $("#resultSub");
    const boardNote = $("#boardNote");
    const toggle = $("#liveToggle");
    const cdNote = $("#cdNote");

    const now = new Date();
    const isEventDay = now >= EVENT_DAY_START && now < EVENT_DAY_END;
    const forced = new URLSearchParams(location.search).has("live");
    let live = isEventDay || forced;

    const render = () => {
      dash.classList.toggle("is-live", live);
      if (live) {
        title.innerHTML = 'The future is <span class="grad">happening now.</span>';
        body.textContent = "STAI 2026 is live. Announcements, results and the leaderboard are updating in real time below.";
        tagText.textContent = "STAI 2026 — Live";
        tag.querySelector(".pulse")?.classList.add("pulse--red");
        nowLabel.textContent = "Happening now";
        resultMain.textContent = "Team Nova — Robotics";
        resultSub.textContent = "Robotics Challenge · Final round";
        boardNote.textContent = "Updated moments ago · scores refresh live.";
        if (toggle) toggle.textContent = "Back to scheduled view";
        if (cdNote && EVENT_START - now <= 0) cdNote.textContent = "The future is happening now.";
      } else {
        title.innerHTML = 'Prepare <span class="grad">for the future.</span>';
        body.textContent = "Before STAI, this space holds the schedule. The moment the festival opens, it becomes a live dashboard — announcements, results and the leaderboard, updated in real time.";
        tagText.textContent = "STAI 2026 — Scheduled";
        tag.querySelector(".pulse")?.classList.remove("pulse--red");
        nowLabel.textContent = "First up";
        resultMain.textContent = "Opens on event day";
        resultSub.textContent = "Live results, team by team";
        boardNote.textContent = "Scores unlock when the festival opens.";
        if (toggle) toggle.textContent = "Preview live mode";
      }
    };

    toggle?.addEventListener("click", () => { live = !live; render(); });
    // Hide the preview toggle on the real day — there's nothing to preview.
    if (isEventDay && toggle) toggle.hidden = true;
    render();
  };

  /* ─── Outro star field ───────────────────────────────────────────────── */
  App.outroField = () => {
    const canvas = $("#outroCanvas");
    if (!canvas || REDUCED) return;
    const ctx = canvas.getContext("2d");
    let W, H, stars = [], raf = 0, running = false;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: clamp(Math.floor(W / 7), 60, 220) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2, v: Math.random() * 0.12 + 0.03,
        tw: Math.random() * 6.28, o: Math.random() * 0.5 + 0.15,
      }));
    };
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.y += s.v; s.tw += 0.015;
        if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.28);
        ctx.fillStyle = `rgba(200,225,255,${s.o * (0.6 + 0.4 * Math.sin(s.tw))})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    size();
    window.addEventListener("resize", size);
    new IntersectionObserver(([en]) => {
      running = en.isIntersecting;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    }).observe(canvas);
  };

  /* ─── Back to top ────────────────────────────────────────────────────── */
  App.returnTop = () => {
    const btn = $("#returnTop");
    if (!btn) return;
    window.addEventListener("scroll", () => {
      btn.classList.toggle("is-visible", window.scrollY > window.innerHeight);
    }, { passive: true });
    btn.addEventListener("click", () => {
      App.scrollTo(0, { duration: 1.6 });
    });
  };

  /* ─── Init ───────────────────────────────────────────────────────────── */
  App.init = () => {
    App.cursor();
    App.reveal.init();
    App.gate();
    App.preloader();
    App.clocks();
    App.header();
    App.drawer.init();
    App.anchors();
    App.panels();
    App.lab();
    App.counters();
    App.makers();
    App.poll();
    App.countdown();
    App.live();
    App.outroField();
    App.returnTop();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", App.init);
  else App.init();

  window.App = App;
})();

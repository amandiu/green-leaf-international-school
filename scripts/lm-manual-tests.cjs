/* TEMPORARY harness — Leadership Message manual test checklist (§33).
   Drives headless Chrome via the DevTools protocol. Removed after the run. */
const http = require("http");

const CDP_PORT = 9333;
const APP_URL = process.env.APP_URL || "http://localhost:5174/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

/* ── Minimal CDP client over Node's built-in WebSocket ── */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) c.listeners.forEach((fn) => fn(msg));
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

/* ── Console error collection ── */
const consoleErrors = [];
function trackConsole(msg) {
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    consoleErrors.push("EXCEPTION: " + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    consoleErrors.push("LOG: " + msg.params.entry.text + " @" + (msg.params.entry.url || ""));
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push("CONSOLE: " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
}

/* ── In-page measurement script ── */
const GEO = `(() => {
  const q  = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const cs = (el) => getComputedStyle(el);
  const r2 = (n) => Math.round(n * 100) / 100;
  const ring = q('.lm-ring');
  if (!ring) return { error: 'no .lm-ring found' };
  const ringRect = ring.getBoundingClientRect();
  const rows = qa('.lm-row').map((r) => r.getBoundingClientRect());
  const img = q('.lm-cell-image'); const msg = q('.lm-cell-message');
  const imgR = img.getBoundingClientRect(); const msgR = msg.getBoundingClientRect();
  const imgCS = cs(img); const msgCS = cs(msg);
  const p = q('.lm-portrait'); const pR = p.getBoundingClientRect();
  const im = q('.lm-portrait-img');
  const dv = q('.lm-light-divider-v'); const dh = q('.lm-light-divider-h');
  const oa = q('.lm-light-outer-a');
  return {
    viewport: { w: innerWidth, h: innerHeight },
    ring: { w: r2(ringRect.width), h: r2(ringRect.height) },
    rows: rows.map((r) => ({ w: r2(r.width), h: r2(r.height), dir: cs(q('.lm-row')).flexDirection })),
    imgCell: { w: r2(imgR.width), h: r2(imgR.height), pad: imgCS.padding, ratio: r2(imgR.width / rows[0].width) },
    msgCell: { w: r2(msgR.width), h: r2(msgR.height), pad: msgCS.padding, ratio: r2(msgR.width / rows[0].width) },
    portrait: { w: r2(pR.width), h: r2(pR.height) },
    imgTag: im ? { objectFit: cs(im).objectFit, objectPosition: cs(im).objectPosition, w: r2(im.getBoundingClientRect().width), h: r2(im.getBoundingClientRect().height) } : null,
    dividerV: dv ? { left: cs(dv).left, display: cs(dv).display } : null,
    dividerH: dh ? { top: cs(dh).top, display: cs(dh).display } : null,
    lmVars: { w: cs(ring).getPropertyValue('--lm-w').trim(), h: cs(ring).getPropertyValue('--lm-h').trim() },
    lights: qa('.lm-light').map((l) => {
      const s = cs(l);
      return { cls: l.className.replace('lm-light', '').trim(), display: s.display, anim: s.animationName, state: s.animationPlayState, transform: s.transform };
    }),
    outerA: oa ? cs(oa).transform : null,
    overflowX: { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth },
    hasRealImage: !!im
  };
})()`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function loadViewport(cdp, w, h, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await cdp.send("Page.navigate", { url: APP_URL });
  await sleep(2600);
  await cdp.send("Runtime.evaluate", { expression: `document.querySelector('#leadership-message').scrollIntoView({block:'center'})` });
  await sleep(1300); /* entrance transition (0.7s + stagger) completes */
}

(async () => {
  const targets = await httpGetJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const cdp = await CDP.connect(page.webSocketDebuggerUrl);
  cdp.on(trackConsole);
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");

  const T = (a, b, tol, label, detail) => check(label, Math.abs(a - b) <= tol, `${detail} (diff ${r2(Math.abs(a - b)) <= tol ? "≤" : ">"} ${tol})`);
  const r2 = (n) => Math.round(n * 100) / 100;

  /* ═══ TEST 1 — Desktop 1440px ═══ */
  {
    await loadViewport(cdp, 1440, 900, false);
    const g = (await cdp.send("Runtime.evaluate", { expression: GEO, returnByValue: true })).result.value;
    if (g.error) { check("T1 geometry", false, g.error); }
    else {
      console.log(`\n── TEST 1: Desktop 1440px ──\n` + JSON.stringify(g, null, 1));
      T(g.rows[0].h, 250, 0.6, "T1 row1 height = 250px", `got ${g.rows[0].h}px`);
      T(g.rows[1].h, 250, 0.6, "T1 row2 height = 250px", `got ${g.rows[1].h}px`);
      T(g.imgCell.ratio, 0.30, 0.005, "T1 image column = 30%", `got ${(g.imgCell.ratio * 100).toFixed(2)}%`);
      T(g.msgCell.ratio, 0.70, 0.005, "T1 message column = 70%", `got ${(g.msgCell.ratio * 100).toFixed(2)}%`);
      check("T1 image padding = 5px", g.imgCell.pad === "5px", `got ${g.imgCell.pad}`);
      check("T1 message padding = 10px", g.msgCell.pad === "10px", `got ${g.msgCell.pad}`);
      T(g.portrait.w, g.imgCell.w - 10, 1.2, "T1 image fills cell (5px inset)", `portrait ${g.portrait.w}px vs cell-10 = ${r2(g.imgCell.w - 10)}px`);
      T(g.portrait.h, g.rows[0].h - 10, 1.2, "T1 image fills 250px row (5px inset)", `portrait ${g.portrait.h}px vs row-10 = ${r2(g.rows[0].h - 10)}px`);
      check("T1 no horizontal overflow", g.overflowX.doc === 0 && g.overflowX.body === 0, JSON.stringify(g.overflowX));
      check("T1 --lm-w/--lm-h measured", /px$/.test(g.lmVars.w) && /px$/.test(g.lmVars.h), JSON.stringify(g.lmVars));

      /* TEST 9/10/11/23/24 — divider alignment + lights running */
      const ringW = g.ring.w;
      T(parseFloat(g.dividerV.left), ringW * 0.30, 1.6, "T23 vertical light at 30% boundary", `light ${g.dividerV.left} vs ${(ringW * 0.30).toFixed(1)}`);
      T(parseFloat(g.dividerH.top), 250, 1.6, "T24 horizontal light at 250px", `light ${g.dividerH.top}`);
      const allRunning = g.lights.every((l) => l.anim !== "none" && l.state === "running");
      check("T9-11 all 4 lights animated & running", allRunning, g.lights.map((l) => `${l.cls}:${l.anim}/${l.state}`).join(", "));

      /* TEST 9 (movement) — outer light actually travels */
      const t0 = g.outerA;
      await sleep(450);
      const t1 = (await cdp.send("Runtime.evaluate", { expression: `getComputedStyle(document.querySelector('.lm-light-outer-a')).transform`, returnByValue: true })).result.value;
      check("T9 outer light actually moves", t0 !== t1 && t0 !== "none", "transform changed over 450ms");

      /* TEST 12 — head/tail/streak geometry from CSS */
      const cssHead = (await cdp.send("Runtime.evaluate", { expression: `(() => { const s = getComputedStyle(document.querySelector('.lm-light-head')); return { w: s.width, radius: s.borderRadius }; })()`, returnByValue: true })).result.value;
      check("T12 round sun-like head", cssHead.w === "12px" && cssHead.radius === "50%", JSON.stringify(cssHead));
      const streak = (await cdp.send("Runtime.evaluate", { expression: `getComputedStyle(document.querySelector('.lm-light-tail')).width`, returnByValue: true })).result.value;
      T(parseFloat(streak), 64, 14, "T12 streak within 50-70px", `tail disc ${streak} (visible wedge ≈ 64px)`);

      /* TEST 21 — clipping / pointer-events */
      const pe = (await cdp.send("Runtime.evaluate", { expression: `getComputedStyle(document.querySelector('.lm-light')).pointerEvents`, returnByValue: true })).result.value;
      check("T21 lights pointer-events: none", pe === "none", `got ${pe}`);
    }
  }

  /* ═══ TEST 2 — Desktop 1920px (ratio holds) ═══ */
  {
    await loadViewport(cdp, 1920, 1080, false);
    const g = (await cdp.send("Runtime.evaluate", { expression: GEO, returnByValue: true })).result.value;
    if (g.error) { check("T2 geometry", false, g.error); }
    else {
      console.log(`\n── TEST 2: Desktop 1920px ──`);
      T(g.imgCell.ratio, 0.30, 0.005, "T2 image column = 30% @1920", `got ${(g.imgCell.ratio * 100).toFixed(2)}%`);
      T(g.msgCell.ratio, 0.70, 0.005, "T2 message column = 70% @1920", `got ${(g.msgCell.ratio * 100).toFixed(2)}%`);
      T(g.rows[0].h, 250, 0.6, "T2 rows still 250px @1920", `got ${g.rows[0].h}/${g.rows[1].h}px`);
      check("T2 no horizontal overflow", g.overflowX.doc === 0 && g.overflowX.body === 0, JSON.stringify(g.overflowX));
      const dvx = parseFloat(g.dividerV.left), exp = g.ring.w * 0.30;
      T(dvx, exp, 1.6, "T2 vertical light tracks 30% @1920", `light ${g.dividerV.left} vs ${exp.toFixed(1)}`);
    }
  }

  /* ═══ TEST 3 — Tablet 800px (2-col structure active) ═══ */
  {
    await loadViewport(cdp, 800, 1024, false);
    const g = (await cdp.send("Runtime.evaluate", { expression: GEO, returnByValue: true })).result.value;
    if (g.error) { check("T3 geometry", false, g.error); }
    else {
      console.log(`\n── TEST 3: Tablet 800px ──`);
      check("T3 2-col structure preserved", g.rows[0].dir === "row", `flex-direction ${g.rows[0].dir}`);
      T(g.imgCell.ratio, 0.30, 0.006, "T3 image column = 30%", `got ${(g.imgCell.ratio * 100).toFixed(2)}%`);
      T(g.rows[0].h, 250, 0.6, "T3 rows = 250px", `got ${g.rows[0].h}px`);
      check("T3 no horizontal overflow", g.overflowX.doc === 0 && g.overflowX.body === 0, JSON.stringify(g.overflowX));
    }
  }

  /* ═══ TEST 4/5/26 — Mobile 390px + 320px ═══ */
  for (const [w, h, label] of [[390, 844, "TEST 4: Mobile 390px"], [320, 568, "TEST 5: Mobile 320px"]]) {
    await loadViewport(cdp, w, h, true);
    const g = (await cdp.send("Runtime.evaluate", { expression: GEO, returnByValue: true })).result.value;
    if (g.error) { check(`${label} geometry`, false, g.error); continue; }
    console.log(`\n── ${label} ──`);
    check(`${label} rows stack vertically`, g.rows[0].dir === "column", `flex-direction ${g.rows[0].dir}`);
    check(`${label} divider lights hidden (no border to animate)`, g.dividerV.display === "none" && g.dividerH.display === "none", `v:${g.dividerV.display} h:${g.dividerH.display}`);
    check(`${label} outer lights still active`, g.lights.filter((l) => l.cls.startsWith("lm-light-outer")).every((l) => l.anim !== "none"), "outer-a/b animated");
    check(`${label} image cell 5px padding kept`, g.imgCell.pad === "5px", `got ${g.imgCell.pad}`);
    check(`${label} message 10px padding kept`, g.msgCell.pad === "10px", `got ${g.msgCell.pad}`);
    check(`${label} no horizontal overflow`, g.overflowX.doc === 0 && g.overflowX.body === 0, JSON.stringify(g.overflowX));
  }

  /* ═══ TEST 13 — Reduced motion ═══ */
  {
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await loadViewport(cdp, 1440, 900, false);
    const g = (await cdp.send("Runtime.evaluate", { expression: GEO, returnByValue: true })).result.value;
    console.log(`\n── TEST 13: Reduced motion ──`);
    check("T13 lights hidden under reduced motion", g.lights.every((l) => l.display === "none"), g.lights.map((l) => `${l.cls}:${l.display}`).join(", "));
    const ring = (await cdp.send("Runtime.evaluate", { expression: `(() => { const s = getComputedStyle(document.querySelector('.lm-ring')); return { opacity: s.opacity, border: s.borderTopWidth }; })()`, returnByValue: true })).result.value;
    check("T13 border structure intact, section visible", ring.opacity === "1" && ring.border !== "0px", JSON.stringify(ring));
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "" }] });
  }

  /* ═══ TEST 14 — Console errors ═══ */
  console.log(`\n── TEST 14: Browser console ──`);
  if (consoleErrors.length === 0) {
    check("T14 no console errors", true, "clean across all viewports");
  } else {
    console.log("Collected console errors:");
    consoleErrors.forEach((e) => console.log("  " + e.slice(0, 300)));
    check("T14 no console errors", false, `${consoleErrors.length} collected (see above)`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n════ SUMMARY: ${results.length - failed.length}/${results.length} checks passed ════`);
  cdp.close();
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR:", e.message); process.exit(1); });

/* Builds the generated SVG parts of the deck and runs the slide animations. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (/[?&]still\b/.test(location.search)) document.documentElement.classList.add("still");

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }
  function txt(parent, str, attrs) {
    const t = el("text", attrs, parent);
    t.textContent = str;
    return t;
  }
  const $ = (sel) => document.querySelector(sel);
  const f = (x) => x.toFixed(1);
  const isPresent = (id) => document.getElementById(id)?.classList.contains("present");

  // small seeded generator, so the generated pictures look the same every time
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rand) {
    return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  }

  // wavy line (photon / W) along a curve fn(t) -> [x, y]
  function wavy(fn, waves, amp, n = 200) {
    let d = "";
    for (let i = 0; i <= n; i++) {
      const t = i / n, e = 1e-3;
      const [x, y] = fn(t);
      const [x2, y2] = fn(Math.min(1, t + e));
      const [x1, y1] = fn(Math.max(0, t - e));
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const o = amp * Math.sin(2 * Math.PI * waves * t);
      d += (i ? "L" : "M") + f(x + nx * o) + " " + f(y + ny * o);
    }
    return d;
  }
  const line = (x1, y1, x2, y2) => (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];

  // curly gluon line between two points
  function coil(x1, y1, x2, y2, r = 8, n = 150) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const loops = Math.max(4, Math.round(L / (2.1 * r)));
    let d = "";
    for (let i = 0; i <= n; i++) {
      const s = i / n, th = 2 * Math.PI * loops * s;
      const along = s * L + r - r * Math.cos(th);
      const side = r * Math.sin(th);
      d += (i ? "L" : "M") + f(x1 + ux * along - uy * side) + " " + f(y1 + uy * along + ux * side);
    }
    return d;
  }

  /* ---------------- hadrons: quarks on gluon springs ---------------- */
  const CHARGE = ["var(--magenta)", "var(--aqua)", "var(--cyan)"];
  const PAIRS = [[0, 1], [1, 2], [2, 0]];
  const hadrons = [];
  // flavours: "~u" is an antiquark (drawn with a bar); positions: optional [dx, dy] per quark
  function makeHadron(g, cx, cy, R, flavours, { spread = 58, qr = 27, amp = 9, colours = CHARGE, pairs = PAIRS, positions = null } = {}) {
    if (!g) return;
    el("circle", { cx, cy, r: R, class: "hadron" }, g);
    const springs = pairs.map(() => el("path", { class: "gluon" }, g));
    const quarks = flavours.map((fl, i) => {
      const a = (-90 + 120 * i) * Math.PI / 180;
      const grp = el("g", {}, g);
      const dot = el("circle", { r: qr, class: "quark-dot", style: `fill:${colours[i]}` }, grp);
      const anti = fl.startsWith("~");
      const label = txt(grp, anti ? fl.slice(1) : fl, { class: "quark-txt", "text-anchor": "middle", dy: f(qr * 0.3), style: `font-size:${f(qr * 0.9)}px` });
      // the antiquark bar is drawn by hand, close above the letter (a text overline floats too high)
      if (anti) el("line", { x1: f(-qr * 0.3), x2: f(qr * 0.3), y1: f(-qr * 0.27), y2: f(-qr * 0.27), stroke: "var(--bg)", "stroke-width": f(Math.max(2, qr * 0.07)), "stroke-linecap": "round" }, grp);
      const base = positions ? [cx + positions[i][0], cy + positions[i][1]] : [cx + spread * Math.cos(a), cy + spread * Math.sin(a)];
      return { grp, dot, base, colour: i, ph: [0, 1, 2, 3].map(() => Math.random() * 6.28), pos: [0, 0] };
    });
    const h = { section: g.closest("section"), quarks, springs, amp, coilR: qr * 0.3, pairs, colours };
    hadrons.push(h);
    drawHadron(h, 0);
  }
  function drawHadron(h, t) {
    const a = reduce ? 0 : h.amp;
    for (const q of h.quarks) {
      q.pos = [q.base[0] + a * (Math.sin(t * 1.3 + q.ph[0]) + 0.45 * Math.sin(t * 2.9 + q.ph[1])),
               q.base[1] + a * (Math.cos(t * 1.1 + q.ph[2]) + 0.45 * Math.sin(t * 2.3 + q.ph[3]))];
      q.grp.setAttribute("transform", `translate(${f(q.pos[0])} ${f(q.pos[1])})`);
    }
    h.pairs.forEach(([i, j], k) => {
      const p = h.quarks[i].pos, r = h.quarks[j].pos;
      h.springs[k].setAttribute("d", coil(p[0], p[1], r[0], r[1], h.coilR));
    });
  }
  function swapColour() {
    const live = hadrons.filter((h) => h.section?.classList.contains("present"));
    if (reduce || !live.length) return;
    const h = live[Math.floor(Math.random() * live.length)];
    const k = Math.floor(Math.random() * h.pairs.length), [i, j] = h.pairs[k];
    const qa = h.quarks[i], qb = h.quarks[j];
    [qa.colour, qb.colour] = [qb.colour, qa.colour];
    qa.dot.style.fill = h.colours[qa.colour];
    qb.dot.style.fill = h.colours[qb.colour];
    h.springs[k].classList.add("flash");
    setTimeout(() => h.springs[k].classList.remove("flash"), 450);
  }

  // a nucleus as a cluster of protons and neutrons, drawn back to front
  const NUCLEONS = [[0, -104], [-60, -52], [0, -52], [60, -52], [-90, 0], [-30, 0], [30, 0], [90, 0],
                    [-60, 52], [0, 52], [60, 52], [0, 104]];
  function nucleus(g, cx, cy, scale, r) {
    NUCLEONS.forEach(([x, y], i) => {
      el("circle", { cx: f(cx + x * scale), cy: f(cy + y * scale), r, fill: i % 2 ? "url(#n-g)" : "url(#p-g)", class: "nucleon" }, g);
    });
  }

  /* ---------------- title: continuous event display, one rare decay after the other ---------------- */
  // labels are [letter, subscript, superscript]
  const EV_DECAYS = [
    { parent: ["B", "", ""], had: ["K", "", ""], leps: [["μ", "", "+"], ["μ", "", "−"]] },
    { parent: ["B", "", ""], had: ["K*", "", ""], leps: [["e", "", "+"], ["e", "", "−"]] },
    { parent: ["Λ", "b", ""], had: ["Λ", "", ""], leps: [["μ", "", "+"], ["μ", "", "−"]] },
    { parent: ["B", "s", ""], had: ["φ", "", ""], leps: [["μ", "", "+"], ["μ", "", "−"]] },
  ];
  const EV_PV = [320, 380], EV_R = 292;
  let evCount = 0;

  function evLabel(parent, parts, x, y, color, anchor, delay) {
    const t = el("text", { x: f(x), y: f(y), class: "ev-label fadein", "text-anchor": anchor, style: `--d:${delay}s;fill:var(${color})` }, parent);
    t.appendChild(document.createTextNode(parts[0]));
    if (parts[1]) el("tspan", { dy: "0.07em", "font-size": "72%" }, t).textContent = parts[1];   // small drop: the default subscript sits too low
    if (parts[2]) el("tspan", { "baseline-shift": "super", "font-size": "70%" }, t).textContent = parts[2];
  }
  // a gently curved track from o; it is shortened until it ends inside the picture
  function evTrack(o, ang, len, bend, cls, delay, dur, parent) {
    let e, c;
    for (let k = 0; k < 40; k++) {
      c = [o[0] + (len / 2) * Math.cos(ang), o[1] + (len / 2) * Math.sin(ang)];
      e = [o[0] + len * Math.cos(ang + bend), o[1] + len * Math.sin(ang + bend)];
      if (Math.hypot(e[0] - EV_PV[0], e[1] - EV_PV[1]) <= EV_R && e[0] > 76 && e[0] < 584 && e[1] > 30 && e[1] < 690) break;
      len *= 0.94;
    }
    el("path", { d: `M${f(o[0])} ${f(o[1])} Q${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`,
                 class: `${cls} drawon`, pathLength: 1, style: `--d:${delay}s;--dur:${dur}s` }, parent);
    return e;
  }
  function buildEventFrame() {
    const prompt = $("#ev-prompt"), sig = $("#ev-signal");
    if (!prompt) return;
    prompt.replaceChildren();
    sig.replaceChildren();
    const rnd = Math.random;
    for (let i = 0; i < 34; i++) {
      evTrack(EV_PV, rnd() * 2 * Math.PI, 110 + rnd() * 200, (rnd() - 0.5) * 1.2, "trk", (rnd() * 0.6).toFixed(2), 0.8, prompt);
    }
    el("circle", { cx: EV_PV[0], cy: EV_PV[1], r: 5, class: "pv" }, prompt);

    const d = EV_DECAYS[evCount++ % EV_DECAYS.length];
    const th = rnd() * 2 * Math.PI, dist = 70 + rnd() * 50, s = rnd() < 0.5 ? -1 : 1;
    const SV = [EV_PV[0] + dist * Math.cos(th), EV_PV[1] + dist * Math.sin(th)];
    const legs = [
      [d.had, th + s * (0.3 + rnd() * 0.3), "trk-k", "--aqua", 190 + rnd() * 70],
      [d.leps[0], th - s * (0.55 + rnd() * 0.35), "trk-mu", "--cyan", 230 + rnd() * 90],
      [d.leps[1], th - s * (1.55 + rnd() * 0.6), "trk-mu", "--cyan", 230 + rnd() * 90],
    ];
    legs.forEach(([lab, ang, cls, colour, len]) => {
      const e = evTrack(SV, ang, len, (rnd() - 0.5) * 0.7, cls, 1.3, 0.9, sig);
      const dx = e[0] - SV[0], dy = e[1] - SV[1], n = Math.hypot(dx, dy) || 1;
      evLabel(sig, lab, e[0] + 16 * dx / n, e[1] + 16 * dy / n + 7, colour, dx < 0 ? "end" : "start", 2.1);
    });
    // the b-hadron's flight line and the decay vertex go last, so they sit on top of the daughter tracks
    el("path", { d: `M${f(EV_PV[0])} ${f(EV_PV[1])} L${f(SV[0])} ${f(SV[1])}`, class: "trk-b drawon", pathLength: 1, style: "--d:0.7s;--dur:0.5s" }, sig);
    el("circle", { cx: f(SV[0]), cy: f(SV[1]), r: 5, class: "sv fadein", style: "--d:1.2s" }, sig);
    // parent label beside the short flight line, on the side away from the daughters
    const nx = -Math.sin(th) * -s, ny = Math.cos(th) * -s;
    evLabel(sig, d.parent, (EV_PV[0] + SV[0]) / 2 + 24 * nx, (EV_PV[1] + SV[1]) / 2 + 24 * ny + 7, "--magenta", "middle", 2.1);
  }
  function buildEvent() {
    const svg = $("#event");
    if (!svg) return;
    const rings = svg.querySelector("#ev-rings");
    [70, 140, 220].forEach((r) => el("circle", { cx: EV_PV[0], cy: EV_PV[1], r, class: "ring" }, rings));
    el("circle", { cx: EV_PV[0], cy: EV_PV[1], r: 292, class: "ring outer" }, rings);
    buildEventFrame();
    if (reduce) return;
    setInterval(() => {
      if (!isPresent("s-title")) return;
      svg.classList.add("ev-out");
      setTimeout(() => { buildEventFrame(); svg.classList.remove("ev-out"); }, 650);
    }, 5400);
  }

  /* ---------------- what everything is made of: the zoom ---------------- */
  const LADDER = [["apple", "−1"], ["atom", "−10"], ["nucleus", "−14"], ["proton", "−15"], ["quark", "−18"]];
  const FACTORS = [["×10", "9"], ["×10", "4"], ["×10", ""], ["> ×10", "3"]];
  // text with a real superscript (the Unicode exponents look uneven in Jost)
  function power(parent, attrs, pre, exp, post = "") {
    const t = el("text", attrs, parent);
    t.appendChild(document.createTextNode(pre));
    if (exp) el("tspan", { "baseline-shift": "super", "font-size": "70%" }, t).textContent = exp;
    if (post) t.appendChild(document.createTextNode(post));
    return t;
  }
  // orbiting electrons on circles around (cx, cy); shells = [[radius, [start angles], period s, reverse]]
  function electrons(g, cx, cy, shells, r = 7) {
    shells.forEach(([rad, angles, period, rev]) => {
      const o = el("g", { class: "orbit", style: `transform-origin:${cx}px ${cy}px;--t:${period}s;${rev ? "animation-direction:reverse" : ""}` }, g);
      angles.forEach((a) => {
        const inner = el("g", { transform: `rotate(${a} ${cx} ${cy})` }, o);
        el("circle", { cx: cx + rad, cy, r, class: "electron" }, inner);
      });
    });
  }
  const CARBON_SHELLS = (inner, outer) => [[inner, [0, 180], 5, false], [outer, [45, 135, 225, 315], 9, true]];
  function buildZoom() {
    const nuc = $("#zoom-nucleus");
    if (!nuc) return;
    electrons($("#zoom-electrons"), 300, 215, CARBON_SHELLS(75, 140), 5);
    nucleus(nuc, 300, 190, 1, 33);
    el("circle", { cx: 240, cy: 352, r: 9, fill: "url(#p-g)" }, nuc);
    txt(nuc, "6 protons", { x: 258, y: 360, class: "z-note" });
    el("circle", { cx: 240, cy: 386, r: 9, fill: "url(#n-g)" }, nuc);
    txt(nuc, "6 neutrons", { x: 258, y: 394, class: "z-note" });
    const pr = $("#zoom-proton");
    makeHadron(pr, 300, 205, 150, ["u", "u", "d"], { spread: 72, qr: 34, amp: 11 });
    txt(pr, "proton: up + up + down", { x: 300, y: 330, class: "z-note", "text-anchor": "middle" });

    const lad = $("#zoom-ladder");
    el("path", { d: "M60 458 H540", class: "ladder-line" }, lad);
    LADDER.forEach(([name, exp], i) => {
      const x = 60 + 120 * i, g = el("g", { class: "stop" }, lad);
      el("circle", { cx: x, cy: 458, r: 7 }, g);
      txt(g, name, { x, y: 492, "text-anchor": "middle", class: "stop-name" });
      power(g, { x, y: 522, "text-anchor": "middle", class: "stop-size" }, (name === "quark" ? "< " : "") + "10", exp, " m");
      if (i < 4) power(lad, { x: x + 60, y: 446, "text-anchor": "middle", class: "stop-factor" }, FACTORS[i][0], FACTORS[i][1]);
    });
    zoomHook(0);
  }
  function zoomHook(stage) {
    const z = Math.min(stage, 4);
    document.querySelectorAll("#zoom .zobj").forEach((g) => {
      const k = +g.dataset.z;
      g.classList.toggle("past", k < z);
      g.classList.toggle("now", k === z);
      g.classList.toggle("next", k > z);
    });
    document.querySelectorAll("#zoom-ladder .stop").forEach((g, i) => {
      g.classList.toggle("now", i === z);
      g.classList.toggle("seen", i < z);
    });
  }

  /* ---------------- everyday matter: carbon atom and periodic table ---------------- */
  const ELEMENTS = ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
    "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re " +
    "Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh " +
    "Fl Mc Lv Ts Og").split(" ");
  const LIFE = new Set(["H", "C", "N", "O", "P", "S"]);
  function placeElement(Z) {   // [row, column] of the standard 18-column table; rows 8 and 9 are the f-block
    if (Z === 1) return [1, 1];
    if (Z === 2) return [1, 18];
    if (Z <= 4) return [2, Z - 2];
    if (Z <= 10) return [2, Z + 8];
    if (Z <= 12) return [3, Z - 10];
    if (Z <= 18) return [3, Z];
    if (Z <= 36) return [4, Z - 18];
    if (Z <= 54) return [5, Z - 36];
    if (Z <= 56) return [6, Z - 54];
    if (Z <= 71) return [8, Z - 54];
    if (Z <= 86) return [6, Z - 68];
    if (Z <= 88) return [7, Z - 86];
    if (Z <= 103) return [9, Z - 86];
    return [7, Z - 100];
  }
  function buildMatter() {
    const nuc = $("#carbon-nucleus");
    if (!nuc) return;
    nucleus(nuc, 300, 235, 0.42, 14);
    electrons($("#carbon-electrons"), 300, 235, CARBON_SHELLS(95, 175));
    const pt = $("#ptable");
    ELEMENTS.forEach((sym, i) => {
      const [row, col] = placeElement(i + 1);
      const x = 12 + (col - 1) * 32, y = 92 + (row - 1) * 32 + (row > 7 ? 12 : 0);
      const g = el("g", { class: "pt-cell" + (LIFE.has(sym) ? " life" : ""), style: `--d:${((col + row) * 0.025).toFixed(3)}s` }, pt);
      el("rect", { x, y, width: 30, height: 30, rx: 3 }, g);
      txt(g, sym, { x: x + 15, y: y + 20, "text-anchor": "middle" });
    });
  }

  /* ---------------- flavour: three generations and the CKM matrix ---------------- */
  function buildGens() {
    const grid = $("#gen-grid");
    if (!grid) return;
    const X = [150, 310, 474], Y = [80, 150, 220, 290];
    ["I", "II", "III"].forEach((g, i) => txt(grid, g, { x: X[i], y: 34, "text-anchor": "middle", class: "gen-head" }));
    txt(grid, "quarks", { x: 24, y: 115, "text-anchor": "middle", class: "row-label", transform: "rotate(-90 24 115)" });
    txt(grid, "leptons", { x: 24, y: 255, "text-anchor": "middle", class: "row-label", transform: "rotate(-90 24 255)" });
    ["+⅔", "−⅓", "−1", "0"].forEach((q, j) => txt(grid, q, { x: 74, y: Y[j] + 8, "text-anchor": "middle", class: "row-charge-l" }));
    const rows = [
      [["u", 2.2, "2.2 MeV"], ["c", 1270, "1.27 GeV"], ["t", 173000, "173 GeV"]],
      [["d", 4.7, "4.7 MeV"], ["s", 93, "93 MeV"], ["b", 4180, "4.18 GeV"]],
      [["e", 0.511, "0.511 MeV"], ["μ", 105.7, "106 MeV"], ["τ", 1777, "1.78 GeV"]],
      [["νe", 0, "< 1 eV"], ["νμ", 0, "< 1 eV"], ["ντ", 0, "< 1 eV"]],
    ];
    rows.forEach((row, j) => row.forEach(([sym, m, label], i) => {
      const r = m > 0 ? Math.max(4, 7 + 5 * Math.log10(m)) : 4;
      const kind = j < 2 ? (sym === "b" ? "k-beauty" : "k-quark") : "k-lepton";
      el("circle", { cx: X[i], cy: Y[j], r: f(r), class: `gen-dot ${kind}` }, grid);
      const inside = r >= 14;
      const t = txt(grid, sym[0], { x: inside ? X[i] : X[i] - r - 6, y: Y[j] + (inside ? 8 : 7),
                                    "text-anchor": inside ? "middle" : "end", class: `gen-sym ${inside ? "in" : "out"}` });
      if (sym.length > 1) el("tspan", { "baseline-shift": "sub", "font-size": "17" }, t).textContent = sym.slice(1);
      txt(grid, label, { x: X[i] + r + 7, y: Y[j] + 8, class: "gen-mass" });
    }));

    const dec = $("#gen-decay");
    [[474, 310], [310, 150]].forEach(([a, b]) => {
      el("path", { d: `M${a - 10} 358 Q${(a + b) / 2} 384 ${b + 10} 358`, class: "decay-arrow", "marker-end": "url(#arrow-head)" }, dec);
    });

    const ckm = $("#ckm");
    const ct = txt(ckm, "W", { x: 20, y: 436, class: "ckm-title", style: "font-style:italic" });
    el("tspan", { style: "font-style:normal" }, ct).textContent = " transitions";
    txt(ckm, "(CKM matrix)", { x: 20, y: 468, class: "svg-caption small" });
    const V = [[0.974, 0.225, 0.0037], [0.221, 0.975, 0.041], [0.0086, 0.040, 0.999]];
    const lab = [["0.97", "0.22", "0.004"], ["0.22", "0.97", "0.04"], ["0.009", "0.04", "1.00"]];
    const CX = [290, 380, 470], CY = [450, 488, 526];
    ["d", "s", "b"].forEach((q, i) => txt(ckm, q, { x: CX[i], y: 420, "text-anchor": "middle", class: "ckm-head" + (q === "b" ? " b" : "") }));
    ["u", "c", "t"].forEach((q, j) => txt(ckm, q, { x: 244, y: CY[j] + 6, "text-anchor": "middle", class: "ckm-head" }));
    V.forEach((row, j) => row.forEach((v, i) => {
      el("circle", { cx: CX[i] - 14, cy: CY[j], r: f(Math.max(1.5, 16 * Math.sqrt(v))), class: "ckm-dot" + (i === 2 ? " b" : "") }, ckm);
      txt(ckm, lab[j][i], { x: CX[i] + 6, y: CY[j] + 5, class: "ckm-val" });
    }));
  }

  /* ---------------- the Standard Model table and its mass axis ---------------- */
  const AX = { x0: 40, y: 300, per: 40.4 };             // log axis: 10^-1 eV at x0, 41.5 px per decade
  const xMass = (eV) => AX.x0 + (Math.log10(eV) + 1) * AX.per;
  const ROWY = [262, 228, 194, 160];
  const SM = [
    // symbol, name, kind, table x, y, mass [eV] (0: massless, -1: neutrino), row on the axis
    ["u", "up", "quark", 80, 90, 2.2e6, 1], ["c", "charm", "quark", 165, 90, 1.27e9, 0], ["t", "top", "quark", 250, 90, 1.73e11, 3],
    ["d", "down", "quark", 80, 175, 4.7e6, 2], ["s", "strange", "quark", 165, 175, 9.3e7, 0], ["b", "beauty", "beauty", 250, 175, 4.18e9, 2],
    ["e", "electron", "lepton", 80, 260, 5.11e5, 0], ["μ", "muon", "lepton", 165, 260, 1.057e8, 1], ["τ", "tau", "lepton", 250, 260, 1.777e9, 1],
    ["νe", "νe", "lepton", 80, 345, -1, 0], ["νμ", "νμ", "lepton", 165, 345, -1, 1], ["ντ", "ντ", "lepton", 250, 345, -1, 2],
    ["g", "gluon", "boson", 360, 90, 0, 0], ["γ", "photon", "boson", 360, 175, 0, 1], ["Z", "Z⁰", "boson", 360, 260, 9.12e10, 1],
    ["W", "W±", "boson", 360, 345, 8.04e10, 0], ["H", "Higgs", "higgs", 470, 217, 1.25e11, 2],
  ];
  const smParts = [];
  function chipSymbol(g, sym, attrs, overline = false) {
    const t = txt(g, sym[0], attrs);
    if (overline) t.setAttribute("text-decoration", "overline");
    if (sym.length > 1) el("tspan", { "baseline-shift": "sub", "font-size": "15" }, t).textContent = sym.slice(1);
    return t;
  }
  function axisPos(m, row, idx) {
    if (m === 0) return [70 + 40 * idx, 110];             // massless: parked top left
    if (m === -1) return [58, ROWY[row]];                 // neutrinos: below 1 eV, stacked
    return [xMass(m), ROWY[row]];
  }
  function buildSM() {
    const parts = $("#sm-parts");
    if (!parts) return;
    const heads = $("#sm-heads");
    ["I", "II", "III"].forEach((g, i) => txt(heads, g, { x: 80 + 85 * i, y: 40, "text-anchor": "middle", class: "gen-head" }));
    txt(heads, "forces", { x: 360, y: 40, "text-anchor": "middle", class: "gen-head small" });
    txt(heads, "quarks", { x: 38, y: 132, "text-anchor": "middle", class: "row-label", transform: "rotate(-90 38 132)" });
    txt(heads, "leptons", { x: 38, y: 302, "text-anchor": "middle", class: "row-label", transform: "rotate(-90 38 302)" });

    let massless = 0;
    SM.forEach(([sym, name, kind, tx, ty, m, row]) => {
      const cls = "";
      const g = el("g", { class: `sm-part k-${kind}${cls}` }, parts);
      el("circle", { r: 30, class: "sm-chip" }, g);
      chipSymbol(g, sym, { "text-anchor": "middle", dy: 9, class: "sm-sym" });
      const pn = txt(g, name[0] === "ν" ? "ν" : name, { y: 49, "text-anchor": "middle", class: "pname" + (/^[νWZ]/.test(name) ? " form" : "") });
      if (name[0] === "ν") el("tspan", { "baseline-shift": "sub", "font-size": "16" }, pn).textContent = name.slice(1);
      const ap = axisPos(m, row, m === 0 ? massless++ : 0);
      smParts.push({ g, table: [tx, ty], axis: ap });
    });

    const ax = $("#sm-axis");
    el("path", { d: `M${AX.x0} ${AX.y} H580`, class: "axis-line" }, ax);
    for (let k = -1; k <= 12; k++) el("path", { d: `M${f(xMass(10 ** k))} ${AX.y - 4} v8`, class: "axis-line" }, ax);
    [["eV", 0], ["keV", 3], ["MeV", 6], ["GeV", 9], ["TeV", 12]].forEach(([u, k]) => {
      el("path", { d: `M${f(xMass(10 ** k))} ${AX.y - 8} v16`, class: "axis-line" }, ax);
      txt(ax, "1 " + u, { x: f(xMass(10 ** k)), y: AX.y + 26, "text-anchor": "middle", class: "axis-tick" });
    });
    txt(ax, "massless", { x: 90, y: 76, "text-anchor": "middle", class: "svg-caption small" });
    txt(ax, "< 1 eV", { x: 58, y: 172, "text-anchor": "middle", class: "svg-caption small" });
    const xe = xMass(5.11e5), xt = xMass(1.73e11);
    el("path", { d: `M${f(xe)} 132 v-10 H${f(xt)} v10`, class: "bracket" }, ax);
    txt(ax, "top ≈ 340 000 × electron", { x: f((xe + xt) / 2), y: 110, "text-anchor": "middle", class: "bracket-label" });

    const anti = $("#sm-anti");
    SM.slice(0, 12).forEach(([sym, , kind, , , m, row]) => {
      const [x] = axisPos(m, row, 0);
      const y = 360 + 34 * row;
      const g = el("g", { class: `sm-part k-${kind} anti`, transform: `translate(${f(x)} ${y}) scale(0.5)` }, anti);
      el("circle", { r: 30, class: "sm-chip" }, g);
      chipSymbol(g, sym, { "text-anchor": "middle", dy: 9, class: "sm-sym" }, true);
    });
    txt(anti, "antiparticles: same mass, opposite charge", { x: 300, y: 492, "text-anchor": "middle", class: "fig-tag c-anti" });
    smHook(0);
  }
  function smHook(stage) {
    const axis = stage >= 3;
    for (const p of smParts) {
      const [x, y] = axis ? p.axis : p.table;
      p.g.style.transform = `translate(${f(x)}px, ${f(y)}px) scale(${axis ? 0.5 : 1})`;
    }
  }

  /* ---------------- SM success: timeline and diphoton spectrum ---------------- */
  function buildSuccess() {
    const tl = $("#timeline");
    if (!tl) return;
    const xy = (yr) => 130 + (yr - 1960) * (420 / 55);
    [1960, 1980, 2000].forEach((yr) => {
      el("path", { d: `M${f(xy(yr))} 28 V124`, class: "grid-line" }, tl);
      txt(tl, String(yr), { x: f(xy(yr)), y: 144, "text-anchor": "middle", class: "axis-tick" });
    });
    [["W, Z", 1967, 1983, 44], ["top", 1973, 1995, 74], ["Higgs", 1964, 2012, 104]].forEach(([n, a, b, y]) => {
      txt(tl, n, { x: 20, y: y + 6, class: "row-label", style: n === "W, Z" ? "font-style:italic" : "" });
      el("path", { d: `M${f(xy(a))} ${y} H${f(xy(b))}`, class: "tl-bar" }, tl);
      el("circle", { cx: f(xy(a)), cy: y, r: 6, class: "tl-pred" }, tl);
      el("circle", { cx: f(xy(b)), cy: y, r: 6, class: "tl-found" }, tl);
      txt(tl, String(a), { x: f(xy(a) - 11), y: y + 5, "text-anchor": "end", class: "tl-year" });
      txt(tl, String(b), { x: f(xy(b) + 11), y: y + 5, class: "tl-year found" });
    });
    el("circle", { cx: 290, cy: 8, r: 5, class: "tl-pred" }, tl);
    txt(tl, "predicted", { x: 301, y: 15, class: "tl-year" });
    el("circle", { cx: 440, cy: 8, r: 5, class: "tl-found" }, tl);
    txt(tl, "found", { x: 451, y: 15, class: "tl-year found" });

    // illustrative diphoton spectrum: falling background + narrow peak at 125 GeV
    const g = $("#diphoton");
    const P = { x0: 120, x1: 584, top: 158, bot: 352, rtop: 368, rbot: 466 };
    const mx = (m) => P.x0 + (m - 100) / 60 * (P.x1 - P.x0);
    const my = (n) => P.bot - (n - 500) / 6000 * (P.bot - P.top);
    const ry = (n) => P.rbot - (n + 150) / 500 * (P.rbot - P.rtop);
    const B = (m) => 6000 * Math.exp(-(m - 100) / 32);
    const S = (m) => 300 * Math.exp(-((m - 125) ** 2) / (2 * 1.7 ** 2));
    el("rect", { x: P.x0, y: P.top, width: P.x1 - P.x0, height: P.bot - P.top, class: "panel" }, g);
    el("rect", { x: P.x0, y: P.rtop, width: P.x1 - P.x0, height: P.rbot - P.rtop, class: "panel" }, g);
    [1000, 3000, 5000].forEach((n) => txt(g, n.toLocaleString("en-US"), { x: P.x0 - 8, y: f(my(n) + 5), "text-anchor": "end", class: "axis-tick" }));
    [0, 200].forEach((n) => txt(g, String(n), { x: P.x0 - 8, y: f(ry(n) + 5), "text-anchor": "end", class: "axis-tick" }));
    el("path", { d: `M${P.x0} ${f(ry(0))} H${P.x1}`, class: "grid-line" }, g);
    [100, 110, 120, 130, 140, 150].forEach((m) => {
      el("path", { d: `M${f(mx(m))} ${P.rbot} v6`, class: "axis-line" }, g);
      txt(g, String(m), { x: f(mx(m)), y: P.rbot + 28, "text-anchor": "middle", class: "axis-tick" });
    });
    const xl = txt(g, "m", { x: P.x1, y: P.rbot + 58, "text-anchor": "end", class: "axis-title", style: "font-style:italic" });
    el("tspan", { "baseline-shift": "sub", "font-size": "14" }, xl).textContent = "γγ";
    el("tspan", { style: "font-style:normal" }, xl).textContent = " [GeV]";
    txt(g, "events / 2 GeV", { x: 38, y: (P.top + P.bot) / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 38 ${(P.top + P.bot) / 2})` });
    txt(g, "data−bkg", { x: 38, y: (P.rtop + P.rbot) / 2, "text-anchor": "middle", class: "axis-title small", transform: `rotate(-90 38 ${(P.rtop + P.rbot) / 2})` });

    const rand = rng(2012), pts = el("g", {}, g), res = el("g", { class: "on-2" }, g);
    for (let m = 101; m < 160; m += 2) {
      const mu = B(m) + S(m), n = mu + Math.sqrt(mu) * gauss(rand), e = Math.sqrt(n), d = `--d:${((m - 101) * 0.02).toFixed(2)}s`;
      const p = el("g", { class: "pt", style: d }, pts);
      el("path", { d: `M${f(mx(m))} ${f(my(n - e))} V${f(my(n + e))}`, class: "err" }, p);
      el("circle", { cx: f(mx(m)), cy: f(my(n)), r: 3.2, class: "pt-dot" }, p);
      const rr = n - B(m);
      el("path", { d: `M${f(mx(m))} ${f(ry(rr - e))} V${f(ry(rr + e))}`, class: "err" }, res);
      el("circle", { cx: f(mx(m)), cy: f(ry(rr)), r: 3, class: "pt-dot" }, res);
    }
    const curve = (fn, yfn) => {
      let d = "";
      for (let m = 100; m <= 160; m += 0.25) d += (d ? "L" : "M") + f(mx(m)) + " " + f(yfn(fn(m)));
      return d;
    };
    const fit = el("g", { class: "on-2" }, g);
    el("path", { d: curve(B, my), class: "fit-bkg dl", pathLength: 1 }, fit);
    el("path", { d: curve((m) => B(m) + S(m), my), class: "fit-sig dl", pathLength: 1 }, fit);
    el("path", { d: curve(S, ry), class: "fit-sig dl", pathLength: 1 }, fit);
    el("path", { d: `M${f(mx(125))} ${P.top} V${P.rbot}`, class: "mh-line" }, fit);
    const mh = txt(fit, "m", { x: f(mx(125) + 8), y: P.top + 22, class: "mh-label", style: "font-style:italic" });
    el("tspan", { "baseline-shift": "sub", "font-size": "14" }, mh).textContent = "H";
    el("tspan", { style: "font-style:normal" }, mh).textContent = " ≈ 125 GeV";
  }

  /* ---------------- the SM is not the end: universe content and rotation curve ---------------- */
  function buildLimits() {
    const dn = $("#donut");
    if (!dn) return;
    const segs = [[4.9, "seg-ord"], [26.8, "seg-dm"], [68.3, "seg-de"]];
    let start = 0;
    segs.forEach(([p, cls], i) => {
      el("circle", { cx: 120, cy: 122, r: 88, pathLength: 100, class: `seg ${cls}`, transform: "rotate(-90 120 122)",
                     style: `stroke-dasharray:${p} ${100 - p};stroke-dashoffset:${-start};--d:${(0.3 + i * 0.35).toFixed(2)}s` }, dn);
      start += p;
    });
    txt(dn, "Energy content of the universe", { x: 258, y: 34, class: "legend-head" });
    [["5%", "ordinary matter", "everything in the SM", "seg-ord"], ["27%", "dark matter", "", "seg-dm"], ["68%", "dark energy", "", "seg-de"]]
      .forEach(([p, n, sub, cls], i) => {
        const y = 82 + 62 * i;
        el("rect", { x: 258, y: y - 16, width: 16, height: 16, rx: 3, class: `swatch ${cls}` }, dn);
        txt(dn, p, { x: 286, y, class: "legend-pct" });
        txt(dn, n, { x: 350, y, class: "legend-name" });
        if (sub) txt(dn, sub, { x: 350, y: y + 20, class: "svg-caption small" });
      });

    const rc = $("#rotation");
    const P = { x0: 100, x1: 570, top: 300, bot: 478 };
    const xr = (r) => P.x0 + r / 30 * (P.x1 - P.x0), yv = (v) => P.bot - v / 250 * (P.bot - P.top);
    const vObs = (r) => 215 * (1 - Math.exp(-r / 2.5));
    const vVis = (r) => { const x = r / 3; return 322 * x / (1 + x * x) ** 0.75; };
    txt(rc, "Galaxy rotation curve (schematic)", { x: P.x0, y: 270, class: "legend-head" });
    el("path", { d: `M${P.x0} ${P.top} V${P.bot} H${P.x1}`, class: "axis-line" }, rc);
    [0, 10, 20, 30].forEach((r) => txt(rc, String(r), { x: f(xr(r)), y: P.bot + 26, "text-anchor": "middle", class: "axis-tick" }));
    [0, 100, 200].forEach((v) => txt(rc, String(v), { x: P.x0 - 8, y: f(yv(v) + 5), "text-anchor": "end", class: "axis-tick" }));
    txt(rc, "distance from the centre [kpc]", { x: P.x1, y: P.bot + 54, "text-anchor": "end", class: "axis-title" });
    txt(rc, "speed [km/s]", { x: 38, y: (P.top + P.bot) / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 38 ${(P.top + P.bot) / 2})` });
    let gap = "", obs = "", vis = "", back = "";
    for (let r = 0.2; r <= 30.01; r += 0.2) {
      obs += (obs ? "L" : "M") + f(xr(r)) + " " + f(yv(vObs(r)));
      vis += (vis ? "L" : "M") + f(xr(r)) + " " + f(yv(vVis(r)));
    }
    for (let r = 6; r <= 30.01; r += 0.2) gap += (gap ? "L" : "M") + f(xr(r)) + " " + f(yv(vObs(r)));
    for (let r = 30; r >= 6; r -= 0.2) back += "L" + f(xr(r)) + " " + f(yv(vVis(r)));
    el("path", { d: gap + back + "Z", class: "dm-gap fadein", style: "--d:1.6s" }, rc);
    el("path", { d: vis, class: "curve-vis drawon", pathLength: 1, style: "--d:0.4s;--dur:1.2s" }, rc);
    el("path", { d: obs, class: "curve-obs drawon", pathLength: 1, style: "--d:0.9s;--dur:1.2s" }, rc);
    const rand = rng(33);
    for (let r = 2; r <= 30; r += 2) {
      const v = vObs(r) + 6 * gauss(rand), x = xr(r);
      const p = el("g", { class: "fadein", style: `--d:${(0.9 + r * 0.03).toFixed(2)}s` }, rc);
      el("path", { d: `M${f(x)} ${f(yv(v - 10))} V${f(yv(v + 10))}`, class: "err obs" }, p);
      el("circle", { cx: f(x), cy: f(yv(v)), r: 3.5, class: "pt-obs" }, p);
    }
    txt(rc, "observed", { x: f(xr(30)), y: f(yv(vObs(30)) - 14), "text-anchor": "end", class: "curve-label obs fadein", style: "--d:2s" });
    txt(rc, "expected from visible matter", { x: f(xr(30)), y: f(yv(vVis(30)) + 28), "text-anchor": "end", class: "curve-label fadein", style: "--d:2s" });
    txt(rc, "dark matter?", { x: f(xr(19)), y: f((yv(vObs(19)) + yv(vVis(19))) / 2 + 6), "text-anchor": "middle", class: "curve-label dm fadein", style: "--d:2.2s" });
  }

  /* ---------------- the beauty quark: b -> c decay, masses, flight ---------------- */
  function buildBeauty() {
    const mb = $("#mass-bars");
    if (!mb) return;
    makeHadron($("#b-meson"), 300, 170, 140, ["b", "~u"], { colours: ["var(--magenta)", "var(--cyan)"], pairs: [[0, 1]], positions: [[-64, 0], [64, 0]], qr: 38, amp: 12 });
    txt(mb, "mass", { x: 20, y: 380, class: "legend-head" });
    const px = 60;   // pixels per GeV
    [["proton", 0.938, "0.94 GeV", "bar-p", ""], ["b quark", 4.18, "4.18 GeV", "bar-b", ""]]
      .forEach(([n, m, lab, cls, extra], i) => {
        const y = 400 + 42 * i, g = el("g", { class: extra.trim() }, mb);
        const rl = txt(g, n === "b quark" ? "b" : n, { x: 20, y: y + 15, class: "row-label", style: n === "b quark" ? "font-style:italic" : "" });
        if (n === "b quark") el("tspan", { style: "font-style:normal" }, rl).textContent = " quark";
        const wdt = Math.min(m * px, 440);
        el("rect", { x: 130, y, width: f(wdt), height: 20, rx: 4, class: `bar ${cls}` }, g);
        if (m * px > 440) el("path", { d: `M570 ${y - 2} l14 12 l-14 12 z`, class: `bar ${cls}` }, g);
        txt(g, lab, { x: m * px > 440 ? 130 : 138 + wdt, y: m * px > 440 ? y + 42 : y + 15, class: "bar-label" });
      });
    const fl = $("#flight");
    const PV = [90, 440], SV = [450, 440];
    const rand = rng(5);
    for (let i = 0; i < 9; i++) {
      const a = (rand() - 0.5) * 2.2 + (i % 2 ? Math.PI : 0);
      el("path", { d: `M${PV[0]} ${PV[1]} l${f(90 * Math.cos(a))} ${f(60 * Math.sin(a))}`, class: "trk" }, fl);
    }
    el("path", { d: `M${PV[0]} ${PV[1]} H${SV[0]}`, class: "trk-b dl", pathLength: 1 }, fl);
    [[-0.5, "trk-k"], [0.35, "trk-k"], [-0.15, "trk-l"]].forEach(([a, cls]) =>
      el("path", { d: `M${SV[0]} ${SV[1]} l${f(120 * Math.cos(a))} ${f(120 * Math.sin(a))}`, class: `${cls} dl`, pathLength: 1 }, fl));
    el("circle", { cx: PV[0], cy: PV[1], r: 6, class: "pv" }, fl);
    el("circle", { cx: SV[0], cy: SV[1], r: 6, class: "sv" }, fl);
    const tau = txt(fl, "τ", { x: 270, y: 424, "text-anchor": "middle", class: "mh-label b", style: "font-style:italic" });
    el("tspan", { style: "font-style:normal" }, tau).textContent = " ≈ 1.5 ps";
    el("path", { d: `M${PV[0]} 482 v-8 M${PV[0]} 478 H${SV[0]} M${SV[0]} 482 v-8`, class: "dim-line" }, fl);
    txt(fl, "a few mm", { x: 270, y: 504, "text-anchor": "middle", class: "svg-label" });
    txt(fl, "collision", { x: PV[0], y: 530, "text-anchor": "middle", class: "svg-caption small" });
    const bd = txt(fl, "B", { x: SV[0], y: 530, "text-anchor": "middle", class: "svg-caption small", style: "font-style:italic" });
    el("tspan", { style: "font-style:normal" }, bd).textContent = " decay";
  }

  /* ---------------- quarks slide and divider ---------------- */
  function buildHadrons() {
    makeHadron($("#had-p"), 160, 190, 128, ["u", "u", "d"]);
    makeHadron($("#had-n"), 440, 190, 128, ["u", "d", "d"]);
    makeHadron($("#div-proton"), 300, 300, 230, ["u", "u", "d"], { spread: 110, qr: 44, amp: 14 });
  }

  /* ---------------- built-ahead slides: penguin and lattice ---------------- */
  function buildPenguin() {
    const w = $("#w-boson"), ph = $("#photon");
    if (!w) return;
    const P0 = [200, 270], C = [300, 50], P2 = [400, 270];
    const bez = (t) => [0, 1].map((k) => (1 - t) ** 2 * P0[k] + 2 * (1 - t) * t * C[k] + t * t * P2[k]);
    w.setAttribute("d", wavy(bez, 9, 6));
    ph.setAttribute("d", wavy(line(300, 160, 300, 72), 4.5, 6));
  }
  const lat = { coarse: [], fine: [], count: 0, active: false };
  function buildGrid(sel, n, step, x0, y0, nodeR, key) {
    const g = $(sel);
    if (!g) return;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = x0 + i * step, y = y0 + j * step;
      if (i < n - 1) lat[key].push(el("line", { x1: x, y1: y, x2: x + step, y2: y, class: "lat-link" }, g));
      if (j < n - 1) lat[key].push(el("line", { x1: x, y1: y, x2: x, y2: y + step, class: "lat-link" }, g));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      el("circle", { cx: x0 + i * step, cy: y0 + j * step, r: nodeR, class: "lat-node" + (key === "coarse" ? " pop" : ""),
                     style: `--d:${((i + j) * 0.05).toFixed(2)}s` }, g);
    }
  }
  const FIELD = ["var(--boson)", "var(--magenta)", "var(--cyan)", "var(--aqua)", "var(--cyan)"];
  function flicker() {
    const snap = $("#snap-frag");
    const on = !reduce && isPresent("s-lattice") && snap?.classList.contains("visible");
    if (!on) {
      if (lat.active) { [...lat.coarse, ...lat.fine].forEach((l) => l.removeAttribute("style")); lat.active = false; lat.count = 0; }
      return;
    }
    lat.active = true;
    const fineOn = $("#lat-fine")?.parentElement.classList.contains("visible");
    for (const l of fineOn ? lat.fine : lat.coarse) {
      if (Math.random() < 0.35) {
        l.style.stroke = FIELD[Math.floor(Math.random() * FIELD.length)];
        l.style.strokeOpacity = (0.3 + Math.random() * 0.7).toFixed(2);
      }
    }
    lat.count += 1;
    $("#snap-count").textContent = `gluon field · snapshot ${lat.count.toLocaleString("en-US")}`;
  }

  /* ---------------- stages: text fragments drive the figures ---------------- */
  const HOOKS = { "s-zoom": zoomHook, "s-sm": smHook };
  function applyStage(sec) {
    if (!sec) return;
    let s = 0;
    sec.querySelectorAll(".fragment.visible[data-stage]").forEach((fr) => { s = Math.max(s, +fr.dataset.stage); });
    for (let k = 1; k <= 8; k++) sec.classList.toggle("st-" + k, k <= s);
    HOOKS[sec.id]?.(s);
  }

  /* ================= Part 2: accelerators ================= */
  // SVG animations (SMIL): a particle is a dot moved along a path
  const motion = (parent, path, dur, begin = 0, extra = {}) =>
    el("animateMotion", { path, dur: dur + "s", begin: begin + "s", repeatCount: "indefinite", ...extra }, parent);
  const pulse = (parent, attr, values, keyTimes, dur, begin = 0, count = "indefinite", fill = "remove") =>
    el("animate", { attributeName: attr, values, keyTimes, dur: dur + "s", begin: begin + "s", repeatCount: count, fill }, parent);
  const dot = (parent, r, cls) => el("circle", { cx: 0, cy: 0, r, class: cls }, parent);
  // play n times from `begin`, hidden before and after
  const playN = (c, path, dur, begin, n, extra = {}) => {
    c.setAttribute("opacity", "0");
    el("set", { attributeName: "opacity", to: "1", begin: begin + "s", fill: "freeze" }, c);
    motion(c, path, dur, begin, { repeatCount: n, fill: "freeze", ...extra });
    el("set", { attributeName: "opacity", to: "0", begin: (begin + dur * n) + "s", fill: "freeze" }, c);
  };
  const polar = (c, R, deg) => [c[0] + R * Math.cos(deg * Math.PI / 180), c[1] + R * Math.sin(deg * Math.PI / 180)];
  // text with italic symbol parts: parts = [[text, italic?], ...]
  function mixed(parent, attrs, parts) {
    const t = el("text", attrs, parent);
    parts.forEach(([s, it, over]) => {
      const sp = el("tspan", { style: `font-style:${it ? "italic" : "normal"}${over ? ";text-decoration:overline" : ""}` }, t);
      sp.textContent = s;
    });
    return t;
  }

  /* ---- divider: random collisions in the background ---- */
  function buildCollisions() {
    const svg = $("#collisions");
    if (!svg) return;
    const still = document.documentElement.classList.contains("still");
    const accent = ["boson", "boson", "boson", "aqua", "cyan", "magenta"];
    function burst(instant) {
      const x = 120 + Math.random() * 1040, y = 80 + Math.random() * 560, g = el("g", {}, svg);
      const ang = Math.random() * Math.PI;
      for (const s of [-1, 1]) {
        const x0 = x - s * Math.cos(ang) * 260, y0 = y - s * Math.sin(ang) * 260;
        el("path", { d: `M${f(x0)} ${f(y0)} L${f(x)} ${f(y)}`, pathLength: 1, class: "cb-line cb-in" }, g);
      }
      el("circle", { cx: f(x), cy: f(y), r: 5, class: "cb-flash" }, g);
      const n = 9 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 2 * Math.PI, L = 50 + Math.random() * 120, b = (Math.random() - 0.5) * 0.8;
        const ex = x + L * Math.cos(a + b), ey = y + L * Math.sin(a + b);
        el("path", { d: `M${f(x)} ${f(y)} Q${f(x + L / 2 * Math.cos(a))} ${f(y + L / 2 * Math.sin(a))} ${f(ex)} ${f(ey)}`,
                     pathLength: 1, class: `cb-line cb-out cb-${accent[Math.floor(Math.random() * accent.length)]}` }, g);
      }
      if (!instant) setTimeout(() => g.remove(), 3600);
    }
    if (still) { for (let i = 0; i < 9; i++) burst(true); return; }
    if (reduce) return;
    burst(false);
    setInterval(() => { if (isPresent("s-part2")) burst(false); }, 1500);
  }

  /* ---- basic principle: beams, fields, collision ---- */
  function buildBasic() {
    const g = $("#basic");
    if (!g) return;
    el("rect", { x: 30, y: 244, width: 540, height: 52, rx: 26, class: "tube" }, g);
    const plates = (x) => {
      el("rect", { x: x - 17, y: 196, width: 34, height: 40, rx: 4, class: "plate" }, g);
      el("rect", { x: x - 17, y: 304, width: 34, height: 40, rx: 4, class: "plate" }, g);
      txt(g, "+", { x, y: 224, "text-anchor": "middle", class: "plate-sym" });
      txt(g, "−", { x, y: 332, "text-anchor": "middle", class: "plate-sym" });
    };
    const magnet = (x) => {
      el("rect", { x: x - 22, y: 196, width: 44, height: 40, rx: 4, class: "magnet" }, g);
      el("rect", { x: x - 22, y: 304, width: 44, height: 40, rx: 4, class: "magnet" }, g);
      txt(g, "N", { x, y: 224, "text-anchor": "middle", class: "plate-sym" });
      txt(g, "S", { x, y: 332, "text-anchor": "middle", class: "plate-sym" });
    };
    [80, 220, 520, 380].forEach(plates);
    [150, 450].forEach(magnet);
    txt(g, "electric field", { x: 82, y: 384, "text-anchor": "middle", class: "fig-tag" });
    txt(g, "magnets", { x: 150, y: 186, "text-anchor": "middle", class: "fig-tag" });

    const proton = (path) => {
      const c = dot(g, 9, "pt-m");
      // three collisions, 5.5 s each: a short wait, the protons speed up and collide at 55% of the cycle; then they are gone
      motion(c, path, 5.5, 0, { repeatCount: 3, keyPoints: "0;0;1;1", keyTimes: "0;0.2;0.55;1", calcMode: "spline", keySplines: "0 0 1 1;0.55 0 1 1;0 0 1 1" });
      pulse(c, "opacity", "1;1;0;0", "0;0.55;0.551;1", 5.5, 0, 3);
      el("set", { attributeName: "opacity", to: "0", begin: "16.5s", fill: "freeze" }, c);
    };
    proton("M40 270 H292");
    proton("M560 270 H308");
    const burst = el("g", { transform: "translate(300 270)" }, g);
    const flash = el("circle", { r: 6, class: "flash" }, burst);
    pulse(flash, "opacity", "0;0;0.9;0;0", "0;0.55;0.58;0.7;1", 5.5, 0, 3);
    pulse(flash, "r", "6;6;46;46", "0;0.55;0.7;1", 5.5, 0, 3);
    [[-230, -12, "pt-a"], [230, 14, "pt-c"], [-70, -125, "pt-m"], [75, -118, "pt-a"],
     [-70, 125, "pt-c"], [72, 128, "pt-g"], [-165, 20, "pt-g"], [168, -22, "pt-m"]].forEach(([dx, dy, cls]) => {
      const c = dot(burst, 6, cls);
      c.setAttribute("opacity", "0");
      motion(c, `M0 0 L${dx} ${dy}`, 5.5, 0, { repeatCount: 3, keyPoints: "0;0;1;1", keyTimes: "0;0.55;0.97;1" });
      pulse(c, "opacity", "0;0;1;1;0", "0;0.55;0.57;0.85;1", 5.5, 0, 3);
    });
    const e = txt(g, "E = mc", { x: 300, y: 100, "text-anchor": "middle", class: "fig-tag on-1", style: "font-size:34px" });
    el("tspan", { "baseline-shift": "super", "font-size": "70%" }, e).textContent = "2";
    txt(g, "new, heavier particles", { x: 300, y: 470, "text-anchor": "middle", class: "fig-tag on-1" });
  }

  /* ---- the purpose: Rutherford scattering ---- */
  function buildRutherford() {
    const g = $("#rutherford");
    if (!g) return;
    const C = [340, 270];
    el("circle", { cx: C[0], cy: C[1], r: 170, fill: "url(#cloud-g)" }, g);
    el("circle", { cx: C[0], cy: C[1], r: 150, class: "atom-ring" }, g);
    for (let i = 0; i < 14; i++) {
      const [x, y] = polar(C, 120 + (i % 3) * 14, i * 25.7);
      el("circle", { cx: f(x), cy: f(y), r: 4, class: "electron" }, g);
    }
    el("circle", { cx: C[0], cy: C[1], r: 10, class: "nucleus-dot" }, g);
    // each alpha particle crosses twice and then stays gone; the clock restarts whenever the slide is shown
    const pass = (c, path, begin) => {
      c.setAttribute("opacity", "0");
      el("set", { attributeName: "opacity", to: "1", begin: begin + "s", fill: "freeze" }, c);
      motion(c, path, 4, begin, { repeatCount: 2, fill: "freeze" });
      el("set", { attributeName: "opacity", to: "0", begin: (begin + 8) + "s", fill: "freeze" }, c);   // gone after the second pass
    };
    const ys = [110, 160, 210, 330, 380, 430];
    ys.forEach((y, i) => {
      el("path", { d: `M10 ${y} H590`, class: "alpha-track" }, g);
      pass(dot(g, 7, "pt-a"), `M-10 ${y} H610`, i * 0.6);
    });
    // a slight deflection and a rare backscatter off the tiny nucleus
    el("path", { d: "M10 245 H326 C348 245 360 238 372 225 L590 120", class: "alpha-track hit" }, g);
    pass(dot(g, 7, "pt-a"), "M-10 245 H326 C348 245 360 238 372 225 L600 115", 0.9);
    el("path", { d: "M10 270 H322 C336 270 340 282 332 296 L40 430", class: "alpha-track hit" }, g);
    pass(dot(g, 7, "pt-a"), "M-10 270 H322 C336 270 340 282 332 296 L20 440", 2.1);
    mixed(g, { x: 340, y: 482, "text-anchor": "middle", class: "fig-tag" }, [["gold atom", 0]]);
    mixed(g, { x: 20, y: 70, class: "fig-tag" }, [["α", 1], [" particles", 0]]);
  }

  /* ---- the synchrotron ---- */
  function buildSynch() {
    const g = $("#synch");
    if (!g) return;
    const C = [300, 262], R = 140;
    el("circle", { cx: C[0], cy: C[1], r: R + 14, class: "ring-tube" }, g);
    el("circle", { cx: C[0], cy: C[1], r: R - 14, class: "ring-tube" }, g);
    const mags = el("g", { class: "on-1" }, g);
    for (let k = 0; k < 8; k++) {
      const a = 22.5 + 45 * k, [x, y] = polar(C, R, a);
      el("rect", { x: -24, y: -18, width: 48, height: 36, rx: 5, class: "dipole", transform: `translate(${f(x)} ${f(y)}) rotate(${a + 90})` }, mags);
      if (45 * k !== 270) {
        const [qx, qy] = polar(C, R, 45 * k);
        el("rect", { x: -11, y: -11, width: 22, height: 22, rx: 3, class: "quad", transform: `translate(${f(qx)} ${f(qy)}) rotate(${45 * k + 90})` }, mags);
      }
    }
    // synchrotron radiation: light leaves tangentially at the bends
    const rad = el("g", { class: "on-1" }, g);
    [337.5, 22.5, 67.5, 112.5].forEach((a) => {
      const [x, y] = polar(C, R + 14, a), t = [-Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
      el("path", { d: wavy(line(x, y, x + 62 * t[0], y + 62 * t[1]), 4, 4, 60), class: "boson photon" }, rad);
    });
    el("rect", { x: C[0] - 14, y: C[1] - R - 24, width: 28, height: 48, rx: 6, class: "rf" }, g);
    txt(g, "RF cavity: accelerates", { x: 300, y: 66, "text-anchor": "middle", class: "fig-tag" });
    const path = `M${C[0]} ${C[1] - R} A${R} ${R} 0 1 1 ${C[0] - 0.1} ${C[1] - R}`;
    [0, -2.5].forEach((b) => motion(dot(g, 9, "pt-m"), path, 5, b));
    const lg = el("g", { class: "on-1" }, g);
    el("rect", { x: 20, y: 440, width: 34, height: 24, rx: 4, class: "dipole" }, lg);
    txt(lg, "dipole: bends", { x: 66, y: 460, class: "fig-tag" });
    el("rect", { x: 300, y: 440, width: 24, height: 24, rx: 3, class: "quad" }, lg);
    txt(lg, "quadrupole: focuses", { x: 336, y: 460, class: "fig-tag" });
    txt(lg, "synchrotron radiation", { x: 590, y: 512, "text-anchor": "end", class: "fig-tag c-photon" });
  }

  /* ---- the LHC ring: two loops, then the beams collide at ATLAS and vanish ---- */
  function buildLHC() {
    const g = $("#lhc");
    if (!g) return;
    const C = [300, 262], R = 150, T = 3.4, END = 2 * T;
    el("circle", { cx: C[0], cy: C[1], r: R + 14, class: "ring-tube" }, g);
    el("circle", { cx: C[0], cy: C[1], r: R - 14, class: "ring-tube" }, g);
    const pts = [["ATLAS", -90, "middle", 0, -26], ["CMS", 90, "middle", 0, 38], ["ALICE", -45, "start", 22, -2], ["LHCb", -135, "end", -22, -2]];
    pts.forEach(([name, a, anchor, dx, dy]) => {
      const [x, y] = polar(C, R, a);
      el("rect", { x: f(x - 11), y: f(y - 11), width: 22, height: 22, rx: 4, class: "expt" }, g);
      txt(g, name, { x: f(x + dx), y: f(y + dy + 8), "text-anchor": anchor, class: "fig-tag" });
    });
    txt(g, "27 km", { x: 300, y: 276, "text-anchor": "middle", class: "legend-head", style: "font-size:34px" });
    const top = [C[0], C[1] - R], start = `M${top[0]} ${top[1]}`;
    const beam = (path) => {
      const d = dot(g, 8, "pt-m");
      motion(d, path, T, 0, { repeatCount: 2, fill: "freeze" });
      el("set", { attributeName: "opacity", to: "0", begin: END + "s", fill: "freeze" }, d);
    };
    beam(`${start} A${R} ${R} 0 1 1 ${top[0] - 0.1} ${top[1]}`);
    beam(`${start} A${R} ${R} 0 1 0 ${top[0] + 0.1} ${top[1]}`);
    // after the second lap the two beams meet at ATLAS: flash and a spray of new particles
    const fl = el("circle", { cx: top[0], cy: top[1], r: 6, class: "flash" }, g);
    el("animate", { attributeName: "opacity", values: "0;0.9;0", dur: "1s", begin: END + "s", fill: "freeze" }, fl);
    el("animate", { attributeName: "r", values: "6;34", dur: "1s", begin: END + "s", fill: "freeze" }, fl);
    [[-70, -50, "pt-a"], [-25, -78, "pt-c"], [30, -78, "pt-g"], [72, -48, "pt-a"], [-55, 40, "pt-c"], [55, 42, "pt-g"]].forEach(([dx, dy, cls]) => {
      const d = el("circle", { cx: top[0], cy: top[1], r: 5, class: cls, opacity: 0 }, g);
      el("set", { attributeName: "opacity", to: "1", begin: END + "s", fill: "freeze" }, d);
      el("animateMotion", { path: `M0 0 L${dx} ${dy}`, dur: "1.4s", begin: END + "s", fill: "freeze" }, d);
      el("animate", { attributeName: "opacity", values: "1;1;0", keyTimes: "0;0.6;1", dur: "1.4s", begin: END + "s", fill: "freeze" }, d);
    });
  }

  /* ---- LHC (II): pile-up event display, a new bunch crossing every second or so ---- */
  function buildPileup() {
    const svg = $("#pileup");
    if (!svg) return;
    el("path", { d: "M10 270 H590", class: "beam-line" }, svg);
    const g = el("g", {}, svg);
    const fill = () => {
      g.replaceChildren();
      const r = Math.random;
      const track = (x, y, L0, cls, delay, dur) => {
        const a = r() * 2 * Math.PI, bend = (r() - 0.5) * 0.9;
        let L = L0, ex, ey;
        for (let k = 0; k < 30; k++) {
          ex = x + L * Math.cos(a + bend); ey = y + L * Math.sin(a + bend);
          if (ex > 14 && ex < 586 && ey > 14 && ey < 526) break;
          L *= 0.92;
        }
        el("path", { d: `M${f(x)} ${f(y)} Q${f(x + L / 2 * Math.cos(a))} ${f(y + L / 2 * Math.sin(a))} ${f(ex)} ${f(ey)}`,
                     class: `${cls} drawon`, pathLength: 1, style: `--d:${(+delay + 0.9).toFixed(2)}s;--dur:${dur}s` }, g);   // starts 0.9 s after the slide appears
      };
      for (let v = 0; v < 28; v++) {
        const x = 300 + (r() - 0.5) * 130, y = 270 + (r() - 0.5) * 6, n = 5 + Math.floor(r() * 5);
        for (let i = 0; i < n; i++) track(x, y, 70 + r() * 200, "trk", (r() * 0.25).toFixed(2), 0.5);
        el("circle", { cx: f(x), cy: f(y), r: 2.6, class: "pv fadein", style: "--d:0.9s" }, g);
      }
      const sx = 300 + (r() - 0.5) * 60;
      ["trk-k", "trk-mu", "trk-mu"].forEach((c) => track(sx, 270, 190 + r() * 90, c, 0.3, 0.6));
      el("circle", { cx: f(sx), cy: 270, r: 5, class: "sv fadein", style: "--d:1.2s" }, g);
    };
    fill();
    document.addEventListener("pileup-again", fill);   // a fresh crossing, drawn once, each time the slide is shown
  }

  /* ---- the detectors, to scale (10 px per metre), with a person ---- */
  function buildDetectors() {
    const g = $("#detectors");
    if (!g) return;
    const ring = (parent, c, r, w, colour, op) =>
      el("circle", { cx: c[0], cy: c[1], r, fill: "none", stroke: colour, "stroke-width": w, "stroke-opacity": op }, parent);
    const label = (parent, x, y, name, size) => {
      txt(parent, name, { x, y, "text-anchor": "middle", class: "fig-tag" });
      txt(parent, size, { x, y: y + 28, "text-anchor": "middle", class: "fig-tag c-dim" });
    };
    const base = 330;

    // ATLAS: 25 m, end view: muon chambers, toroid coils, calorimeters, tracker
    const A = [165, base - 125];
    ring(g, A, 125, 1.5, "var(--boson)", 0.8);
    ring(g, A, 106, 34, "var(--aqua)", 0.1);
    for (let k = 0; k < 8; k++) {
      const [x, y] = polar(A, 96, 22.5 + 45 * k);
      el("rect", { x: -17, y: -7, width: 34, height: 14, rx: 4, class: "det-coil", transform: `translate(${f(x)} ${f(y)}) rotate(${22.5 + 45 * k + 90})` }, g);
    }
    ring(g, A, 66, 30, "var(--boson)", 0.22);
    ring(g, A, 46, 12, "var(--magenta)", 0.28);
    ring(g, A, 28, 16, "var(--cyan)", 0.2);
    ring(g, A, 36, 1.2, "var(--boson)", 0.7);
    for (let k = 0; k < 16; k++) {
      const [x1, y1] = polar(A, 82, 11.25 + 22.5 * k), [x2, y2] = polar(A, 124, 11.25 + 22.5 * k);
      el("path", { d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, class: "det-spoke" }, g);
    }
    el("circle", { cx: A[0], cy: A[1], r: 4, class: "pv" }, g);
    label(g, A[0], 372, "ATLAS", "25 m");

    // a person, 1.8 m
    const P = 322;
    el("circle", { cx: P, cy: base - 16.4, r: 3, class: "person" }, g);
    el("path", { d: `M${P} ${base - 13} V${base - 6} M${P - 5} ${base - 11} H${P + 5} M${P} ${base - 6} L${P - 3} ${base} M${P} ${base - 6} L${P + 3} ${base}`, class: "person-line" }, g);
    txt(g, "person", { x: P, y: 372, "text-anchor": "middle", class: "fig-tag c-dim" });
    txt(g, "1.8 m", { x: P, y: 400, "text-anchor": "middle", class: "fig-tag c-dim" });

    // CMS and LHCb come with the click
    const more = el("g", { class: "on-1" }, g);
    const M = [462, base - 75];
    ring(more, M, 75, 1.5, "var(--boson)", 0.8);
    ring(more, M, 60, 26, "var(--boson)", 0.2);
    for (let k = 0; k < 12; k++) {
      const [x1, y1] = polar(M, 47, 15 + 30 * k), [x2, y2] = polar(M, 73, 15 + 30 * k);
      el("path", { d: `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, class: "det-spoke" }, more);
    }
    ring(more, M, 38, 6, "var(--cyan)", 0.5);
    ring(more, M, 27, 12, "var(--aqua)", 0.25);
    ring(more, M, 13, 14, "var(--magenta)", 0.28);
    el("circle", { cx: M[0], cy: M[1], r: 3, class: "pv" }, more);
    label(more, M[0], 372, "CMS", "15 m");

    const L = { x: 40, y: 438, w: 210, h: 90 };              // 21 m x 9 m
    el("rect", { x: L.x, y: L.y, width: L.w, height: L.h, rx: 6, class: "det-ring" }, more);
    el("path", { d: `M${L.x + 6} ${L.y + L.h / 2} L${L.x + L.w - 4} ${L.y + 12} V${L.y + L.h - 12} Z`, class: "cone" }, more);
    el("rect", { x: L.x + 62, y: L.y + 12, width: 34, height: L.h - 24, rx: 5, class: "det-magnet" }, more);
    [L.x + 22, L.x + 36].forEach((x) => el("rect", { x: x - 2, y: L.y + 30, width: 4, height: 30, rx: 1, class: "stn" }, more));
    [118, 130, 142].forEach((x) => el("rect", { x: L.x + x - 2, y: L.y + 20, width: 4, height: L.h - 40, rx: 1, class: "stn" }, more));
    [L.x + 160, L.x + 172].forEach((x) => el("rect", { x: x - 4, y: L.y + 12, width: 8, height: L.h - 24, rx: 1, class: "stn thick" }, more));
    [188, 196, 204].forEach((x) => el("rect", { x: L.x + x - 2, y: L.y + 8, width: 4, height: L.h - 16, rx: 1, class: "stn" }, more));
    el("circle", { cx: L.x + 8, cy: L.y + L.h / 2, r: 3, class: "pv" }, more);
    txt(more, "LHCb", { x: 300, y: 470, class: "fig-tag" });
    txt(more, "21 m long", { x: 300, y: 498, class: "fig-tag c-dim" });
  }

  /* ---- LHCb: forward spectrometer with a B decay ---- */
  function buildLHCb() {
    const g = $("#lhcb");
    if (!g) return;
    el("path", { d: "M60 270 L585 150 V390 Z", class: "cone" }, g);
    const bar = (x, h, w, cls) => el("rect", { x: x - w / 2, y: 270 - h / 2, width: w, height: h, rx: 2, class: cls }, g);
    [76, 88].forEach((x) => bar(x, 40, 5, "stn"));                       // vertex detector
    bar(135, 76, 6, "stn");
    el("rect", { x: 220, y: 170, width: 70, height: 200, rx: 8, class: "det-magnet" }, g);   // dipole magnet
    [325, 345, 365].forEach((x) => bar(x, 130, 6, "stn"));               // tracking stations
    bar(410, 150, 12, "stn thick");                                      // RICH
    [455, 480].forEach((x) => bar(x, 200, 14, "stn thick"));             // calorimeters
    [515, 535, 555, 575].forEach((x) => bar(x, 230, 6, "stn"));          // muon stations
    const tr = (d, cls) => el("path", { d, class: `alpha-track ${cls}` }, g);
    const paths = [["M74 270 L220 268 Q290 262 340 252 L580 205", "pt-a"],
                   ["M74 270 L220 266 Q290 252 340 232 L580 130", "pt-c"],
                   ["M74 270 L220 274 Q290 288 340 308 L580 400", "pt-c"]];
    paths.forEach(([d, cls], i) => {
      el("path", { d, class: "alpha-track" }, g);
      playN(dot(g, 6, cls), d, 2.6, i * 0.05, 3);
    });
    el("path", { d: "M60 270 L74 270", class: "b-flight" }, g);
    el("circle", { cx: 74, cy: 270, r: 5, class: "sv" }, g);
    el("circle", { cx: 60, cy: 270, r: 4, class: "pv" }, g);
    txt(g, "collision", { x: 40, y: 330, class: "fig-tag" });
    txt(g, "magnet", { x: 255, y: 150, "text-anchor": "middle", class: "fig-tag" });
    txt(g, "muon stations", { x: 590, y: 440, "text-anchor": "end", class: "fig-tag" });
  }

  /* ---- B factory: e+ e- -> B B-bar, three times, the B mesons flying in random directions ---- */
  function buildBelle() {
    const g = $("#belle");
    if (!g) return;
    const T = 4.4, N = 2, rnd = Math.random;   // two plays per state: before and after the click
    mixed(g, { x: 30, y: 218, class: "fig-tag c-lep" }, [["e", 1], ["−", 0]]);
    mixed(g, { x: 570, y: 218, "text-anchor": "end", class: "fig-tag c-lep" }, [["e", 1], ["+", 0]]);
    txt(g, "10.6 GeV", { x: 580, y: 518, "text-anchor": "end", class: "fig-tag c-dim" });
    mixed(g, { x: 80, y: 518, class: "fig-tag on-1" }, [["invisible neutrino", 0]]);
    el("path", { d: "M20 511 H66", class: "nu-ray on-1", style: "stroke-dasharray:7 6" }, g);
    const dyn = el("g", {}, g);

    const cycle = (k) => {
      const b0 = k * T;
      const last = k === N - 1;          // the last round stays on screen
      const lepton = (path) => {
        const c = dot(dyn, 8, "pt-c");                  // electron and positron: same size
        c.setAttribute("opacity", "0");
        motion(c, path, T, b0, { repeatCount: 1, keyPoints: "0;1;1", keyTimes: "0;0.4;1" });
        pulse(c, "opacity", "1;1;0;0", "0;0.4;0.41;1", T, b0, 1);
      };
      lepton("M30 250 H292");
      lepton("M570 250 H308");
      const c0 = el("g", { transform: "translate(300 250)" }, dyn);
      const flash = el("circle", { r: 6, class: "flash" }, c0);
      pulse(flash, "opacity", "0;0;0.9;0;0", "0;0.4;0.46;0.7;1", T, b0, 1);
      pulse(flash, "r", "6;6;40;40", "0;0.4;0.7;1", T, b0, 1);

      // the pair flies apart back to back; angle to the beam ~ sin^2 (a vector decaying into two scalars)
      let th;
      do { th = rnd() * Math.PI; } while (rnd() > Math.sin(th) ** 2);
      if (rnd() < 0.5) th = -th;
      const invSide = rnd() < 0.5 ? 1 : -1;
      [1, -1].forEach((s) => {
        const dx = s * 105 * Math.cos(th), dy = s * 105 * Math.sin(th);
        const gb = el("g", { opacity: 0 }, c0);
        el("circle", { cx: 0, cy: 0, r: 22, class: "pt-m" }, gb);
        mixed(gb, { x: 0, y: 8, "text-anchor": "middle", class: "quark-txt" }, s < 0 ? [["B", 1, 1]] : [["B", 1]]);
        motion(gb, `M0 0 L${f(dx)} ${f(dy)}`, T, b0, { repeatCount: 1, keyPoints: "0;0;1;1", keyTimes: "0;0.4;0.65;1" });
        pulse(gb, "opacity", "0;0;1;1;0;0", "0;0.4;0.42;0.66;0.68;1", T, b0, 1);
        // each B decays in a random direction: one into K mu+ mu- (all visible), the other into K nu nubar (invisible)
        const invisible = s === invSide;
        const dk = el("g", { transform: `translate(${f(300 + dx)} ${f(250 + dy)})`, opacity: 0 }, dyn);
        const phi = rnd() * 2 * Math.PI;
        const prongs = invisible
          ? [["trk-k", ["K", "", ""], "--aqua"], ["nu-ray", ["ν", "", ""], "--cyan"], ["nu-ray", ["ν", "", ""], "--cyan", true]]
          : [["trk-k", ["K", "", ""], "--aqua"], ["trk-mu", ["μ", "", "+"], "--cyan"], ["trk-mu", ["μ", "", "−"], "--cyan"]];
        prongs.forEach(([cls, parts, colour, over], jj) => {
          const a = phi + jj * 2.094 + (rnd() - 0.5) * 0.5, len = 66 + rnd() * 16;
          const ex = len * Math.cos(a), ey = len * Math.sin(a), ux = Math.cos(a), uy = Math.sin(a);
          const wrap = invisible && jj > 0 ? el("g", { class: "on-1" }, dk) : dk;     // the neutrinos appear with the click
          // the line grows out of the decay vertex, like the tracks on the title slide
          const ln = el("line", { x1: 0, y1: 0, x2: 0, y2: 0, class: `${cls} belle-ray` }, wrap);
          el("animate", { attributeName: "x2", values: `0;0;${f(ex)};${f(ex)}`, keyTimes: "0;0.68;0.8;1", dur: T + "s", begin: b0 + "s", repeatCount: 1, fill: last ? "freeze" : "remove" }, ln);
          el("animate", { attributeName: "y2", values: `0;0;${f(ey)};${f(ey)}`, keyTimes: "0;0.68;0.8;1", dur: T + "s", begin: b0 + "s", repeatCount: 1, fill: last ? "freeze" : "remove" }, ln);
          // its label fades in as the line arrives
          const t = el("text", { x: f(ex + 17 * ux), y: f(ey + 17 * uy + 7), class: "ev-label", "text-anchor": ux < 0 ? "end" : "start", opacity: 0, style: `fill:var(${colour})` }, wrap);
          t.appendChild(document.createTextNode(parts[0]));
          if (parts[2]) el("tspan", { "baseline-shift": "super", "font-size": "70%" }, t).textContent = parts[2];
          if (over) t.setAttribute("text-decoration", "overline");
          pulse(t, "opacity", "0;0;1;1", "0;0.8;0.88;1", T, b0, 1, last ? "freeze" : "remove");
        });
        if (last) pulse(dk, "opacity", "0;0;1;1", "0;0.66;0.67;1", T, b0, 1, "freeze");
        else pulse(dk, "opacity", "0;0;1;1;0", "0;0.66;0.67;0.95;1", T, b0, 1);
      });
    };
    const build = () => { dyn.replaceChildren(); for (let k = 0; k < N; k++) cycle(k); };
    build();
    document.addEventListener("belle-again", build);   // new random directions on every visit
  }

  buildCollisions();
  buildBasic();
  buildRutherford();
  buildSynch();
  buildLHC();
  buildPileup();
  buildDetectors();
  buildLHCb();
  buildBelle();
  buildEvent();
  buildHadrons();
  buildZoom();
  buildMatter();
  buildGens();
  buildSM();
  buildSuccess();
  buildLimits();
  buildBeauty();
  buildPenguin();
  buildGrid("#lat-coarse", 7, 70, 90, 70, 6, "coarse");
  buildGrid("#lat-fine", 15, 35, 55, 35, 3.5, "fine");

  // equations: write $W$ inline or $$ ... $$ as a display formula in any slide text (not in speaker notes)
  if (window.renderMathInElement) {
    renderMathInElement(document.querySelector(".reveal .slides"), {
      delimiters: [
        { left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }, { left: "$", right: "$", display: false },
      ],
      ignoredClasses: ["notes"], throwOnError: false,
    });
  }

  // divider: grey, fuzzy bubbles rising like in a liquid
  const bc = $("#s-part1 .bubbles");
  if (bc) {
    for (let i = 0; i < 130; i++) {
      const b = document.createElement("span"), size = 2.5 + Math.pow(Math.random(), 2) * 12, dur = 22 - size / 2 + Math.random() * 6;
      b.className = "bubble";
      b.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;` +
        `--dur:${dur.toFixed(1)}s;--delay:${(-Math.random() * dur).toFixed(1)}s;--o:${(0.36 + Math.random() * 0.4).toFixed(2)};` +
        `--sway:${((Math.random() - 0.5) * 80).toFixed(0)}px;--b:${(0.4 + size / 24).toFixed(1)}px;--ty:${(-Math.random() * 760).toFixed(0)}px`;
      bc.appendChild(b);
    }
  }

  // safety net: SVG text has no colour of its own and would default to black on the dark background;
  // a presentation attribute gives every label a light default, and any CSS rule still overrides it
  document.querySelectorAll(".reveal svg text").forEach((t) => { if (!t.hasAttribute("fill")) t.setAttribute("fill", "#eef1f6"); });

  Reveal.initialize({
    width: 1280, height: 720, margin: 0.04, center: false, hash: true,
    transition: "fade", backgroundTransition: "none",
    controls: false, controlsTutorial: false, progress: true, slideNumber: "c",
    plugins: window.RevealNotes ? [window.RevealNotes] : [],
  });
  // the title slide and the part dividers carry no page number
  const showNumber = () => {
    const n = document.querySelector(".reveal .slide-number");
    if (n) n.style.visibility = Reveal.getCurrentSlide()?.dataset.visibility === "uncounted" ? "hidden" : "visible";
  };
  Reveal.on("ready", showNumber);
  Reveal.on("slidechanged", showNumber);
  const restage = () => applyStage(Reveal.getCurrentSlide());
  const ONCE = { "s-basic": "#basic", "s-purpose": "#rutherford", "s-lhc1": "#lhc", "s-lhcb": "#lhcb", "s-belle": "#belle" };
  const restartOnce = (id) => {
    if (id === "s-belle") document.dispatchEvent(new Event("belle-again"));   // rebuild first, then restart the clock
    if (ONCE[id]) { const s = $(ONCE[id]); try { s.setCurrentTime(0); s.unpauseAnimations(); } catch (err) {} }
    if (id === "s-pileup") document.dispatchEvent(new Event("pileup-again"));
  };
  Reveal.on("slidechanged", (e) => restartOnce(e.currentSlide?.id));
  Reveal.on("ready", (e) => restartOnce(e.currentSlide?.id));
  ["fragmentshown", "fragmenthidden"].forEach((ev) => Reveal.on(ev, () => { if (Reveal.getCurrentSlide()?.id === "s-belle") restartOnce("s-belle"); }));
  Reveal.on("ready", () => document.querySelectorAll(".reveal .slides > section").forEach(applyStage));
  ["slidechanged", "fragmentshown", "fragmenthidden"].forEach((ev) => Reveal.on(ev, restage));

  if (!reduce) {
    const loop = (ms) => {
      for (const h of hadrons) if (h.section?.classList.contains("present")) drawHadron(h, ms / 1000 * 0.5);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setInterval(swapColour, 4500);
  }
  setInterval(flicker, 140);
})();

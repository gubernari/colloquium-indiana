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

  // curly gluon line between two points; pass a fixed loop count to stretch the coil instead of adding loops
  const coilLoops = (L, r) => Math.max(4, Math.round(L / (2.1 * r)));
  function coil(x1, y1, x2, y2, r = 8, n = 150, fixedLoops = 0) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const loops = fixedLoops || coilLoops(L, r);
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
  function makeHadron(g, cx, cy, R, flavours, { spread = 58, qr = 27, amp = 9, colours = CHARGE, pairs = PAIRS, positions = null, noswap = false } = {}) {
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
    const coilR = qr * 0.3;
    // loop count fixed from the rest positions, so the wobble only stretches each spring
    const loops = pairs.map(([i, j]) => coilLoops(Math.hypot(quarks[j].base[0] - quarks[i].base[0], quarks[j].base[1] - quarks[i].base[1]), coilR));
    const h = { section: g.closest("section"), quarks, springs, amp, coilR, loops, pairs, colours, noswap };
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
      h.springs[k].setAttribute("d", coil(p[0], p[1], r[0], r[1], h.coilR, 150, h.loops[k]));
    });
  }
  function swapColour() {
    const live = hadrons.filter((h) => h.section?.classList.contains("present") && !h.noswap);
    if (reduce || !live.length) return;
    const h = live[Math.floor(Math.random() * live.length)];
    const k = Math.floor(Math.random() * h.pairs.length), [i, j] = h.pairs[k];
    const qa = h.quarks[i], qb = h.quarks[j];
    [qa.colour, qb.colour] = [qb.colour, qa.colour];
    qa.dot.style.fill = h.colours[qa.colour];
    qb.dot.style.fill = h.colours[qb.colour];
    // not "flash": that class is the collision bursts' circle, which starts invisible
    h.springs[k].classList.add("swap");
    setTimeout(() => h.springs[k].classList.remove("swap"), 450);
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
  // an event display is an svg with three groups: rings, prompt tracks, the rare decay (svg._only: always the same decay)
  function buildEventFrame(svg) {
    if (!svg) return;
    const prompt = svg.children[1], sig = svg.children[2];
    prompt.replaceChildren();
    sig.replaceChildren();
    const rnd = Math.random;
    for (let i = 0; i < 34; i++) {
      evTrack(EV_PV, rnd() * 2 * Math.PI, 110 + rnd() * 200, (rnd() - 0.5) * 1.2, "trk", (rnd() * 0.6).toFixed(2), 0.8, prompt);
    }
    el("circle", { cx: EV_PV[0], cy: EV_PV[1], r: 5, class: "pv" }, prompt);

    svg._n = (svg._n || 0) + 1;
    const d = svg._only ? EV_DECAYS[0] : EV_DECAYS[(svg._n - 1) % EV_DECAYS.length];
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
  // the same display on the title slide, the outline and (always B → K μ⁺μ⁻) the take-home slide
  function buildEvent() {
    [["event", ["s-title", "s-outline"], false]].forEach(([id, sections, only]) => {
      const svg = document.getElementById(id);
      if (!svg) return;
      svg._only = only;
      const rings = svg.children[0];
      [70, 140, 220].forEach((r) => el("circle", { cx: EV_PV[0], cy: EV_PV[1], r, class: "ring" }, rings));
      el("circle", { cx: EV_PV[0], cy: EV_PV[1], r: 292, class: "ring outer" }, rings);
      buildEventFrame(svg);
      if (reduce) return;
      setInterval(() => {
        if (!sections.some(isPresent)) return;
        svg.classList.add("ev-out");
        setTimeout(() => { buildEventFrame(svg); svg.classList.remove("ev-out"); }, 650);
      }, 5400);
    });
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
    // a rounded arch (half ellipse), so the wiggle keeps an even wavelength all the way round
    const arch = (t) => [300 - 100 * Math.cos(Math.PI * t), 270 - 110 * Math.sin(Math.PI * t)];
    w.setAttribute("d", wavy(arch, 8, 6, 300));
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
    // set like the KaTeX maths in the text: italic variables, upright "=" and exponent, normal weight
    const e = txt(g, "", { x: 300, y: 100, "text-anchor": "middle", class: "fig-tag on-1", style: "font-size:34px;font-weight:400" });
    [["E", true], [" = ", false], ["mc", true]].forEach(([s, it]) => { el("tspan", it ? { "font-style": "italic" } : {}, e).textContent = s; });
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
    [22.5, 112.5, 202.5, 292.5].forEach((a) => {   // every second dipole
      const [x, y] = polar(C, R + 14, a), t = [-Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
      el("path", { d: wavy(line(x, y, x + 62 * t[0], y + 62 * t[1]), 4, 4, 60), class: "boson photon" }, rad);
    });
    el("rect", { x: C[0] - 14, y: C[1] - R - 24, width: 28, height: 48, rx: 6, class: "rf" }, g);
    txt(g, "RF cavity: accelerates", { x: 300, y: 66, "text-anchor": "middle", class: "fig-tag" });
    const path = `M${C[0]} ${C[1] - R} A${R} ${R} 0 1 1 ${C[0] - 0.1} ${C[1] - R}`;
    [0, -2.5].forEach((b) => motion(dot(g, 9, "pt-m"), path, 5, b));
    const lg = el("g", { class: "on-1" }, g);
    el("rect", { x: 20, y: 478, width: 34, height: 24, rx: 4, class: "dipole" }, lg);
    txt(lg, "dipole: bends", { x: 66, y: 498, class: "fig-tag" });
    el("rect", { x: 300, y: 478, width: 24, height: 24, rx: 3, class: "quad" }, lg);
    txt(lg, "quadrupole: focuses", { x: 336, y: 498, class: "fig-tag" });
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
    const T = 4.4, rnd = Math.random;
    let N = 2;   // two plays before the click, one after it
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
          const lg = el("g", { opacity: 0 }, wrap);
          const lx = ex + 17 * ux, ly = ey + 17 * uy + 7;
          const t = el("text", { x: f(lx), y: f(ly), class: "ev-label", "text-anchor": ux < 0 ? "end" : "start", style: `fill:var(${colour})` }, lg);
          t.appendChild(document.createTextNode(parts[0]));
          if (parts[2]) el("tspan", { "baseline-shift": "super", "font-size": "70%" }, t).textContent = parts[2];
          if (over) {   // the bar of the antiparticle, drawn just above the letter
            const x0 = ux < 0 ? lx - 12 : lx + 1;
            el("line", { x1: f(x0), x2: f(x0 + 11), y1: f(ly - 15), y2: f(ly - 15), stroke: `var(${colour})`, "stroke-width": 1.8, "stroke-linecap": "round" }, lg);
          }
          pulse(lg, "opacity", "0;0;1;1", "0;0.8;0.88;1", T, b0, 1, last ? "freeze" : "remove");
        });
        if (last) pulse(dk, "opacity", "0;0;1;1", "0;0.66;0.67;1", T, b0, 1, "freeze");
        else pulse(dk, "opacity", "0;0;1;1;0", "0;0.66;0.67;0.95;1", T, b0, 1);
      });
    };
    const build = () => {
      N = document.querySelector("#s-belle .fragment.visible") ? 1 : 2;
      dyn.replaceChildren();
      for (let k = 0; k < N; k++) cycle(k);
    };
    build();
    document.addEventListener("belle-again", build);   // new random directions on every visit
  }

  /* ================= Part 3: new physics ================= */
  const muLabel = (parent, x, y, anchor, sign, extra = {}) => {
    const t = txt(parent, "μ", { x, y, "text-anchor": anchor, class: "mu-label", ...extra });
    el("tspan", { "baseline-shift": "super", "font-size": "70%", style: "font-style:normal" }, t).textContent = sign;
    return t;
  };

  /* ---- divider: self-energy diagrams (photon, quark loop, photon) appear and fade; grey for at least half of them ---- */
  function buildVacuum() {
    const svg = $("#vacuum");
    if (!svg) return;
    const still = document.documentElement.classList.contains("still");
    const accent = ["boson", "boson", "boson", "boson", "aqua", "cyan", "magenta"];
    function diagram(instant) {
      const rnd = Math.random, cls = accent[Math.floor(rnd() * accent.length)];
      const L = 26 + rnd() ** 2 * 84, a = L / 2;   // the loop is a circle of diameter L
      const p = L * (0.7 + rnd() * 0.4), amp = Math.max(3, Math.min(7, L * 0.08)), waves = Math.max(2, Math.round(p / 13));
      const fade = 2 + rnd() * 0.5;
      let x, y;
      do { x = 60 + rnd() * 1160; y = 50 + rnd() * 620; } while (Math.abs(x - 640) < 420 && Math.abs(y - 350) < 110);   // keep clear of the title
      const g = el("g", { class: "vp", style: `--f:${f(fade)}s`, transform: `translate(${f(x)} ${f(y)}) rotate(${f(rnd() * 180)})` }, svg);
      const line_ = (d, delay, dur) => el("path", { d, pathLength: 1, class: `vp-line vp-${cls}`, style: `--d:${delay}s;--dur:${dur}s` }, g);
      line_(wavy(line(-a - p, 0, -a, 0), waves, amp, 80), 0, 0.5);                                            // photon in
      [0, 1].forEach((s) => line_(`M${f(-a)} 0 A${f(a)} ${f(a)} 0 0 ${s} ${f(a)} 0`, 0.45, 0.8));   // quark loop: both halves from the left vertex
      line_(wavy(line(a, 0, a + p, 0), waves, amp, 80), 1.15, 0.5);                                           // photon out
      [[-a, 0.45], [a, 1.15]].forEach(([x, d]) => el("circle", { cx: f(x), cy: 0, r: 2.6, class: "vp-dot", style: `--d:${d}s;fill:var(--${cls})` }, g));
      if (!instant) setTimeout(() => g.remove(), (fade + 1) * 1000);
    }
    if (still) { for (let i = 0; i < 10; i++) diagram(true); return; }
    if (reduce) return;
    setInterval(() => { if (isPresent("s-part3")) diagram(false); }, 450);
  }

  /* ---- two ways: a bump on top of the SM (direct); precise measurements below the SM band (indirect) ---- */
  function buildWays() {
    const g = $("#ways");
    if (!g) return;
    // both panels are spectra: the same axes, dΓ/dE against E [GeV]
    const axes = (parent, P) => {
      el("path", { d: `M${P.x0} ${P.bot} V${P.top - 6}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, parent);
      el("path", { d: `M${P.x0} ${P.bot} H${P.x1 + 8}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, parent);
      const ym = (P.top + P.bot) / 2;
      txt(parent, "dΓ", { x: 58, y: ym - 8, "text-anchor": "middle", class: "fig-tag it" });
      el("path", { d: `M40 ${ym} H76`, class: "frac-line" }, parent);
      txt(parent, "dE", { x: 58, y: ym + 24, "text-anchor": "middle", class: "fig-tag it" });
      mixed(parent, { x: (P.x0 + P.x1) / 2, y: P.bot + 32, "text-anchor": "middle", class: "fig-tag" }, [["E", 1], [" [GeV]", 0]]);
    };
    const curve = (fn, ux, vy, u0 = 0, u1 = 1) => {
      let d = "";
      for (let u = u0; u <= u1 + 1e-9; u += 0.004) d += (d ? "L" : "M") + f(ux(u)) + " " + f(vy(fn(u)));
      return d;
    };

    // direct: the SM rate against energy, and the bump of a new particle near the end of the reach
    const D = { x0: 96, x1: 580, top: 44, bot: 228 };
    axes(g, D);
    txt(g, "direct search", { x: 580, y: 24, "text-anchor": "end", class: "fig-tag c-dim" });
    const sm = (u) => Math.pow(u, 0.62) * Math.pow(1 - u, 1.3);
    let smax = 0;
    for (let u = 0; u <= 1; u += 0.01) smax = Math.max(smax, sm(u));
    const bump = (u) => 0.36 * smax * Math.exp(-((u - 0.8) ** 2) / (2 * (u < 0.8 ? 0.034 : 0.018) ** 2));
    const ux = (u) => D.x0 + 4 + u * (D.x1 - D.x0 - 10), vy = (v) => D.bot - 0.82 * (D.bot - D.top) * v / smax;
    // the new-physics curve goes underneath, so the SM line stays on top where the two coincide
    el("path", { d: curve((u) => sm(u) + bump(u), ux, vy, 0.66, 1), class: "fit-np drawon", pathLength: 1, style: "--d:1.4s;--dur:0.8s" }, g);
    el("path", { d: curve(sm, ux, vy), class: "fit-sm drawon", pathLength: 1, style: "--d:0.3s;--dur:1.2s" }, g);
    txt(g, "SM", { x: f(ux(0.36)), y: f(vy(0.55 * smax)), "text-anchor": "middle", class: "fig-tag c-sm fadein", style: "--d:1s" });
    txt(g, "new particle", { x: f(ux(0.8)), y: f(vy(sm(0.8) + bump(0.8)) - 18), "text-anchor": "middle", class: "fig-tag c-np fadein", style: "--d:2s" });

    // indirect: the SM prediction with its uncertainty, and precise measurements that sit below it
    const I = { x0: 96, x1: 580, top: 312, bot: 500 };
    const ig = el("g", { class: "on-1" }, g);
    axes(ig, I);
    txt(ig, "indirect search", { x: 580, y: 292, "text-anchor": "end", class: "fig-tag c-dim" });
    const iu = (u) => I.x0 + 4 + u * (I.x1 - I.x0 - 10), iv = (v) => I.bot - v * (I.bot - I.top);
    const c = (u) => 0.66 - 0.1 * u + 0.3 * u ** 3, w = (u) => 0.05 + 0.08 * u;
    el("path", { d: curve(c, iu, iv), class: "fit-sm dl", pathLength: 1 }, ig);
    // the uncertainty lines fade in after the central line (drawing them on would replace their dash pattern)
    el("path", { d: curve((u) => c(u) + w(u), iu, iv), class: "sm-dash late" }, ig);
    el("path", { d: curve((u) => c(u) - w(u), iu, iv), class: "sm-dash late" }, ig);
    txt(ig, "SM", { x: f(iu(0.6)), y: f(iv(0.84)), "text-anchor": "middle", class: "fig-tag c-sm late" });
    for (let i = 0; i < 8; i++) {
      const u = 0.08 + 0.12 * i, v = 0.3 + 0.04 * Math.sin(1.7 * i) + 0.06 * u, e = 0.055, hw = 0.045;
      const p = el("g", { class: "seq", style: `--d:${(1 + 0.12 * i).toFixed(2)}s` }, ig);
      const x = iu(u), y = iv(v), y1 = iv(v - e), y2 = iv(v + e);
      el("path", { d: `M${f(iu(u - hw))} ${f(y)} H${f(iu(u + hw))} M${f(x)} ${f(y1)} V${f(y2)}`, class: "err" }, p);
      el("circle", { cx: f(x), cy: f(y), r: 3, class: "pt-dot" }, p);
    }
    txt(ig, "measurements", { x: f(iu(0.3)), y: f(iv(0.1)), "text-anchor": "middle", class: "fig-tag seq", style: "--d:2s" });   // below the points
    // at the end of the indirect-search animation (a moment after the points are in): the gap between data and prediction is the hint
    const dev = el("g", { class: "on-1 dev-late" }, ig);
    const xd = iu(0.99), ya = iv(c(0.97) - w(0.97)), yb = iv(0.38);
    el("path", { d: `M${f(xd)} ${f(ya)} V${f(yb)} M${f(xd - 6)} ${f(ya)} h12 M${f(xd - 6)} ${f(yb)} h12`, class: "dev-line" }, dev);
    txt(dev, "deviation?", { x: f(xd - 12), y: f(yb - 14), "text-anchor": "end", class: "fig-tag c-np" });   // below the band, above the data
  }

  /* ---- seeing the invisible: Uranus' orbit bulges towards the unseen Neptune; a heavy virtual particle between two known ones ---- */
  function buildInvisible() {
    const g = $("#solar");
    if (!g) return;
    const C = [300, 150], RU = 96, RN = 146, aN = -38 * Math.PI / 180;
    const N = [C[0] + RN * Math.cos(aN), C[1] + RN * Math.sin(aN)];
    el("circle", { cx: C[0], cy: C[1], r: RN, class: "orbit-n" }, g);
    el("circle", { cx: C[0], cy: C[1], r: 46, fill: "url(#sun-g)" }, g);
    el("circle", { cx: C[0], cy: C[1], r: 15, class: "sun" }, g);
    txt(g, "Sun", { x: C[0], y: C[1] + 44, "text-anchor": "middle", class: "fig-tag c-dim" });
    el("circle", { cx: C[0], cy: C[1], r: RU, class: "orbit-exp" }, g);
    // the observed orbit: pulled outwards where it passes the unseen planet (exaggerated)
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * 2 * Math.PI, da = Math.atan2(Math.sin(a - aN), Math.cos(a - aN));
      const r = RU + 12 * Math.exp(-(da * da) / 0.5);
      d += (i ? "L" : "M") + f(C[0] + r * Math.cos(a)) + " " + f(C[1] + r * Math.sin(a));
    }
    el("path", { d, class: "orbit-obs" }, g);
    const uranus = el("g", {}, g);
    dot(uranus, 8, "planet-u");
    txt(uranus, "Uranus", { y: -16, "text-anchor": "middle", class: "fig-tag c-e" });
    motion(uranus, d, 8);
    // Neptune: first only the predicted spot, then the planet
    el("circle", { cx: f(N[0]), cy: f(N[1]), r: 18, class: "ghost" }, g);
    txt(g, "?", { x: f(N[0]), y: f(N[1] + 8), "text-anchor": "middle", class: "fig-tag c-nep fadeaway", style: "--d:2.4s" });
    el("circle", { cx: f(N[0]), cy: f(N[1]), r: 10, class: "planet-n fadein", style: "--d:2.6s" }, g);
    txt(g, "Neptune", { x: f(N[0] + 28), y: f(N[1] + 2), class: "fig-tag c-nep fadein", style: "--d:2.6s" });
    txt(g, "1846", { x: f(N[0] + 28), y: f(N[1] + 28), class: "fig-tag c-dim fadein", style: "--d:2.6s" });
    el("path", { d: "M96 322 H136", class: "orbit-exp" }, g);
    txt(g, "expected orbit", { x: 146, y: 329, class: "fig-tag c-dim" });
    el("path", { d: "M346 322 H386", class: "orbit-obs" }, g);
    txt(g, "observed", { x: 396, y: 329, class: "fig-tag c-dim" });

    // with the click: two known particles meet and exchange a heavy virtual particle for a moment
    const v = $("#virtual");
    const A = "M40 400 H300 L560 378", B = "M560 500 H300 L40 522";
    [A, B].forEach((p) => {
      el("path", { d: p, class: "alpha-track vt" }, v);
      motion(dot(v, 8, "pt-c"), p, 4);     // both reach the middle at the same moment
    });
    const ex = el("g", { opacity: 0 }, v);
    el("path", { d: wavy(line(300, 400, 300, 500), 4.5, 7), class: "boson np" }, ex);
    el("circle", { cx: 300, cy: 400, r: 5, class: "vertex" }, ex);
    el("circle", { cx: 300, cy: 500, r: 5, class: "vertex" }, ex);
    if (document.documentElement.classList.contains("still")) ex.setAttribute("opacity", 1);   // screenshots: show the exchange
    else pulse(ex, "opacity", "0;0;1;1;0;0", "0;0.42;0.47;0.56;0.66;1", 4);
    txt(v, "known particles", { x: 40, y: 384, class: "fig-tag c-dim" });
    txt(v, "heavy, virtual", { x: 284, y: 457, "text-anchor": "end", class: "fig-tag c-np" });
    txt(v, "for a very short time", { x: 318, y: 457, class: "fig-tag c-dim" });
  }

  /* ---- flavour has done it before: predicted (open circle), then found (the particle) ---- */
  function buildHistory() {
    const g = $("#history");
    if (!g) return;
    const xy = (yr) => 150 + (yr - 1965) * 12;
    [1970, 1980, 1990, 2000].forEach((yr) => {
      el("path", { d: `M${xy(yr)} 40 V392`, class: "grid-line" }, g);
      txt(g, String(yr), { x: xy(yr), y: 424, "text-anchor": "middle", class: "axis-tick" });
    });
    el("path", { d: `M${xy(1965)} 396 H${xy(2000) + 10}`, class: "axis-line" }, g);
    [
      // name, who predicted it, predicted, found, particle, colour, row, stage
      ["charm quark", "GIM", 1970, 1974, "c", "quark", 112, 0],
      ["3rd generation", "Kobayashi–Maskawa", 1973, 1977, "b", "beauty", 222, 1],
      ["very heavy top", "ARGUS", 1987, 1995, "t", "quark", 332, 2],
    ].forEach(([name, who, a, b, sym, kind, y, st]) => {
      const row = el("g", st ? { class: `on-${st}` } : {}, g);
      const head = txt(row, name, { x: 20, y: y - 40, class: "fig-tag" });
      el("tspan", { style: "fill:var(--muted)" }, head).textContent = ` · ${who}`;
      const xa = xy(a), xb = xy(b);
      el("path", { d: `M${xa + 7} ${y} H${xb - 21}`, class: `tl-bar ${st ? "dl" : "drawon"}`, pathLength: 1, style: "--d:0.4s;--dur:0.9s" }, row);
      el("circle", { cx: xa, cy: y, r: 7, class: "tl-pred" }, row);
      txt(row, String(a), { x: xa - 14, y: y + 7, "text-anchor": "end", class: "tl-year" });
      const found = el("g", { class: st ? "late" : "fadein", style: "--d:1.1s" }, row);
      const chip = el("g", { class: `sm-part k-${kind}`, transform: `translate(${xb} ${y}) scale(0.7)` }, found);
      el("circle", { r: 30, class: "sm-chip" }, chip);
      txt(chip, sym, { "text-anchor": "middle", dy: 9, class: "sm-sym" });
      txt(found, String(b), { x: xb + 30, y: y + 7, class: "tl-year found" });
    });
  }

  /* ---- rare decays and new particles: b -> s through a heavy Z', and the mass reach ---- */
  function buildNP() {
    const g = $("#np");
    if (!g) return;
    // the same picture as the penguin, but the new particle connects b, s and the muons directly
    el("path", { d: "M540 296 H60", class: "quark" }, g);
    el("path", { d: "M290 296 l14 -7 v14 z", class: "arrow" }, g);
    txt(g, "u", { x: 300, y: 330, "text-anchor": "middle", class: "q-label" });
    el("path", { d: "M60 180 H300", class: "quark q-b" }, g);
    el("path", { d: "M188 180 l-14 -7 v14 z", class: "arrow a-b" }, g);
    txt(g, "b", { x: 128, y: 162, "text-anchor": "middle", class: "q-label t-b" });
    el("path", { d: "M300 180 H540", class: "quark q-s" }, g);
    el("path", { d: "M428 180 l-14 -7 v14 z", class: "arrow a-s" }, g);
    txt(g, "s", { x: 470, y: 162, "text-anchor": "middle", class: "q-label t-s" });
    // the mesons go on top of the quark lines, so the lines start at their edge
    [60, 540].forEach((x, i) => {
      el("ellipse", { cx: x, cy: 236, rx: 34, ry: 92, class: `meson ${i ? "m-k" : "m-b"}` }, g);
      txt(g, i ? "K" : "B", { x, y: 247, "text-anchor": "middle", class: "meson-label" });
    });
    el("path", { d: wavy(line(300, 180, 300, 74), 5.5, 7), class: "boson np drawon", pathLength: 1, style: "--d:0.4s;--dur:0.9s" }, g);
    txt(g, "Z′", { x: 318, y: 136, class: "q-label c-np fadein", style: "--d:0.9s" });
    txt(g, "new heavy particle", { x: 282, y: 112, "text-anchor": "end", class: "fig-tag c-np fadein", style: "--d:0.9s" });
    [[214, 28], [386, 28]].forEach(([x, y]) =>
      el("path", { d: `M300 74 L${x} ${y}`, class: "lepton drawon", pathLength: 1, style: "--d:1.2s;--dur:0.6s" }, g));
    [[300, 180], [300, 74]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 5, class: "vertex" }, g));
    muLabel(g, 198, 32, "end", "+", { class: "mu-label fadein", style: "--d:1.6s" });
    muLabel(g, 402, 32, "start", "−", { class: "mu-label fadein", style: "--d:1.6s" });

    // with the click: how far up in mass each kind of search can see (log scale)
    const R = el("g", { class: "on-1" }, g);
    const lx = (tev) => 60 + (Math.log10(tev) + 0.5) * (500 / 3);
    [[396, 5, "r-direct", "LHC, direct", "a few TeV", 0], [442, 100, "r-indirect", "rare decays, indirect", "~100 TeV", 0.35]]
      .forEach(([y, m, cls, inside, value, delay]) => {
        el("rect", { x: 60, y, width: f(lx(m) - 60), height: 34, rx: 5, class: `rbar ${cls}`, style: `--d:${delay}s` }, R);
        txt(R, inside, { x: 74, y: y + 25, class: "bar-in" });
        txt(R, value, { x: f(lx(m) + 12), y: y + 25, class: "fig-tag late" });
      });
    el("path", { d: "M60 498 H560", class: "axis-line" }, R);
    [1, 10, 100].forEach((m) => {
      el("path", { d: `M${f(lx(m))} 492 v12`, class: "axis-line" }, R);
      txt(R, `${m} TeV`, { x: f(lx(m)), y: 528, "text-anchor": "middle", class: "axis-tick" });
    });
  }

  /* ================= Part 4: calculations ================= */
  // pairs of a quark and an antiquark that pop in and out of existence inside a hadron
  function seaPairs(parent, cx, cy, R, n, rand) {
    for (let i = 0; i < n; i++) {
      let x, y;
      do {
        const a = rand() * 2 * Math.PI, r = 40 + rand() * (R - 40 - 26);
        x = Math.cos(a) * r; y = Math.sin(a) * r;
      } while (Math.abs(x) < 86 && Math.abs(y) < 52);       // keep clear of the two valence quarks
      const p = el("g", { transform: `translate(${f(cx + x)} ${f(cy + y)}) rotate(${f(rand() * 180)})`, opacity: 0 }, parent);
      el("path", { d: coil(-9, 0, 9, 0, 3.2, 40), class: "gluon" }, p);
      el("circle", { cx: -9, cy: 0, r: 5.5, fill: "var(--boson)" }, p);
      el("circle", { cx: 9, cy: 0, r: 5.5, fill: "var(--cyan)" }, p);
      const dur = 3 + rand() * 3;
      pulse(p, "opacity", "0;0;1;1;0", "0;0.08;0.2;0.75;1", dur, -(rand() * dur));
    }
  }

  /* ---- measure mesons: B -> K mu mu, and the swarm inside each meson ---- */
  function buildMeasure() {
    const g = $("#measure");
    if (!g) return;
    const rand = rng(11), B = [150, 250], K = [450, 250], R = 118;
    makeHadron(el("g", {}, g), B[0], B[1], R, ["b", "~u"], { colours: ["var(--magenta)", "var(--cyan)"], pairs: [[0, 1]], positions: [[-38, 6], [38, -6]], qr: 30, amp: 7, noswap: true });
    makeHadron(el("g", {}, g), K[0], K[1], R, ["s", "~u"], { colours: ["var(--aqua)", "var(--cyan)"], pairs: [[0, 1]], positions: [[-38, 6], [38, -6]], qr: 30, amp: 7, noswap: true });
    mixed(g, { x: B[0], y: 402, "text-anchor": "middle", class: "fig-tag" }, [["B", 1], [" meson", 0]]);
    mixed(g, { x: K[0], y: 402, "text-anchor": "middle", class: "fig-tag" }, [["K", 1], [" meson", 0]]);
    // the quark transition b -> s with the muon pair
    el("path", { d: "M274 250 H326", class: "decay-arrow", "marker-end": "url(#arrow-head)" }, g);
    el("path", { d: wavy(line(300, 250, 300, 108), 4, 6), class: "boson" }, g);
    [[236, 44], [364, 44]].forEach(([x, y]) => el("path", { d: `M300 108 L${x} ${y}`, class: "lepton" }, g));
    el("circle", { cx: 300, cy: 108, r: 5, class: "vertex" }, g);
    [[224, 52, "end", "+"], [376, 52, "start", "−"]].forEach(([x, y, anchor, sign]) => {
      const t = txt(g, "μ", { x, y, "text-anchor": anchor, class: "mu-label" });
      el("tspan", { "baseline-shift": "super", "font-size": "70%", style: "font-style:normal" }, t).textContent = sign;
    });
    // with the click: the swarm of gluons and pairs, and the object we need to compute
    const sea = el("g", { class: "on-1" }, g);
    seaPairs(sea, B[0], B[1], R, 9, rand);
    seaPairs(sea, K[0], K[1], R, 9, rand);
    el("path", { d: `M${B[0]} 424 V440 H${K[0]} V424`, class: "bracket" }, sea);
    txt(sea, "hadronic matrix element", { x: 300, y: 478, "text-anchor": "middle", class: "fig-tag", style: "fill:var(--aqua);font-weight:600" });
  }

  /* ---- beyond perturbation theory: the terms of a series ---- */
  function buildSeries() {
    const g = $("#series");
    if (!g) return;
    const panel = (parent, y0, vals, colour, verdict, late) => {
      const base = y0 + 150, H = 100;
      el("path", { d: `M44 ${base} H560`, class: "axis-line" }, parent);
      vals.forEach(([v, lab], i) => {
        const h = Math.max(2, H * v), x = 60 + i * 100;
        el("rect", { x, y: f(base - h), width: 58, height: f(h), rx: 3, class: "sbar" + (late ? " late" : ""), style: `fill:${colour};--d:${(0.2 + i * 0.16).toFixed(2)}s` }, parent);
        const t = txt(parent, lab[0], { x: x + 29, y: f(base - h - 10), "text-anchor": "middle", class: "fig-tag" });
        if (lab[1]) el("tspan", { "baseline-shift": "super", "font-size": "70%" }, t).textContent = lab[1];
      });
      txt(parent, "…", { x: 60 + vals.length * 100 + 4, y: base - 4, class: "fig-tag" });
      txt(parent, verdict, { x: 300, y: base + 36, "text-anchor": "middle", class: "fig-tag", style: `fill:${colour};font-weight:600` });
    };
    mixed(g, { x: 44, y: 40, class: "fig-tag" }, [["QED: ", 0], ["α", 1], [" ≈ 1/137", 0]]);
    panel(g, 40, [[1, ["1"]], [0.01, ["10", "−2"]], [0.0001, ["10", "−4"]], [0.000001, ["10", "−6"]]], "var(--aqua)", "good convergence", false);
    const q = el("g", { class: "on-1" }, g);
    const t = txt(q, "strong force in a meson: ", { x: 44, y: 326, class: "fig-tag" });
    el("tspan", { style: "font-style:italic" }, t).textContent = "α";
    el("tspan", { dy: "0.2em", "font-size": "72%", style: "font-style:italic" }, t).textContent = "s";   // a modest drop: the default subscript sits too low
    el("tspan", { dy: "-0.2em" }, t).textContent = " ≈ 1";
    panel(q, 326, [[1, ["1"]], [0.8, ["0.8"]], [0.7, ["0.7"]], [0.65, ["0.65"]], [0.6, ["0.6"]]], "var(--magenta)", "bad convergence", true);
  }

  /* ---- sum rules: the same quantity, computed with quarks and gluons and as a sum over hadrons ---- */
  function buildSumRules() {
    const g = $("#sumrules");
    if (!g) return;
    // left: a quark loop with a gluon (perturbation theory)
    txt(g, "quarks and gluons", { x: 140, y: 120, "text-anchor": "middle", class: "fig-tag", style: "fill:var(--aqua);font-weight:600" });
    txt(g, "short distances: calculable", { x: 140, y: 152, "text-anchor": "middle", class: "fig-tag c-dim" });
    el("circle", { cx: 140, cy: 270, r: 72, class: "sr-loop" }, g);
    el("path", { d: wavy(line(140, 200, 140, 340), 5, 7), class: "boson" }, g);
    // two external lines, both pointing away from the loop; the vertices sit on the circle
    [[68, -1], [212, 1]].forEach(([x, dir]) => { el("path", { d: `M${x} 270 H${x + dir * 36}`, class: "sr-loop" }, g); el("circle", { cx: x, cy: 270, r: 9, class: "vertex" }, g); });
    // the two descriptions are equal
    const eq = el("g", { class: "on-1" }, g);
    txt(eq, "=", { x: 300, y: 292, "text-anchor": "middle", style: "fill:var(--fg);font-size:64px;font-weight:300;font-family:var(--font)" });
    // right: the same quantity as a sum over hadronic states
    txt(eq, "hadrons", { x: 460, y: 120, "text-anchor": "middle", class: "fig-tag", style: "fill:var(--magenta);font-weight:600" });
    mixed(eq, { x: 460, y: 152, "text-anchor": "middle", class: "fig-tag c-dim" }, [["K", 1], [" meson + heavier states", 0]]);
    const base = 340, x0 = 340, x1 = 580;
    el("path", { d: `M${x0} ${base} V190`, class: "axis-line", "marker-end": "url(#arrow-head)" }, eq);
    el("path", { d: `M${x0} ${base} H${x1 + 6}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, eq);
    let peak = "";
    for (let x = 352; x <= 402; x += 1) peak += (peak ? "L" : "M") + x + " " + f(base - 130 * Math.exp(-(((x - 377) / 6) ** 2) / 2));
    el("path", { d: peak + `L402 ${base} L352 ${base}Z`, class: "sr-peak" }, eq);
    mixed(eq, { x: 396, y: 200, class: "fig-tag", style: "fill:var(--magenta)" }, [["K", 1], [" meson", 0]]);
    let cont = `M440 ${base}`;
    for (let x = 440; x <= 572; x += 4) cont += `L${x} ${f(base - 62 * (1 - Math.exp(-(x - 440) / 22)))}`;
    const wob = el("g", { class: "wob" }, eq);
    el("path", { d: cont + `L572 ${base}Z`, class: "sr-cont" }, wob);
    el("path", { d: cont.replace(/L(\d+) /g, (m, x) => `L${x} `) , class: "sr-unc" }, wob);
    txt(eq, "heavier states", { x: 510, y: 262, "text-anchor": "middle", class: "fig-tag c-dim" });
    txt(eq, "uncertain", { x: 510, y: 402, "text-anchor": "middle", class: "fig-tag", style: "fill:var(--cyan);font-style:italic" });
    el("path", { d: "M510 374 V352", class: "decay-arrow", "marker-end": "url(#arrow-head)" }, eq);
    txt(eq, "mass", { x: 580, y: 370, "text-anchor": "end", class: "fig-tag c-dim" });
  }

  /* ---- divider: equations from the paper drifting in the background ---- */
  const PAPER_EQS = [
    String.raw`\mathcal{O}_2^q=(\bar{s}_L\gamma_\mu q_L)(\bar{q}_L\gamma^\mu b_L)`,
    String.raw`\mathcal{F}^{B\to P}_{0}=f_{+}^{B\to P}`,
    String.raw`\mathcal{F}^{B\to P}_{t}=f_{0}^{B\to P}`,
    String.raw`\mathcal{F}^{B\to P}_{T,0}=\frac{q^2}{M_B(M_B+M_K)}f_T^{B\to P}`,    String.raw`\mathcal{L}_{\rm WET}^{sb\ell\ell}=\mathcal{L}_{\mathrm{QED}}+\mathcal{L}_{\mathrm{QCD}}+\mathcal{L}_{D=6}^{sb\ell\ell}`,
    String.raw`\mathcal{O}_1^q=(\bar{s}_L\gamma_\mu T^a q_L)(\bar{q}_L\gamma^\mu T^a b_L)`,
    String.raw`\mathcal{O}_7=\frac{e}{16\pi^2}m_b(\bar{s}_L\sigma^{\mu\nu}b_R)F_{\mu\nu}`,
    String.raw`\mathcal{O}_9^{\ell}=\frac{e^2}{16\pi^2}(\bar{s}_L\gamma_\mu b_L)(\bar{\ell}\gamma^\mu\ell)`,
    String.raw`\mathcal{O}_{10}^{\ell}=\frac{e^2}{16\pi^2}(\bar{s}_L\gamma_\mu b_L)(\bar{\ell}\gamma^\mu\gamma_5\ell)`,
    String.raw`\mathcal{F}^{B\to M}_{\mu}(k,q)\equiv\langle M(k)|\bar{s}\gamma_{\mu}P_{L}\,b|\bar{B}(q+k)\rangle`,
    String.raw`\mathcal{F}^{B\to M}_{T,\mu}(k,q)\equiv\langle M(k)|\bar{s}\sigma_{\mu\nu}q^{\nu}P_{R}\,b|\bar{B}(q+k)\rangle`,
    String.raw`z(q^2)\equiv\frac{\sqrt{s_+-q^2}-\sqrt{s_+-s_0}}{\sqrt{s_+-q^2}+\sqrt{s_+-s_0}}`,
    String.raw`\hat{z}(q^2)\equiv\frac{\sqrt{\hat{s}_+-q^2}-\sqrt{\hat{s}_+-\hat{s}_0}}{\sqrt{\hat{s}_+-q^2}+\sqrt{\hat{s}_+-\hat{s}_0}}`,
    String.raw`\hat{\mathcal{H}}^{B\to M}_{\lambda}(\hat{z})=\sum_{n=0}^{\infty}\beta_{\lambda,n}^{B\to M}p_n(\hat{z})`,
    String.raw`r^{B\to K}\equiv\sum_{n}|\beta_{0,n}^{B\to K}|^2`,
    String.raw`\sum_{n=0}^{\infty}\{2|\beta_{0,n}^{B\to K}|^2+\sum_{\lambda=\perp,\parallel,0}[2|\beta_{\lambda,n}^{B\to K^*}|^2+|\beta_{\lambda,n}^{B_s\to\phi}|^2]\}<1`,
  ];
  function buildFormulas() {
    const box = $("#s-part4 .formulas");
    if (!box) return;
    const rand = rng(4), TINT =["var(--aqua)", "var(--cyan)", "var(--magenta)"], colourOf = (i) => (i % 4 === 3 ? TINT[Math.floor(i / 4) % 3] : "var(--boson)");
    PAPER_EQS.forEach((eq, i) => {
      const s = document.createElement("span");
      s.className = "ff";
      s.textContent = `\\(${eq}\\)`;
      const dur = 12 + rand() * 6;
      s.style.cssText = `color:${colourOf(i)};--dur:${dur.toFixed(1)}s;--delay:${(-rand() * dur).toFixed(1)}s;--o:${(0.36 + rand() * 0.16).toFixed(2)}`;
      box.appendChild(s);
    });
  }
  // placed once the slide is on screen (hidden slides have no size): biggest first, never overlapping each other or the title
  let formulasPlaced = false;
  function placeFormulas() {
    const box = $("#s-part4 .formulas");
    if (formulasPlaced || !box) return;
    const items = [...box.children];
    if (!items.length || !items[0].offsetWidth) return;
    formulasPlaced = true;
    const rand = rng(21), W = 1280, H = 720, M = 26;
    const title = [215, 222, 1065, 452];            // the PART 4 label and the big title
    const placed = [title];
    const hit = (r, o) => r[0] < o[2] + M && r[2] > o[0] - M && r[1] < o[3] + M && r[3] > o[1] - M;
    items.map((s) => ({ s, w: s.offsetWidth, h: s.offsetHeight })).sort((p, q) => q.w * q.h - p.w * p.h).forEach(({ s, w, h }) => {
      let best = null;
      for (let k = 0; k < 600 && !best; k++) {
        const x = 24 + rand() * (W - w - 48), y = 24 + rand() * (H - h - 48), r = [x, y, x + w, y + h];
        if (!placed.some((o) => hit(r, o))) best = r;
      }
      best = best || [24, 24, 24 + w, 24 + h];
      placed.push(best);
      s.style.left = best[0].toFixed(0) + "px";
      s.style.top = best[1].toFixed(0) + "px";
    });
  }

  /* ================= Part 5: predictions ================= */
  const Kmeson = (parent, attrs, tail = "") => mixed(parent, attrs, [["K", 1], [" meson" + tail, 0]]);
  const errBar = (g, x, y, ey, hw, colour, delay) => {
    const p = el("g", { class: "fadein", style: `--d:${delay}s` }, g);
    el("path", { d: `M${f(x - hw)} ${f(y)} H${f(x + hw)} M${f(x)} ${f(y - ey)} V${f(y + ey)}`, fill: "none", stroke: colour, "stroke-width": 2, "stroke-linecap": "round" }, p);
    el("circle", { cx: f(x), cy: f(y), r: 4.5, fill: colour }, p);
  };

  /* ---- putting the pieces together: sum rules at high K speed, lattice at low, one band through both ---- */
  function buildMatching() {
    const g = $("#match");
    if (!g) return;
    const P = { x0: 96, x1: 560, top: 60, bot: 420 };
    const X = (u) => P.x0 + 14 + u * (P.x1 - P.x0 - 30), Y = (v) => P.bot - v * (P.bot - P.top);
    const fn = (u) => 0.3 + 0.62 * Math.pow(u, 1.7), w = (u) => 0.075 - 0.045 * u;
    el("path", { d: `M${P.x0} ${P.bot} V${P.top - 8}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    el("path", { d: `M${P.x0} ${P.bot} H${P.x1 + 10}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    txt(g, "fast", { x: f(X(0)), y: P.bot + 32, class: "fig-tag c-dim" });
    txt(g, "slow", { x: f(X(1)), y: P.bot + 32, "text-anchor": "end", class: "fig-tag c-dim" });
    mixed(g, { x: f((P.x0 + P.x1) / 2), y: P.bot + 68, "text-anchor": "middle", class: "fig-tag" }, [["speed of the ", 0], ["K", 1], [" meson", 0]]);
    txt(g, "matrix element", { x: 40, y: f((P.top + P.bot) / 2), "text-anchor": "middle", class: "fig-tag", transform: `rotate(-90 40 ${f((P.top + P.bot) / 2)})` });
    // the combined band is drawn first (it comes with the click), the points on top
    const band = el("g", { class: "on-1" }, g);
    let up = "", lo = "";
    for (let u = 0; u <= 1.0001; u += 0.02) { up += (up ? "L" : "M") + f(X(u)) + " " + f(Y(fn(u) + w(u))); }
    for (let u = 1; u >= -0.0001; u -= 0.02) { lo += "L" + f(X(u)) + " " + f(Y(fn(u) - w(u))); }
    el("path", { d: up + lo + "Z", class: "comb-band" }, band);
    el("path", { d: curve_(fn, X, Y), class: "fit-sm dl", pathLength: 1 }, band);
    txt(band, "combined", { x: f(X(0.5)), y: f(Y(fn(0.5) + 0.2)), "text-anchor": "middle", class: "fig-tag c-sm" });
    [0.04, 0.16, 0.28, 0.40].forEach((u, i) => errBar(g, X(u), Y(fn(u)), 0.075 * (P.bot - P.top), 0, "var(--aqua)", 0.4 + 0.18 * i));
    [0.62, 0.72, 0.82, 0.92].forEach((u, i) => errBar(g, X(u), Y(fn(u)), 0.028 * (P.bot - P.top), 0, "var(--cyan)", 1.2 + 0.18 * i));
    txt(g, "sum rules", { x: f(X(0.2)), y: f(Y(0.6)), "text-anchor": "middle", class: "fig-tag", style: "fill:var(--aqua);font-weight:600" });
    txt(g, "lattice", { x: f(X(0.78)), y: f(Y(0.5)), "text-anchor": "middle", class: "fig-tag", style: "fill:var(--cyan);font-weight:600" });
  }
  function curve_(fn, X, Y) {
    let d = "";
    for (let u = 0; u <= 1.0001; u += 0.01) d += (d ? "L" : "M") + f(X(u)) + " " + f(Y(fn(u)));
    return d;
  }

  /* ---- the charm-quark trap ---- */
  function buildCharm() {
    const g = $("#charm");
    if (!g) return;
    const diag = (cx, top, tx) => {
      const d = el("g", { transform: `translate(${tx} 6) scale(1.15)` }, g);
      const arrowAt = (x, y, cls) => el("path", { d: `M${x} ${y} l-12 -6 v12 z`, class: "arrow " + cls }, d);
      el("path", { d: `M${cx - 100} 176 H${cx - 36}`, class: "quark q-b" }, d);
      el("path", { d: `M${cx + 36} 176 H${cx + 100}`, class: "quark q-s" }, d);
      arrowAt(cx - 70, 176, "a-b"); arrowAt(cx + 78, 176, "a-s");
      txt(d, "b", { x: cx - 70, y: 156, "text-anchor": "middle", class: "q-label t-b" });
      txt(d, "s", { x: cx + 78, y: 156, "text-anchor": "middle", class: "q-label t-s" });
      let photonFrom, mu;
      if (top) {
        el("path", { d: `M${cx - 36} 176 H${cx + 36}`, class: "quark" }, d);
        txt(d, "t", { x: cx, y: 202, "text-anchor": "middle", class: "q-label" });
        const arch = (t) => [cx - 36 * Math.cos(Math.PI * t), 176 - 72 * Math.sin(Math.PI * t)];
        el("path", { d: wavy(arch, 6, 4, 200), class: "boson" }, d);
        el("circle", { cx: cx - 36, cy: 176, r: 4.5, class: "vertex" }, d); el("circle", { cx: cx + 36, cy: 176, r: 4.5, class: "vertex" }, d);
        photonFrom = [cx, 104]; mu = 58;
        txt(d, "W", { x: cx, y: 146, "text-anchor": "middle", class: "b-label" });
      } else {
        // the Standard Model diagram: b -> c W, the charm quark runs round the loop and radiates the photon, then c W -> s
        el("path", { d: `M${cx - 36} 176 A36 66 0 0 1 ${cx + 36} 176`, class: "quark charm-loop", fill: "none" }, d);
        el("path", { d: "M0 0 l-12 -6 v12 z", class: "arrow", style: "fill:var(--lime)", transform: `translate(${cx - 23} 126) rotate(-57)` }, d);
        el("path", { d: wavy(line(cx - 36, 176, cx + 36, 176), 4, 4, 80), class: "boson" }, d);
        txt(d, "c", { x: cx, y: 148, "text-anchor": "middle", class: "q-label", style: "fill:var(--lime)" });
        txt(d, "W", { x: cx, y: 206, "text-anchor": "middle", class: "b-label" });
        photonFrom = [cx, 110]; mu = 36;
      }
      el("path", { d: wavy(line(photonFrom[0], photonFrom[1], cx, mu), 3, 4, 50), class: "boson" }, d);
      if (!top) [[cx - 36, 176], [cx + 36, 176], [cx, 110]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 4.5, class: "vertex", style: "fill:var(--lime)" }, d));   // on top of the lines
      [[-1, "+"], [1, "−"]].forEach(([s, sign]) => {
        el("path", { d: `M${cx} ${mu} L${cx + s * 32} ${mu - 36}`, class: "lepton" }, d);
        muLabel(d, cx + s * 40, mu - 30, s < 0 ? "end" : "start", sign, { class: "mu-label" });
      });
      el("circle", { cx, cy: mu, r: 4.5, class: "vertex" }, d);
      txt(d, top ? "rare decay" : "charm effect", { x: cx, y: 246, "text-anchor": "middle", class: "fig-tag", style: top ? "fill:var(--magenta);font-weight:600" : "fill:var(--lime);font-weight:600" });
    };
    diag(150, true, -27); diag(150, false, 283);
  }

  /* ---- theory meets experiment: the SM band lies above all the measurements ----
     Data read off the EOS preliminary plot (pixel analysis of the picture): bins [1,8] GeV^2, rate in units of 1e-5 GeV^-2 */
  function buildTension(id = "tension") {
    const g = document.getElementById(id);
    if (!g) return;
    const P = { x0: 104, x1: 556, top: 100, bot: 420 }, QMIN = 0.9, QMAX = 8.3, VMIN = 1, VMAX = 5.6;
    const X = (q) => P.x0 + ((q - QMIN) / (QMAX - QMIN)) * (P.x1 - P.x0), Y = (v) => P.bot - ((v - VMIN) / (VMAX - VMIN)) * (P.bot - P.top);
    el("path", { d: `M${P.x0} ${P.bot} V${P.top - 14}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    el("path", { d: `M${P.x0} ${P.bot} H${P.x1 + 14}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    for (let q = 1; q <= 8; q++) {
      el("path", { d: `M${f(X(q))} ${P.bot} v8`, class: "axis-line" }, g);
      txt(g, String(q), { x: f(X(q)), y: P.bot + 34, "text-anchor": "middle", class: "axis-tick" });
    }
    const xt = txt(g, "mass", { x: f((P.x0 + P.x1) / 2), y: P.bot + 72, "text-anchor": "middle", class: "fig-tag" });
    xt.textContent = "(mass of the muon pair)²  [GeV²]";
    const mid = (P.top + P.bot) / 2;
    const ylab = (x, build) => { const t = el("text", { x, y: f(mid), "text-anchor": "middle", class: "fig-tag", transform: `rotate(-90 ${x} ${f(mid)})` }, g); build(t); };
    const add = (t, s, attrs) => { const n = el("tspan", attrs || {}, t); n.textContent = s; };
    // the kaon is fast at small q² and slow at large q² (seen from the B meson)
    txt(g, "fast kaon", { x: P.x0, y: P.bot + 112, class: "fig-tag c-dim" });
    txt(g, "slow kaon", { x: P.x1, y: P.bot + 112, "text-anchor": "end", class: "fig-tag c-dim" });
    el("path", { d: `M${P.x0 + 104} ${P.bot + 106} H${P.x1 - 118}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    ylab(30, (t) => { add(t, "how often "); add(t, "B", { style: "font-style:italic" }); add(t, " → "); add(t, "K", { style: "font-style:italic" }); add(t, " "); add(t, "μ", { style: "font-style:italic" }); add(t, "+", { "baseline-shift": "super", "font-size": "70%" }); add(t, "μ", { style: "font-style:italic" }); add(t, "−", { "baseline-shift": "super", "font-size": "70%" }); add(t, " happens"); });
    ylab(60, (t) => { add(t, "(per GeV"); add(t, "2", { "baseline-shift": "super", "font-size": "70%" }); add(t, ")"); });

    // the SM prediction, one box per bin
    const edges = [1, 2, 3, 4, 5, 6, 7, 8], cv = [3.832, 3.810, 3.793, 3.776, 3.745, 3.724, 3.719], hw = [0.216, 0.212, 0.212, 0.220, 0.259, 0.350, 0.570];
    cv.forEach((c, i) => el("rect", { x: f(X(edges[i])), y: f(Y(c + hw[i])), width: f(X(edges[i + 1]) - X(edges[i])), height: f(Y(c - hw[i]) - Y(c + hw[i])), class: "sm-box" }, g));

    // the measurements: [bin low, bin high, value, error, horizontal offset of the error bar inside the bin]
    const EXP = [
      ["BaBar", "var(--grey-a)", [[2, 4.3, 2.12, 0.65, 0], [4.3, 8.12, 2.45, 0.54, 0]]],
      ["Belle", "var(--grey-b)", [[1, 6, 4.57, 0.80, 0]]],
      ["LHCb", "var(--aqua)", [[1, 2, 2.34, 0.15, -0.14], [2, 3, 2.83, 0.15, -0.14], [3, 4, 2.55, 0.15, -0.14], [4, 5, 2.22, 0.15, -0.14], [5, 6, 2.32, 0.15, -0.14], [6, 7, 2.47, 0.15, -0.14], [7, 8, 2.31, 0.15, -0.14]]],
      ["CMS", "var(--cyan)", [[1, 2, 2.135, 0.24, 0.14], [2, 3, 3.05, 0.24, 0.14], [3, 4, 2.53, 0.24, 0.14], [4, 5, 2.46, 0.24, 0.14], [5, 6, 2.52, 0.24, 0.14], [6, 7, 2.49, 0.24, 0.14], [7, 8, 2.33, 0.24, 0.14]]],
    ];
    const ms = el("g", { class: "on-1" }, g);
    EXP.forEach(([name, col, pts], k) => {
      const grp = el("g", { class: "fadein", style: `--d:${(0.15 + 0.35 * k).toFixed(2)}s` }, ms);
      pts.forEach(([a0, a1, v, e, off]) => {
        const y = Y(v), xc = X((a0 + a1) / 2 + off), ey = Y(v - e) - Y(v);
        el("path", { d: `M${f(X(a0))} ${f(y)} H${f(X(a1))}`, stroke: col, "stroke-width": 2.2, "stroke-opacity": 0.85, fill: "none", "stroke-linecap": "round" }, grp);
        el("path", { d: `M${f(xc)} ${f(y - ey)} V${f(y + ey)}`, stroke: col, "stroke-width": 2.2, fill: "none", "stroke-linecap": "round" }, grp);
        el("circle", { cx: f(xc), cy: f(y), r: 3.8, fill: col }, grp);
      });
    });

    // legend above the plot: the SM first, the experiments with the click
    const sw = el("g", {}, g);
    el("rect", { x: P.x0, y: 22, width: 28, height: 15, rx: 2, class: "sm-box" }, sw);
    txt(sw, "SM prediction", { x: P.x0 + 38, y: 36, class: "fig-tag c-sm" });
    const lg = el("g", { class: "on-1" }, g);
    const entry = (x, y, col, label) => {
      el("path", { d: `M${x - 12} ${y - 6} H${x + 12}`, stroke: col, "stroke-width": 2.2, "stroke-linecap": "round" }, lg);
      el("path", { d: `M${x} ${y - 13} V${y + 1}`, stroke: col, "stroke-width": 2.2, "stroke-linecap": "round" }, lg);
      el("circle", { cx: x, cy: y - 6, r: 3.8, fill: col }, lg);
      txt(lg, label, { x: x + 22, y, class: "fig-tag", style: `fill:${col}` });
    };
    entry(P.x0 + 250, 36, "var(--aqua)", "LHCb");
    entry(P.x0 + 352, 36, "var(--cyan)", "CMS");
    entry(P.x0 + 250, 70, "var(--grey-a)", "BaBar");
    entry(P.x0 + 352, 70, "var(--grey-b)", "Belle");
  }

  /* ---- new physics or strong interactions? a balance that cannot decide ---- */
  function buildFork() {
    const g = $("#fork");
    if (!g) return;
    el("path", { d: "M300 150 V452", class: "axis-line", style: "stroke-width:4" }, g);
    el("path", { d: "M236 468 H364 L350 452 H250 Z", class: "fork-base" }, g);
    const beam = el("g", { class: "fork-beam" }, g);
    el("path", { d: "M92 150 H508", class: "fork-bar" }, beam);
    const pan = (cls, x, orbFill, label, parts, late, line2) => {
      const pg = el("g", { class: cls }, g);
      const gr = el("g", { class: late ? "on-1" : "" }, pg);
      el("path", { d: `M${x} 150 L${x - 62} 296 M${x} 150 L${x + 62} 296`, class: "fork-string" }, pg);
      el("path", { d: `M${x - 74} 296 H${x + 74} Q${x + 74} 336 ${x} 336 Q${x - 74} 336 ${x - 74} 296 Z`, class: "fork-pan" }, pg);
      el("circle", { cx: x, cy: 262, r: 30, fill: orbFill, "fill-opacity": 0.28, stroke: orbFill, "stroke-width": 2.4 }, gr);
      mixed(gr, { x, y: 272, "text-anchor": "middle", class: "fig-tag", style: `fill:${orbFill};font-size:30px;font-weight:600` }, [label]);
      mixed(pg, { x, y: 376, "text-anchor": "middle", class: "fig-tag", style: `fill:${orbFill};font-weight:600` }, parts);
      if (line2) mixed(pg, { x, y: 404, "text-anchor": "middle", class: "fig-tag", style: `fill:${orbFill};font-weight:600` }, line2);
    };
    pan("fork-pan-l", 92, "var(--lime)", ["Z′", 1], [["new particle ", 0], ["Z′", 1]], false);
    pan("fork-pan-r", 508, "var(--cyan)", ["g", 1], [["strong", 0]], true, [["interactions", 0]]);
    txt(g, "?", { x: 300, y: 112, "text-anchor": "middle", style: "fill:var(--fg);font-family:var(--font);font-size:56px;font-weight:300" });
    el("circle", { cx: 300, cy: 150, r: 9, class: "vertex" }, g);
  }

  /* ---- the future: a timeline of data (indicative dates) and the theory that has to keep up ---- */
  function buildFuture() {
    const g = $("#future");
    if (!g) return;
    const X0 = 150, X1 = 570, Y0 = 2026, Y1 = 2046, AX = 440;
    const X = (y) => X0 + ((y - Y0) / (Y1 - Y0)) * (X1 - X0);
    el("path", { d: `M${X0} ${AX} H${X1 + 14}`, class: "axis-line", "marker-end": "url(#arrow-head)" }, g);
    [2026, 2030, 2035, 2040, 2045].forEach((y) => {
      el("path", { d: `M${f(X(y))} ${AX} v8`, class: "axis-line" }, g);
      txt(g, String(y), { x: f(X(y)), y: AX + 34, "text-anchor": "middle", class: "axis-tick" });
    });
    // today
    el("path", { d: `M${f(X(2026.85))} 70 V${AX}`, class: "axis-line", style: "stroke-dasharray:4 5" }, g);
    txt(g, "today", { x: f(X(2026.85) + 8), y: 76, class: "fig-tag c-dim" });
    // [label, colour, y, [[from, to, solid?], ...]]
    const ROWS = [
      ["LHC, LHCb", "var(--aqua)", 150, [[2026.85, 2030, false], [2030, 2041, true, "HL-LHC"]], 0],
      ["Belle II", "var(--cyan)", 250, [[2026.85, 2042, true, "~50× Belle"]], 0],
      ["FCC-ee", "var(--lime)", 350, [[2030, 2045, false, "planning, construction"], [2045, 2046, true]], 1],
    ];
    ROWS.forEach(([label, col, y, segs, late], k) => {
      const grp = el("g", { class: late ? "on-1" : "" }, g);
      const inner = el("g", { class: "fadein", style: `--d:${(0.2 + 0.25 * k).toFixed(2)}s` }, grp);
      txt(inner, label, { x: 0, y: y + 7, class: "fig-tag", style: `fill:${col};font-weight:600` });
      segs.forEach(([a, b, solid, text]) => {
        el("rect", { x: f(X(a)), y: y - 18, width: f(X(b) - X(a)), height: 36, rx: 6, fill: solid ? col : "none", "fill-opacity": 0.26, stroke: col,
                     "stroke-width": solid ? 2.2 : 1.8, "stroke-opacity": solid ? 1 : 0.7, "stroke-dasharray": solid ? "none" : "6 5" }, inner);
        if (text) txt(inner, text, { x: f((X(a) + X(b)) / 2), y: y + 7, "text-anchor": "middle", class: "fig-tag", style: `fill:${col}` });
      });
      if (label === "FCC-ee") el("path", { d: `M${f(X(2046))} ${y} h14`, stroke: col, "stroke-width": 2.2, fill: "none", "marker-end": "url(#arrow-head)" }, inner);
    });
    // legend: dashed = preparation, solid = taking data
    const lg = el("g", {}, g);
    el("rect", { x: X0, y: 500, width: 34, height: 20, rx: 4, fill: "none", stroke: "var(--muted)", "stroke-width": 1.8, "stroke-dasharray": "6 5" }, lg);
    txt(lg, "preparation", { x: X0 + 44, y: 516, class: "fig-tag c-dim" });
    el("rect", { x: X0 + 210, y: 500, width: 34, height: 20, rx: 4, fill: "var(--muted)", "fill-opacity": 0.26, stroke: "var(--muted)", "stroke-width": 2.2 }, lg);
    txt(lg, "data and results", { x: X0 + 254, y: 516, class: "fig-tag c-dim" });
  }

  /* ---- divider: a wall of tables (grey, scrolling) with a few coloured plots over it ---- */
  function buildStats() {
    const wall = $("#s-part5 .wall"), plots = $("#s-part5 .plots");
    if (!wall) return;
    const rand = rng(9), gnum = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) * 1.1; };
    const f2 = (x, n = 2) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(n);
    const unc = (x, u) => `${f2(x)}±${u.toFixed(2)}`;
    // rows copied from the last tables of the paper, then rows of the same kind
    const REAL_A = [
      "α0A0   0.38±0.04  0.42±0.02    α0T1   0.34±0.04  0.30±0.01", "α1A0  −1.26±0.40  −0.98±0.24    α1T1  −0.77±0.32  −1.10±0.08",
      "α2A0   2.83±3.83  3.27±1.36    α2T1   0.93±2.76  0.58±1.00", "α0A1   0.30±0.03  0.29±0.01    α0T23  0.64±0.06  0.65±0.04",
    ];
    const NAMES = ["A0", "A1", "A12", "T1", "T2", "T23", "V", "+", "0", "T"];
    const rowA = () => { const k = () => NAMES[Math.floor(rand() * NAMES.length)], d = () => Math.floor(rand() * 3);
      return `α${d()}${k()}   ${unc(gnum() * 0.8, rand() * 0.6)}  ${unc(gnum() * 0.8, rand() * 0.4)}    α${d()}${k()}   ${unc(gnum() * 0.8, rand() * 0.6)}  ${unc(gnum() * 0.8, rand() * 0.4)}`; };
    const BINS = ["[0.1,0.98]", "[1.1,2.5]", "[2.5,4.0]", "[4.0,6.0]", "[6.0,8.0]", "[1.1,4.0]", "[15,17]", "[17,19]"];
    const rowB = (i) => `${BINS[i % BINS.length]}   ${[1, 2, 3, 4].map(() => `${f2(gnum() * 3, 2)} ±${(rand() * 0.9).toFixed(2)}`).join("   ")}`;
    const rowC = () => `χ² ${(rand() * 40 + 2).toFixed(1)}   dof ${Math.floor(rand() * 90 + 6)}   p ${rand().toFixed(2)}   ${f2(gnum() * 2)}σ`;
    const TABLES = [
      ["Table 12: SM predictions, angular observables, B⁰→K*⁰μ⁺μ⁻", "q² bin    F_L[10⁻¹]   S₃[10⁻²]   S₄[10⁻¹]   S₅[10⁻¹]", (i) => rowB(i), 11],
      ["Table 11: Posteriors of the Bs→φ local form factors", "Coefficient   This work   Ref.[29]      Coefficient   This work   Ref.[29]", (i) => (i < REAL_A.length ? REAL_A[i] : rowA()), 10],
      ["Table 5: χ², dof, p-values of the fits", "Fit                  χ²     dof    p      pull", () => rowC(), 9],
      ["Table 10: Posteriors of the B→K* local form factors", "Coefficient   This work   Ref.[29]      Coefficient   This work   Ref.[29]", () => rowA(), 11],
      ["Table 9: Posteriors of the B→K local form factors", "Coefficient   This work   Ref.[30]      Coefficient   This work   Ref.[30]", () => rowA(), 8],
      ["Table 13: SM predictions, Bs→φμ⁺μ⁻", "q² bin    F_L[10⁻¹]   S₃[10⁻²]   S₄[10⁻¹]   S₅[10⁻¹]", (i) => rowB(i + 3), 12],
    ];
    const rows = [];
    // a handful of table windows at random places (no two overlapping), each scrolling at its own speed
    const lay = rng(23), spots = [];
    for (let tries = 0; tries < 600 && spots.length < 9; tries++) {
      const w = 330 + lay() * 80, h = 130 + lay() * 110, x = 16 + lay() * (1280 - w - 32), y = 10 + lay() * (720 - h - 20);
      if (spots.every((s) => x > s.x + s.w + 4 || x + w + 4 < s.x || y > s.y + s.h + 4 || y + h + 4 < s.y)) spots.push({ x, y, w, h });
    }
    for (let c = 0; c < spots.length; c++) {
      const col = document.createElement("div");
      col.className = "wcol";
      const sp = spots[c];
      col.style.cssText = `left:${sp.x.toFixed(0)}px;top:${sp.y.toFixed(0)}px;width:${sp.w.toFixed(0)}px;height:${sp.h.toFixed(0)}px;--dur:${(70 + lay() * 40).toFixed(0)}s;--start:${(-lay() * 60).toFixed(0)}s`;
      const inner = document.createElement("div");
      inner.className = "wscroll";
      for (let rep = 0; rep < 2; rep++) {                         // twice, so the loop is seamless
        for (let t = 0; t < TABLES.length; t++) {
          const [cap, head, gen, n] = TABLES[(t + c * 2) % TABLES.length];
          const cp = document.createElement("div"); cp.className = "wcap"; cp.textContent = cap; inner.appendChild(cp);
          const hd = document.createElement("div"); hd.className = "whead"; hd.textContent = head; inner.appendChild(hd);
          for (let i = 0; i < n; i++) { const r = document.createElement("div"); r.className = "wrow"; r.textContent = gen(i); inner.appendChild(r); rows.push(r); }
          const sp = document.createElement("div"); sp.className = "wgap"; inner.appendChild(sp);
        }
      }
      col.appendChild(inner);
      wall.appendChild(col);
    }
    // a few rows light up at a time
    if (!reduce) setInterval(() => {
      if (!isPresent("s-part5")) return;
      for (let k = 0; k < 6; k++) {
        const r = rows[Math.floor(Math.random() * rows.length)];
        r.classList.add("hot");
        setTimeout(() => r.classList.remove("hot"), 700 + Math.random() * 700);
      }
    }, 180);

    // coloured plots that fade in and out over the wall
    const card = (cls, w, h, delay) => {
      const d = document.createElement("div");
      d.className = "pcard " + cls;
      d.style.setProperty("--pd", delay + "s");
      const s = document.createElementNS(NS, "svg");
      s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", w); s.setAttribute("height", h);
      d.appendChild(s); plots.appendChild(d);
      return s;
    };
    const axes = (s, w, h) => {
      el("path", { d: `M28 ${h - 22} V12`, stroke: "var(--muted)", "stroke-width": 1.6, fill: "none", "marker-end": "url(#arrow-head)" }, s);
      el("path", { d: `M28 ${h - 22} H${w - 10}`, stroke: "var(--muted)", "stroke-width": 1.6, fill: "none", "marker-end": "url(#arrow-head)" }, s);
    };
    // A: the SM band above the measurements
    const A = card("pa", 330, 210, 0);
    axes(A, 330, 210);
    const cA = [58, 57, 57, 56, 56, 55, 55, 54], hA = [5, 5, 5, 6, 7, 8, 10, 13];
    cA.forEach((c, i) => el("rect", { x: 36 + i * 35, y: c - hA[i], width: 35, height: 2 * hA[i], fill: "var(--magenta)", "fill-opacity": 0.34, stroke: "var(--magenta)", "stroke-width": 1.4 }, A));
    [[74, 12], [102, 10], [74 + 70, 11], [74 + 105, 9], [74 + 140, 10], [74 + 175, 9], [74 + 210, 11], [74 + 245, 10]].forEach(([x, e], i) => {
      const y = [92, 108, 94, 102, 110, 106, 104, 108][i];
      el("path", { d: `M${x - 15} ${y} H${x + 15} M${x} ${y - e} V${y + e}`, stroke: "var(--fg)", "stroke-width": 1.8, fill: "none" }, A);
      el("circle", { cx: x, cy: y, r: 3.4, fill: "var(--fg)" }, A);
    });
    // B: pulls of many observables
    const B = card("pb", 330, 210, 5);
    axes(B, 330, 210);
    el("path", { d: "M28 100 H320", stroke: "var(--line)", "stroke-width": 1.4, "stroke-dasharray": "5 5" }, B);
    const pr = rng(5);
    for (let i = 0; i < 20; i++) {
      let v = 0; for (let k = 0; k < 6; k++) v += pr(); v = (v - 3) * 2.1; if (i === 3 || i === 11) v = -2.6;
      const col = Math.abs(v) < 1 ? "var(--aqua)" : Math.abs(v) < 2 ? "var(--cyan)" : "var(--magenta)", hh = v * 26;
      el("rect", { x: 38 + i * 14.2, y: hh >= 0 ? 100 - hh : 100, width: 9, height: Math.abs(hh), rx: 1.5, fill: col }, B);
    }
    // C: allowed region of two parameters, away from the SM point
    const C = card("pc", 330, 210, 10);
    axes(C, 330, 210);
    [[86, 34, 0.12], [58, 23, 0.2], [30, 12, 0.34]].forEach(([rx, ry, a]) =>
      el("ellipse", { cx: 150, cy: 92, rx, ry, transform: "rotate(-24 150 92)", fill: "var(--aqua)", "fill-opacity": a, stroke: "var(--aqua)", "stroke-width": 1.5 }, C));
    el("path", { d: "M250 140 l-9 -9 m18 0 l-18 18 M250 140 l9 9", stroke: "var(--magenta)", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, C);
    el("path", { d: "M241 131 L259 149 M259 131 L241 149", stroke: "var(--magenta)", "stroke-width": 3, "stroke-linecap": "round" }, C);
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
  buildVacuum();
  buildWays();
  buildInvisible();
  buildHistory();
  buildNP();
  buildMeasure();
  buildSeries();
  buildSumRules();
  buildFormulas();
  buildMatching();
  buildCharm();
  buildTension();
  buildTension("tension-take");   // the same plot again on the take-home slide
  buildFork();
  buildStats();
  buildFuture();
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

  // divider: fuzzy glowing circles (all the same size, like the Sun) rising like in a liquid: mostly grey, a few in the three colours
  const bc = $("#s-part1 .bubbles");
  if (bc) {
    const G = "var(--grey-rgb)";
    const GLOW = [G, G, G, G, G, G, G, G, "var(--aqua-rgb)", G, G, G, G, G, G, G, G, "var(--magenta-rgb)", G, G, G, G, G, G, G, G, "var(--cyan-rgb)"];   // about 1 in 9 coloured, the three colours equally
    for (let i = 0; i < 72; i++) {
      const b = document.createElement("span"), dur = 20 + Math.random() * 10, rgb = GLOW[i % GLOW.length];
      b.className = "bubble";
      b.style.cssText = `left:${(Math.random() * 93).toFixed(1)}%;--c:${rgb};` +
        `--dur:${dur.toFixed(1)}s;--delay:${(-Math.random() * dur).toFixed(1)}s;--o:${(rgb === G ? 0.45 + Math.random() * 0.3 : 0.6 + Math.random() * 0.3).toFixed(2)};` +
        `--sway:${((Math.random() - 0.5) * 80).toFixed(0)}px;--ty:${(-Math.random() * 760).toFixed(0)}px`;
      bc.appendChild(b);
    }
  }

  // Conclusion divider: tracks come in from all sides and meet around the title (the pieces come together)
  const cv = $("#converge");
  if (cv) {
    const rand = rng(61), CX = 640, CY = 360, COLS = ["var(--aqua)", "var(--magenta)", "var(--cyan)"];
    for (let i = 0; i < 54; i++) {
      const a = rand() * 2 * Math.PI, bend = (rand() - 0.5) * 1.1, R0 = 330 + rand() * 60, R1 = 190 + rand() * 70;
      const p = (R, ang) => [CX + R * 1.5 * Math.cos(ang), CY + R * 0.85 * Math.sin(ang)];   // the picture is wider than tall: tracks stay inside it
      const s = p(R0, a), e = p(R1, a + bend), c = p((R0 + R1) / 2, a + bend * 0.2);
      const colour = i % 5 === 2 ? COLS[(i / 5 | 0) % 3] : "var(--track)";
      const dur = 7 + rand() * 4;
      el("path", { d: `M${f(s[0])} ${f(s[1])} Q${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`, class: "cv-line", pathLength: 1, stroke: colour,
                   "stroke-width": colour === "var(--track)" ? 1.4 : 2.4,
                   style: `--dur:${dur.toFixed(1)}s;--delay:${(rand() * 5).toFixed(1)}s;--o:${colour === "var(--track)" ? (0.35 + rand() * 0.25).toFixed(2) : (0.55 + rand() * 0.3).toFixed(2)}` }, cv);
    }
  }

  // closing slide: now and then one letter lights up in a colour
  const thanks = $("#thanks");
  if (thanks) {
    const word = thanks.textContent;
    thanks.textContent = "";
    const letters = [...word].map((ch) => { const sp = document.createElement("span"); sp.className = "tl"; sp.textContent = ch; thanks.appendChild(sp); return sp; }).filter((sp) => sp.textContent.trim());
    const COLS = ["var(--aqua)", "var(--magenta)", "var(--cyan)", "var(--lime)"];
    if (!reduce) setInterval(() => {
      if (!isPresent("s-end")) return;
      const idle = letters.filter((l) => !l.style.color);
      const sp = idle[Math.floor(Math.random() * idle.length)];
      sp.style.color = COLS[Math.floor(Math.random() * COLS.length)];
      setTimeout(() => { sp.style.color = ""; }, 2800);   // lit a bit longer than the gap between two letters, so two colours overlap for a moment
    }, 2000);
  }

  // no single word alone on the last line: the last two words of each paragraph are joined by a non-breaking space
  document.querySelectorAll(".reveal .slides :is(.text p, blockquote p, cite, .proscons li)").forEach((p) => {
    const nodes = [];
    const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement.closest(".katex")) nodes.push(n);
    let i = nodes.length - 1;
    while (i >= 0 && !nodes[i].data.trim()) i--;
    if (i < 0) return;
    const end = nodes[i].data.replace(/\s+$/, "").length;
    let j = nodes[i].data.lastIndexOf(" ", end - 1);
    const before = nodes[i].previousSibling;
    if (j === 0 && before && before.nodeType === 1) {   // " word" right after an equation symbol: keep both on one line
      const keep = document.createElement("span");
      keep.className = "nobr";
      before.parentNode.insertBefore(keep, before);
      keep.appendChild(before);
      keep.appendChild(nodes[i]);
      return;
    }
    if (j >= 0) { nodes[i].data = nodes[i].data.slice(0, j) + "\u00A0" + nodes[i].data.slice(j + 1); return; }
    for (let k = i - 1; k >= 0; k--) {          // the last word stands alone in its text node: bind it to the word before
      const s = nodes[k].data.replace(/\s+$/, ""), m = s.lastIndexOf(" ");
      if (nodes[k].data.endsWith(" ")) { nodes[k].data = nodes[k].data.slice(0, -1) + "\u00A0"; return; }
      if (m >= 0 && nodes[k].data.trim()) { nodes[k].data = s.slice(0, m) + "\u00A0" + s.slice(m + 1) + nodes[k].data.slice(s.length); return; }
    }
  });

  // safety net: SVG text has no colour of its own and would default to black on the dark background;
  // a presentation attribute gives every label a light default, and any CSS rule still overrides it
  document.querySelectorAll(".reveal svg text").forEach((t) => { if (!t.hasAttribute("fill")) t.setAttribute("fill", "var(--fg)"); });

  Reveal.initialize({
    width: 1280, height: 720, margin: 0.04, center: false, hash: true,
    transition: "fade", backgroundTransition: "none",
    controls: false, controlsTutorial: false, progress: true, slideNumber: "c",
    plugins: window.RevealNotes ? [window.RevealNotes] : [],
  });

  // colour theme: dark (default) or light; ?theme=light in the link, the key T switches
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch (err) {}
  };
  {
    let t = new URLSearchParams(location.search).get("theme");
    if (t !== "light" && t !== "dark") { try { t = localStorage.getItem("theme"); } catch (err) { t = null; } }
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  }
  Reveal.addKeyBinding({ keyCode: 84, key: "T", description: "Switch between the dark and the light colours" },
    () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));

  // the title slide and the part dividers carry no page number
  const showNumber = () => {
    const n = document.querySelector(".reveal .slide-number");
    if (n) n.style.visibility = Reveal.getCurrentSlide()?.dataset.visibility === "uncounted" ? "hidden" : "visible";
  };
  Reveal.on("ready", showNumber);
  Reveal.on("slidechanged", showNumber);
  // the event display lives outside the slides and stays on from the title to the outline
  const showEvent = () => document.querySelector(".reveal").classList.toggle("show-event", ["s-title", "s-outline"].includes(Reveal.getCurrentSlide()?.id));
  Reveal.on("ready", showEvent);
  Reveal.on("slidechanged", showEvent);
  const restage = () => applyStage(Reveal.getCurrentSlide());
  const ONCE = { "s-basic": "#basic", "s-purpose": "#rutherford", "s-lhc1": "#lhc", "s-lhcb": "#lhcb", "s-belle": "#belle" };
  const restartOnce = (id) => {
    if (id === "s-part4") placeFormulas();
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

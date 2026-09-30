'use strict';
/* Легенди Двох Кланів — браузерна версія */
(() => {
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, zoom = 1.5;

// ============ helpers ============
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

// ============ world gen ============
const T = 32, MW = 96, MH = 72;
const R = mulberry32(20260930);
const NG = 64, nv = new Float32Array(NG * NG); for (let i = 0; i < nv.length; i++) nv[i] = R();
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const g = (a, b) => nv[((b & 63) * NG) + (a & 63)];
  const s = t => t * t * (3 - 2 * t);
  const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1), u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vn(x / 9, y / 9) * .55 + vn(x / 4.5 + 17, y / 4.5 + 9) * .3 + vn(x / 2 + 31, y / 2 + 5) * .15;

const GRASS = 0, DARK = 1, DIRT = 2, WATER = 3, STONE = 4;
const G = new Uint8Array(MW * MH), S = new Uint8Array(MW * MH), RES = new Uint8Array(MW * MH);
const idx = (x, y) => y * MW + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const objs = [], decals = [], lights = [];
const CAMP = { tx: 48, ty: 36 }, GRAVE = { tx: 76, ty: 14 }, SWAMP = { tx: 18, ty: 56 }, CRYPT = { tx: 86, ty: 40 };
const tdist = (x, y, p) => Math.hypot(x - p.tx, y - p.ty);
const tc = t => t * T + T / 2;

function carve(ax, ay, bx, by, seed) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.sin(t * Math.PI) * (vn(t * 6 + seed, seed) - .5) * 10;
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    const x = Math.round(lerp(ax, bx, t) + nx / nl * w), y = Math.round(lerp(ay, by, t) + ny / nl * w);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= 1 && G[idx(X, Y)] !== STONE) G[idx(X, Y)] = DIRT;
      else if (G[idx(X, Y)] === WATER) G[idx(X, Y)] = DARK;
      RES[idx(X, Y)] = 1;
    }
  }
}
function addObj(type, tx, ty, solid = true, extra) {
  const o = Object.assign({ type, tx, ty, x: tc(tx), y: ty * T + T - 3 }, extra || {});
  objs.push(o); if (solid) S[idx(tx, ty)] = 1; return o;
}
function genWorld() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const n = fbm(x, y), i = idx(x, y);
    G[i] = n < .46 ? DARK : GRASS;
    if (n < .3 && tdist(x, y, CAMP) > 12) G[i] = WATER;
    const ds = tdist(x, y, SWAMP);
    if (ds < 13) { const m = fbm(x * 1.7 + 40, y * 1.7); G[i] = m < .44 ? WATER : DARK; }
    if (tdist(x, y, GRAVE) < 11) G[i] = DARK;
  }
  // camp
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const d = tdist(x, y, CAMP);
    if (d < 6.5) G[idx(x, y)] = DIRT;
    if (d < 8.5) { RES[idx(x, y)] = 1; if (G[idx(x, y)] === WATER) G[idx(x, y)] = GRASS; }
  }
  // crypt
  for (let y = CRYPT.ty - 6; y <= CRYPT.ty + 6; y++) for (let x = CRYPT.tx - 6; x <= CRYPT.tx + 6; x++) {
    if (!inb(x, y)) continue; const i = idx(x, y);
    G[i] = STONE; RES[i] = 1;
  }
  carve(CAMP.tx, CAMP.ty, GRAVE.tx - 2, GRAVE.ty + 3, 3);
  carve(CAMP.tx, CAMP.ty, SWAMP.tx + 3, SWAMP.ty - 3, 7);
  carve(CAMP.tx, CAMP.ty, CRYPT.tx - 8, CRYPT.ty, 11);
  carve(CAMP.tx, CAMP.ty, 44, 6, 13);
  carve(CAMP.tx, CAMP.ty, 58, 66, 17);
  carve(CAMP.tx, CAMP.ty, 8, 30, 19);
  // crypt walls
  for (let y = CRYPT.ty - 5; y <= CRYPT.ty + 5; y++) for (let x = CRYPT.tx - 5; x <= CRYPT.tx + 5; x++) {
    const edge = x === CRYPT.tx - 5 || x === CRYPT.tx + 5 || y === CRYPT.ty - 5 || y === CRYPT.ty + 5;
    if (edge && !(x === CRYPT.tx - 5 && Math.abs(y - CRYPT.ty) <= 1)) addObj('wall', x, y);
  }
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) addObj('pillar', CRYPT.tx + dx, CRYPT.ty + dy);
  lights.push({ x: tc(CRYPT.tx), y: tc(CRYPT.ty), r: 150, col: 'rgba(170,80,255,' });
  // camp
  const c = CAMP;
  const fire = addObj('fire', c.tx, c.ty); lights.push({ x: fire.x, y: fire.y - 8, r: 230, col: 'rgba(255,170,70,', fire: 1 });
  addObj('tent', c.tx - 4, c.ty - 3); addObj('tent', c.tx + 4, c.ty - 3); addObj('tent', c.tx, c.ty - 5);
  addObj('barrel', c.tx + 5, c.ty + 2); addObj('barrel', c.tx + 5, c.ty + 3); addObj('crate', c.tx - 5, c.ty + 3);
  addObj('banner', c.tx - 2, c.ty - 4, true); addObj('banner', c.tx + 2, c.ty - 4, true);
  // border
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = idx(x, y);
    if (G[i] === WATER) S[i] = 1;
    if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) {
      if (G[i] === WATER) G[i] = DARK;
      if (!S[i]) addObj(R() < .6 ? 'pine' : 'tree', x, y, true, { v: R() });
      S[i] = 1;
    }
  }
  // scatter
  for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) {
    const i = idx(x, y); if (RES[i] || S[i] || G[i] === WATER) continue;
    const dg = tdist(x, y, GRAVE), ds = tdist(x, y, SWAMP);
    if (dg < 9.5) {
      if (x % 3 === 0 && y % 3 === 1 && R() < .8) addObj('grave', x, y, true, { v: R() });
      else if (R() < .04) addObj('tree', x, y, true, { v: R() });
      else if (R() < .06) decals.push({ t: 'bones', x, y, v: R() });
      continue;
    }
    if (ds < 13) {
      if (R() < .09) addObj('tree', x, y, true, { v: R() });
      else if (R() < .07) { decals.push({ t: 'shroom', x, y, v: R() }); }
      continue;
    }
    const n = fbm(x + 50, y + 50);
    if (n > .6 && R() < .5) addObj(R() < .55 ? 'tree' : 'pine', x, y, true, { v: R() });
    else if (R() < .014) addObj('rock', x, y, true, { v: R() });
    else if (R() < .004) addObj('grave', x, y, true, { v: R() });
    else if (R() < .05) decals.push({ t: R() < .5 ? 'tuft' : (R() < .5 ? 'flower' : 'bones'), x, y, v: R() });
  }
  for (const d of decals) if (d.t === 'shroom') lights.push({ x: tc(d.x), y: tc(d.y), r: 60, col: 'rgba(90,255,190,' });
  objs.sort((a, b) => a.y - b.y);
}

// ============ sprites ============
function spr(w, h, fn) { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); fn(g, w, h); c.w = w; c.h = h; return c; }
const SPR = {};
function buildSprites() {
  for (let v = 0; v < 3; v++) SPR['tree' + v] = spr(56, 72, (g, w, h) => {
    const cx = w / 2, b = h - 4;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 16, 5);
    g.strokeStyle = '#2b1e17'; g.lineCap = 'round';
    g.lineWidth = 7; g.beginPath(); g.moveTo(cx, b); g.quadraticCurveTo(cx - 3 + v * 2, b - 22, cx + 2 - v, b - 40); g.stroke();
    g.lineWidth = 3;
    const br = [[-16, -46, -24, -58], [14, -50, 22, -62], [-8, -54, -6, -66], [10, -36, 20, -40], [-12, -32, -20, -30]];
    for (let k = 0; k < br.length; k++) {
      if (k === 4 && v === 2) continue;
      const [a1, b1, a2, b2] = br[k];
      g.beginPath(); g.moveTo(cx + (k > 2 ? 0 : 1), b - (k > 2 ? 30 : 38)); g.quadraticCurveTo(cx + a1, b + b1, cx + a2 + v * 2, b + b2); g.stroke();
    }
    g.strokeStyle = '#4a3528'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 1, b - 2); g.quadraticCurveTo(cx - 3, b - 20, cx, b - 36); g.stroke();
    if (v !== 1) { g.fillStyle = 'rgba(110,70,140,.55)'; for (let k = 0; k < 7; k++) circ(g, cx + Math.sin(k * 2.3 + v) * 18, b - 46 - Math.cos(k * 1.7) * 12, 2.5); }
  });
  for (let v = 0; v < 2; v++) SPR['pine' + v] = spr(52, 78, (g, w, h) => {
    const cx = w / 2, b = h - 4;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 17, 6);
    g.fillStyle = '#2a1b12'; g.fillRect(cx - 3, b - 12, 6, 12);
    const cols = v ? ['#15271f', '#1d3529', '#27463a'] : ['#1a2a22', '#223a2e', '#2e4c3c'];
    for (let k = 0; k < 4; k++) {
      const yb = b - 8 - k * 14, hw = 22 - k * 4.5;
      g.fillStyle = cols[0]; g.beginPath(); g.moveTo(cx - hw, yb); g.lineTo(cx, yb - 26); g.lineTo(cx + hw, yb); g.closePath(); g.fill();
      g.fillStyle = cols[1]; g.beginPath(); g.moveTo(cx - hw + 3, yb - 2); g.lineTo(cx, yb - 26); g.lineTo(cx + 2, yb - 2); g.closePath(); g.fill();
      g.fillStyle = cols[2]; g.fillRect(cx - hw + 5, yb - 3, hw * .6, 2);
    }
  });
  for (let v = 0; v < 2; v++) SPR['rock' + v] = spr(36, 28, (g, w, h) => {
    const cx = w / 2, b = h - 3;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 15, 4);
    g.fillStyle = '#4e4b55'; g.beginPath(); g.moveTo(cx - 14, b); g.lineTo(cx - 12, b - 12 - v * 3); g.lineTo(cx - 3, b - 19); g.lineTo(cx + 9, b - 15); g.lineTo(cx + 14, b - 4); g.lineTo(cx + 12, b); g.closePath(); g.fill();
    g.fillStyle = '#6c6975'; g.beginPath(); g.moveTo(cx - 11, b - 11 - v * 3); g.lineTo(cx - 3, b - 18); g.lineTo(cx + 8, b - 14); g.lineTo(cx, b - 10); g.closePath(); g.fill();
    g.fillStyle = '#3b6b3a'; g.fillRect(cx - 12, b - 3, 8, 2);
  });
  for (let v = 0; v < 2; v++) SPR['grave' + v] = spr(24, 32, (g, w, h) => {
    const cx = w / 2, b = h - 3;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 10, 3);
    g.fillStyle = '#3d2f25'; ell(g, cx, b - 1, 8, 3);
    if (v) {
      g.fillStyle = '#7b7884'; g.fillRect(cx - 2, b - 24, 4, 22); g.fillRect(cx - 8, b - 19, 16, 4);
      g.fillStyle = '#9a97a3'; g.fillRect(cx - 2, b - 24, 2, 22);
    } else {
      g.fillStyle = '#6c6975'; rr(g, cx - 7, b - 20, 14, 19, 6); g.fill();
      g.fillStyle = '#86838f'; rr(g, cx - 7, b - 20, 5, 19, 3); g.fill();
      g.fillStyle = '#4a4752'; g.fillRect(cx - 1, b - 16, 2, 8); g.fillRect(cx - 3, b - 13, 6, 2);
      g.fillStyle = '#3f6b3a'; g.fillRect(cx - 7, b - 5, 5, 3);
    }
  });
  SPR.tent = spr(64, 52, (g, w, h) => {
    const cx = w / 2, b = h - 3;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 28, 6);
    g.fillStyle = '#6b5236'; g.beginPath(); g.moveTo(cx - 28, b); g.lineTo(cx, b - 40); g.lineTo(cx + 28, b); g.closePath(); g.fill();
    g.fillStyle = '#86683f'; g.beginPath(); g.moveTo(cx - 28, b); g.lineTo(cx, b - 40); g.lineTo(cx - 4, b); g.closePath(); g.fill();
    g.fillStyle = '#231710'; g.beginPath(); g.moveTo(cx - 8, b); g.lineTo(cx, b - 22); g.lineTo(cx + 8, b); g.closePath(); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, b - 40); g.lineTo(cx, b - 46); g.stroke();
  });
  SPR.wall = spr(32, 52, (g, w, h) => {
    const b = h;
    g.fillStyle = '#2e2b36'; g.fillRect(0, b - 22, 32, 22);
    g.fillStyle = '#4b4757'; g.fillRect(0, b - 52, 32, 30);
    g.strokeStyle = '#36323f'; g.lineWidth = 1;
    for (let r = 0; r < 3; r++) { g.beginPath(); g.moveTo(0, b - 22 - r * 10 + .5); g.lineTo(32, b - 22 - r * 10 + .5); g.stroke(); const o = r % 2 ? 8 : 0; for (let k = o; k < 32; k += 16) { g.beginPath(); g.moveTo(k + .5, b - 32 - r * 10); g.lineTo(k + .5, b - 22 - r * 10); g.stroke(); } }
    g.fillStyle = '#5c5869'; g.fillRect(0, b - 52, 32, 3);
    g.fillStyle = '#25222c'; for (let r = 0; r < 2; r++) g.fillRect(0, b - 12 - r * 10, 32, 1);
  });
  SPR.pillar = spr(26, 64, (g, w, h) => {
    const b = h - 3, cx = w / 2;
    g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, cx, b, 12, 4);
    g.fillStyle = '#3a3645'; g.fillRect(cx - 10, b - 8, 20, 8);
    g.fillStyle = '#56526a'; g.fillRect(cx - 7, b - 54, 14, 48);
    g.fillStyle = '#6d6982'; g.fillRect(cx - 7, b - 54, 4, 48);
    g.fillStyle = '#3a3645'; g.fillRect(cx - 10, b - 60, 20, 7);
    g.fillStyle = 'rgba(180,110,255,.8)'; circ(g, cx, b - 34, 2.5);
  });
  SPR.barrel = spr(24, 30, (g, w, h) => {
    const cx = w / 2, b = h - 3;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 10, 3);
    g.fillStyle = '#6a4526'; rr(g, cx - 8, b - 20, 16, 20, 4); g.fill();
    g.fillStyle = '#835a33'; g.fillRect(cx - 7, b - 19, 4, 18);
    g.fillStyle = '#2b2b30'; g.fillRect(cx - 8, b - 16, 16, 2); g.fillRect(cx - 8, b - 6, 16, 2);
    g.fillStyle = '#4a2e18'; ell(g, cx, b - 20, 8, 2.5);
  });
  SPR.crate = spr(28, 30, (g, w, h) => {
    const cx = w / 2, b = h - 3;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx, b, 12, 3);
    g.fillStyle = '#7a5530'; g.fillRect(cx - 11, b - 20, 22, 20);
    g.strokeStyle = '#4d331a'; g.lineWidth = 2; g.strokeRect(cx - 10, b - 19, 20, 18);
    g.beginPath(); g.moveTo(cx - 10, b - 19); g.lineTo(cx + 10, b - 1); g.stroke();
  });
}

// ============ ground render ============
let mapCv = null, miniBase = null;
const GC = { [GRASS]: ['#39432c', '#434e33', '#2f3824'], [DARK]: ['#2e2f2a', '#363629', '#262620'], [DIRT]: ['#4e3d2b', '#5a4733', '#433425'], [WATER]: ['#1b3440', '#214050', '#16303a'], [STONE]: ['#3b3844', '#45424f', '#33303b'] };
function renderGround() {
  mapCv = document.createElement('canvas'); mapCv.width = MW * T; mapCv.height = MH * T;
  const g = mapCv.getContext('2d');
  const r = mulberry32(99);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = G[idx(x, y)], c = GC[t], px = x * T, py = y * T;
    g.fillStyle = c[0]; g.fillRect(px, py, T, T);
    if (t === STONE) {
      g.fillStyle = c[1]; g.fillRect(px + 1, py + 1, 14, 14); g.fillRect(px + 17, py + 17, 14, 14);
      g.fillStyle = c[2]; g.fillRect(px + 17, py + 1, 14, 14); g.fillRect(px + 1, py + 17, 14, 14);
      continue;
    }
    for (let k = 0; k < 9; k++) {
      g.fillStyle = c[r() < .5 ? 1 : 2];
      const sx = px + r() * T, sy = py + r() * T;
      if (t === GRASS || t === DARK) g.fillRect(sx, sy, 1, 3); else g.fillRect(sx, sy, 2, 2);
    }
    if (t === WATER) {
      g.fillStyle = 'rgba(120,180,200,.12)'; g.fillRect(px + r() * 20, py + r() * 28, 10, 1);
      const nb = (dx, dy) => { const X = x + dx, Y = y + dy; return inb(X, Y) && G[idx(X, Y)] !== WATER; };
      g.fillStyle = '#2c4b3a';
      if (nb(0, -1)) g.fillRect(px, py, T, 4);
      if (nb(0, 1)) g.fillRect(px, py + T - 3, T, 3);
      if (nb(-1, 0)) g.fillRect(px, py, 3, T);
      if (nb(1, 0)) g.fillRect(px + T - 3, py, 3, T);
    }
    if (t === DIRT) {
      const nb = (dx, dy) => { const X = x + dx, Y = y + dy; return inb(X, Y) && (G[idx(X, Y)] === GRASS || G[idx(X, Y)] === DARK); };
      g.fillStyle = 'rgba(40,50,30,.45)';
      if (nb(0, -1)) for (let k = 0; k < 6; k++) g.fillRect(px + r() * T, py, 3, 2 + r() * 4);
      if (nb(0, 1)) for (let k = 0; k < 6; k++) g.fillRect(px + r() * T, py + T - 4, 3, 4);
      if (nb(-1, 0)) for (let k = 0; k < 6; k++) g.fillRect(px, py + r() * T, 2 + r() * 4, 3);
      if (nb(1, 0)) for (let k = 0; k < 6; k++) g.fillRect(px + T - 4, py + r() * T, 4, 3);
    }
  }
  // camp ring stones
  for (let a = 0; a < 24; a++) {
    const ang = a / 24 * Math.PI * 2, x = tc(CAMP.tx) + Math.cos(ang) * 6.3 * T, y = tc(CAMP.ty) + Math.sin(ang) * 6.3 * T;
    g.fillStyle = '#58545f'; ell(g, x, y, 5, 3.5); g.fillStyle = '#6f6b78'; ell(g, x - 1, y - 1, 3, 2);
  }
  // crypt rune circle
  g.strokeStyle = 'rgba(160,90,240,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(tc(CRYPT.tx), tc(CRYPT.ty), 60, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(tc(CRYPT.tx), tc(CRYPT.ty), 44, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2, a2 = (k + 2) / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(tc(CRYPT.tx) + Math.cos(a) * 44, tc(CRYPT.ty) + Math.sin(a) * 44); g.lineTo(tc(CRYPT.tx) + Math.cos(a2) * 44, tc(CRYPT.ty) + Math.sin(a2) * 44); g.stroke(); }
  for (const d of decals) {
    const x = d.x * T + 6 + d.v * 18, y = d.y * T + 8 + ((d.v * 7) % 1) * 16;
    if (d.t === 'tuft') { g.fillStyle = '#4d5a37'; for (let k = 0; k < 5; k++) g.fillRect(x + k * 2 - 4, y - 3 - (k % 2) * 2, 1, 5 + (k % 2) * 2); }
    else if (d.t === 'flower') { g.fillStyle = '#4d5a37'; g.fillRect(x, y - 4, 1, 5); g.fillStyle = '#a06bd1'; circ(g, x, y - 5, 2); }
    else if (d.t === 'bones') { g.fillStyle = '#cfc8b4'; g.fillRect(x - 5, y, 10, 2); circ(g, x - 5, y + 1, 1.8); circ(g, x + 5, y + 1, 1.8); circ(g, x + 8, y - 5, 3.2); g.fillStyle = '#2a2520'; g.fillRect(x + 7, y - 6, 1, 1); g.fillRect(x + 9, y - 6, 1, 1); }
    else if (d.t === 'shroom') { for (let k = 0; k < 3; k++) { const sx = x + k * 5 - 5, sy = y + (k % 2) * 3; g.fillStyle = '#d8e8d8'; g.fillRect(sx, sy - 3, 2, 4); g.fillStyle = '#4fe0a8'; ell(g, sx + 1, sy - 3, 3.5, 2); } }
  }
  // minimap base
  miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
  const m = miniBase.getContext('2d'), im = m.createImageData(MW, MH);
  const MC = { [GRASS]: [58, 70, 44], [DARK]: [48, 49, 42], [DIRT]: [120, 96, 66], [WATER]: [30, 70, 90], [STONE]: [90, 84, 104] };
  for (let i = 0; i < MW * MH; i++) { let c = MC[G[i]]; if (S[i] && G[i] !== WATER) c = [26, 34, 28]; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
  m.putImageData(im, 0, 0);
}

// ============ collision & paths ============
function solidPx(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return !inb(tx, ty) || S[idx(tx, ty)] === 1; }
function canStand(x, y, r) { return !solidPx(x - r, y - r * .6) && !solidPx(x + r, y - r * .6) && !solidPx(x - r, y + r * .4) && !solidPx(x + r, y + r * .4); }
function moveEnt(e, dx, dy) {
  const r = e.cr || 7; let moved = 0;
  if (dx && canStand(e.x + dx, e.y, r)) { e.x += dx; moved += Math.abs(dx); }
  if (dy && canStand(e.x, e.y + dy, r)) { e.y += dy; moved += Math.abs(dy); }
  return moved;
}
function losClear(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!canStand(lerp(ax, bx, t), lerp(ay, by, t), 6)) return false; }
  return true;
}
function findPath(sx, sy, gx, gy) {
  let stx = Math.floor(sx / T), sty = Math.floor(sy / T), gtx = Math.floor(gx / T), gty = Math.floor(gy / T);
  if (!inb(gtx, gty)) return null;
  if (S[idx(gtx, gty)]) {
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = gtx + dx, Y = gty + dy; if (inb(X, Y) && !S[idx(X, Y)]) { const d = Math.hypot(X * T + 16 - sx, Y * T + 16 - sy) * .2 + Math.hypot(dx, dy); if (d < bd) { bd = d; best = [X, Y]; } } }
    if (!best) return null; gtx = best[0]; gty = best[1]; gx = tc(gtx); gy = tc(gty);
  }
  const N = MW * MH, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const s = idx(stx, sty), goal = idx(gtx, gty); gs[s] = 0; push(s, 0);
  const h = i => { const x = i % MW, y = (i / MW) | 0; const dx = Math.abs(x - gtx), dy = Math.abs(y - gty); return Math.max(dx, dy) + .41 * Math.min(dx, dy); };
  let it = 0, found = false;
  while (heap.length && it++ < 6000) {
    const [, cur] = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const X = cx + dx, Y = cy + dy; if (!inb(X, Y)) continue; const ni = idx(X, Y); if (S[ni] || closed[ni]) continue;
      if (dx && dy && (S[idx(cx + dx, cy)] || S[idx(cx, cy + dy)])) continue;
      const ng = gs[cur] + (dx && dy ? 1.414 : 1);
      if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; push(ni, ng + h(ni)); }
    }
  }
  if (!found) return null;
  const pts = []; let c = goal; while (c !== s && c !== -1) { pts.push({ x: tc(c % MW), y: tc((c / MW) | 0) }); c = came[c]; }
  pts.reverse(); if (pts.length) pts[pts.length - 1] = { x: gx, y: gy };
  // smooth
  const out = []; let ax = sx, ay = sy, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !losClear(ax, ay, pts[j].x, pts[j].y)) j--; out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1; }
  return out;
}

// ============ classes ============
const CLASSES = {
  paladin: {
    faction: 'light', name: 'Паладин', desc: 'Воїн світла в латах. Витривалий, лікує себе і б\'є святим світлом навколо.',
    hp: 150, mp: 70, atk: 14, range: 36, speed: 92, armor: .15,
    look: { skin: '#e6b894', armor: '#b9bfcc', armor2: '#8b93a6', trim: '#e8c170', legs: '#5b6275', boots: '#3a2c22', head: 'helm', weapon: 'sword', shield: '#2f5cb5', cape: '#2f5cb5' },
    skills: [
      { n: 'Удар мечем', i: '⚔️', mp: 0, cd: 1.1, range: 'melee', t: 'melee', p: 1 },
      { n: 'Щит світла', i: '🛡️', mp: 20, cd: 14, t: 'buff', buff: 'shield', dur: 6, d: 'Шкода по тобі −60% на 6 с' },
      { n: 'Кара', i: '✨', mp: 25, cd: 7, t: 'aoe', radius: 80, p: 1.7, color: '255,230,150' },
      { n: 'Зцілення', i: '💛', mp: 30, cd: 12, t: 'heal', p: .4 }]
  },
  mage: {
    faction: 'light', name: 'Маг', desc: 'Повелитель стихій. Крихкий, але б\'є здалеку вогнем і кригою.',
    hp: 95, mp: 140, atk: 14, range: 175, speed: 96, armor: 0,
    look: { skin: '#e6b894', armor: '#3b4fa8', armor2: '#2a3a80', trim: '#e8c170', legs: '#2a3a80', boots: '#2a1d14', head: 'hat', weapon: 'staff', orb: '#ff9a3a', robe: 1, beard: 1 },
    skills: [
      { n: 'Магічна стріла', i: '✴️', mp: 0, cd: 1.2, range: 175, t: 'proj', p: 1, color: '185,163,255' },
      { n: 'Вогняна куля', i: '🔥', mp: 18, cd: 4, range: 210, t: 'proj', p: 2.3, color: '255,122,42', big: 1 },
      { n: 'Крижаний вибух', i: '❄️', mp: 25, cd: 10, t: 'aoe', radius: 95, p: 1.1, slow: 3, color: '159,231,255' },
      { n: 'Телепорт', i: '🌀', mp: 15, cd: 8, t: 'blink', dist: 140 }]
  },
  necro: {
    faction: 'dark', name: 'Некромант', desc: 'Володар смерті. Проклинає ворогів, висмоктує життя і кличе скелета.',
    hp: 100, mp: 130, atk: 13, range: 165, speed: 95, armor: .03,
    look: { skin: '#9fb59a', armor: '#2e2640', armor2: '#1d1829', trim: '#6dff8a', legs: '#1d1829', boots: '#161018', head: 'hood', weapon: 'scythe', orb: '#6dff8a', robe: 1, eyes: '#6dff8a' },
    skills: [
      { n: 'Тіньова стріла', i: '🟣', mp: 0, cd: 1.2, range: 165, t: 'proj', p: 1, color: '154,92,255' },
      { n: 'Прокляття', i: '☠️', mp: 18, cd: 6, range: 190, t: 'dot', p: 3.2, dur: 6, color: '109,255,138' },
      { n: 'Скелет-слуга', i: '💀', mp: 35, cd: 22, t: 'summon', dur: 25 },
      { n: 'Висмоктування', i: '🩸', mp: 22, cd: 8, range: 160, t: 'drain', p: 1.7, color: '255,59,92' }]
  },
  warrior: {
    faction: 'dark', name: 'Воїн', desc: 'Мертвий берсерк із сокирою. Вривається в бій і рубає всіх навколо.',
    hp: 165, mp: 55, atk: 16, range: 36, speed: 92, armor: .12,
    look: { skin: '#8a9a88', armor: '#5b4a45', armor2: '#3d302c', trim: '#b04030', legs: '#3d302c', boots: '#1d1512', head: 'horned', weapon: 'axe', eyes: '#ff4030', cape: '#5a1a18' },
    skills: [
      { n: 'Удар сокирою', i: '🪓', mp: 0, cd: 1.2, range: 'melee', t: 'melee', p: 1.05 },
      { n: 'Ривок', i: '💨', mp: 12, cd: 9, range: 230, t: 'charge', p: 1.4, stun: 1.5 },
      { n: 'Вихор', i: '🌪️', mp: 20, cd: 7, t: 'aoe', radius: 72, p: 1.5, color: '217,200,176' },
      { n: 'Кривава лють', i: '💢', mp: 15, cd: 18, t: 'buff', buff: 'rage', dur: 7, d: '+50% шкоди, +20% швидкості' }]
  }
};
const FACTION = {
  light: { camp: 'Табір Світанку', elder: 'Старійшина Гордій', merchant: 'Торговка Олена', fire: 'rgba(255,170,70,', flame: ['#ffdf6a', '#ff8a2a', '#d0401a'], banner: '#2f5cb5' },
  dark: { camp: 'Табір Тіні', elder: 'Лорд-Ліч Морвен', merchant: 'Гробар Скрип', fire: 'rgba(90,255,150,', flame: ['#caffd8', '#4fe08a', '#1a8a50'], banner: '#3a6a30' }
};

// ============ humanoid drawing ============
function drawHumanoid(c, x, y, o) {
  const L = o.look, s = o.scale || 1, face = o.face || 1;
  c.save(); c.translate(x, y); c.scale(s * face, s);
  if (o.alpha != null) c.globalAlpha = o.alpha;
  c.fillStyle = 'rgba(0,0,0,.38)'; ell(c, 0, 0, 10, 3.6);
  const mv = o.moving ? 1 : 0, ph = o.walk || 0;
  const bob = mv ? Math.abs(Math.sin(ph)) * 1.6 : Math.sin(ph * .5) * .4;
  const lg = mv ? Math.sin(ph) * 3.2 : 0;
  c.translate(0, -bob);
  const back = o.back;
  // cape behind
  if (L.cape && !back) { c.fillStyle = L.cape; c.beginPath(); c.moveTo(-6, -21); c.lineTo(3, -21); c.lineTo(-2 - mv * 2, -5); c.lineTo(-10 - mv * 3, -4); c.closePath(); c.fill(); }
  // legs
  if (!L.robe) {
    c.fillStyle = L.legs; c.fillRect(-5 + lg, -10, 4, 9); c.fillRect(1 - lg, -10, 4, 9);
    c.fillStyle = L.boots; c.fillRect(-5 + lg, -3, 5, 3); c.fillRect(1 - lg, -3, 5, 3);
  } else {
    c.fillStyle = L.boots; c.fillRect(-4 + lg * .6, -3, 4, 3); c.fillRect(1 - lg * .6, -3, 4, 3);
  }
  // back arm
  const armSw = mv ? Math.sin(ph) * 2.5 : 0;
  c.fillStyle = L.armor2; c.fillRect(-9, -20 + (L.armsFwd ? 0 : 0), 4, 9 - armSw * .3);
  // body
  if (L.robe) {
    c.fillStyle = L.armor; c.beginPath(); c.moveTo(-7, -22); c.lineTo(7, -22); c.lineTo(9 + lg * .3, -2); c.lineTo(-9 + lg * .3, -2); c.closePath(); c.fill();
    c.fillStyle = L.armor2; c.beginPath(); c.moveTo(-1, -20); c.lineTo(2, -20); c.lineTo(3, -2); c.lineTo(-2, -2); c.closePath(); c.fill();
    c.fillStyle = L.trim; c.fillRect(-9 + lg * .3, -4, 18, 2); c.fillRect(-7, -13, 14, 2);
  } else if (L.bones) {
    c.fillStyle = '#2a2622'; rr(c, -6, -22, 12, 13, 3); c.fill();
    c.fillStyle = L.armor; for (let k = 0; k < 4; k++) c.fillRect(-5, -20 + k * 3, 10, 1.6);
    c.fillRect(-1, -22, 2, 13);
  } else {
    c.fillStyle = L.armor; rr(c, -7, -22, 14, 13, 3); c.fill();
    c.fillStyle = L.armor2; c.fillRect(-7, -15, 14, 2);
    c.fillStyle = L.trim; c.fillRect(-7, -11, 14, 2);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-5, -21, 3, 6);
  }
  // shoulders
  if (!L.robe && !L.bones && !L.rags) { c.fillStyle = L.armor2; ell(c, -6, -21, 4, 3); ell(c, 6, -21, 4, 3); }
  // head
  const hy = -28;
  c.fillStyle = L.skin; circ(c, 0, hy, 6.2);
  if (L.head === 'skull') {
    c.fillStyle = '#1d1a18'; if (!back) { c.fillRect(1, hy - 1, 2.2, 2.4); c.fillRect(4, hy - 1, 2, 2.4); c.fillRect(2, hy + 3, 4, 1); }
    if (L.eyes && !back) { c.fillStyle = L.eyes; c.fillRect(1.4, hy - .6, 1.4, 1.4); c.fillRect(4.3, hy - .6, 1.4, 1.4); }
  } else if (!back && L.head !== 'hood') {
    c.fillStyle = L.eyes || '#1b1410'; c.fillRect(1.5, hy - 1, 1.6, 2); c.fillRect(4.2, hy - 1, 1.6, 2);
    if (L.eyes) { c.fillStyle = L.eyes.replace(')', ',.35)').replace('#', '#'); }
  }
  if (L.beard && !back) { c.fillStyle = '#d8d4cc'; c.beginPath(); c.moveTo(-1, hy + 2); c.lineTo(6, hy + 2); c.lineTo(3, hy + 10); c.closePath(); c.fill(); }
  if (L.hair && L.head === 'none') { c.fillStyle = L.hair; c.beginPath(); c.arc(0, hy - 1, 6.6, Math.PI, 0); c.fill(); c.fillRect(-6.6, hy - 1, 3, 6); }
  if (L.head === 'helm') {
    c.fillStyle = L.armor; c.beginPath(); c.arc(0, hy - 1, 7, Math.PI, 0); c.fill(); c.fillRect(-7, hy - 1, 3.5, 6);
    c.fillStyle = L.armor2; c.fillRect(-7, hy - 1, 14, 2);
    if (!back) { c.fillStyle = '#1a1a22'; c.fillRect(1, hy, 6, 1.6); }
    c.fillStyle = L.trim; c.fillRect(-1, hy - 9, 2, 5);
  } else if (L.head === 'hat') {
    c.fillStyle = L.armor2; c.fillRect(-9, hy - 4, 18, 3);
    c.fillStyle = L.armor; c.beginPath(); c.moveTo(-6, hy - 4); c.lineTo(6, hy - 4); c.lineTo(-3, hy - 19); c.closePath(); c.fill();
    c.fillStyle = L.trim; c.fillRect(-6, hy - 6, 12, 2); circ(c, -3, hy - 19, 1.5);
  } else if (L.head === 'hood') {
    c.fillStyle = L.armor; c.beginPath(); c.arc(0, hy, 7.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-7, hy - 3); c.lineTo(-2, hy - 12); c.lineTo(4, hy - 6); c.closePath(); c.fill();
    if (!back) {
      c.fillStyle = '#0d0a12'; c.beginPath(); c.ellipse(2.5, hy + 1, 4, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = L.eyes || '#fff'; c.fillRect(1.2, hy, 1.6, 1.6); c.fillRect(4, hy, 1.6, 1.6);
    }
  } else if (L.head === 'horned') {
    c.fillStyle = L.armor2; c.beginPath(); c.arc(0, hy - 1, 7, Math.PI, 0); c.fill(); c.fillRect(-7, hy - 1, 3, 6);
    c.fillStyle = '#d8ccb0';
    c.beginPath(); c.moveTo(-6, hy - 4); c.quadraticCurveTo(-13, hy - 8, -11, hy - 15); c.lineTo(-8, hy - 7); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(6, hy - 4); c.quadraticCurveTo(13, hy - 8, 11, hy - 15); c.lineTo(8, hy - 7); c.closePath(); c.fill();
    if (!back) { c.fillStyle = L.eyes; c.fillRect(1.5, hy - .5, 1.8, 1.8); c.fillRect(4.3, hy - .5, 1.8, 1.8); }
  } else if (L.head === 'crown') {
    c.fillStyle = '#b89a3a'; c.fillRect(-6, hy - 8, 12, 3); for (let k = -6; k <= 4; k += 5) { c.beginPath(); c.moveTo(k, hy - 8); c.lineTo(k + 1, hy - 13); c.lineTo(k + 2, hy - 8); c.fill(); }
  }
  // shield
  if (L.shield) {
    c.fillStyle = L.shield; c.beginPath(); c.moveTo(-12, -21); c.lineTo(-3, -21); c.lineTo(-3, -13); c.lineTo(-7.5, -7); c.lineTo(-12, -13); c.closePath(); c.fill();
    c.fillStyle = L.trim; c.fillRect(-8.5, -20, 2, 10); c.fillRect(-11, -17, 7, 2);
  }
  // weapon arm
  const atk = o.atk != null && o.atk >= 0 && o.atk < 1 ? o.atk : -1;
  let ang;
  if (L.weapon === 'staff' || L.weapon === 'scythe') ang = atk >= 0 ? -0.2 + Math.sin(atk * Math.PI) * 1.1 : -0.15 + armSw * .03;
  else ang = atk >= 0 ? lerp(-2.3, 1.1, 1 - Math.pow(1 - atk, 3)) : -0.5 + armSw * .05;
  if (L.armsFwd) ang = atk >= 0 ? -0.6 + Math.sin(atk * Math.PI) * .9 : 1.35;
  c.save(); c.translate(6, -19); c.rotate(ang);
  c.fillStyle = L.armsFwd ? L.skin : L.armor2; c.fillRect(-2, 0, 4, 9);
  c.fillStyle = L.skin; circ(c, 0, 10, 2.4);
  if (L.weapon === 'sword') {
    c.fillStyle = '#6a4a28'; c.fillRect(-1, 8, 2, 5); c.fillStyle = L.trim; c.fillRect(-4, 12, 8, 2);
    c.fillStyle = '#dfe4ee'; c.fillRect(-1.5, 14, 3, 17); c.fillStyle = '#fff'; c.fillRect(-.5, 14, 1, 16);
  } else if (L.weapon === 'axe') {
    c.fillStyle = '#4a3020'; c.fillRect(-1.2, 4, 2.4, 26);
    c.fillStyle = '#8c8f98'; c.beginPath(); c.moveTo(1, 22); c.quadraticCurveTo(12, 20, 11, 32); c.lineTo(1, 29); c.closePath(); c.fill();
    c.fillStyle = '#c6c9d2'; c.fillRect(9, 23, 2, 8);
  } else if (L.weapon === 'staff') {
    c.rotate(-ang * 1.2 - 3.0); c.fillStyle = '#5a3a20'; c.fillRect(-1.2, -26, 2.4, 36);
    c.fillStyle = L.orb; c.globalAlpha *= .35; circ(c, 0, -28, 7); c.globalAlpha = o.alpha != null ? o.alpha : 1; circ(c, 0, -28, 3.6);
    c.fillStyle = '#fff'; circ(c, -1, -29, 1.2);
  } else if (L.weapon === 'scythe') {
    c.rotate(-ang * 1.2 - 3.0); c.fillStyle = '#2a2230'; c.fillRect(-1.2, -28, 2.4, 40);
    c.fillStyle = '#b8bfcc'; c.beginPath(); c.moveTo(0, -28); c.quadraticCurveTo(16, -30, 18, -18); c.quadraticCurveTo(12, -25, 0, -24); c.closePath(); c.fill();
    c.fillStyle = L.orb; circ(c, 0, -29, 2.2);
  } else if (L.weapon === 'rsword') {
    c.fillStyle = '#8b7d6a'; c.fillRect(-1.3, 11, 2.6, 15); c.fillStyle = '#5a4a3a'; c.fillRect(-3, 10, 6, 2);
  } else if (L.weapon === 'bigaxe') {
    c.fillStyle = '#231a2a'; c.fillRect(-1.6, 2, 3.2, 32);
    c.fillStyle = '#6c5a8a'; c.beginPath(); c.moveTo(1, 20); c.quadraticCurveTo(18, 16, 16, 36); c.lineTo(1, 32); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-1, 20); c.quadraticCurveTo(-14, 18, -12, 32); c.lineTo(-1, 30); c.closePath(); c.fill();
    c.fillStyle = '#c9a0ff'; c.fillRect(13, 22, 2, 11);
  }
  c.restore();
  c.restore();
}
function drawGhost(c, x, y, t, s, alpha) {
  c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = alpha;
  c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, 0, 0, 9, 3);
  const fy = -14 + Math.sin(t * 3) * 3;
  c.fillStyle = 'rgba(150,230,220,.25)'; circ(c, 0, fy - 8, 15);
  c.fillStyle = '#b8f0e6'; c.beginPath(); c.arc(0, fy - 10, 8, Math.PI, 0);
  c.lineTo(8, fy + 4);
  for (let k = 0; k < 4; k++) c.quadraticCurveTo(6 - k * 4, fy + 8 + ((k + Math.floor(t * 6)) % 2) * 3, 4 - k * 4, fy + 4);
  c.lineTo(-8, fy - 10); c.closePath(); c.fill();
  c.fillStyle = '#10302c'; ell(c, -2.8, fy - 11, 1.8, 2.6); ell(c, 2.8, fy - 11, 1.8, 2.6); ell(c, 0, fy - 5, 2, 2.6);
  c.restore();
}

// ============ enemies ============
const ETYPES = {
  zombie: { name: 'Зомбі', hp: l => 40 + l * 18, dmg: l => 5 + l * 2.3, speed: 42, range: 26, cd: 1.6, aggro: 130, xp: l => 14 + l * 6, gold: [2, 5],
    look: { skin: '#7d9a6a', armor: '#5a4a3a', armor2: '#46392c', trim: '#3a2f25', legs: '#3d352c', boots: '#2a2320', head: 'none', hair: '#2a2a20', armsFwd: 1, eyes: '#e0e070', rags: 1 } },
  skeleton: { name: 'Скелет', hp: l => 55 + l * 20, dmg: l => 6 + l * 2.6, speed: 58, range: 28, cd: 1.4, aggro: 150, xp: l => 18 + l * 7, gold: [3, 8],
    look: { skin: '#e2dccb', armor: '#e2dccb', armor2: '#c9c2ae', trim: '#8b7d6a', legs: '#d4cdb9', boots: '#d4cdb9', head: 'skull', weapon: 'rsword', bones: 1, rags: 1, eyes: '#ff5a3a' } },
  ghost: { name: 'Привид', hp: l => 45 + l * 17, dmg: l => 7 + l * 2.6, speed: 52, range: 140, cd: 2.0, aggro: 170, xp: l => 22 + l * 8, gold: [4, 10], ranged: 1 },
  boss: { name: 'Страж Склепу', hp: () => 1800, dmg: () => 32, speed: 56, range: 40, cd: 1.8, aggro: 200, xp: () => 900, gold: [150, 220], boss: 1,
    look: { skin: '#e2dccb', armor: '#3a2f4a', armor2: '#271f33', trim: '#c9a0ff', legs: '#271f33', boots: '#1a1422', head: 'crown', weapon: 'bigaxe', eyes: '#c9a0ff', cape: '#3a1a55' } }
};
const enemies = [];
function spawnEnemy(type, lvl, tx, ty) {
  const d = ETYPES[type];
  const e = { kind: 'enemy', type, lvl, x: tc(tx), y: tc(ty), hx: tc(tx), hy: tc(ty), maxHp: Math.round(d.hp(lvl)), dmg: d.dmg(lvl), speed: d.speed, range: d.range,
    cd: d.cd, atkT: rnd(0, 1), state: 'idle', wT: rnd(1, 4), wx: 0, wy: 0, walk: rnd(0, 6), face: 1, dead: false, respawn: 0, aggro: null, dot: null, slow: 0, stun: 0, flash: 0, atkAnim: -1, slamT: 6, cr: d.boss ? 10 : 7, scale: d.boss ? 1.55 : 1 };
  e.hp = e.maxHp; e.name = d.name; enemies.push(e); return e;
}
function placeSpawns() {
  const pick = (p, rmin, rmax, n, cb) => {
    let tries = 0, c = 0;
    while (c < n && tries++ < 3000) {
      const a = Math.random() * Math.PI * 2, r = rnd(rmin, rmax), x = Math.round(p.tx + Math.cos(a) * r), y = Math.round(p.ty + Math.sin(a) * r);
      if (!inb(x, y) || S[idx(x, y)] || G[idx(x, y)] === WATER) continue;
      if (tdist(x, y, CAMP) < 9) continue;
      cb(x, y, c); c++;
    }
  };
  pick(CAMP, 10, 24, 20, (x, y) => spawnEnemy('zombie', rndi(1, 3), x, y));
  pick(GRAVE, 2, 9, 15, (x, y) => spawnEnemy('skeleton', rndi(3, 6), x, y));
  pick(SWAMP, 2, 12, 13, (x, y) => spawnEnemy('ghost', rndi(5, 8), x, y));
  pick({ tx: CRYPT.tx - 10, ty: CRYPT.ty }, 1, 4, 5, (x, y) => spawnEnemy('skeleton', rndi(7, 9), x, y));
  spawnEnemy('boss', 12, CRYPT.tx + 2, CRYPT.ty);
}

// ============ game state ============
let state = 'menu', P = null, minion = null, npcs = [];
const projs = [], parts = [], floats = [], rings = [], teles = [];
let camX = 0, camY = 0, time = 0, markT = 0, mark = null;
const QUESTS = [
  { t: 'Мертві біля табору', d: 'Знищ зомбі навколо табору', type: 'zombie', n: 6, xp: 90, gold: 20, at: CAMP },
  { t: 'Неспокійне кладовище', d: 'Скелети на північному сході', type: 'skeleton', n: 8, xp: 300, gold: 50, at: GRAVE },
  { t: 'Болото привидів', d: 'Привиди на південному заході', type: 'ghost', n: 6, xp: 600, gold: 90, at: SWAMP },
  { t: 'Страж Склепу', d: 'Здолай володаря склепу на сході', type: 'boss', n: 1, xp: 1500, gold: 300, at: CRYPT }
];
function questFor(i) {
  if (i < QUESTS.length) return QUESTS[i];
  const k = i - QUESTS.length, types = ['zombie', 'skeleton', 'ghost'], at = [CAMP, GRAVE, SWAMP], ty = types[k % 3];
  return { t: 'Полювання ' + (k + 1), d: 'Очисти землі: ' + ETYPES[ty].name.toLowerCase(), type: ty, n: 10, xp: 400 + k * 80, gold: 60 + k * 10, at: at[k % 3] };
}
const xpNeed = l => Math.floor(60 * Math.pow(l, 1.65));
const lvlMult = l => 1 + (l - 1) * .11;

function makePlayer(d) {
  const C = CLASSES[d.cls];
  P = { kind: 'player', clsId: d.cls, C, faction: C.faction, name: d.name, lvl: d.lvl || 1, xp: d.xp || 0, gold: d.gold || 0, hpPot: d.hpPot != null ? d.hpPot : 3, mpPot: d.mpPot != null ? d.mpPot : 2,
    questIdx: d.quest || 0, qprog: d.qprog || 0, x: tc(CAMP.tx), y: tc(CAMP.ty) + 70, face: 1, back: false, walk: 0, moving: false, cds: [0, 0, 0, 0], buffs: {}, target: null, path: null, autoAtk: false,
    pending: -1, talkTo: null, atkAnim: -1, stun: 0, dead: false, combatT: 99, dash: null, flash: 0, cr: 7, slow: 0 };
  if (d.x && d.y && canStand(d.x, d.y, 7)) { P.x = d.x; P.y = d.y; }
  recalc(); P.hp = P.maxHp; P.mp = P.maxMp;
  const F = FACTION[P.faction];
  npcs = [
    { kind: 'npc', role: 'elder', name: F.elder, x: tc(CAMP.tx) - 58, y: tc(CAMP.ty) + 26, face: 1,
      look: P.faction === 'light' ? { skin: '#e6b894', armor: '#e8e2d0', armor2: '#b9b09a', trim: '#e8c170', legs: '#b9b09a', boots: '#3a2c22', head: 'none', hair: '#d8d4cc', beard: 1, robe: 1, weapon: 'staff', orb: '#9fd0ff' }
        : { skin: '#d8d2c0', armor: '#2a1d3a', armor2: '#1a1226', trim: '#b080ff', legs: '#1a1226', boots: '#100a16', head: 'crown', robe: 1, weapon: 'staff', orb: '#b080ff', eyes: '#b080ff' } },
    { kind: 'npc', role: 'merchant', name: F.merchant, x: tc(CAMP.tx) + 60, y: tc(CAMP.ty) + 26, face: -1,
      look: P.faction === 'light' ? { skin: '#e6b894', armor: '#7a3b2a', armor2: '#5a2a1d', trim: '#e8c170', legs: '#4a3a2a', boots: '#2a1d14', head: 'none', hair: '#6a3a1a', robe: 1 }
        : { skin: '#8a9a88', armor: '#3d3a33', armor2: '#2a2822', trim: '#8a7a5a', legs: '#2a2822', boots: '#1a1612', head: 'hood', robe: 1, eyes: '#e0e070' } }
  ];
}
function recalc() {
  const C = P.C, m = lvlMult(P.lvl);
  P.maxHp = Math.round(C.hp * (1 + (P.lvl - 1) * .13)); P.maxMp = Math.round(C.mp * (1 + (P.lvl - 1) * .08)); P.atk = C.atk * m;
}

// ============ save ============
const SAVE_KEY = 'tcl_browser_save_v1';
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function writeSave() {
  if (!P) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cls: P.clsId, name: P.name, lvl: P.lvl, xp: P.xp, gold: P.gold, hpPot: P.hpPot, mpPot: P.mpPot, quest: P.questIdx, qprog: P.qprog, x: Math.round(P.x), y: Math.round(P.y) })); } catch (e) { }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

// ============ fx ============
function burst(x, y, col, n, spd = 60, life = .6, size = 2.5, grav = 0) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(spd * .3, spd); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * .2, life: rnd(life * .6, life), max: life, col, size: rnd(size * .6, size), grav }); } }
function floatTxt(x, y, text, col, size = 13) { floats.push({ x: x + rnd(-6, 6), y, text, col, size, life: 1.1 }); }
function ring(x, y, r1, col, life = .45) { rings.push({ x, y, r1, col, life, max: life }); }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; toastT = 2.2; }

// ============ combat ============
const alive = e => e && !e.dead && e.hp > 0;
function skillRange(sk) { return sk.range === 'melee' ? P.C.range : (sk.range || 0); }
function playerDmg(mult) {
  let d = P.atk * mult * rnd(.9, 1.1); if (P.buffs.rage > 0) d *= 1.5;
  const crit = Math.random() < .12; if (crit) d *= 1.6; return { d: Math.round(d), crit };
}
function hitEnemy(e, amt, src, crit, col) {
  if (!alive(e)) return;
  e.hp -= amt; e.flash = .12;
  floatTxt(e.x, e.y - 34 * e.scale, (crit ? amt + '!' : '' + amt), crit ? '#ffd54a' : (col || '#fff'), crit ? 17 : 13);
  if (src && (!e.aggro || e.state !== 'chase')) { e.aggro = src; e.state = 'chase'; }
  if (src === P) P.combatT = 0;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; e.hp = 0; e.respawn = e.type === 'boss' ? 90 : rnd(16, 24);
  const D = ETYPES[e.type];
  burst(e.x, e.y - 14, e.type === 'ghost' ? '#b8f0e6' : (e.type === 'zombie' ? '#6a8a50' : '#e2dccb'), e.type === 'boss' ? 40 : 14, 80, .8, 3, 120);
  if (P.target === e) { P.target = null; P.autoAtk = false; P.pending = -1; }
  if (minion && minion.target === e) minion.target = null;
  const diff = P.lvl - e.lvl; const mult = diff > 5 ? .15 : diff > 3 ? .5 : 1;
  gainXp(Math.round(D.xp(e.lvl) * mult));
  const g = rndi(D.gold[0], D.gold[1]) + Math.floor(e.lvl / 2); P.gold += g; floatTxt(e.x, e.y - 50, '+' + g + ' 🪙', '#e8c170', 12);
  if (Math.random() < (e.type === 'boss' ? 1 : .08)) { if (Math.random() < .6) P.hpPot++; else P.mpPot++; floatTxt(e.x, e.y - 64, '+зілля', '#ff8aa0', 12); }
  const q = questFor(P.questIdx);
  if (q.type === e.type && P.qprog < q.n) {
    P.qprog++;
    if (P.qprog >= q.n) { P.gold += q.gold; gainXp(q.xp); toast('Завдання виконано: ' + q.t + '  +' + q.xp + ' досвіду, +' + q.gold + ' 🪙'); P.questIdx++; P.qprog = 0; writeSave(); }
  }
}
function gainXp(n) {
  if (P.lvl >= 30) return;
  P.xp += n; floatTxt(P.x, P.y - 46, '+' + n + ' досв.', '#c9a13a', 11);
  while (P.xp >= xpNeed(P.lvl) && P.lvl < 30) {
    P.xp -= xpNeed(P.lvl); P.lvl++; recalc(); P.hp = P.maxHp; P.mp = P.maxMp;
    toast('Новий рівень: ' + P.lvl + '!'); ring(P.x, P.y - 10, 70, '232,193,112', .8); burst(P.x, P.y - 16, '#ffe08a', 30, 90, 1, 3, -40); writeSave();
  }
}
function hitPlayer(amt, src) {
  if (P.dead) return;
  let d = amt * rnd(.9, 1.1) * (1 - P.C.armor);
  if (P.buffs.shield > 0) d *= .4;
  d = Math.max(1, Math.round(d));
  P.hp -= d; P.flash = .12; P.combatT = 0;
  floatTxt(P.x, P.y - 36, '-' + d, '#ff6a5a', 14);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.path = null; P.target = null; P.autoAtk = false; P.pending = -1; $('death').hidden = false; burst(P.x, P.y - 14, '#aa2222', 30, 80, 1, 3, 100); }
}
function reviveP() {
  const lost = Math.floor(P.gold * .1); P.gold -= lost;
  P.dead = false; P.hp = Math.round(P.maxHp * .6); P.mp = Math.round(P.maxMp * .6); P.x = tc(CAMP.tx); P.y = tc(CAMP.ty) + 70; P.buffs = {}; P.stun = 0; P.dash = null;
  for (const e of enemies) if (e.aggro === P) { e.state = 'return'; e.aggro = null; }
  $('death').hidden = true; writeSave();
  if (lost) toast('Втрачено ' + lost + ' 🪙');
}
function inCamp(e) { return Math.hypot(e.x - tc(CAMP.tx), e.y - tc(CAMP.ty)) < 7 * T; }
function nearestEnemy(x, y, maxD) { let b = null, bd = maxD; for (const e of enemies) { if (!alive(e)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; b = e; } } return b; }

function useSkill(i, fromAuto) {
  if (!P || P.dead || state !== 'game') return false;
  const sk = P.C.skills[i];
  if (P.cds[i] > 0) { if (!fromAuto && i > 0) toast('Ще не готово'); return false; }
  if (P.mp < sk.mp) { if (!fromAuto) toast('Не вистачає мани'); return false; }
  if (P.stun > 0) return false;
  const targeted = ['melee', 'proj', 'dot', 'drain', 'charge'].includes(sk.t);
  if (targeted) {
    if (!alive(P.target)) { const n = nearestEnemy(P.x, P.y, 300); if (!n) { if (!fromAuto) toast('Немає цілі поруч'); return false; } P.target = n; }
    const d = dist(P, P.target);
    if (d > skillRange(sk) + 2) { P.pending = i; P.autoAtk = true; P.path = null; P.repath = 0; return false; }
    castSkill(i, P.target); return true;
  }
  castSkill(i, null); return true;
}
function castSkill(i, t) {
  const sk = P.C.skills[i], lookCol = P.C.look.orb || '#fff';
  P.cds[i] = sk.cd; P.mp -= sk.mp; P.atkAnim = 0; P.combatT = Math.min(P.combatT, 1);
  if (t) { P.face = t.x < P.x ? -1 : 1; P.back = false; }
  const sx = P.x + P.face * 10, sy = P.y - 22;
  switch (sk.t) {
    case 'melee': { const { d, crit } = playerDmg(sk.p); hitEnemy(t, d, P, crit); burst(t.x, t.y - 16, '#fff2c0', 6, 50, .3, 2); break; }
    case 'proj': { const { d, crit } = playerDmg(sk.p); projs.push({ x: sx, y: sy, t, spd: sk.big ? 300 : 360, dmg: d, crit, col: sk.color, big: sk.big, owner: P }); break; }
    case 'dot': { const { d } = playerDmg(sk.p); t.dot = { dps: d / sk.dur, t: sk.dur, acc: 0, src: P }; burst(t.x, t.y - 18, '#6dff8a', 16, 40, .8, 2.5, -30); hitEnemy(t, 1, P, false, '#6dff8a'); break; }
    case 'drain': { const { d, crit } = playerDmg(sk.p); projs.push({ x: sx, y: sy, t, spd: 320, dmg: d, crit, col: sk.color, drain: 1, owner: P }); break; }
    case 'aoe': {
      ring(P.x, P.y - 8, sk.radius, sk.color, .5); burst(P.x, P.y - 10, 'rgb(' + sk.color + ')', 26, sk.radius * 1.6, .5, 3);
      for (const e of enemies) if (alive(e) && Math.hypot(e.x - P.x, e.y - P.y) < sk.radius + 8) { const { d, crit } = playerDmg(sk.p); hitEnemy(e, d, P, crit); if (sk.slow) e.slow = sk.slow; }
      break;
    }
    case 'heal': { const h = Math.round(P.maxHp * sk.p); P.hp = Math.min(P.maxHp, P.hp + h); floatTxt(P.x, P.y - 40, '+' + h, '#7dff9a', 15); burst(P.x, P.y - 16, '#ffe98a', 24, 50, .9, 2.5, -60); break; }
    case 'buff': { P.buffs[sk.buff] = sk.dur; ring(P.x, P.y - 10, 40, sk.buff === 'rage' ? '255,60,50' : '255,230,150', .5); toast(sk.n + '!'); break; }
    case 'blink': {
      let dx = P.face, dy = 0;
      const mv = moveInput(); if (mv.m > .1) { dx = mv.x / mv.m; dy = mv.y / mv.m; } else if (P.lastDir) { dx = P.lastDir.x; dy = P.lastDir.y; }
      burst(P.x, P.y - 14, '#9fd8ff', 18, 60, .5, 2.5);
      for (let d = sk.dist; d > 0; d -= 8) { const nx = P.x + dx * d, ny = P.y + dy * d; if (canStand(nx, ny, 7) && losClearRough(P.x, P.y, nx, ny)) { P.x = nx; P.y = ny; break; } }
      burst(P.x, P.y - 14, '#9fd8ff', 18, 60, .5, 2.5); P.path = null; break;
    }
    case 'summon': {
      const a = Math.random() * 6.28; let mx = P.x + Math.cos(a) * 24, my = P.y + Math.sin(a) * 24; if (!canStand(mx, my, 7)) { mx = P.x; my = P.y; }
      minion = { kind: 'minion', x: mx, y: my, hp: Math.round(60 * lvlMult(P.lvl) * 1.5), life: sk.dur, atkT: 0, walk: 0, face: 1, moving: false, target: null, atkAnim: -1, cr: 6, flash: 0 };
      minion.maxHp = minion.hp; burst(mx, my - 10, '#6dff8a', 24, 60, .8, 3, -40); ring(mx, my, 30, '109,255,138'); break;
    }
    case 'charge': { P.dash = { t, time: .45, dmg: playerDmg(sk.p), stun: sk.stun }; P.path = null; break; }
  }
}
function losClearRough(ax, ay, bx, by) { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 10); for (let i = 1; i <= n; i++) { const t = i / n; if (solidPx(lerp(ax, bx, t), lerp(ay, by, t))) return false; } return true; }
function drinkPotion(kind) {
  if (!P || P.dead) return;
  if (kind === 'hp') { if (P.hpPot <= 0) return toast('Немає зілля здоров\'я'); if (P.potCd > 0) return; P.hpPot--; const h = Math.round(P.maxHp * .45); P.hp = Math.min(P.maxHp, P.hp + h); floatTxt(P.x, P.y - 40, '+' + h, '#7dff9a', 15); burst(P.x, P.y - 16, '#ff6a7a', 14, 40, .7, 2, -50); }
  else { if (P.mpPot <= 0) return toast('Немає зілля мани'); if (P.potCd > 0) return; P.mpPot--; const h = Math.round(P.maxMp * .5); P.mp = Math.min(P.maxMp, P.mp + h); floatTxt(P.x, P.y - 40, '+' + h, '#8ab8ff', 15); burst(P.x, P.y - 16, '#6a9aff', 14, 40, .7, 2, -50); }
  P.potCd = 1.5;
}

// ============ input ============
const keys = {};
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1; if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (joy.active) { x += joy.x; y += joy.y; }
  const m = Math.min(1, Math.hypot(x, y));
  const l = Math.hypot(x, y) || 1;
  return { x: x / l * m, y: y / l * m, m };
}
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && state === 'menu' && !$('scrName').hidden) $('bStart').click(); return; }
  keys[e.code] = true;
  if (state !== 'game') return;
  if (e.code >= 'Digit1' && e.code <= 'Digit4') { useSkill(+e.code.slice(5) - 1); pressFx(+e.code.slice(5) - 1); }
  if (e.code === 'KeyQ') drinkPotion('hp'); if (e.code === 'KeyE') drinkPotion('mp');
  if (e.code === 'Tab') { e.preventDefault(); const n = nearestEnemy(P.x, P.y, 400); if (n) { P.target = n; } }
  if (e.code === 'Escape') { if (!$('dialog').hidden) closeDialog(); else openMenu(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.active = false; $('joy').hidden = true; });

const downs = new Map();
cv.addEventListener('pointerdown', e => {
  if (state !== 'game') return;
  cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  if (e.pointerType !== 'mouse' && e.clientX < W * .45 && !joy.active && e.clientY > H * .3) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; joy.active = true; joy.moved = false;
    const j = $('joy'); j.hidden = false; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.firstElementChild.style.transform = '';
    return;
  }
  downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
});
cv.addEventListener('pointermove', e => {
  if (joy.active && e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), mx = 46;
    if (l > mx) { dx = dx / l * mx; dy = dy / l * mx; }
    if (l > 8) joy.moved = true;
    joy.x = l > 8 ? dx / mx : 0; joy.y = l > 8 ? dy / mx : 0;
    $('joy').firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  }
});
function endPointer(e) {
  if (joy.active && e.pointerId === joy.id) {
    joy.active = false; joy.x = joy.y = 0; $('joy').hidden = true;
    if (!joy.moved) worldTap(e.clientX, e.clientY);
    return;
  }
  const d = downs.get(e.pointerId); downs.delete(e.pointerId);
  if (d && e.type === 'pointerup' && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 14) worldTap(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e => e.preventDefault());

function worldTap(sx, sy) {
  if (!P || P.dead) return;
  const wx = sx / zoom + camX, wy = sy / zoom + camY;
  // enemies
  let best = null, bd = 26;
  for (const e of enemies) { if (!alive(e)) continue; const d = Math.hypot(e.x - wx, (e.y - 14 * e.scale) - wy); if (d < bd * e.scale) { bd = d; best = e; } }
  if (best) { P.target = best; P.autoAtk = true; P.pending = -1; P.path = null; P.repath = 0; P.talkTo = null; return; }
  for (const n of npcs) { if (Math.hypot(n.x - wx, n.y - 14 - wy) < 24) { P.talkTo = n; P.autoAtk = false; P.pending = -1; P.path = findPath(P.x, P.y, n.x, n.y + 20); return; } }
  P.autoAtk = false; P.pending = -1; P.talkTo = null;
  const path = findPath(P.x, P.y, wx, wy);
  if (path && path.length) { P.path = path; mark = { x: path[path.length - 1].x, y: path[path.length - 1].y }; markT = .6; }
}

// ============ update ============
function followPath(e, spd, dt) {
  if (!e.path || !e.path.length) return 0;
  const wp = e.path[0], dx = wp.x - e.x, dy = wp.y - e.y, l = Math.hypot(dx, dy);
  if (l < 4) { e.path.shift(); return followPath(e, spd, dt); }
  const st = Math.min(l, spd * dt), mx = dx / l * st, my = dy / l * st;
  const m = moveEnt(e, mx, my); setFacing(e, dx, dy);
  if (m < st * .2) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > .4) { e.path = null; e.stuck = 0; } } else e.stuck = 0;
  return m;
}
function setFacing(e, dx, dy) { if (Math.abs(dx) > .01) e.face = dx < 0 ? -1 : 1; e.back = dy < -Math.abs(dx) * 1.2; }
function moveTowards(e, tx, ty, spd, dt, stopAt = 0) {
  const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy); if (l <= stopAt) return 0;
  const st = Math.min(l - stopAt, spd * dt); setFacing(e, dx, dy);
  return moveEnt(e, dx / l * st, dy / l * st);
}
function updatePlayer(dt) {
  const p = P;
  for (let i = 0; i < 4; i++) p.cds[i] = Math.max(0, p.cds[i] - dt);
  for (const k in p.buffs) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
  p.potCd = Math.max(0, (p.potCd || 0) - dt); p.flash = Math.max(0, p.flash - dt);
  if (p.atkAnim >= 0) { p.atkAnim += dt * 3.5; if (p.atkAnim >= 1) p.atkAnim = -1; }
  if (p.dead) return;
  p.combatT += dt;
  // regen
  const camp = inCamp(p), ooc = p.combatT > 5;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (camp ? .08 : ooc ? .025 : .004) * dt);
  p.mp = Math.min(p.maxMp, p.mp + p.maxMp * (camp ? .08 : ooc ? .03 : .012) * dt);
  if (p.stun > 0) { p.stun -= dt; p.moving = false; return; }
  const spd = p.C.speed * (p.buffs.rage > 0 ? 1.2 : 1);
  let moved = 0;
  if (p.dash) {
    const t = p.dash.t; p.dash.time -= dt;
    if (!alive(t) || p.dash.time <= 0) p.dash = null;
    else {
      const m = moveTowards(p, t.x, t.y, 520, dt, 22); moved = m;
      burst(p.x, p.y - 10, '#b09080', 1, 20, .3, 2);
      if (dist(p, t) <= 24 || m < 1) { hitEnemy(t, p.dash.dmg.d, p, p.dash.dmg.crit); if (alive(t)) { t.stun = p.dash.stun; floatTxt(t.x, t.y - 50, 'Оглушено', '#ffd54a', 11); } ring(t.x, t.y - 8, 30, '217,200,176', .3); p.dash = null; }
    }
  } else {
    const mv = moveInput();
    if (mv.m > .12) {
      p.path = null; p.autoAtk = false; p.pending = -1; p.talkTo = null;
      moved = moveEnt(p, mv.x * spd * dt, mv.y * spd * dt); setFacing(p, mv.x, mv.y); p.lastDir = { x: mv.x / mv.m, y: mv.y / mv.m };
    } else if ((p.autoAtk || p.pending >= 0) && p.target) {
      const t = p.target;
      if (!alive(t)) { p.autoAtk = false; p.pending = -1; }
      else {
        const si = p.pending >= 0 ? p.pending : 0, sk = p.C.skills[si], rg = skillRange(sk), d = dist(p, t);
        if (d > rg) {
          p.repath = (p.repath || 0) - dt;
          if (losClear(p.x, p.y, t.x, t.y)) { p.path = null; moved = moveTowards(p, t.x, t.y, spd, dt, rg - 6); }
          else { if (!p.path || p.repath <= 0) { p.path = findPath(p.x, p.y, t.x, t.y); p.repath = .5; } moved = followPath(p, spd, dt); }
        } else {
          p.path = null; setFacing(p, t.x - p.x, 0);
          if (p.pending >= 0) { if (useSkill(p.pending, true)) p.pending = -1; else if (p.mp < p.C.skills[p.pending].mp) p.pending = -1; }
          else if (p.cds[0] <= 0) useSkill(0, true);
        }
      }
    } else if (p.path) {
      moved = followPath(p, spd, dt);
      if (!p.path || !p.path.length) p.path = null;
    }
    if (p.talkTo && dist(p, p.talkTo) < 50) { const n = p.talkTo; p.talkTo = null; p.path = null; openNpc(n); }
  }
  p.moving = moved > .05;
  if (p.moving) p.walk += dt * 11; else p.walk += dt * 2;
}
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) { e.respawn -= dt; if (e.respawn <= 0) { e.dead = false; e.hp = e.maxHp; e.x = e.hx; e.y = e.hy; e.state = 'idle'; e.aggro = null; e.dot = null; burst(e.x, e.y - 12, '#8a6aff', 10, 40, .6, 2); } continue; }
    e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt);
    if (e.atkAnim >= 0) { e.atkAnim += dt * 3; if (e.atkAnim >= 1) e.atkAnim = -1; }
    if (e.dot) { const tick = Math.min(dt, e.dot.t); e.dot.t -= dt; e.dot.acc += e.dot.dps * tick; if (e.dot.acc >= 1) { const n = Math.floor(e.dot.acc); e.dot.acc -= n; e.hp -= n; if (Math.random() < .3) burst(e.x, e.y - 18, '#6dff8a', 1, 20, .6, 2, -40); if (e.hp <= 0) { killEnemy(e); continue; } } if (e.dot && e.dot.t <= 0) e.dot = null; }
    if (e.stun > 0) { e.stun -= dt; e.moving = false; continue; }
    const spd = e.speed * (e.slow > 0 ? .45 : 1);
    const D = ETYPES[e.type];
    let moved = 0;
    const tgtAlive = t => t && (t === P ? !P.dead : t.hp > 0 && minion === t);
    if (e.state === 'idle') {
      e.wT -= dt;
      if (e.wT <= 0) { e.wT = rnd(2, 5); const a = Math.random() * 6.28, r = rnd(0, 50); e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r; }
      if (e.wx && Math.hypot(e.wx - e.x, e.wy - e.y) > 4) moved = moveTowards(e, e.wx, e.wy, spd * .4, dt);
      if (P && !P.dead && !inCamp(P) && dist(e, P) < D.aggro) { e.state = 'chase'; e.aggro = P; }
    } else if (e.state === 'chase') {
      const t = e.aggro;
      const leash = Math.hypot(e.x - e.hx, e.y - e.hy) > (D.boss ? 260 : 420);
      if (!tgtAlive(t) || leash || (t === P && inCamp(P)) || inCamp(e)) { e.state = 'return'; e.aggro = null; }
      else {
        const d = dist(e, t);
        if (D.boss) { e.slamT -= dt; if (e.slamT <= 0 && d < 160) { e.slamT = rnd(6, 8); teles.push({ x: t.x, y: t.y, r: 72, t: 0, max: 1.2, dmg: e.dmg * 1.8 }); toast('Страж готує удар! Відійди!'); } }
        if (d > e.range) { moved = moveTowards(e, t.x, t.y, spd, dt, e.range - 4); if (moved < spd * dt * .2) { e.stuckT = (e.stuckT || 0) + dt; if (e.stuckT > 2) { e.state = 'return'; e.aggro = null; e.stuckT = 0; } } else e.stuckT = 0; }
        else {
          setFacing(e, t.x - e.x, 0);
          e.atkT -= dt;
          if (e.atkT <= 0) {
            e.atkT = e.cd; e.atkAnim = 0;
            if (D.ranged) projs.push({ x: e.x, y: e.y - 20, t, spd: 190, dmg: e.dmg, col: '140,240,220', owner: e });
            else if (t === P) hitPlayer(e.dmg, e); else { t.hp -= Math.round(e.dmg); t.flash = .12; floatTxt(t.x, t.y - 30, '-' + Math.round(e.dmg), '#ff9a8a', 12); }
          }
        }
      }
    } else if (e.state === 'return') {
      moved = moveTowards(e, e.hx, e.hy, spd * 1.3, dt);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .25 * dt);
      if (Math.hypot(e.x - e.hx, e.y - e.hy) < 8 || moved < .01) { e.state = 'idle'; e.hp = e.maxHp; e.wx = 0; if (moved < .01) { e.x = e.hx; e.y = e.hy; } }
    }
    e.moving = moved > .05; e.walk += dt * (e.moving ? 9 : 2);
  }
}
function updateMinion(dt) {
  const m = minion; if (!m) return;
  m.life -= dt; m.flash = Math.max(0, m.flash - dt);
  if (m.atkAnim >= 0) { m.atkAnim += dt * 3; if (m.atkAnim >= 1) m.atkAnim = -1; }
  if (m.life <= 0 || m.hp <= 0 || P.dead) { burst(m.x, m.y - 12, '#6dff8a', 16, 50, .7, 2.5); for (const e of enemies) if (e.aggro === m) { e.aggro = P.dead ? null : P; if (P.dead) e.state = 'return'; } minion = null; return; }
  if (!alive(m.target)) m.target = alive(P.target) ? P.target : nearestEnemy(P.x, P.y, 180);
  let moved = 0; const spd = 100;
  if (m.target && dist(m.target, P) < 320) {
    const d = dist(m, m.target);
    if (d > 26) moved = moveTowards(m, m.target.x, m.target.y, spd, dt, 22);
    else { setFacing(m, m.target.x - m.x, 0); m.atkT -= dt; if (m.atkT <= 0) { m.atkT = 1.3; m.atkAnim = 0; hitEnemy(m.target, Math.round(P.atk * .7 * rnd(.9, 1.1)), m, false, '#9aff9a'); } }
  } else if (dist(m, P) > 40) moved = moveTowards(m, P.x - P.face * 20, P.y + 8, spd, dt);
  if (dist(m, P) > 400) { m.x = P.x; m.y = P.y; }
  m.moving = moved > .05; m.walk += dt * (m.moving ? 11 : 2);
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i], t = pr.t;
    const ok = t && (t === P ? !P.dead : t === minion ? minion && minion.hp > 0 : alive(t));
    if (!ok) { projs.splice(i, 1); continue; }
    const ty = t.y - 16 * (t.scale || 1), dx = t.x - pr.x, dy = ty - pr.y, l = Math.hypot(dx, dy);
    if (Math.random() < .7) parts.push({ x: pr.x, y: pr.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: .35, max: .35, col: 'rgb(' + pr.col + ')', size: pr.big ? 3.5 : 2, grav: 0 });
    if (l < 10) {
      projs.splice(i, 1);
      if (pr.owner === P) {
        hitEnemy(t, pr.dmg, P, pr.crit, pr.drain ? '#ff8aa0' : null); burst(t.x, ty, 'rgb(' + pr.col + ')', pr.big ? 18 : 8, pr.big ? 90 : 50, .4, pr.big ? 3.5 : 2.5);
        if (pr.drain) { const h = Math.round(pr.dmg * .6); P.hp = Math.min(P.maxHp, P.hp + h); floatTxt(P.x, P.y - 40, '+' + h, '#7dff9a', 13); }
      } else {
        burst(t.x, ty, 'rgb(' + pr.col + ')', 8, 40, .4, 2.5);
        if (t === P) hitPlayer(pr.dmg, pr.owner); else { t.hp -= Math.round(pr.dmg); t.flash = .12; }
      }
      continue;
    }
    pr.x += dx / l * pr.spd * dt; pr.y += dy / l * pr.spd * dt;
  }
}
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= .96; p.vy *= .96; }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= 26 * dt; if (f.life <= 0) floats.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
  for (let i = teles.length - 1; i >= 0; i--) {
    const t = teles[i]; t.t += dt;
    if (t.t >= t.max) { teles.splice(i, 1); ring(t.x, t.y, t.r, '200,120,255', .4); burst(t.x, t.y, '#c9a0ff', 30, 120, .6, 3); if (P && !P.dead && Math.hypot(P.x - t.x, P.y - t.y) < t.r) hitPlayer(t.dmg); }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  markT = Math.max(0, markT - dt);
  if (P && P.target && !alive(P.target)) P.target = null;
  if (P && P.target && dist(P, P.target) > 600) { P.target = null; P.autoAtk = false; }
}

// ============ render ============
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  zoom = clamp(Math.min(W, H) / 330, 1.15, 2.5);
}
addEventListener('resize', resize);

let lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
function render() {
  const vw = W / zoom, vh = H / zoom;
  let fx, fy;
  if (P && state !== 'menu') { fx = P.x; fy = P.y - 16; }
  else { fx = tc(CAMP.tx) + Math.sin(time * .05) * 500; fy = tc(CAMP.ty) + Math.cos(time * .04) * 300; }
  camX = clamp(fx - vw / 2, 0, MW * T - vw); camY = clamp(fy - vh / 2, 0, MH * T - vh);
  const k = dpr * zoom;
  // snap camera to device pixels
  camX = Math.round(camX * k) / k; camY = Math.round(camY * k) / k;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);
  ctx.imageSmoothingEnabled = false;
  const sx = Math.max(0, Math.floor(camX)), sy = Math.max(0, Math.floor(camY)), sw = Math.min(MW * T - sx, Math.ceil(vw) + 2), sh = Math.min(MH * T - sy, Math.ceil(vh) + 2);
  ctx.drawImage(mapCv, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.imageSmoothingEnabled = true;
  // water shimmer
  ctx.fillStyle = 'rgba(140,200,220,.08)';
  const tx0 = Math.floor(camX / T), ty0 = Math.floor(camY / T), tx1 = Math.ceil((camX + vw) / T), ty1 = Math.ceil((camY + vh) / T);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) { if (!inb(x, y) || G[idx(x, y)] !== WATER) continue; const o = (Math.sin(time * 1.5 + x * 1.3 + y * .7) + 1) * 10; ctx.fillRect(x * T + 4 + o * .5, y * T + 8 + ((x * 7 + y * 3) % 14), 8, 1.5); }
  // telegraphs
  for (const t of teles) { const f = t.t / t.max; ctx.fillStyle = 'rgba(200,40,60,' + (.15 + f * .2) + ')'; ell(ctx, t.x, t.y, t.r, t.r * .6); ctx.strokeStyle = 'rgba(255,90,90,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r * f, t.r * .6 * f, 0, 0, 6.29); ctx.stroke(); }
  // target ring & move mark
  if (P && P.target && alive(P.target)) { const t = P.target; ctx.strokeStyle = 'rgba(255,70,60,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(t.x, t.y, 13 * t.scale, 5 * t.scale, 0, 0, 6.29); ctx.stroke(); }
  if (markT > 0 && mark) { ctx.strokeStyle = 'rgba(232,193,112,' + markT + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(mark.x, mark.y, 10 * (1.4 - markT), 4 * (1.4 - markT), 0, 0, 6.29); ctx.stroke(); }
  // y-sorted drawables
  const list = [];
  const m = 80;
  for (const o of objs) if (o.x > camX - m && o.x < camX + vw + m && o.y > camY - 20 && o.y < camY + vh + 90) list.push(o);
  for (const e of enemies) if (!e.dead && e.x > camX - m && e.x < camX + vw + m && e.y > camY - 20 && e.y < camY + vh + 90) list.push(e);
  if (state !== 'menu') { for (const n of npcs) list.push(n); if (minion) list.push(minion); if (P && !P.dead) list.push(P); }
  list.sort((a, b) => a.y - b.y);
  for (const it of list) drawThing(it);
  // projectiles
  for (const pr of projs) { ctx.fillStyle = 'rgba(' + pr.col + ',.35)'; circ(ctx, pr.x, pr.y, pr.big ? 9 : 6); ctx.fillStyle = 'rgb(' + pr.col + ')'; circ(ctx, pr.x, pr.y, pr.big ? 5 : 3); ctx.fillStyle = '#fff'; circ(ctx, pr.x, pr.y, pr.big ? 2 : 1.2); }
  // particles
  for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const r of rings) { const f = 1 - r.life / r.max; ctx.strokeStyle = 'rgba(' + r.col + ',' + (1 - f) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r1 * (.3 + f * .7), r.r1 * (.3 + f * .7) * .6, 0, 0, 6.29); ctx.stroke(); }
  // lighting
  drawLighting(vw, vh);
  ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);
  // health bars / names / floats (above lighting)
  for (const e of enemies) {
    if (e.dead || e.x < camX - 40 || e.x > camX + vw + 40 || e.y < camY - 40 || e.y > camY + vh + 80) continue;
    const top = e.y - (e.type === 'ghost' ? 42 : 40) * e.scale;
    if (e.hp < e.maxHp || P && P.target === e || ETYPES[e.type].boss) {
      const w = e.scale > 1 ? 40 : 26; ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2 - 1, top - 1, w + 2, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(e.x - w / 2, top, w * e.hp / e.maxHp, 3);
    }
    if (P && (P.target === e || ETYPES[e.type].boss)) { ctx.font = 'bold 9px Philosopher, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(e.name + ' ' + e.lvl, e.x + .7, top - 3.3); ctx.fillStyle = e.lvl > (P.lvl || 1) + 2 ? '#ff7a6a' : '#ffe7b0'; ctx.fillText(e.name + ' ' + e.lvl, e.x, top - 4); }
  }
  if (state !== 'menu') {
    ctx.font = 'bold 9px Philosopher, serif'; ctx.textAlign = 'center';
    for (const n of npcs) { ctx.fillStyle = '#000'; ctx.fillText(n.name, n.x + .7, n.y - 44.3); ctx.fillStyle = '#ffd97a'; ctx.fillText(n.name, n.x, n.y - 45); ctx.font = 'bold 13px sans-serif'; ctx.fillText(n.role === 'elder' ? '❗' : '🪙', n.x, n.y - 56 + Math.sin(time * 3) * 2); ctx.font = 'bold 9px Philosopher, serif'; }
    if (P && !P.dead) { ctx.fillStyle = '#000'; ctx.fillText(P.name, P.x + .7, P.y - 44.3); ctx.fillStyle = P.faction === 'light' ? '#9fc3ff' : '#9fe7a8'; ctx.fillText(P.name, P.x, P.y - 45); }
    // quest arrow
    if (P && !P.dead) {
      const q = questFor(P.questIdx), qx = tc(q.at.tx), qy = tc(q.at.ty), d = Math.hypot(qx - P.x, qy - P.y);
      if (d > 9 * T) { const a = Math.atan2(qy - P.y, qx - P.x), ax = P.x + Math.cos(a) * 44, ay = P.y - 12 + Math.sin(a) * 30; ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.globalAlpha = .75 + Math.sin(time * 4) * .2; ctx.fillStyle = '#e8c170'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
  }
  for (const f of floats) { ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.font = 'bold ' + f.size + 'px Philosopher, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;
}
function drawLighting(vw, vh) {
  const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2);
  if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
  const L = lctx, s = zoom / 2;
  L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, lw, lh);
  L.fillStyle = 'rgba(12,6,28,.5)'; L.fillRect(0, 0, lw, lh);
  L.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const X = (x - camX) * s, Y = (y - camY) * s, Rr = r * s; if (X < -Rr || Y < -Rr || X > lw + Rr || Y > lh + Rr) return; const g = L.createRadialGradient(X, Y, 0, X, Y, Rr); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(X - Rr, Y - Rr, Rr * 2, Rr * 2); };
  if (P && state !== 'menu') hole(P.x, P.y - 14, 210, .85); else hole(camX + vw / 2, camY + vh / 2, 400, .7);
  for (const l of lights) hole(l.x, l.y, l.r * (l.fire ? 1 + Math.sin(time * 9) * .04 : 1), .9);
  for (const pr of projs) hole(pr.x, pr.y, 60, .6);
  L.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0, cv.width, cv.height);
  // coloured glows
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (l.x < camX - l.r || l.x > camX + vw + l.r || l.y < camY - l.r || l.y > camY + vh + l.r) continue;
    const col = l.fire && P ? FACTION[P.faction].fire : l.col, r = l.r * .55;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r); g.addColorStop(0, col + '.22)'); g.addColorStop(1, col + '0)'); ctx.fillStyle = g; ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawThing(it) {
  const c = ctx;
  if (it.kind === 'player') {
    const b = it.buffs;
    if (b.shield > 0) { c.fillStyle = 'rgba(255,230,150,' + (.18 + Math.sin(time * 6) * .05) + ')'; ell(c, it.x, it.y - 16, 18, 22); }
    if (b.rage > 0) { c.fillStyle = 'rgba(255,50,40,.18)'; ell(c, it.x, it.y - 14, 16, 20); if (Math.random() < .3) parts.push({ x: it.x + rnd(-8, 8), y: it.y - rnd(0, 30), vx: 0, vy: -30, life: .5, max: .5, col: '#ff4030', size: 2, grav: 0 }); }
    drawHumanoid(c, it.x, it.y, { look: it.C.look, face: it.face, back: it.back, walk: it.walk, moving: it.moving, atk: it.atkAnim, alpha: it.flash > 0 ? .6 : 1 });
    return;
  }
  if (it.kind === 'enemy') {
    const a = it.flash > 0 ? .55 : 1;
    if (it.type === 'ghost') drawGhost(c, it.x, it.y, time + it.hx, 1, .85 * a);
    else drawHumanoid(c, it.x, it.y, { look: ETYPES[it.type].look, face: it.face, back: it.back, walk: it.walk, moving: it.moving, atk: it.atkAnim, alpha: a, scale: it.scale });
    if (it.dot) { c.fillStyle = 'rgba(109,255,138,.25)'; ell(c, it.x, it.y - 16 * it.scale, 12 * it.scale, 16 * it.scale); }
    if (it.stun > 0) { c.fillStyle = '#ffd54a'; for (let k = 0; k < 3; k++) { const a2 = time * 5 + k * 2.1; circ(c, it.x + Math.cos(a2) * 8, it.y - 42 * it.scale + Math.sin(a2) * 3, 1.6); } }
    if (it.slow > 0) { c.fillStyle = 'rgba(160,230,255,.3)'; ell(c, it.x, it.y - 2, 12, 4); }
    return;
  }
  if (it.kind === 'npc') { drawHumanoid(c, it.x, it.y, { look: it.look, face: it.face, walk: time * 2, moving: false }); return; }
  if (it.kind === 'minion') { drawHumanoid(c, it.x, it.y, { look: MINION_LOOK, face: it.face, back: it.back, walk: it.walk, moving: it.moving, atk: it.atkAnim, alpha: Math.min(1, it.life) * (it.flash > 0 ? .6 : .95), scale: .9 }); return; }
  // objects
  let s;
  switch (it.type) {
    case 'tree': s = SPR['tree' + Math.floor(it.v * 3)]; break;
    case 'pine': s = SPR['pine' + Math.floor(it.v * 2)]; break;
    case 'rock': s = SPR['rock' + Math.floor(it.v * 2)]; break;
    case 'grave': s = SPR['grave' + Math.floor(it.v * 2)]; break;
    case 'fire': return drawFire(it);
    case 'banner': return drawBanner(it);
    default: s = SPR[it.type];
  }
  if (!s) return;
  const yOff = it.type === 'wall' ? T + 3 - 0 : 0;
  c.drawImage(s, it.x - s.w / 2, it.y + (it.type === 'wall' ? 3 : 0) - s.h, s.w, s.h);
}
const MINION_LOOK = { skin: '#d4e8cc', armor: '#d4e8cc', armor2: '#b8ccb0', trim: '#6dff8a', legs: '#c8dcc0', boots: '#c8dcc0', head: 'skull', weapon: 'rsword', bones: 1, rags: 1, eyes: '#6dff8a' };
function drawFire(o) {
  const c = ctx, x = o.x, y = o.y - 4, F = FACTION[P ? P.faction : 'light'].flame;
  c.fillStyle = 'rgba(0,0,0,.4)'; ell(c, x, y + 2, 16, 5);
  c.fillStyle = '#58545f'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; ell(c, x + Math.cos(a) * 13, y + Math.sin(a) * 5, 4, 3); }
  c.fillStyle = '#4a2e18'; c.save(); c.translate(x, y); c.rotate(.4); c.fillRect(-11, -2, 22, 4); c.rotate(-.8); c.fillRect(-11, -2, 22, 4); c.restore();
  for (let k = 0; k < 3; k++) {
    const h = 20 - k * 5 + Math.sin(time * 12 + k) * 3, w = 9 - k * 2.2;
    c.fillStyle = F[k]; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w, y - h * .5, x + Math.sin(time * 8 + k) * 2, y - h); c.quadraticCurveTo(x + w, y - h * .5, x + w, y); c.closePath(); c.fill();
  }
  if (Math.random() < .3) parts.push({ x: x + rnd(-5, 5), y: y - 14, vx: rnd(-8, 8), vy: -40, life: .8, max: .8, col: F[0], size: 1.6, grav: 0 });
}
function drawBanner(o) {
  const c = ctx, col = P ? FACTION[P.faction].banner : '#2f5cb5';
  c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, o.x, o.y, 6, 2);
  c.fillStyle = '#3a2a1a'; c.fillRect(o.x - 1.5, o.y - 46, 3, 46);
  const w = Math.sin(time * 2 + o.tx) * 2;
  c.fillStyle = col; c.beginPath(); c.moveTo(o.x + 1, o.y - 44); c.lineTo(o.x + 16 + w, o.y - 42); c.lineTo(o.x + 15 + w, o.y - 24); c.lineTo(o.x + 8, o.y - 28); c.lineTo(o.x + 1, o.y - 24); c.closePath(); c.fill();
  c.fillStyle = '#e8c170'; circ(c, o.x + 8 + w * .5, o.y - 35, 2.5);
}

// ============ minimap ============
const mm = $('minimap'), mmc = mm.getContext('2d');
function drawMinimap() {
  if (!P) return;
  mmc.imageSmoothingEnabled = false;
  const vw = 64, vh = 48;
  const cx = clamp(P.x / T - vw / 2, 0, MW - vw), cy = clamp(P.y / T - vh / 2, 0, MH - vh);
  mmc.clearRect(0, 0, mm.width, mm.height);
  mmc.drawImage(miniBase, cx, cy, vw, vh, 0, 0, mm.width, mm.height);
  const sc = mm.width / vw;
  const q = questFor(P.questIdx);
  mmc.fillStyle = '#ffd54a'; const qx = (q.at.tx - cx) * sc, qy = (q.at.ty - cy) * sc;
  if (qx > 0 && qy > 0 && qx < mm.width && qy < mm.height) { mmc.font = 'bold 10px sans-serif'; mmc.textAlign = 'center'; mmc.fillText('!', qx, qy + 4); }
  mmc.fillStyle = '#ff5a4a';
  for (const e of enemies) { if (e.dead) continue; const x = (e.x / T - cx) * sc, y = (e.y / T - cy) * sc; if (x < 0 || y < 0 || x > mm.width || y > mm.height) continue; mmc.fillRect(x - 1, y - 1, e.type === 'boss' ? 4 : 2, e.type === 'boss' ? 4 : 2); }
  mmc.fillStyle = '#e8c170'; mmc.fillRect((CAMP.tx - cx) * sc - 2, (CAMP.ty - cy) * sc - 2, 4, 4);
  mmc.fillStyle = '#fff'; mmc.beginPath(); mmc.arc((P.x / T - cx) * sc, (P.y / T - cy) * sc, 2.5, 0, 6.29); mmc.fill();
}

// ============ HUD ============
const hudCache = {};
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setW(id, f) { const v = (clamp(f, 0, 1) * 100).toFixed(1) + '%'; if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.width = v; } }
function buildSkillBar() {
  const box = $('skills'); box.innerHTML = '';
  P.C.skills.forEach((sk, i) => {
    const b = document.createElement('button'); b.className = 'sk ' + (i === 0 ? 'big' : 's' + i); b.title = sk.n + (sk.d ? ' — ' + sk.d : '');
    b.innerHTML = `${sk.i}<span class="cd"></span><span class="cdt"></span>${sk.mp ? `<span class="cost">${sk.mp}</span>` : ''}<span class="key">${i + 1}</span>`;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useSkill(i); pressFx(i); });
    box.appendChild(b);
  });
  const hp = document.createElement('button'); hp.className = 'pot hpp'; hp.innerHTML = '❤️<span id="potH">0</span>'; hp.title = 'Зілля здоров\'я (Q)';
  hp.addEventListener('pointerdown', e => { e.preventDefault(); drinkPotion('hp'); });
  const mp = document.createElement('button'); mp.className = 'pot mpp'; mp.innerHTML = '💧<span id="potM">0</span>'; mp.title = 'Зілля мани (E)';
  mp.addEventListener('pointerdown', e => { e.preventDefault(); drinkPotion('mp'); });
  box.appendChild(hp); box.appendChild(mp);
  for (const k in hudCache) delete hudCache[k];
}
function pressFx(i) { const b = $('skills').children[i]; if (!b) return; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); }
function updateHud() {
  setTxt('hName', P.name); setTxt('hLvl', P.lvl + ' рів.');
  setW('hHp', P.hp / P.maxHp); setTxt('hHpT', Math.ceil(P.hp) + ' / ' + P.maxHp);
  setW('hMp', P.mp / P.maxMp); setTxt('hMpT', Math.floor(P.mp) + ' / ' + P.maxMp);
  setW('hXp', P.xp / xpNeed(P.lvl)); setTxt('hGold', '' + P.gold);
  setTxt('potH', '' + P.hpPot); setTxt('potM', '' + P.mpPot);
  const t = P.target;
  if (alive(t)) { $('tFrame').hidden = false; setTxt('tName', t.name); setTxt('tLvl', ' ' + t.lvl); setW('tHp', t.hp / t.maxHp); setTxt('tHpT', Math.ceil(t.hp) + ' / ' + t.maxHp); }
  else $('tFrame').hidden = true;
  const q = questFor(P.questIdx); setTxt('qT', q.t); setTxt('qD', q.d); setTxt('qP', P.qprog + ' / ' + q.n);
  const btns = $('skills').children;
  P.C.skills.forEach((sk, i) => {
    const b = btns[i]; if (!b) return; const cd = P.cds[i], f = cd > 0 ? cd / sk.cd : 0;
    const key = 'cd' + i, v = f.toFixed(3); if (hudCache[key] !== v) { hudCache[key] = v; b.style.setProperty('--cd', v); b.children[1].textContent = cd > 1 && i > 0 ? Math.ceil(cd) : ''; }
    const nm = P.mp < sk.mp; if (hudCache['nm' + i] !== nm) { hudCache['nm' + i] = nm; b.classList.toggle('nomp', nm); }
  });
}

// ============ dialogs ============
function openDialog(html) { const d = $('dialog'); d.innerHTML = html; d.hidden = false; }
function closeDialog() { $('dialog').hidden = true; }
$('dialog').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'close') closeDialog();
  else if (act === 'buyhp' || act === 'buymp') { const price = 10 + P.lvl * 2; if (P.gold < price) return toast('Не вистачає золота'); P.gold -= price; if (act === 'buyhp') P.hpPot++; else P.mpPot++; toast('Куплено!'); writeSave(); openNpc(npcs[1]); }
  else if (act === 'resume') closeDialog();
  else if (act === 'save') { writeSave(); toast('Збережено'); closeDialog(); }
  else if (act === 'tomenu') { writeSave(); closeDialog(); toMenu(); }
});
function openNpc(n) {
  if (n.role === 'elder') {
    const q = questFor(P.questIdx);
    const lines = P.faction === 'light'
      ? ['Світло ледве жевріє в цих землях, герою.', 'Прокляття склепу піднімає мертвих щоночі.']
      : ['Живі думають, що ці землі належать їм. Помиляються.', 'Але Страж Склепу не визнає навіть нас.'];
    openDialog(`<h3>${n.name}</h3><p><i>«${lines[P.questIdx % 2]}»</i></p><div class="row"><div><b style="color:var(--gold)">${q.t}</b><br>${q.d}<br><span style="color:var(--good)">Прогрес: ${P.qprog} / ${q.n}</span><br><small style="color:var(--muted)">Нагорода: ${q.xp} досвіду, ${q.gold} 🪙</small></div></div><button class="btn" data-act="close">Зрозумів</button>`);
  } else {
    const price = 10 + P.lvl * 2;
    openDialog(`<h3>${n.name}</h3><p>У тебе ${P.gold} 🪙</p>
      <div class="row"><span>❤️ Зілля здоров'я <small style="color:var(--muted)">(${P.hpPot})</small></span><button class="sbtn" data-act="buyhp" ${P.gold < price ? 'disabled' : ''}>${price} 🪙</button></div>
      <div class="row"><span>💧 Зілля мани <small style="color:var(--muted)">(${P.mpPot})</small></span><button class="sbtn" data-act="buymp" ${P.gold < price ? 'disabled' : ''}>${price} 🪙</button></div>
      <button class="btn ghost" data-act="close">Закрити</button>`);
  }
}
function openMenu() {
  openDialog(`<h3>Меню</h3><p>${P.name} — ${P.C.name}, ${P.lvl} рівень</p>
    <p style="color:var(--muted);font-size:13px">Прогрес зберігається автоматично в цьому браузері.</p>
    <button class="btn" data-act="resume">Продовжити</button><button class="btn ghost" data-act="save">Зберегти</button><button class="btn ghost" data-act="tomenu">Головне меню</button>`);
}
$('bMenu').addEventListener('click', () => { if (state === 'game') openMenu(); });
$('bRevive').addEventListener('click', reviveP);

// ============ menus ============
let pickFaction = 'light', pickClass = 'paladin';
function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function previewCanvas(cvs, cls, t) {
  const g = cvs.getContext('2d'), w = cvs.width, h = cvs.height; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  const gr = g.createRadialGradient(w / 2, h * .75, 4, w / 2, h * .7, w * .5); gr.addColorStop(0, CLASSES[cls].faction === 'light' ? 'rgba(80,120,220,.35)' : 'rgba(80,200,110,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const sc = w / 42;
  drawHumanoid(g, w / 2, h * .86, { look: CLASSES[cls].look, face: 1, walk: t * 2, moving: false, scale: sc, atk: (t % 3) < 1 ? (t % 3) : -1 });
}
function refreshTitle() {
  const s = loadSave();
  if (s && CLASSES[s.cls]) { $('bContinue').hidden = false; $('contInfo').textContent = `${s.name} · ${CLASSES[s.cls].name} · ${s.lvl} рівень`; }
  else $('bContinue').hidden = true;
}
$('bContinue').addEventListener('click', () => { const s = loadSave(); if (s) startGame(s); });
$('bNew').addEventListener('click', () => {
  if (loadSave()) { openDialog(`<h3>Новий герой?</h3><p>Збережений герой буде видалений.</p><button class="btn" id="bConfirmNew">Так, почати заново</button><button class="btn ghost" data-act="close">Скасувати</button>`); $('bConfirmNew').onclick = () => { closeDialog(); show('scrFaction'); }; }
  else show('scrFaction');
});
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => show(b.dataset.back));
for (const c of document.querySelectorAll('#scrFaction .card')) {
  const go = () => { pickFaction = c.dataset.f; buildClassCards(); show('scrClass'); };
  c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
function buildClassCards() {
  const box = $('classCards'); box.innerHTML = '';
  for (const id in CLASSES) {
    const C = CLASSES[id]; if (C.faction !== pickFaction) continue;
    const d = document.createElement('div'); d.className = 'card ' + C.faction; d.tabIndex = 0; d.dataset.cls = id;
    d.innerHTML = `<canvas width="120" height="120" data-preview="${id}"></canvas><h3>${C.name}</h3><p>${C.desc}</p>
      <div class="stats"><span>❤️ ${C.hp}</span><span>💧 ${C.mp}</span><span>⚔️ ${C.atk}</span><span>${C.range > 60 ? '🏹 Дальній' : '🗡️ Ближній'}</span></div>
      <div class="skills">${C.skills.map(s => `<span title="${s.n}">${s.i}</span>`).join('')}</div>`;
    const go = () => { pickClass = id; $('nameIn').value = randomName(C.faction); show('scrName'); };
    d.addEventListener('click', go); d.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    box.appendChild(d);
  }
}
function randomName(f) {
  const a = f === 'light' ? ['Ярослав', 'Мирослава', 'Богдан', 'Златослава', 'Всеволод', 'Ростислав', 'Злата', 'Святослав'] : ['Моргул', 'Кістяк', 'Вієра', 'Гнилодух', 'Некрос', 'Тінь', 'Скорбот', 'Мара'];
  return a[Math.floor(Math.random() * a.length)];
}
$('bStart').addEventListener('click', () => {
  const name = ($('nameIn').value || '').trim().slice(0, 14) || randomName(pickFaction);
  clearSave(); startGame({ cls: pickClass, name, lvl: 1, xp: 0, gold: 0 });
});

function startGame(d) {
  makePlayer(d); minion = null; projs.length = 0; teles.length = 0;
  for (const e of enemies) { e.dead = false; e.hp = e.maxHp; e.x = e.hx; e.y = e.hy; e.state = 'idle'; e.aggro = null; e.dot = null; e.stun = 0; }
  state = 'game'; show(''); $('hud').hidden = false; $('death').hidden = true; closeDialog(); buildSkillBar(); writeSave();
  toast(FACTION[P.faction].camp + ' — поговори зі старійшиною ❗');
}
function toMenu() { state = 'menu'; $('hud').hidden = true; $('death').hidden = true; refreshTitle(); show('scrTitle'); P = null; minion = null; }

// ============ loop ============
let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
  if (state === 'game' && P) {
    const paused = !$('dialog').hidden;
    if (!paused) { updatePlayer(dt); updateMinion(dt); updateEnemies(dt); updateProjs(dt); }
    updateFx(dt);
    updateHud(); drawMinimap();
    saveT += dt; if (saveT > 10) { saveT = 0; writeSave(); }
  } else {
    updateFx(dt);
    for (const c of document.querySelectorAll('.screen:not([hidden]) canvas[data-preview]')) previewCanvas(c, c.dataset.preview, time);
    if (!$('scrName').hidden) previewCanvas($('namePreview'), pickClass, time);
  }
  render();
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });
addEventListener('pagehide', writeSave);

// ============ boot ============
resize(); genWorld(); buildSprites(); renderGround(); placeSpawns(); refreshTitle();
requestAnimationFrame(frame);
window.__game = { get P() { return P; }, enemies, useSkill, worldTap, get state() { return state; } };
})();

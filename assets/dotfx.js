// Dot-matrix canvases for the footer: the giant "QUESTBOARD" wordmark (dots scatter around a ring cursor)
// and a dotted Scout with blue "live" dots. Plain canvas, no libraries. Static when prefers-reduced-motion is set.
import { reducedMotion } from './ui.js';

const GREY = '#C9CCD3';
const INK = '#111111';

/** Samples a drawing into grid points. draw(ctx, w, h) paints on an offscreen canvas; returns [{x, y, a}] in CSS px. */
function sample(w, h, step, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = step / 2; y < c.height; y += step) {
    for (let x = step / 2; x < c.width; x += step) {
      const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
      if (data[i + 3] > 110) pts.push({ x, y, r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  return pts;
}

function fitCanvas(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Giant dotted wordmark. Move the pointer over it: a ring cursor pushes the dots away; they spring back. */
export function dotWordmark(canvas, text, accent = '#1F3BFF') {
  let dots = [], W = 0, H = 0, step = 6, ctx, raf = 0, pointer = null, ring = 0;
  const still = reducedMotion();

  function build() {
    W = canvas.parentElement.clientWidth;
    H = Math.round(W * 0.16);
    step = Math.max(3, Math.round(W / 300));
    ctx = fitCanvas(canvas, W, H);
    dots = sample(W, H, step, (g, w, h) => {
      let size = h * 1.05;
      g.font = `800 ${size}px Montserrat, system-ui, sans-serif`;
      const m = g.measureText(text).width;
      size *= (w * 0.995) / m;
      g.font = `800 ${size}px Montserrat, system-ui, sans-serif`;
      g.textBaseline = 'middle';
      g.fillStyle = '#000';
      g.fillText(text, (w - g.measureText(text).width) / 2, h * 0.54);
    }).map((p) => ({ hx: p.x, hy: p.y, x: p.x, y: p.y, vx: 0, vy: 0, j: Math.random() }));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const rad = step * 0.32;
    for (const d of dots) {
      const off = Math.abs(d.x - d.hx) + Math.abs(d.y - d.hy);
      ctx.fillStyle = off > step * 1.5 ? INK : GREY;
      ctx.fillRect(d.x - rad, d.y - rad, rad * 2, rad * 2);
    }
    if (pointer && ring > 0.01) {
      const R = step * 8 * ring;
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function tick() {
    raf = 0;
    const R = step * 13;
    let moving = false;
    ring += ((pointer ? 1 : 0) - ring) * 0.2;
    for (const d of dots) {
      if (pointer) {
        const dx = d.x - pointer.x, dy = d.y - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < R) {
          const f = (1 - dist / R) * (2.2 + d.j * 2.5);
          d.vx += (dx / dist) * f + (d.j - 0.5) * 0.6;
          d.vy += (dy / dist) * f + (0.5 - d.j) * 0.6;
        }
      }
      d.vx += (d.hx - d.x) * 0.045; d.vy += (d.hy - d.y) * 0.045;
      d.vx *= 0.82; d.vy *= 0.82;
      d.x += d.vx; d.y += d.vy;
      if (Math.abs(d.vx) + Math.abs(d.vy) > 0.03 || Math.abs(d.x - d.hx) + Math.abs(d.y - d.hy) > 0.3) moving = true;
    }
    draw();
    if (moving || pointer || ring > 0.01) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    kick();
  };
  const onLeave = () => { pointer = null; kick(); };
  if (!still) {
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onLeave);
  }
  const ro = new ResizeObserver(() => { if (canvas.parentElement.clientWidth !== W) build(); });
  ro.observe(canvas.parentElement);
  (document.fonts?.ready || Promise.resolve()).then(build);
  return () => { ro.disconnect(); cancelAnimationFrame(raf); };
}

/** Dotted Scout head (svg markup) with blue "live" dots on the eyes and nose; blue dots blink gently. */
export function dotFox(canvas, svgInner, viewBox, accent = '#1F3BFF') {
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  let W, H, ctx, pts = [], raf = 0, t0 = performance.now();
  const blue = [[82, 78], [118, 78], [100, 105]];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${svgInner}</svg>`);

  function build() {
    W = canvas.parentElement.clientWidth;
    H = Math.round(W * (vh / vw));
    const step = Math.max(4, Math.round(W / 40));
    ctx = fitCanvas(canvas, W, H);
    pts = sample(W, H, step, (g, w, h) => g.drawImage(img, 0, 0, w, h)).map((p) => {
      const sx = vx + (p.x / W) * vw, sy = vy + (p.y / H) * vh;
      const hot = blue.some(([bx, by]) => Math.hypot(sx - bx, sy - by) < 3.6);
      const dark = p.r + p.g + p.b < 260;
      return { ...p, hot, dark, step };
    });
    draw(0);
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      const s = p.step * (p.hot ? 0.36 : 0.26);
      ctx.globalAlpha = p.hot ? 0.7 + 0.3 * Math.sin(t / 500) : 1;
      ctx.fillStyle = p.hot ? accent : p.dark ? '#9EA3AD' : '#D3D6DC';
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const loop = (now) => { draw(now - t0); raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !reducedMotion()) { if (!raf) raf = requestAnimationFrame(loop); }
    else { cancelAnimationFrame(raf); raf = 0; }
  });
  img.onload = () => { build(); io.observe(canvas); };
  const ro = new ResizeObserver(() => { if (img.complete && canvas.parentElement.clientWidth !== W) build(); });
  ro.observe(canvas.parentElement);
  return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
}

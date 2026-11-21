export type Rect = { x: number; y: number; w: number; h: number };

/** Treemap squarified (Bruls et al.). Devuelve un rect por valor, en el mismo orden. */
export function squarify(values: number[], rect: Rect): Rect[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const total = values.reduce((a, b) => a + b, 0);
  const scale = (rect.w * rect.h) / total;
  const items = order.map((o) => ({ a: o.v * scale, i: o.i }));
  const out: Rect[] = new Array(values.length);
  let { x, y, w, h } = rect;
  let row: typeof items = [];

  const worst = (r: typeof items, side: number) => {
    let s = 0, mx = 0, mn = Infinity;
    for (const it of r) { s += it.a; if (it.a > mx) mx = it.a; if (it.a < mn) mn = it.a; }
    const s2 = s * s, side2 = side * side;
    return Math.max((side2 * mx) / s2, s2 / (side2 * mn));
  };

  const layout = (r: typeof items) => {
    const s = r.reduce((a, it) => a + it.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const it of r) { const ih = it.a / cw; out[it.i] = { x, y: cy, w: cw, h: ih }; cy += ih; }
      x += cw; w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const it of r) { const iw = it.a / rh; out[it.i] = { x: cx, y, w: iw, h: rh }; cx += iw; }
      y += rh; h -= rh;
    }
  };

  let k = 0;
  while (k < items.length) {
    const side = Math.min(w, h);
    const c = items[k];
    if (row.length === 0 || worst([...row, c], side) <= worst(row, side)) {
      row.push(c);
      k++;
    } else {
      layout(row);
      row = [];
    }
  }
  if (row.length) layout(row);
  return out;
}

/** Partición recursiva estilo treemap para la ciudad de fondo. */
export function slice(rect: Rect, rand: () => number, minArea: number, out: Rect[] = [], depth = 0): Rect[] {
  const area = rect.w * rect.h;
  if (area < minArea * (0.6 + rand() * 1.8) || depth > 14) {
    out.push(rect);
    return out;
  }
  const t = 0.28 + rand() * 0.44;
  if (rect.w >= rect.h) {
    const a = rect.w * t;
    slice({ x: rect.x, y: rect.y, w: a, h: rect.h }, rand, minArea, out, depth + 1);
    slice({ x: rect.x + a, y: rect.y, w: rect.w - a, h: rect.h }, rand, minArea, out, depth + 1);
  } else {
    const a = rect.h * t;
    slice({ x: rect.x, y: rect.y, w: rect.w, h: a }, rand, minArea, out, depth + 1);
    slice({ x: rect.x, y: rect.y + a, w: rect.w, h: rect.h - a }, rand, minArea, out, depth + 1);
  }
  return out;
}

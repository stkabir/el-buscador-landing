export type ThemeName = 'dark' | 'light';

export type Palette = {
  bg: number;
  ground: number;
  blocks: [number, number, number];
  lit: number;
  accent: number;
  accent2: number;
  accent3: number;
  safe: number;
  review: number;
  keep: number;
  neutral: number;
  wall: number;
  roof: number;
  steel: number;
  belt: number;
  skin: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  dirI: number;
  emissive: number;
  ink: string;
  muted: string;
  labelBg: string;
  labelLine: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: 0x0f1115,
    ground: 0x111419,
    blocks: [0x1b2029, 0x212731, 0x283039],
    lit: 0x1d3a31,
    accent: 0x34d399,
    accent2: 0x23a87c,
    accent3: 0x177a5a,
    safe: 0x34d399,
    review: 0xfbbf24,
    keep: 0xf87171,
    neutral: 0x2c333e,
    wall: 0x232a34,
    roof: 0x1a1f27,
    steel: 0x46515f,
    belt: 0x15191f,
    skin: 0xd9a77f,
    hemiSky: 0x9fb0c4,
    hemiGround: 0x0f1115,
    hemiI: 0.75,
    dirI: 1.9,
    emissive: 0.55,
    ink: '#e8eaed',
    muted: '#9aa3ae',
    labelBg: 'rgba(15,17,21,0.86)',
    labelLine: 'rgba(52,211,153,0.55)',
  },
  light: {
    bg: 0xe8ecf0,
    ground: 0xdde3e9,
    blocks: [0xf7f8fa, 0xeef1f4, 0xe3e8ed],
    lit: 0xc6efdf,
    accent: 0x10b981,
    accent2: 0x0d9b6e,
    accent3: 0x0a7a57,
    safe: 0x10b981,
    review: 0xf59e0b,
    keep: 0xef4444,
    neutral: 0xc9d1da,
    wall: 0xf3f5f8,
    roof: 0xd3dae2,
    steel: 0x8a96a3,
    belt: 0x4a5562,
    skin: 0xe0b48f,
    hemiSky: 0xffffff,
    hemiGround: 0xb9c2cc,
    hemiI: 1.25,
    dirI: 2.1,
    emissive: 0.12,
    ink: '#14171c',
    muted: '#545d69',
    labelBg: 'rgba(255,255,255,0.94)',
    labelLine: 'rgba(4,120,87,0.45)',
  },
};

export function currentTheme(): ThemeName {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// --- utilidades numéricas ---
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** progreso local de x dentro de [a, b] */
export const range = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

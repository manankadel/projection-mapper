export interface RGB { r: number; g: number; b: number; }
export interface HSV { h: number; s: number; v: number; }
export interface HSL { h: number; s: number; l: number; }

export function hexToRGB(hex: string): RGB {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.substr(0, 2), 16) / 255,
    g: parseInt(hex.substr(2, 2), 16) / 255,
    b: parseInt(hex.substr(4, 2), 16) / 255,
  };
}

export function rgbToHex(rgb: RGB): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function rgbToHSV(rgb: RGB): HSV {
  const r = rgb.r, g = rgb.g, b = rgb.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, v };
}

export function hsvToRGB(hsv: HSV): RGB {
  const { h, s, v } = hsv;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: return { r: v, g: t, b: p };
    case 1: return { r: q, g: v, b: p };
    case 2: return { r: p, g: v, b: t };
    case 3: return { r: p, g: q, b: v };
    case 4: return { r: t, g: p, b: v };
    case 5: return { r: v, g: p, b: q };
    default: return { r: 0, g: 0, b: 0 };
  }
}

export function rgbToHSL(rgb: RGB): HSL {
  const r = rgb.r, g = rgb.g, b = rgb.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, l };
}

export function hslToRGB(hsl: HSL): RGB {
  const { h, s, l } = hsl;
  if (s === 0) return { r: l, g: l, b: l };

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
}

export function gammaCorrect(v: number, gamma: number): number {
  return Math.pow(v, 1 / gamma);
}

export function linearToSRGB(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function sRGBToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// Color temperature approximation (Kelvin to RGB)
export function kelvinToRGB(kelvin: number): RGB {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 1;
    g = clamp((99.4708025861 * Math.log(temp) - 161.1195681661) / 255, 0, 1);
    if (temp <= 19) {
      b = 0;
    } else {
      b = clamp((138.5177312231 * Math.log(temp - 10) - 305.0447927307) / 255, 0, 1);
    }
  } else {
    r = clamp((329.698727446 * Math.pow(temp - 60, -0.1332047592)) / 255, 0, 1);
    g = clamp((288.1221695283 * Math.pow(temp - 60, -0.0755148492)) / 255, 0, 1);
    b = 1;
  }

  return { r, g, b };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Generate surface color palette
export const SURFACE_COLORS = [
  '#00d4ff', '#ff3366', '#33ff88', '#ffaa00',
  '#aa55ff', '#ff5500', '#00ffaa', '#5588ff',
  '#ff00aa', '#aaff00', '#00aaff', '#ff8800',
];

// Contrast curves
export function applyContrast(rgb: RGB, contrast: number): RGB {
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  return {
    r: clamp(factor * (rgb.r - 0.5) + 0.5, 0, 1),
    g: clamp(factor * (rgb.g - 0.5) + 0.5, 0, 1),
    b: clamp(factor * (rgb.b - 0.5) + 0.5, 0, 1),
  };
}

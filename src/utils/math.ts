import type { Vec2, ControlPoint } from '../types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function vec2Length(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(b, a));
}

export function vec2Normalize(a: Vec2): Vec2 {
  const len = vec2Length(a);
  if (len === 0) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

export function vec2Lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Reflect(a: Vec2, normal: Vec2): Vec2 {
  const d = 2 * vec2Dot(a, normal);
  return { x: a.x - d * normal.x, y: a.y - d * normal.y };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return (v - a) / (b - a);
}

export function remap(inMin: number, inMax: number, outMin: number, outMax: number, v: number): number {
  const t = inverseLerp(inMin, inMax, v);
  return lerp(outMin, outMax, t);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function gammaCorrect(v: number, gamma: number): number {
  return Math.pow(v, 1 / gamma);
}

// Bézier curve evaluation
export function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
}

export function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  return 3 * mt2 * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t2 * (p3 - p2);
}

// Evaluate bicubic surface
export function bicubicSurface(
  u: number, v: number,
  p00: Vec2, p10: Vec2, p20: Vec2, p30: Vec2,
  p01: Vec2, p11: Vec2, p21: Vec2, p31: Vec2,
  p02: Vec2, p12: Vec2, p22: Vec2, p32: Vec2,
  p03: Vec2, p13: Vec2, p23: Vec2, p33: Vec2,
): Vec2 {
  // First interpolate along u for each row
  const row0 = {
    x: cubicBezier(u, p00.x, p10.x, p20.x, p30.x),
    y: cubicBezier(u, p00.y, p10.y, p20.y, p30.y),
  };
  const row1 = {
    x: cubicBezier(u, p01.x, p11.x, p21.x, p31.x),
    y: cubicBezier(u, p01.y, p11.y, p21.y, p31.y),
  };
  const row2 = {
    x: cubicBezier(u, p02.x, p12.x, p22.x, p32.x),
    y: cubicBezier(u, p02.y, p12.y, p22.y, p32.y),
  };
  const row3 = {
    x: cubicBezier(u, p03.x, p13.x, p23.x, p33.x),
    y: cubicBezier(u, p03.y, p13.y, p23.y, p33.y),
  };

  // Then interpolate along v
  return {
    x: cubicBezier(v, row0.x, row1.x, row2.x, row3.x),
    y: cubicBezier(v, row0.y, row1.y, row2.y, row3.y),
  };
}

// Create a flat mesh grid
export function createFlatMesh(
  x: number, y: number, w: number, h: number,
  cols: number, rows: number,
): ControlPoint[] {
  const points: ControlPoint[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      const px = x + w * u;
      const py = y + h * v;
      points.push({
        pos: { x: px, y: py },
        handleIn: { x: px - w / cols * 0.25, y: py },
        handleOut: { x: px + w / cols * 0.25, y: py },
      });
    }
  }
  return points;
}

// Tessellate mesh into triangles with bicubic Bézier interpolation
// The handles define cubic Bézier curves along each edge, giving smooth warps
export function tessellateBezierMesh(
  points: ControlPoint[],
  cols: number,
  rows: number,
  segments: number,
): { positions: Float32Array; texCoords: Float32Array } {
  const positions: number[] = [];
  const texCoords: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i00 = r * (cols + 1) + c;
      const i10 = i00 + 1;
      const i01 = i00 + (cols + 1);
      const i11 = i01 + 1;

      const p00 = points[i00].pos;
      const p10 = points[i10].pos;
      const p01 = points[i01].pos;
      const p11 = points[i11].pos;

      const h00 = points[i00].handleOut;
      const h10 = points[i10].handleIn;
      const h01 = points[i01].handleOut;
      const h11 = points[i11].handleIn;

      for (let sy = 0; sy < segments; sy++) {
        for (let sx = 0; sx < segments; sx++) {
          const u0 = sx / segments;
          const u1 = (sx + 1) / segments;
          const v0 = sy / segments;
          const v1 = (sy + 1) / segments;

          const q00 = evalBicubicPatch(u0, v0, p00, p10, p01, p11, h00, h10, h01, h11);
          const q10 = evalBicubicPatch(u1, v0, p00, p10, p01, p11, h00, h10, h01, h11);
          const q01 = evalBicubicPatch(u0, v1, p00, p10, p01, p11, h00, h10, h01, h11);
          const q11 = evalBicubicPatch(u1, v1, p00, p10, p01, p11, h00, h10, h01, h11);

          positions.push(q00.x, q00.y, q10.x, q10.y, q01.x, q01.y);
          texCoords.push(u0, v0, u1, v0, u0, v1);

          positions.push(q10.x, q10.y, q11.x, q11.y, q01.x, q01.y);
          texCoords.push(u1, v0, u1, v1, u0, v1);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    texCoords: new Float32Array(texCoords),
  };
}

// Cubic Bézier edge interpolation, then linear blend between edges (Y direction)
// This uses the handles for smooth X-direction warping while maintaining grid-like Y interpolation
function evalBicubicPatch(
  u: number, v: number,
  p00: Vec2, p10: Vec2, p01: Vec2, p11: Vec2,
  h00: Vec2, h10: Vec2, h01: Vec2, h11: Vec2,
): Vec2 {
  // Top edge: cubic Bézier from p00 to p10 using h00 (handleOut) and h10 (handleIn)
  const tx0 = cubicBezier(u, p00.x, h00.x, h10.x, p10.x);
  const ty0 = cubicBezier(u, p00.y, h00.y, h10.y, p10.y);

  // Bottom edge: cubic Bézier from p01 to p11 using h01 (handleOut) and h11 (handleIn)
  const tx1 = cubicBezier(u, p01.x, h01.x, h11.x, p11.x);
  const ty1 = cubicBezier(u, p01.y, h01.y, h11.y, p11.y);

  // Linear interpolation between top and bottom edges
  const x = lerp(tx0, tx1, v);
  const y = lerp(ty0, ty1, v);
  return { x, y };
}

// Find closest point on a line segment
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number; distance: number } {
  const ab = vec2Sub(b, a);
  const ap = vec2Sub(p, a);
  const abLen2 = vec2Dot(ab, ab);
  if (abLen2 === 0) return { point: a, t: 0, distance: vec2Distance(p, a) };
  let t = vec2Dot(ap, ab) / abLen2;
  t = clamp(t, 0, 1);
  const point = vec2Add(a, vec2Scale(ab, t));
  return { point, t, distance: vec2Distance(p, point) };
}

// Point-in-polygon test (ray casting)
export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Generate unique ID
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Debounce
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Throttle
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      return fn(...args);
    }
  }) as T;
}

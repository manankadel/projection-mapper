import type { SurfaceData, ControlPoint, Vec2 } from '../types';
import { createFlatMesh, vec2Distance, closestPointOnSegment } from '../utils/math';
import { SURFACE_COLORS } from '../utils/color';
import { uid } from '../utils/math';

export function createSurface(
  x: number, y: number, w: number, h: number,
  cols: number = 4, rows: number = 4,
  colorIndex: number = 0,
): SurfaceData {
  return {
    id: uid(),
    name: `Surface ${colorIndex + 1}`,
    color: SURFACE_COLORS[colorIndex % SURFACE_COLORS.length],
    mesh: {
      cols,
      rows,
      points: createFlatMesh(x, y, w, h, cols, rows),
    },
    opacity: 1,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    gamma: 2.2,
    flipH: false,
    flipV: false,
    blendMode: 'normal',
    edgeBlend: {
      enabled: false,
      side: 'none',
      width: 0.15,
      gamma: 2.2,
      blackLevel: 0,
      whiteLevel: 1,
    },
    visible: true,
    locked: false,
    groupId: null,
    contentId: null,
  };
}

export function getSurfaceBounds(surf: SurfaceData): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of surf.mesh.points) {
    minX = Math.min(minX, p.pos.x);
    minY = Math.min(minY, p.pos.y);
    maxX = Math.max(maxX, p.pos.x);
    maxY = Math.max(maxY, p.pos.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function resetSurfaceWarp(surf: SurfaceData) {
  const bounds = getSurfaceBounds(surf);
  const { cols, rows } = surf.mesh;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const idx = r * (cols + 1) + c;
      const u = c / cols;
      const v = r / rows;
      const px = bounds.x + bounds.w * u;
      const py = bounds.y + bounds.h * v;
      surf.mesh.points[idx].pos = { x: px, y: py };
      surf.mesh.points[idx].handleIn = { x: px - bounds.w / cols * 0.25, y: py };
      surf.mesh.points[idx].handleOut = { x: px + bounds.w / cols * 0.25, y: py };
    }
  }
}

export function findNearestPoint(
  surf: SurfaceData, point: Vec2, threshold: number = 15,
): { index: number; distance: number } | null {
  let nearest: { index: number; distance: number } | null = null;

  for (let i = 0; i < surf.mesh.points.length; i++) {
    const dist = vec2Distance(surf.mesh.points[i].pos, point);
    if (dist < threshold && (!nearest || dist < nearest.distance)) {
      nearest = { index: i, distance: dist };
    }
  }

  return nearest;
}

export function findNearestEdge(
  surf: SurfaceData, point: Vec2, threshold: number = 10,
): { edgeIndex: number; t: number; distance: number } | null {
  const { cols, rows, points } = surf.mesh;
  let nearest: { edgeIndex: number; t: number; distance: number } | null = null;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * (cols + 1) + c;
      const a = points[idx].pos;
      const b = points[idx + 1].pos;
      const result = closestPointOnSegment(point, a, b);
      if (result.distance < threshold && (!nearest || result.distance < nearest.distance)) {
        nearest = { edgeIndex: idx, t: result.t, distance: result.distance };
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const idx = r * (cols + 1) + c;
      const a = points[idx].pos;
      const b = points[idx + cols + 1].pos;
      const result = closestPointOnSegment(point, a, b);
      if (result.distance < threshold && (!nearest || result.distance < nearest.distance)) {
        nearest = { edgeIndex: idx, t: result.t, distance: result.distance };
      }
    }
  }

  return nearest;
}

export function updateMeshResolution(surf: SurfaceData, newCols: number, newRows: number) {
  const bounds = getSurfaceBounds(surf);
  const oldCols = surf.mesh.cols;
  const oldRows = surf.mesh.rows;

  if (newCols === oldCols && newRows === oldRows) return;

  // Sample old mesh at new grid positions
  const newPoints: ControlPoint[] = [];
  for (let r = 0; r <= newRows; r++) {
    for (let c = 0; c <= newCols; c++) {
      const u = c / newCols;
      const v = r / newRows;

      // Find position on old mesh
      const oldU = u * oldCols;
      const oldV = v * oldRows;
      const oc = Math.min(Math.floor(oldU), oldCols - 1);
      const or = Math.min(Math.floor(oldV), oldRows - 1);
      const ou = oldU - oc;
      const ov = oldV - or;

      const i00 = or * (oldCols + 1) + oc;
      const i10 = i00 + 1;
      const i01 = i00 + (oldCols + 1);
      const i11 = i01 + 1;

      const p00 = surf.mesh.points[i00]?.pos || { x: 0, y: 0 };
      const p10 = surf.mesh.points[i10]?.pos || p00;
      const p01 = surf.mesh.points[i01]?.pos || p00;
      const p11 = surf.mesh.points[i11]?.pos || p00;

      const x = (1 - ou) * (1 - ov) * p00.x + ou * (1 - ov) * p10.x + (1 - ou) * ov * p01.x + ou * ov * p11.x;
      const y = (1 - ou) * (1 - ov) * p00.y + ou * (1 - ov) * p10.y + (1 - ou) * ov * p01.y + ou * ov * p11.y;

      newPoints.push({
        pos: { x, y },
        handleIn: { x: x - bounds.w / newCols * 0.25, y },
        handleOut: { x: x + bounds.w / newCols * 0.25, y },
      });
    }
  }

  surf.mesh.cols = newCols;
  surf.mesh.rows = newRows;
  surf.mesh.points = newPoints;
}

export function moveSurface(surf: SurfaceData, dx: number, dy: number) {
  for (const p of surf.mesh.points) {
    p.pos.x += dx;
    p.pos.y += dy;
    p.handleIn.x += dx;
    p.handleIn.y += dy;
    p.handleOut.x += dx;
    p.handleOut.y += dy;
  }
}

export function scaleSurface(surf: SurfaceData, scaleX: number, scaleY: number, anchor: Vec2) {
  for (const p of surf.mesh.points) {
    p.pos.x = anchor.x + (p.pos.x - anchor.x) * scaleX;
    p.pos.y = anchor.y + (p.pos.y - anchor.y) * scaleY;
    p.handleIn.x = anchor.x + (p.handleIn.x - anchor.x) * scaleX;
    p.handleIn.y = anchor.y + (p.handleIn.y - anchor.y) * scaleY;
    p.handleOut.x = anchor.x + (p.handleOut.x - anchor.x) * scaleX;
    p.handleOut.y = anchor.y + (p.handleOut.y - anchor.y) * scaleY;
  }
}

export function duplicateSurface(surf: SurfaceData, offsetX: number = 30, offsetY: number = 30): SurfaceData {
  const dup = JSON.parse(JSON.stringify(surf));
  dup.id = uid();
  dup.name = surf.name + ' Copy';
  for (const p of dup.mesh.points) {
    p.pos.x += offsetX;
    p.pos.y += offsetY;
    p.handleIn.x += offsetX;
    p.handleIn.y += offsetY;
    p.handleOut.x += offsetX;
    p.handleOut.y += offsetY;
  }
  return dup;
}

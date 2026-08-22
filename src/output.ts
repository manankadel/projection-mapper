import { Renderer } from './core/Renderer';
import { projectionLink, isOutputWindow } from './core/ProjectionLink';
import { MediaStore } from './core/MediaStore';
import type { ContentItem, SurfaceData } from './types';

if (!isOutputWindow()) {
  window.name = 'projmap-output';
}

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('clickStart') as HTMLDivElement;

const renderer = new Renderer(canvas);
let surfaces: SurfaceData[] = [];
let contentMap = new Map<string, ContentItem>();

const blobUrls = new Map<string, string>();

async function resolveContent(items: ContentItem[]) {
  // Revoke old blob URLs to prevent memory leak in long shows
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();

  const map = new Map<string, ContentItem>();
  for (const item of items) {
    if (item.type === 'image' || item.type === 'video') {
      const rec = await MediaStore.get(item.id);
      if (rec) {
        const url = URL.createObjectURL(rec.blob);
        blobUrls.set(item.id, url);
        const local: ContentItem = { ...item, src: url };
        map.set(item.id, local);
        if (rec.type.startsWith('video/')) {
          const v = renderer.loadVideo(local.id, local.src);
          v.muted = true;
          v.play().catch(() => {});
        } else if (rec.type.startsWith('image/')) {
          renderer.loadImage(local.id, local.src).catch(e => console.warn('[Output] image load:', e));
        }
        continue;
      } else {
        console.warn('[Output] Missing media for', item.id, '— was file saved to MediaStore?');
      }
    }
    map.set(item.id, { ...item });
  }
  contentMap = map;
}

window.addEventListener('beforeunload', () => {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
});

let hasReceivedState = false;

projectionLink.onMessage(async (msg) => {
  if (msg.type === 'state') {
    hasReceivedState = true;
    surfaces = msg.surfaces || [];
    await resolveContent(msg.content || []);
  }
  if (msg.type === 'request-state') {
    // Ignore — output doesn't hold state
  }
});

function loop() {
  renderer.render(surfaces, contentMap);
  requestAnimationFrame(loop);
}
loop();

// Announce ready and request state — retry until we get it (fixes race where UI broadcast before output listened)
function announce() {
  projectionLink.broadcast({ type: 'ready' });
  projectionLink.requestState();
  if (!hasReceivedState) setTimeout(announce, 500);
}
announce();
setTimeout(() => {
  if (!hasReceivedState) projectionLink.requestState();
}, 100);

// Also periodically request if still empty (e.g. user reloaded output)
setInterval(() => {
  if (!hasReceivedState) projectionLink.requestState();
}, 2000);

overlay.addEventListener('click', () => {
  document.documentElement.requestFullscreen().then(() => {
    overlay.style.display = 'none';
  }).catch(() => {});
});

document.addEventListener('fullscreenchange', () => {
  overlay.style.display = document.fullscreenElement ? 'none' : 'flex';
});

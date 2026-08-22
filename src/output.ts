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

async function resolveContent(items: ContentItem[]) {
  const map = new Map<string, ContentItem>();
  for (const item of items) {
    if (item.type === 'image' || item.type === 'video') {
      const rec = await MediaStore.get(item.id);
      if (rec) {
        const url = URL.createObjectURL(rec.blob);
        const local: ContentItem = { ...item, src: url };
        map.set(item.id, local);
        if (rec.type.startsWith('video/')) {
          renderer.loadVideo(local.id, local.src);
        } else if (rec.type.startsWith('image/')) {
          renderer.loadImage(local.id, local.src);
        }
        continue;
      }
    }
    map.set(item.id, { ...item });
  }
  contentMap = map;
}

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

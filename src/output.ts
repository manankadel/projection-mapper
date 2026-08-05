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

projectionLink.onMessage(async (msg) => {
  if (msg.type === 'state') {
    surfaces = msg.surfaces || [];
    await resolveContent(msg.content || []);
  }
});

function loop() {
  renderer.render(surfaces, contentMap);
  requestAnimationFrame(loop);
}
loop();

projectionLink.broadcast({ type: 'ready' });

overlay.addEventListener('click', () => {
  document.documentElement.requestFullscreen().then(() => {
    overlay.style.display = 'none';
  }).catch(() => {});
});

document.addEventListener('fullscreenchange', () => {
  overlay.style.display = document.fullscreenElement ? 'none' : 'flex';
});

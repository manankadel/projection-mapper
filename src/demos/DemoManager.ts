import * as aurora from './aurora-demo';
import * as particles from './particle-demo';
import * as matrix from './matrix-demo';
import * as bouncing from './bouncing-balls-demo';
import type { DemoInstance, DemoMeta, DemoModule } from './types';

export class DemoManager {
  private modules: DemoModule[] = [aurora, particles, matrix, bouncing];
  private instances: Map<string, DemoInstance> = new Map();
  private canvases: Map<string, HTMLCanvasElement> = new Map();
  private activeDemo: string | null = null;
  private _running = false;

  registerDemos(contentManager: any, renderer: any) {
    for (const mod of this.modules) {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);

      const instance = mod.create(canvas);
      this.instances.set(mod.meta.id, instance);
      this.canvases.set(mod.meta.id, canvas);

      const item = contentManager.addCanvas(mod.meta.name, canvas);
      renderer.loadCanvas(item.id, canvas);
    }
  }

  assignToSurface(ui: any, demoId: string) {
    const item = this.modules.find(m => m.meta.id === demoId);
    if (!item) return;

    if (this.activeDemo && this.activeDemo !== demoId) {
      this.instances.get(this.activeDemo)?.stop();
    }

    this.activeDemo = demoId;
    const instance = this.instances.get(demoId);
    if (instance) {
      instance.start();
    }

    const canvas = this.canvases.get(demoId);
    if (canvas) {
      const items = ui.contentManager.getAllItems();
      const contentItem = items.find((i: any) => i.type === 'canvas' && i.name === item.meta.name);
      if (contentItem) {
        ui.surfaces[ui.state.selectedSurface ?? 0].contentId = contentItem.id;
        ui.renderSurfaceList();
      }
    }
  }

  startActiveDemo() {
    if (this.activeDemo && !this._running) {
      this._running = true;
      this.instances.get(this.activeDemo)?.start();
    }
  }

  stopActiveDemo() {
    if (this._running) {
      this._running = false;
      if (this.activeDemo) {
        this.instances.get(this.activeDemo)?.stop();
      }
    }
  }

  resizeActive(width: number, height: number) {
    if (!this.activeDemo) return;
    this.instances.get(this.activeDemo)?.resize(width, height);
  }

  getDemos(): DemoMeta[] {
    return this.modules.map(m => m.meta);
  }

  getDemoMeta(id: string): DemoMeta | undefined {
    return this.modules.find(m => m.meta.id === id)?.meta;
  }

  destroy() {
    for (const instance of this.instances.values()) {
      instance.stop();
    }
    for (const canvas of this.canvases.values()) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    this.instances.clear();
    this.canvases.clear();
  }
}

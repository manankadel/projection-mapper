import * as aurora from './aurora-demo';
import * as particles from './particle-demo';
import * as matrix from './matrix-demo';
import * as bouncing from './bouncing-balls-demo';
import * as fireworks from './fireworks-demo';
import * as snow from './snow-demo';
import * as gradient from './gradient-shift-demo';
import * as ocean from './ocean-demo';
import * as constellation from './constellation-demo';
import * as dataviz from './dataviz-demo';
import * as holiday from './holiday-demo';
import type { DemoInstance, DemoMeta, DemoModule, DemoProps } from './types';

export class DemoManager {
  private modules: DemoModule[] = [
    aurora, particles, matrix, bouncing, fireworks,
    snow, gradient, ocean, constellation, dataviz, holiday,
  ];
  private instances: Map<string, DemoInstance> = new Map();
  private canvases: Map<string, HTMLCanvasElement> = new Map();
  private activeDemo: string | null = null;
  private _running = false;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Uint8Array | null = null;

  private motionActive = false;
  private motionX = 0;
  private motionY = 0;

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
    const mod = this.modules.find(m => m.meta.id === demoId);
    if (!mod) return;

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
      const contentItem = items.find((i: any) => i.type === 'canvas' && i.name === mod.meta.name);
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

  setDemoProps(props: DemoProps) {
    if (!this.activeDemo) return;
    this.instances.get(this.activeDemo)?.setProps(props);
  }

  getDemos(): DemoMeta[] {
    return this.modules.map(m => m.meta);
  }

  getDemoMeta(id: string): DemoMeta | undefined {
    return this.modules.find(m => m.meta.id === id)?.meta;
  }

  getDemosByCategory(category: string): DemoMeta[] {
    const all = this.getDemos();
    if (category === 'all') return all;
    return all.filter(d => d.category === category || d.tags.includes(category));
  }

  getDemosByUseCase(useCaseId: number): DemoMeta[] {
    return this.modules.filter(m => m.meta.useCases.includes(useCaseId)).map(m => m.meta);
  }

  async initAudio() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      source.connect(this.analyser);
      this.startAudioLoop();
    } catch (e) {
      console.warn('[DemoManager] Audio init failed:', e);
    }
  }

  private startAudioLoop() {
    if (!this.analyser || !this.dataArray) return;
    const update = () => {
      this.analyser!.getByteFrequencyData(this.dataArray! as Uint8Array<ArrayBuffer>);
      const bass = this.calcBand(2, 8);
      const mids = this.calcBand(8, 20);
      const treble = this.calcBand(20, 50);
      const amplitude = this.calcAmplitude();

      this.setDemoProps({
        bass,
        mids,
        treble,
        amplitude,
      });

      if (this._running) {
        requestAnimationFrame(update);
      }
    };
    update();
  }

  private calcBand(start: number, end: number): number {
    if (!this.dataArray) return 0;
    let sum = 0;
    let count = 0;
    for (let i = start; i < Math.min(end, this.dataArray.length); i++) {
      sum += this.dataArray[i];
      count++;
    }
    return count > 0 ? sum / count / 255 : 0;
  }

  private calcAmplitude(): number {
    if (!this.dataArray) return 0;
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.dataArray.length / 255;
  }

  async initMotionTracking() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      this.startMotionLoop();
    } catch (e) {
      console.warn('[DemoManager] Motion tracking init failed:', e);
    }
  }

  private startMotionLoop() {
    if (!this.stream) return;
    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.play();

    const motionCanvas = document.createElement('canvas');
    motionCanvas.width = 64;
    motionCanvas.height = 48;
    const ctx = motionCanvas.getContext('2d');
    if (!ctx) return;

    let prevFrame: Uint8ClampedArray | null = null;

    const detect = () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(detect);
        return;
      }

      ctx.drawImage(video, 0, 0, motionCanvas.width, motionCanvas.height);
      const curr = ctx.getImageData(0, 0, motionCanvas.width, motionCanvas.height).data;

      if (prevFrame) {
        let motionX = 0;
        let motionY = 0;
        let motionCount = 0;
        let diffSum = 0;

        for (let i = 0; i < curr.length; i += 4) {
          const diff = Math.abs(curr[i] - prevFrame[i]);
          if (diff > 30) {
            const pixelIdx = i / 4;
            const x = pixelIdx % motionCanvas.width;
            const y = Math.floor(pixelIdx / motionCanvas.width);
            motionX += x;
            motionY += y;
            motionCount++;
            diffSum += diff;
          }
        }

        if (motionCount > 5) {
          this.motionActive = true;
          this.motionX = (motionX / motionCount) / motionCanvas.width;
          this.motionY = (motionY / motionCount) / motionCanvas.height;

          this.setDemoProps({
            mouseX: this.motionX,
            mouseY: this.motionY,
            mouseActive: this.motionActive,
            intensity: diffSum / motionCount / 255,
          });
        } else {
          this.motionActive = false;
        }
      }

      prevFrame = new Uint8ClampedArray(curr);
      requestAnimationFrame(detect);
    };

    video.addEventListener('playing', () => {
      requestAnimationFrame(detect);
    });
  }

  destroy() {
    this.stopActiveDemo();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
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

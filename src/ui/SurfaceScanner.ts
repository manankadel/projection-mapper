/**
 * SurfaceScanner — Uses webcam to capture physical objects,
 * then lets you draw surfaces on top of the photograph.
 * The photograph becomes the background for precise mapping.
 */
export class SurfaceScanner {
  private container: HTMLElement;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private capturedImage: ImageData | null = null;
  private surfaces: ScannedSurface[] = [];
  private currentSurface: ScannedSurface | null = null;
  private onComplete: (surfaces: ScannedSurface[]) => void;

  constructor(onComplete: (surfaces: ScannedSurface[]) => void) {
    this.onComplete = onComplete;
    this.container = document.createElement('div');
    this.container.id = 'surface-scanner';

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('autoplay', '');

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  async open() {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.renderUI();
    await this.startCamera();
  }

  private renderUI() {
    this.container.innerHTML = `
      <div class="scanner-overlay">
        <div class="scanner-modal">
          <div class="scanner-header">
            <h2>Surface Scanner</h2>
            <p>Photograph your object, then draw surfaces on it</p>
            <button class="scanner-close" onclick="surfaceScanner.close()">×</button>
          </div>

          <div class="scanner-body">
            <!-- Step 1: Camera -->
            <div class="scanner-step" id="scannerStep1">
              <div class="camera-viewport" id="cameraViewport">
                <video id="scannerVideo" autoplay playsinline></video>
                <div class="camera-guide">
                  <span>Position your object in the frame</span>
                </div>
              </div>
              <div class="scanner-actions">
                <button class="btn btn-accent" onclick="surfaceScanner.capture()">
                  📸 Capture
                </button>
              </div>
            </div>

            <!-- Step 2: Draw surfaces -->
            <div class="scanner-step" id="scannerStep2" style="display:none">
              <div class="draw-viewport" id="drawViewport">
                <canvas id="scannerCanvas"></canvas>
                <div class="draw-hint">Click to place points. Double-click to close the shape.</div>
              </div>
              <div class="scanner-actions">
                <button class="btn" onclick="surfaceScanner.undoPoint()">Undo Point</button>
                <button class="btn" onclick="surfaceScanner.clearSurface()">Clear</button>
                <button class="btn btn-accent" onclick="surfaceScanner.saveSurface()">Save Surface</button>
              </div>
            </div>

            <!-- Step 3: Review -->
            <div class="scanner-step" id="scannerStep3" style="display:none">
              <div class="review-viewport" id="reviewViewport">
                <canvas id="reviewCanvas"></canvas>
              </div>
              <div class="scanner-surfaces-list" id="scannedSurfacesList"></div>
              <div class="scanner-actions">
                <button class="btn" onclick="surfaceScanner.backToDraw()">+ Add More</button>
                <button class="btn btn-accent" onclick="surfaceScanner.finish()">Apply to App</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'environment' },
      });
      const videoEl = document.getElementById('scannerVideo') as HTMLVideoElement;
      videoEl.srcObject = this.stream;
    } catch (_e) {
      console.error('Camera access denied');
      this.showFallback();
    }
  }

  private showFallback() {
    const viewport = document.getElementById('cameraViewport');
    if (viewport) {
      viewport.innerHTML = `
        <div class="camera-fallback">
          <p>📷 Camera not available</p>
          <p>Upload a photo of your object instead:</p>
          <input type="file" id="scannerFileInput" accept="image/*" onchange="surfaceScanner.onFileUpload(event)">
          <label for="scannerFileInput" class="btn btn-accent" style="margin-top:12px;cursor:pointer">Choose Photo</label>
        </div>
      `;
    }
  }

  onFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx?.drawImage(img, 0, 0);
      this.capturedImage = this.ctx?.getImageData(0, 0, img.width, img.height) || null;
      this.showDrawStep();
    };
    img.src = URL.createObjectURL(file);
  }

  capture() {
    const videoEl = document.getElementById('scannerVideo') as HTMLVideoElement;
    if (!videoEl) return;

    this.canvas.width = videoEl.videoWidth;
    this.canvas.height = videoEl.videoHeight;
    this.ctx?.drawImage(videoEl, 0, 0);
    this.capturedImage = this.ctx?.getImageData(0, 0, this.canvas.width, this.canvas.height) || null;

    // Stop camera
    this.stream?.getTracks().forEach(t => t.stop());

    this.showDrawStep();
  }

  private showDrawStep() {
    document.getElementById('scannerStep1')!.style.display = 'none';
    document.getElementById('scannerStep2')!.style.display = '';
    document.getElementById('scannerStep3')!.style.display = 'none';

    const canvas = document.getElementById('scannerCanvas') as HTMLCanvasElement;
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '400px';

    const ctx = canvas.getContext('2d')!;
    if (this.capturedImage) {
      ctx.putImageData(this.capturedImage, 0, 0);
    }

    // Setup drawing
    this.setupDrawing(canvas, ctx);
  }

  private setupDrawing(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.currentSurface = { points: [], color: this.getNextColor() };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      this.currentSurface!.points.push({ x, y });
      this.redrawCanvas(canvas, ctx);
    };

    canvas.ondblclick = (e) => {
      e.preventDefault();
      if (this.currentSurface && this.currentSurface.points.length >= 3) {
        this.saveSurface();
      }
    };
  }

  private redrawCanvas(_canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    if (this.capturedImage) {
      ctx.putImageData(this.capturedImage, 0, 0);
    }

    // Draw all saved surfaces
    for (const surface of this.surfaces) {
      this.drawSurface(ctx, surface, 0.5);
    }

    // Draw current surface
    if (this.currentSurface && this.currentSurface.points.length > 0) {
      this.drawSurface(ctx, this.currentSurface, 0.8);
    }
  }

  private drawSurface(ctx: CanvasRenderingContext2D, surface: ScannedSurface, alpha: number) {
    if (surface.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(surface.points[0].x, surface.points[0].y);
    for (let i = 1; i < surface.points.length; i++) {
      ctx.lineTo(surface.points[i].x, surface.points[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = surface.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.fill();
    ctx.strokeStyle = surface.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw points
    for (const p of surface.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = surface.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  undoPoint() {
    if (this.currentSurface && this.currentSurface.points.length > 0) {
      this.currentSurface.points.pop();
      const canvas = document.getElementById('scannerCanvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      this.redrawCanvas(canvas, ctx);
    }
  }

  clearSurface() {
    if (this.currentSurface) {
      this.currentSurface.points = [];
      const canvas = document.getElementById('scannerCanvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      this.redrawCanvas(canvas, ctx);
    }
  }

  saveSurface() {
    if (this.currentSurface && this.currentSurface.points.length >= 3) {
      this.surfaces.push(this.currentSurface);
      this.currentSurface = { points: [], color: this.getNextColor() };
      const canvas = document.getElementById('scannerCanvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      this.redrawCanvas(canvas, ctx);

      if (this.surfaces.length >= 1) {
        this.showReviewStep();
      }
    }
  }

  private showReviewStep() {
    document.getElementById('scannerStep1')!.style.display = 'none';
    document.getElementById('scannerStep2')!.style.display = 'none';
    document.getElementById('scannerStep3')!.style.display = '';

    const canvas = document.getElementById('reviewCanvas') as HTMLCanvasElement;
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '400px';
    const ctx = canvas.getContext('2d')!;

    if (this.capturedImage) {
      ctx.putImageData(this.capturedImage, 0, 0);
    }

    for (const surface of this.surfaces) {
      this.drawSurface(ctx, surface, 0.6);
    }

    // Update list
    const list = document.getElementById('scannedSurfacesList');
    if (list) {
      list.innerHTML = this.surfaces.map((s, i) => `
        <div class="scanned-surface-item">
          <div class="scanned-color" style="background:${s.color}"></div>
          <span>Surface ${i + 1} — ${s.points.length} points</span>
          <button class="btn-sm danger" onclick="surfaceScanner.removeSurface(${i})">×</button>
        </div>
      `).join('');
    }
  }

  backToDraw() {
    this.showDrawStep();
  }

  removeSurface(index: number) {
    this.surfaces.splice(index, 1);
    if (this.surfaces.length === 0) {
      document.getElementById('scannerStep1')!.style.display = '';
      document.getElementById('scannerStep2')!.style.display = 'none';
      document.getElementById('scannerStep3')!.style.display = 'none';
      this.startCamera();
    } else {
      this.showReviewStep();
    }
  }

  finish() {
    this.onComplete(this.surfaces);
    this.close();
  }

  close() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.container.remove();
  }

  private getNextColor(): string {
    const colors = ['#00d4ff', '#ff3366', '#33ff88', '#ffaa00', '#aa55ff', '#ff5500'];
    return colors[this.surfaces.length % colors.length];
  }
}

interface ScannedSurface {
  points: { x: number; y: number }[];
  color: string;
}

import type { SurfaceData, ViewState, Tool, Vec2 } from '../types';
import { Renderer } from '../core/Renderer';
import { ContentManager } from '../core/ContentManager';
import { ShowManager } from '../core/ShowManager';
import { MIDIController } from '../core/MIDIController';
import { OSCController } from '../core/OSCController';
import {
  createSurface, getSurfaceBounds, resetSurfaceWarp,
  findNearestPoint, updateMeshResolution,
  duplicateSurface, findNearestEdge,
} from '../core/Surface';
import { debounce, uid } from '../utils/math';

export class UI {
  private renderer: Renderer;
  private contentManager: ContentManager;
  private showManager: ShowManager;
  private midiController: MIDIController;
  private oscController: OSCController;

  private surfaces: SurfaceData[] = [];
  private state: ViewState = {
    zoom: 1,
    pan: { x: 0, y: 0 },
    tool: 'select',
    editMode: 'design',
    selectedSurface: 0,
    selectedPoint: null,
    showGrid: false,
    snapToGrid: false,
    gridSize: 50,
  };

  private isDragging = false;
  private dragStart: Vec2 = { x: 0, y: 0 };
  private dragPointStart: Vec2 = { x: 0, y: 0 };
  private undoStack: string[] = [];
  private maxUndo = 50;
  private animationFrame: number = 0;
  private overlay: HTMLElement;
  private viewport: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.contentManager = new ContentManager();
    this.showManager = new ShowManager(this.contentManager);
    this.midiController = new MIDIController();
    this.oscController = new OSCController();

    this.viewport = document.getElementById('viewport')!;
    this.overlay = document.getElementById('control-overlay')!;

    this.setupEventListeners();
    this.setupMIDI();
    this.setupOSC();
    this.addDefaultSurface();
    this.renderSurfaceList();
    this.renderContentList();
    this.startRenderLoop();
    this.saveUndo();
  }

  private addDefaultSurface() {
    const vp = this.viewport;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    const size = Math.min(w, h) * 0.6;
    this.surfaces.push(
      createSurface((w - size) / 2, (h - size) / 2, size, size, 4, 4, 0)
    );
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  private setupEventListeners() {
    // Viewport mouse events
    this.viewport.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());
    this.viewport.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.viewport.addEventListener('dblclick', (e) => this.onDoubleClick(e));

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Window resize
    window.addEventListener('resize', debounce(() => this.renderControlOverlay(), 100));

    // File input
    document.getElementById('mediaFileInput')?.addEventListener('change', (e) => this.onFileLoad(e));

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen');
      }
    });
  }

  private setupMIDI() {
    this.midiController.onMessage((binding, value) => {
      this.applyMIDIBinding(binding.control, binding.target, value);
    });
  }

  private setupOSC() {
    this.oscController.onMessage2((binding, value) => {
      this.applyMIDIBinding(binding.control, binding.target, value);
    });
  }

  private applyMIDIBinding(control: string, _target: string, value: number) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;

    switch (control) {
      case 'opacity': surf.opacity = value; break;
      case 'brightness': surf.brightness = value; break;
      case 'contrast': surf.contrast = value; break;
      case 'saturation': surf.saturation = value; break;
      case 'hue': surf.hue = value * 360; break;
    }
    this.loadSurfaceProps();
  }

  // ============================================================
  // MOUSE HANDLING
  // ============================================================
  private getViewportCoords(e: MouseEvent): Vec2 {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.state.pan.x) / this.state.zoom,
      y: (e.clientY - rect.top - this.state.pan.y) / this.state.zoom,
    };
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;

    const pos = this.getViewportCoords(e);

    if (this.state.tool === 'pan') {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.state.pan.x, y: e.clientY - this.state.pan.y };
      this.viewport.style.cursor = 'grabbing';
      return;
    }

    if (this.state.tool === 'select' || this.state.tool === 'warp') {
      // Check if clicking on a control point
      const surf = this.surfaces[this.state.selectedSurface ?? 0];
      if (surf) {
        const nearest = findNearestPoint(surf, pos, 15 / this.state.zoom);
        if (nearest) {
          this.state.selectedPoint = nearest.index;
          this.isDragging = true;
          this.dragStart = pos;
          this.dragPointStart = { ...surf.mesh.points[nearest.index].pos };
          this.renderControlOverlay();
          return;
        }
      }

      // Check if clicking on a surface to select it
      for (let i = this.surfaces.length - 1; i >= 0; i--) {
        const bounds = getSurfaceBounds(this.surfaces[i]);
        if (pos.x >= bounds.x && pos.x <= bounds.x + bounds.w &&
            pos.y >= bounds.y && pos.y <= bounds.y + bounds.h) {
          this.state.selectedSurface = i;
          this.renderSurfaceList();
          this.loadSurfaceProps();
          this.renderControlOverlay();
          break;
        }
      }
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;

    if (this.state.tool === 'pan') {
      this.state.pan.x = e.clientX - this.dragStart.x;
      this.state.pan.y = e.clientY - this.dragStart.y;
      this.updateViewportTransform();
      return;
    }

    const pos = this.getViewportCoords(e);
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf || this.state.selectedPoint === null) return;

    const point = surf.mesh.points[this.state.selectedPoint];
    let newX = this.dragPointStart.x + (pos.x - this.dragStart.x);
    let newY = this.dragPointStart.y + (pos.y - this.dragStart.y);

    if (this.state.snapToGrid) {
      newX = Math.round(newX / this.state.gridSize) * this.state.gridSize;
      newY = Math.round(newY / this.state.gridSize) * this.state.gridSize;
    }

    const dx = newX - point.pos.x;
    const dy = newY - point.pos.y;
    point.pos.x = newX;
    point.pos.y = newY;
    point.handleIn.x += dx;
    point.handleIn.y += dy;
    point.handleOut.x += dx;
    point.handleOut.y += dy;

    this.renderControlOverlay();
  }

  private onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.saveUndo();
    }
    this.viewport.style.cursor = this.state.tool === 'pan' ? 'grab' : 'crosshair';
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, this.state.zoom * delta));

    // Zoom toward cursor
    const rect = this.viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.state.pan.x = mx - (mx - this.state.pan.x) * (newZoom / this.state.zoom);
    this.state.pan.y = my - (my - this.state.pan.y) * (newZoom / this.state.zoom);
    this.state.zoom = newZoom;

    this.updateViewportTransform();
    this.renderControlOverlay();
  }

  private onDoubleClick(e: MouseEvent) {
    const pos = this.getViewportCoords(e);
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;

    // Add point at double-click position on nearest edge
    const nearest = findNearestEdge(surf, pos, 20 / this.state.zoom);
    if (nearest) {
      // Insert point along edge
      this.insertMeshPoint(surf, nearest.edgeIndex, nearest.t);
    }
  }

  private insertMeshPoint(surf: SurfaceData, _edgeIndex: number, _t: number) {
    // This would insert a new control point along the edge
    // For now, we'll increase mesh resolution instead
    const newCols = Math.min(surf.mesh.cols + 1, 16);
    const newRows = Math.min(surf.mesh.rows + 1, 16);
    updateMeshResolution(surf, newCols, newRows);
    this.renderControlOverlay();
    this.saveUndo();
  }

  // ============================================================
  // KEYBOARD HANDLING
  // ============================================================
  private onKeyDown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault();
        this.toggleFullscreen();
        break;
      case 'e':
        e.preventDefault();
        this.toggleEditMode();
        break;
      case 'g':
        e.preventDefault();
        this.toggleGrid();
        break;
      case 's':
        if (ctrl) {
          e.preventDefault();
          this.exportShow();
        } else {
          e.preventDefault();
          this.toggleSnap();
        }
        break;
      case 'r':
        e.preventDefault();
        this.resetWarp();
        break;
      case 'z':
        if (ctrl) {
          e.preventDefault();
          this.undo();
        }
        break;
      case 'y':
        if (ctrl) {
          e.preventDefault();
          this.redo();
        }
        break;
      case 'delete':
      case 'backspace':
        e.preventDefault();
        this.deleteSelectedPoint();
        break;
      case 'escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
          document.body.classList.remove('fullscreen');
        }
        this.state.selectedPoint = null;
        this.renderControlOverlay();
        break;
      case '1': this.setTool('select'); break;
      case '2': this.setTool('warp'); break;
      case '3': this.setTool('pan'); break;
      case 'tab':
        e.preventDefault();
        this.selectNextSurface(shift ? -1 : 1);
        break;
      case '+':
      case '=':
        e.preventDefault();
        this.zoomIn();
        break;
      case '-':
        e.preventDefault();
        this.zoomOut();
        break;
      case '0':
        e.preventDefault();
        this.zoomReset();
        break;
    }
  }

  // ============================================================
  // TOOLBAR ACTIONS
  // ============================================================
  setTool(tool: Tool) {
    this.state.tool = tool;
    this.viewport.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tool === tool);
    });
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      document.body.classList.remove('fullscreen');
    } else {
      document.documentElement.requestFullscreen();
      document.body.classList.add('fullscreen');
    }
  }

  toggleEditMode() {
    this.state.editMode = this.state.editMode === 'design' ? 'projection' : 'design';
    const badge = document.getElementById('editBadge');
    if (badge) badge.style.display = this.state.editMode === 'projection' ? '' : 'none';
    this.renderControlOverlay();
  }

  toggleGrid() {
    this.state.showGrid = !this.state.showGrid;
    document.getElementById('btnGrid')?.classList.toggle('active', this.state.showGrid);
    this.viewport.classList.toggle('show-grid', this.state.showGrid);
  }

  toggleSnap() {
    this.state.snapToGrid = !this.state.snapToGrid;
    document.getElementById('btnSnap')?.classList.toggle('active', this.state.snapToGrid);
  }

  addSurface() {
    const vp = this.viewport;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    const size = Math.min(w, h) * 0.4;
    const surf = createSurface(
      (w - size) / 2 + (this.surfaces.length * 30),
      (h - size) / 2 + (this.surfaces.length * 30),
      size, size, 4, 4, this.surfaces.length
    );
    this.surfaces.push(surf);
    this.state.selectedSurface = this.surfaces.length - 1;
    this.saveUndo();
    this.renderSurfaceList();
    this.renderControlOverlay();
  }

  deleteSurface(index?: number) {
    const idx = index ?? this.state.selectedSurface ?? 0;
    if (this.surfaces.length <= 1) return;
    this.surfaces.splice(idx, 1);
    if (this.state.selectedSurface! >= this.surfaces.length) {
      this.state.selectedSurface = this.surfaces.length - 1;
    }
    this.saveUndo();
    this.renderSurfaceList();
    this.renderControlOverlay();
  }

  duplicateSelectedSurface() {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    const dup = duplicateSurface(surf);
    this.surfaces.push(dup);
    this.state.selectedSurface = this.surfaces.length - 1;
    this.saveUndo();
    this.renderSurfaceList();
    this.renderControlOverlay();
  }

  selectNextSurface(delta: number) {
    const idx = (this.state.selectedSurface ?? 0) + delta;
    this.state.selectedSurface = ((idx % this.surfaces.length) + this.surfaces.length) % this.surfaces.length;
    this.renderSurfaceList();
    this.loadSurfaceProps();
    this.renderControlOverlay();
  }

  resetWarp() {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    resetSurfaceWarp(surf);
    this.saveUndo();
    this.renderControlOverlay();
  }

  deleteSelectedPoint() {
    // Reset selected point to grid position
    if (this.state.selectedPoint === null) return;
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    // For now, just deselect
    this.state.selectedPoint = null;
    this.renderControlOverlay();
  }

  updateMeshCols(cols: number) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    updateMeshResolution(surf, cols, surf.mesh.rows);
    this.saveUndo();
    this.renderControlOverlay();
  }

  updateMeshRows(rows: number) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    updateMeshResolution(surf, surf.mesh.cols, rows);
    this.saveUndo();
    this.renderControlOverlay();
  }

  zoomIn() {
    this.state.zoom = Math.min(5, this.state.zoom * 1.2);
    this.updateViewportTransform();
    this.renderControlOverlay();
  }

  zoomOut() {
    this.state.zoom = Math.max(0.1, this.state.zoom / 1.2);
    this.updateViewportTransform();
    this.renderControlOverlay();
  }

  zoomReset() {
    this.state.zoom = 1;
    this.state.pan = { x: 0, y: 0 };
    this.updateViewportTransform();
    this.renderControlOverlay();
  }

  // ============================================================
  // SURFACE PROPERTIES
  // ============================================================
  updateSurfaceProp(prop: string, value: any) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    (surf as any)[prop] = value;
    this.loadSurfaceProps();
  }

  loadSurfaceProps() {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;

    const setVal = (id: string, val: any) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.value = val;
    };
    const setText = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('surfOpacity', surf.opacity * 100);
    setText('surfOpacityVal', Math.round(surf.opacity * 100) + '%');
    setVal('surfBrightness', surf.brightness * 100);
    setText('surfBrightnessVal', Math.round(surf.brightness * 100) + '%');
    setVal('surfContrast', surf.contrast * 100);
    setText('surfContrastVal', Math.round(surf.contrast * 100) + '%');
    setVal('surfSaturation', surf.saturation * 100);
    setText('surfSaturationVal', Math.round(surf.saturation * 100) + '%');
    setVal('surfHue', surf.hue);
    setText('surfHueVal', Math.round(surf.hue) + '°');
    setVal('surfGamma', surf.gamma);
    setText('surfGammaVal', surf.gamma.toFixed(1));

    const flipH = document.getElementById('surfFlipH') as HTMLInputElement;
    const flipV = document.getElementById('surfFlipV') as HTMLInputElement;
    if (flipH) flipH.checked = surf.flipH;
    if (flipV) flipV.checked = surf.flipV;

    setVal('meshCols', surf.mesh.cols);
    setText('meshColsVal', String(surf.mesh.cols));
    setVal('meshRows', surf.mesh.rows);
    setText('meshRowsVal', String(surf.mesh.rows));

    // Edge blend
    const eb = surf.edgeBlend;
    const setChecked = (id: string, val: boolean) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.checked = val;
    };
    setChecked('edgeBlendEnabled', eb.enabled);
    setVal('edgeBlendSide', eb.side);
    setVal('edgeBlendWidth', eb.width * 100);
    setText('edgeBlendWidthVal', Math.round(eb.width * 100) + '%');
    setVal('edgeBlendGamma', eb.gamma);
    setText('edgeBlendGammaVal', eb.gamma.toFixed(1));
  }

  updateEdgeBlend(prop: string, value: any) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    (surf.edgeBlend as any)[prop] = value;
    this.loadSurfaceProps();
  }

  // ============================================================
  // CONTENT MANAGEMENT
  // ============================================================
  async onFileLoad(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const item = await this.contentManager.loadFile(file);
      // Auto-assign to selected surface
      const surf = this.surfaces[this.state.selectedSurface ?? 0];
      if (surf) {
        surf.contentId = item.id;
        // Load into renderer
        if (item.type === 'image') {
          await this.renderer.loadImage(item.id, item.src);
        } else if (item.type === 'video') {
          this.renderer.loadVideo(item.id, item.src);
        }
      }
    }

    this.renderContentList();
    input.value = '';
  }

  async loadURL() {
    const url = prompt('Enter image or video URL:');
    if (!url) return;

    const item = await this.contentManager.loadURL(url);
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (surf) {
      surf.contentId = item.id;
      if (item.type === 'image') {
        await this.renderer.loadImage(item.id, item.src);
      } else if (item.type === 'video') {
        this.renderer.loadVideo(item.id, item.src);
      }
    }
    this.renderContentList();
  }

  setTestPattern(pattern: string) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (surf) {
      surf.contentId = pattern;
    }
  }

  assignContent(contentId: string) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (surf) {
      surf.contentId = contentId;
    }
  }

  removeContent() {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (surf) {
      surf.contentId = null;
    }
  }

  // ============================================================
  // SHOW MANAGEMENT
  // ============================================================
  exportShow() {
    this.showManager.setSurfaces(this.surfaces);
    this.showManager.downloadShow();
  }

  async importShow(file: File) {
    const success = await this.showManager.loadShow(file);
    if (success) {
      const config = this.showManager.getConfig();
      this.surfaces = config.surfaces;
      this.state.selectedSurface = 0;
      this.renderSurfaceList();
      this.renderControlOverlay();
      this.renderContentList();
    }
  }

  saveShow() {
    this.showManager.setSurfaces(this.surfaces);
    this.showManager.saveToLocal();
  }

  loadShow() {
    if (this.showManager.loadFromLocal()) {
      const config = this.showManager.getConfig();
      this.surfaces = config.surfaces;
      this.state.selectedSurface = 0;
      this.renderSurfaceList();
      this.renderControlOverlay();
      this.renderContentList();
    }
  }

  // ============================================================
  // UNDO / REDO
  // ============================================================
  private saveUndo() {
    this.undoStack.push(JSON.stringify(this.surfaces));
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
  }

  private undo() {
    if (this.undoStack.length <= 1) return;
    this.undoStack.pop();
    const prev = this.undoStack[this.undoStack.length - 1];
    this.surfaces = JSON.parse(prev);
    this.renderSurfaceList();
    this.renderControlOverlay();
  }

  private redo() {
    // Simple redo: re-apply last change
    // In production, you'd maintain a separate redo stack
  }

  // ============================================================
  // UI RENDERING
  // ============================================================
  private renderSurfaceList() {
    const list = document.getElementById('surfaceList');
    if (!list) return;

    list.innerHTML = this.surfaces.map((s, i) => `
      <div class="surface-item ${i === this.state.selectedSurface ? 'active' : ''}"
           onclick="ui.selectSurface(${i})" data-index="${i}">
        <div class="surface-color" style="background:${s.color}"></div>
        <div class="surface-info">
          <div class="surface-name">${s.name}</div>
          <div class="surface-meta">${s.mesh.cols}x${s.mesh.rows} mesh</div>
        </div>
        <div class="surface-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); ui.toggleSurfaceVisibility(${i})" title="Toggle visibility">
            ${s.visible ? '👁' : '👁‍🗨'}
          </button>
          <button class="btn-icon" onclick="event.stopPropagation(); ui.toggleSurfaceLock(${i})" title="Toggle lock">
            ${s.locked ? '🔒' : '🔓'}
          </button>
          <button class="btn-icon danger" onclick="event.stopPropagation(); ui.deleteSurface(${i})" title="Delete">×</button>
        </div>
      </div>
    `).join('');

    document.getElementById('statusSurfaces')!.textContent = `Surfaces: ${this.surfaces.length}`;
  }

  selectSurface(index: number) {
    this.state.selectedSurface = index;
    this.state.selectedPoint = null;
    this.renderSurfaceList();
    this.loadSurfaceProps();
    this.renderControlOverlay();
  }

  toggleSurfaceVisibility(index: number) {
    this.surfaces[index].visible = !this.surfaces[index].visible;
    this.renderSurfaceList();
  }

  toggleSurfaceLock(index: number) {
    this.surfaces[index].locked = !this.surfaces[index].locked;
    this.renderSurfaceList();
  }

  private renderContentList() {
    const list = document.getElementById('contentList');
    if (!list) return;

    const items = this.contentManager.getAllItems();
    list.innerHTML = items.map(item => `
      <div class="content-item" onclick="ui.assignContent('${item.id}')" data-id="${item.id}">
        <div class="content-icon">${this.getContentIcon(item.type)}</div>
        <div class="content-info">
          <div class="content-name">${item.name}</div>
          <div class="content-type">${item.type}</div>
        </div>
      </div>
    `).join('');
  }

  private getContentIcon(type: string): string {
    switch (type) {
      case 'image': return '🖼';
      case 'video': return '🎬';
      case 'pattern': return '🔲';
      case 'color': return '🎨';
      case 'gradient': return '🌈';
      case 'webcam': return '📷';
      case 'ndi': return '📡';
      default: return '📄';
    }
  }

  // ============================================================
  // CONTROL OVERLAY
  // ============================================================
  private renderControlOverlay() {
    this.overlay.innerHTML = '';

    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf || !surf.visible) return;

    const { cols, rows, points } = surf.mesh;

    // Draw mesh lines
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const idx = r * (cols + 1) + c;
        const p = points[idx];

        if (c < cols) {
          const next = points[idx + 1];
          this.drawMeshLine(p.pos, next.pos, surf.color);
        }
        if (r < rows) {
          const below = points[idx + cols + 1];
          this.drawMeshLine(p.pos, below.pos, surf.color);
        }
      }
    }

    // Draw control points
    points.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'control-point';
      if (i === this.state.selectedPoint) el.classList.add('selected');

      // Mark corners
      if (i === 0 || i === cols || i === points.length - 1 || i === points.length - 1 - cols) {
        el.classList.add('corner');
      }

      el.style.left = `${p.pos.x * this.state.zoom + this.state.pan.x}px`;
      el.style.top = `${p.pos.y * this.state.zoom + this.state.pan.y}px`;

      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.state.selectedPoint = i;
        this.isDragging = true;
        this.dragStart = this.getViewportCoords(e);
        this.dragPointStart = { ...p.pos };
        this.renderControlOverlay();
      });

      this.overlay.appendChild(el);
    });
  }

  private drawMeshLine(a: Vec2, b: Vec2, color: string) {
    const line = document.createElement('div');
    line.className = 'mesh-line';

    const ax = a.x * this.state.zoom + this.state.pan.x;
    const ay = a.y * this.state.zoom + this.state.pan.y;
    const bx = b.x * this.state.zoom + this.state.pan.x;
    const by = b.y * this.state.zoom + this.state.pan.y;

    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    line.style.left = `${ax}px`;
    line.style.top = `${ay}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angle}deg)`;
    line.style.background = color;

    this.overlay.appendChild(line);
  }

  private updateViewportTransform() {
    const canvas = this.renderer.canvas;
    canvas.style.transform = `translate(${this.state.pan.x}px, ${this.state.pan.y}px) scale(${this.state.zoom})`;
    canvas.style.transformOrigin = '0 0';
  }

  // ============================================================
  // CONTENT TEMPLATES
  // ============================================================
  applyTemplate(templateId: string) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;

    // Create a canvas-based content for this template
    const templateCanvas = document.createElement('canvas');
    templateCanvas.width = 1024;
    templateCanvas.height = 1024;

    // @ts-ignore
    const engine = window.templateEngine;
    if (engine) {
      engine.startRendering(templateId, templateCanvas);

      // Store as a special content type
      const contentId = `template-${templateId}-${Date.now()}`;
      surf.contentId = contentId;

      // @ts-ignore
      this.templateCanvases = this.templateCanvases || new Map();
      // @ts-ignore
      this.templateCanvases.set(contentId, { canvas: templateCanvas, engine, templateId });

      this.renderContentList();
    }
  }

  // ============================================================
  // SCANNED SURFACES
  // ============================================================
  addScannedSurface(points: { x: number; y: number }[], color: string) {
    const vp = this.viewport;
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;

    // Scale scanned points to viewport
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const scanW = maxX - minX;
    const scanH = maxY - minY;
    const scale = Math.min(vpW / scanW, vpH / scanH) * 0.6;
    const offsetX = (vpW - scanW * scale) / 2;
    const offsetY = (vpH - scanH * scale) / 2;

    const meshPoints: { pos: Vec2; handleIn: Vec2; handleOut: Vec2 }[] = [];
    const cols = 4;
    const rows = 4;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const v = r / rows;

        const px = offsetX + (minX + scanW * u - minX) * scale;
        const py = offsetY + (minY + scanH * v - minY) * scale;

        meshPoints.push({
          pos: { x: px, y: py },
          handleIn: { x: px - 20, y: py },
          handleOut: { x: px + 20, y: py },
        });
      }
    }

    const surf: SurfaceData = {
      id: uid(),
      name: `Scanned ${this.surfaces.length + 1}`,
      color,
      mesh: { cols, rows, points: meshPoints },
      opacity: 1,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      hue: 0,
      gamma: 2.2,
      flipH: false,
      flipV: false,
      blendMode: 'normal',
      edgeBlend: { enabled: false, side: 'none', width: 0.15, gamma: 2.2, blackLevel: 0, whiteLevel: 1 },
      visible: true,
      locked: false,
      groupId: null,
      contentId: null,
    };

    this.surfaces.push(surf);
    this.state.selectedSurface = this.surfaces.length - 1;
    this.saveUndo();
    this.renderSurfaceList();
    this.renderControlOverlay();
  }

  // ============================================================
  // RENDER LOOP
  // ============================================================
  private startRenderLoop() {
    const loop = () => {
      this.renderer.render(this.surfaces, this.contentManager.items);
      document.getElementById('statusFPS')!.textContent = `FPS: ${this.renderer.fps}`;
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.renderer.destroy();
    this.contentManager.destroy();
    this.midiController.destroy();
    this.oscController.destroy();
  }
}

import type { SurfaceData, ViewState, Tool, Vec2 } from '../types';
import { Renderer } from '../core/Renderer';
import { ContentManager } from '../core/ContentManager';
import { ShowManager } from '../core/ShowManager';
import { MIDIController } from '../core/MIDIController';
import { OSCController } from '../core/OSCController';
import { MediaStore } from '../core/MediaStore';
import { projectionLink } from '../core/ProjectionLink';
import type { ContentTemplateEngine } from './ContentTemplates';
import type { DemoManager } from '../demos/DemoManager';
import {
  createSurface, getSurfaceBounds, resetSurfaceWarp,
  findNearestPoint, updateMeshResolution,
  duplicateSurface, findNearestEdge,
} from '../core/Surface';
import { debounce, uid } from '../utils/math';

export class UI {
  renderer: Renderer;
  contentManager: ContentManager;
  private showManager: ShowManager;
  private midiController: MIDIController;
  private oscController: OSCController;
  private templateEngine: ContentTemplateEngine | null = null;
  demoManager: DemoManager | null = null;
  private _audioEnabled = false;

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
  private nudgeKeyActive = false;
  private projectionDirty = false;
  private lastProjectionBroadcast = 0;
  private hasOutputWindow = false;
  private lastOutputSeen = 0;
  private undoStack: string[] = [];
  private maxUndo = 50;
  private animationFrame: number = 0;
  private overlay: HTMLElement;
  private viewport: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    console.log('[UI] Constructor started');
    this.renderer = new Renderer(canvas);
    console.log('[UI] Renderer created');
    this.contentManager = new ContentManager();
    console.log('[UI] ContentManager created');
    this.showManager = new ShowManager(this.contentManager);
    console.log('[UI] ShowManager created');
    this.midiController = new MIDIController();
    console.log('[UI] MIDIController created');
    this.oscController = new OSCController();
    console.log('[UI] OSCController created');

    this.viewport = document.getElementById('viewport')!;
    this.overlay = document.getElementById('control-overlay')!;
    console.log('[UI] Elements found:', { viewport: !!this.viewport, overlay: !!this.overlay });

    this.setupEventListeners();
    console.log('[UI] Event listeners attached');
    this.setupProjectionLink();
    console.log('[UI] ProjectionLink setup done');
    this.setupMIDI();
    console.log('[UI] MIDI setup done');
    this.setupOSC();
    console.log('[UI] OSC setup done');
    this.addDefaultSurface();
    console.log('[UI] Default surface added');
    this.renderSurfaceList();
    console.log('[UI] Surface list rendered');
    this.renderContentList();
    console.log('[UI] Content list rendered');
    this.startRenderLoop();
    console.log('[UI] Render loop started');
    this.saveUndo();
    console.log('[UI] Constructor complete');
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

    // Touch events (for projector touch screens)
    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const me = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY, bubbles: true });
        this.viewport.dispatchEvent(me);
      }
      e.preventDefault();
    }, { passive: false });
    
    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const me = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY, bubbles: true });
        document.dispatchEvent(me);
      }
      e.preventDefault();
    }, { passive: false });
    
    this.viewport.addEventListener('touchend', (e) => {
      const me = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(me);
      e.preventDefault();
    }, { passive: false });

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => {
      if (e.key.startsWith('Arrow')) this.nudgeKeyActive = false;
    });

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

  private setupProjectionLink() {
    // Always respond to output window requests — fixes race where output opened after state broadcast
    projectionLink.onMessage((msg) => {
      if (msg?.type === 'request-state') {
        this.broadcastState();
      }
      if (msg?.type === 'ready') {
        this.hasOutputWindow = true;
        this.lastOutputSeen = performance.now();
        this.updateProjectorStatus();
        this.broadcastState();
      }
    });
  }

  private updateProjectorStatus() {
    const dot = document.querySelector('#statusbar .status-dot') as HTMLElement;
    const statusText = dot?.parentElement;
    const isLive = this.hasOutputWindow && performance.now() - this.lastOutputSeen < 3000;
    if (statusText) {
      // Keep dot, update text after it
      const text = isLive ? ' Projector: Connected' : ' Ready — click PROJECT ▶ for projector';
      // statusText contains dot + text node; replace text
      if (statusText.childNodes.length > 1) {
        statusText.childNodes[1].textContent = text;
      } else {
        statusText.appendChild(document.createTextNode(text));
      }
    }
    if (dot) {
      dot.style.background = isLive ? '#22c55e' : '#ef4444';
      dot.style.boxShadow = isLive ? '0 0 6px #22c55e' : 'none';
    }
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
      case 'arrowup':
        e.preventDefault();
        this.nudgeSelectedPoint(0, -(shift ? 10 : 1));
        break;
      case 'arrowdown':
        e.preventDefault();
        this.nudgeSelectedPoint(0, (shift ? 10 : 1));
        break;
      case 'arrowleft':
        e.preventDefault();
        this.nudgeSelectedPoint(-(shift ? 10 : 1), 0);
        break;
      case 'arrowright':
        e.preventDefault();
        this.nudgeSelectedPoint((shift ? 10 : 1), 0);
        break;
      case 'tab':
        e.preventDefault();
        this.selectNextPoint(shift ? -1 : 1);
        break;
      case '[':
        this.selectNextSurface(-1);
        break;
      case ']':
        this.selectNextSurface(1);
        break;
      case 't':
        e.preventDefault();
        this.cycleTestPattern();
        break;
      case 'd':
        e.preventDefault();
        this.showDemoPicker();
        break;
      case 'a':
        e.preventDefault();
        this.toggleAudio();
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
      this.demoManager?.stopActiveDemo();
    } else {
      document.documentElement.requestFullscreen();
      document.body.classList.add('fullscreen');
      this.demoManager?.startActiveDemo();
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
    const n = this.surfaces.length;

    // Tile surfaces in a grid so new ones never overlap existing ones
    const cols = Math.ceil(Math.sqrt(n + 1));
    const rows = Math.ceil((n + 1) / cols);
    const size = Math.min(w / cols, h / rows) * 0.8;
    const cellW = w / cols;
    const cellH = h / rows;
    const col = n % cols;
    const row = Math.floor(n / cols);
    const x = col * cellW + (cellW - size) / 2;
    const y = row * cellH + (cellH - size) / 2;

    const surf = createSurface(x, y, size, size, 4, 4, n);
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

  selectNextPoint(delta: number) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf || surf.mesh.points.length === 0) return;
    if (this.state.selectedPoint === null) {
      this.state.selectedPoint = 0;
    } else {
      const n = surf.mesh.points.length;
      this.state.selectedPoint = ((this.state.selectedPoint + delta) % n + n) % n;
    }
    this.renderControlOverlay();
  }

  nudgeSelectedPoint(dx: number, dy: number) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    if (this.state.selectedPoint === null) this.state.selectedPoint = 0;
    const p = surf.mesh.points[this.state.selectedPoint];
    if (!p) return;
    if (!this.nudgeKeyActive) {
      this.saveUndo();
      this.nudgeKeyActive = true;
    }
    p.pos.x += dx;
    p.pos.y += dy;
    this.renderControlOverlay();
  }

  cycleTestPattern() {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (!surf) return;
    const patterns = ['grid', 'checker', 'colorbars', 'gradient', 'brightness'];
    const current = patterns.indexOf(surf.contentId || '');
    surf.contentId = patterns[(current + 1) % patterns.length];
    this.renderControlOverlay();
  }

  async project() {
    // Attach ready listener BEFORE opening so we don't miss the first 'ready' broadcast
    let output: Window | null = null;
    const readyHandler = (msg: any) => {
      if (msg?.type !== 'ready') return;
      // Output window is ready — move it to projector display if we have multiple screens
      (async () => {
        try {
          const nav = navigator as any;
          if (nav.getScreenDetails) {
            const details = await nav.getScreenDetails();
            if (details.screens.length > 1) {
              const savedLabel = localStorage.getItem('projmapper-projector-display');
              const target =
                details.screens.find((s: any) => s.label === savedLabel) ||
                details.screens.find((s: any) => !s.isPrimary) ||
                details.screens[0];
              if (target && output) {
                try { output.moveTo(target.left, target.top); } catch {}
                try { output.focus(); output.resizeTo(target.width || 1280, target.height || 720); } catch {}
                localStorage.setItem('projmapper-projector-display', target.label || '');
              }
            }
          }
        } catch (_e) {
          // Screen Details API not available — leave output where it opened
        }
        // Ensure output gets state even if initial broadcast was missed
        this.broadcastState();
        setTimeout(() => this.broadcastState(), 100);
        setTimeout(() => this.broadcastState(), 500);
      })();
    };
    const off = projectionLink.onMessage(readyHandler);

    output = window.open('output.html', 'projmap-output', 'width=1280,height=720');
    if (!output) {
      off();
      // Popup blocked — give clear instructions, fall back to single-window fullscreen
      alert('Popup blocked — allow popups for this site, or drag this window to your projector display and press F to fullscreen.\n\nTip: System Settings → Displays → Use as Extended Display (not Mirror)');
      this.toggleFullscreen();
      return;
    }

    // Broadcast immediately and also after a short delay for late joiners
    this.broadcastState();
    setTimeout(() => this.broadcastState(), 50);
    setTimeout(() => this.broadcastState(), 300);
    // Clean up ready listener after 5s (output will use request-state thereafter)
    setTimeout(() => off(), 5000);
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
    this.projectionDirty = true;

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
      // Persist bytes so the output window can use them too
      try {
        await MediaStore.save(item.id, file.name, file.type, file);
      } catch (e) {
        console.warn('[UI] MediaStore save failed:', e);
      }
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
      this.renderControlOverlay();
    }
  }

  setTemplateEngine(engine: ContentTemplateEngine) {
    this.templateEngine = engine;
  }

  assignContent(contentId: string) {
    const surf = this.surfaces[this.state.selectedSurface ?? 0];
    if (surf) {
      surf.contentId = contentId;
      this.renderControlOverlay();
    }
  }

  assignDemo(demoId: string) {
    if (!this.demoManager) return;
    this.demoManager.assignToSurface(this, demoId);
  }

  toggleAudio() {
    if (!this.demoManager) return;
    if (this._audioEnabled) {
      this._audioEnabled = false;
      this.demoManager.setDemoProps({ amplitude: 0, bass: 0, mids: 0, treble: 0 });
    } else {
      this._audioEnabled = true;
      this.demoManager.initAudio();
    }
    const btn = document.getElementById('btnAudioToggle');
    if (btn) btn.textContent = this._audioEnabled ? '🔊' : '🔇';
  }

  showDemoPicker() {
    if (!this.demoManager) return;
    const demos = this.demoManager.getDemos();
    const html = demos.map((d: any) => `
      <div class="demo-option" onclick="ui.assignDemo('${d.id}')">
        <span class="demo-icon">${d.icon}</span>
        <span class="demo-name">${d.name}</span>
      </div>
    `).join('');
    const picker = document.getElementById('demoPicker');
    if (picker) {
      picker.innerHTML = html;
      picker.style.display = 'block';
      setTimeout(() => picker.style.display = 'none', 5000);
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
      await this.restoreFileContent();
      this.broadcastState();
    }
  }

  saveShow() {
    this.showManager.setSurfaces(this.surfaces);
    this.showManager.saveToLocal();
  }

  async loadShow() {
    if (this.showManager.loadFromLocal()) {
      const config = this.showManager.getConfig();
      this.surfaces = config.surfaces;
      this.state.selectedSurface = 0;
      this.renderSurfaceList();
      this.renderControlOverlay();
      this.renderContentList();
      await this.restoreFileContent();
      this.broadcastState();
    }
  }

  // Rebuild working blob: URLs for content persisted in IndexedDB (old
  // blob URLs die on page reload; the output window needs fresh ones too).
  private async restoreFileContent() {
    const keys = await MediaStore.keys();
    for (const id of keys) {
      const rec = await MediaStore.get(id);
      if (!rec) continue;
      const url = URL.createObjectURL(rec.blob);
      const item = this.contentManager.getItem(id);
      if (item) item.src = url;
      if (rec.type.startsWith('video/')) {
        this.renderer.loadVideo(id, url);
      } else if (rec.type.startsWith('image/')) {
        this.renderer.loadImage(id, url);
      }
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

  renderDemoList() {
    if (!this.demoManager) return;
    const list = document.getElementById('demoList');
    if (!list) return;

    const demos = this.demoManager.getDemos();
    list.innerHTML = demos.map(d => `
      <div class="content-item" onclick="ui.assignDemo('${d.id}')" data-id="${d.id}">
        <div class="content-icon">${d.icon}</div>
        <div class="content-info">
          <div class="content-name">${d.name}</div>
          <div class="content-type">${d.category}</div>
        </div>
      </div>
    `).join('');
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
      case 'canvas': return '🎨';
      case 'webcam': return '📷';
      case 'ndi': return '📡';
      default: return '📄';
    }
  }

  // ============================================================
  // CONTROL OVERLAY
  // ============================================================
  private renderControlOverlay() {
    this.projectionDirty = true;
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

    const templateCanvas = document.createElement('canvas');
    templateCanvas.width = 1024;
    templateCanvas.height = 1024;

    const engine = this.templateEngine;
    if (engine) {
      engine.startRendering(templateId, templateCanvas);

      const content = this.contentManager.addCanvas(
        engine.getTemplate(templateId)?.name || templateId,
        templateCanvas,
      );
      this.renderer.loadCanvas(content.id, templateCanvas);
      surf.contentId = content.id;

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
    let lastStatusUpdate = 0;
    const loop = () => {
      this.renderer.render(this.surfaces, this.contentManager.items);
      const fpsEl = document.getElementById('statusFPS');
      if (fpsEl) fpsEl.textContent = `FPS: ${this.renderer.fps}`;

      const now = performance.now();
      if (this.projectionDirty && now - this.lastProjectionBroadcast > 100) {
        this.projectionDirty = false;
        this.lastProjectionBroadcast = now;
        this.broadcastState();
      }
      if (now - lastStatusUpdate > 1000) {
        lastStatusUpdate = now;
        this.updateProjectorStatus();
        // Auto-clear output flag if no heartbeat for 3s
        if (this.hasOutputWindow && now - this.lastOutputSeen > 3000) {
          this.hasOutputWindow = false;
          this.updateProjectorStatus();
        }
      }

      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private broadcastState() {
    try {
      const items = this.contentManager.getAllItems().map(i => {
        const src = i.src && i.src.startsWith('blob:') ? '' : i.src;
        return { ...i, src };
      });
      projectionLink.broadcast({ type: 'state', surfaces: this.surfaces, content: items });
    } catch (_e) {
      // BroadcastChannel unavailable — single-window mode
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.renderer.destroy();
    this.contentManager.destroy();
    this.midiController.destroy();
    this.oscController.destroy();
  }
}

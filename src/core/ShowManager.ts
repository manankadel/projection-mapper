import type { ShowConfig, SurfaceData, MIDIBinding, OSCBinding } from '../types';
import type { ContentManager } from './ContentManager';

export class ShowManager {
  private config: ShowConfig;
  private contentManager: ContentManager;

  constructor(contentManager: ContentManager) {
    this.contentManager = contentManager;
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): ShowConfig {
    return {
      version: 1,
      name: 'Untitled Show',
      surfaces: [],
      content: [],
      playlists: [],
      output: {
        resolution: { x: 1920, y: 1080 },
        fullscreen: false,
        monitor: 0,
        vsync: true,
        maxFPS: 60,
      },
      calibration: {
        showGrid: false,
        gridSize: 50,
        showCrosshair: true,
        showNumbers: false,
        testPattern: null,
        gammaCorrection: 2.2,
      },
      midiBindings: [],
      oscBindings: [],
    };
  }

  getConfig(): ShowConfig {
    return this.config;
  }

  setSurfaces(surfaces: SurfaceData[]) {
    this.config.surfaces = surfaces;
  }

  setName(name: string) {
    this.config.name = name;
  }

  setOutputResolution(x: number, y: number) {
    this.config.output.resolution = { x, y };
  }

  setMaxFPS(fps: number) {
    this.config.output.maxFPS = fps;
  }

  setVsync(vsync: boolean) {
    this.config.output.vsync = vsync;
  }

  setCalibrationGrid(show: boolean) {
    this.config.calibration.showGrid = show;
  }

  setCalibrationCrosshair(show: boolean) {
    this.config.calibration.showCrosshair = show;
  }

  setCalibrationNumbers(show: boolean) {
    this.config.calibration.showNumbers = show;
  }

  setTestPattern(pattern: string | null) {
    this.config.calibration.testPattern = pattern;
  }

  setGammaCorrection(gamma: number) {
    this.config.calibration.gammaCorrection = gamma;
  }

  // MIDI bindings
  addMIDIBinding(binding: MIDIBinding) {
    this.config.midiBindings.push(binding);
  }

  removeMIDIBinding(id: string) {
    this.config.midiBindings = this.config.midiBindings.filter(b => b.id !== id);
  }

  // OSC bindings
  addOSCBinding(binding: OSCBinding) {
    this.config.oscBindings.push(binding);
  }

  removeOSCBinding(id: string) {
    this.config.oscBindings = this.config.oscBindings.filter(b => b.id !== id);
  }

  // Export show
  exportJSON(): string {
    this.config.content = this.contentManager.getAllItems();
    this.config.playlists = Array.from(this.contentManager.playlists.values());
    return JSON.stringify(this.config, null, 2);
  }

  exportBinary(): Blob {
    const json = this.exportJSON();
    return new Blob([json], { type: 'application/json' });
  }

  // Import show
  importJSON(json: string): boolean {
    try {
      const data = JSON.parse(json) as ShowConfig;
      if (data.version !== 1) {
        console.warn('Unknown show version, attempting import anyway');
      }
      this.config = data;
      this.contentManager.importData({
        items: data.content || [],
        playlists: data.playlists || [],
      });
      return true;
    } catch (e) {
      console.error('Failed to import show:', e);
      return false;
    }
  }

  // Download show file
  downloadShow(filename?: string) {
    const blob = this.exportBinary();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${this.config.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load show from file
  async loadShow(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const success = this.importJSON(e.target?.result as string);
        resolve(success);
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  // Save to localStorage
  saveToLocal(key: string = 'projection-mapper-show') {
    try {
      localStorage.setItem(key, this.exportJSON());
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // Load from localStorage
  loadFromLocal(key: string = 'projection-mapper-show'): boolean {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return this.importJSON(data);
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return false;
  }
}

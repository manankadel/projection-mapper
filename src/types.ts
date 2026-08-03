export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BezierPoint {
  position: Vec2;
  handleIn: Vec2;
  handleOut: Vec2;
}

export interface ControlPoint {
  pos: Vec2;
  handleIn: Vec2;
  handleOut: Vec2;
}

export interface MeshGrid {
  cols: number;
  rows: number;
  points: ControlPoint[];
}

export interface SurfaceData {
  id: string;
  name: string;
  color: string;
  mesh: MeshGrid;
  opacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  flipH: boolean;
  flipV: boolean;
  blendMode: BlendMode;
  edgeBlend: EdgeBlendConfig;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
  contentId: string | null;
}

export interface EdgeBlendConfig {
  enabled: boolean;
  side: 'left' | 'right' | 'top' | 'bottom' | 'none';
  width: number;
  gamma: number;
  blackLevel: number;
  whiteLevel: number;
}

export interface ContentItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'color' | 'gradient' | 'pattern' | 'webcam' | 'ndi';
  src: string;
  thumb?: string;
  duration?: number;
  loop: boolean;
  volume: number;
}

export interface Playlist {
  id: string;
  name: string;
  items: string[];
  currentIndex: number;
  autoAdvance: boolean;
  transitionDuration: number;
}

export interface ShowConfig {
  version: number;
  name: string;
  surfaces: SurfaceData[];
  content: ContentItem[];
  playlists: Playlist[];
  output: OutputConfig;
  calibration: CalibrationConfig;
  midiBindings: MIDIBinding[];
  oscBindings: OSCBinding[];
}

export interface OutputConfig {
  resolution: Vec2;
  fullscreen: boolean;
  monitor: number;
  vsync: boolean;
  maxFPS: number;
}

export interface CalibrationConfig {
  showGrid: boolean;
  gridSize: number;
  showCrosshair: boolean;
  showNumbers: boolean;
  testPattern: string | null;
  gammaCorrection: number;
}

export interface MIDIBinding {
  id: string;
  channel: number;
  note: number;
  control: string;
  target: string;
  min: number;
  max: number;
}

export interface OSCBinding {
  id: string;
  address: string;
  control: string;
  target: string;
  min: number;
  max: number;
}

export type BlendMode = 'normal' | 'additive' | 'multiply' | 'screen';

export type Tool = 'select' | 'warp' | 'pan' | 'zoom';

export type EditMode = 'design' | 'projection';

export interface ViewState {
  zoom: number;
  pan: Vec2;
  tool: Tool;
  editMode: EditMode;
  selectedSurface: number | null;
  selectedPoint: number | null;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface RenderState {
  gl: WebGL2RenderingContext | null;
  program: WebGLProgram | null;
  surfaces: SurfaceData[];
  content: Map<string, ContentItem>;
  textures: Map<string, WebGLTexture>;
  videoElements: Map<string, HTMLVideoElement>;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

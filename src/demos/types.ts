export interface DemoInstance {
  start: () => void;
  stop: () => void;
  resize: (width: number, height: number) => void;
  setProps: (props: DemoProps) => void;
}

export interface DemoMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'ambient' | 'interactive' | 'audio' | 'game';
  renderer: 'webgl2' | 'canvas2d';
  useCases: number[];
  tags: string[];
}

export interface DemoModule {
  meta: DemoMeta;
  create: (canvas: HTMLCanvasElement) => DemoInstance;
}

export interface DemoProps {
  audioData?: Float32Array;
  bass?: number;
  mids?: number;
  treble?: number;
  amplitude?: number;
  mouseX?: number;
  mouseY?: number;
  mouseActive?: boolean;
  colors?: string[];
  intensity?: number;
  [key: string]: any;
}

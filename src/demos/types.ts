export interface DemoInstance {
  start: () => void;
  stop: () => void;
  resize: (width: number, height: number) => void;
  setProps: (props: Record<string, any>) => void;
}

export interface DemoMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'ambient' | 'interactive' | 'audio';
  renderer: 'webgl2' | 'canvas2d';
}

export interface DemoModule {
  meta: DemoMeta;
  create: (canvas: HTMLCanvasElement) => DemoInstance;
}

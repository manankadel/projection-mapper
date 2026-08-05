import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'gradient',
  name: 'Gradient Shift',
  description: 'Smooth color gradients with audio-reactive transitions',
  icon: '🌈',
  category: 'audio',
  renderer: 'canvas2d',
  useCases: [42, 47, 48, 36, 12],
  tags: ['gradient', 'color', 'ambient', 'music', 'brand'],
};

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const gradients = [
    ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
    ['#ff8800', '#ff00cc', '#8800ff', '#00ccff', '#00ff88', '#ffff00'],
    ['#000000', '#444444', '#888888', '#cccccc', '#ffffff'],
  ];
  let currentPalette = 0;
  let t = 0;
  let audioBass = 0;
  let audioMids = 0;

  let raf: number;

  const render = () => {
    const time = Date.now() * 0.0005;
    t += 0.01;

    const palette = gradients[currentPalette];
    const stops = palette.length;

    const cx = width / 2 + Math.cos(time * 0.3) * width * 0.2;
    const cy = height / 2 + Math.sin(time * 0.2) * height * 0.2;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);

    const offset = (time * 0.1 + audioMids * 0.5) % 1;
    for (let i = 0; i <= stops; i++) {
      const idx = Math.floor(((i / stops + offset) % 1) * stops) % stops;
      grad.addColorStop(i / stops, palette[idx]);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (audioBass > 0.3) {
      ctx.globalAlpha = audioBass * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${audioBass * 0.5})`;
      const size = audioBass * 200;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(render);
  };

  return {
    start() {
      raf = requestAnimationFrame(render);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
    resize(w, h) {
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
    },
    setProps(props: DemoProps) {
      if (props.bass !== undefined) audioBass = props.bass;
      if (props.mids !== undefined) audioMids = props.mids;
    },
  };
}

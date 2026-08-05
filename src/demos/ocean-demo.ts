import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'ocean',
  name: 'Ocean Surface',
  description: 'Real-time water waves with caustics and lighting',
  icon: '🌊',
  category: 'ambient',
  renderer: 'canvas2d',
  useCases: [8, 35, 4, 42, 10],
  tags: ['ocean', 'water', 'waves', 'caustics', 'ambient'],
};

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const N = 30;
  const grid: { x: number; y: number; z: number }[][] = [];

  for (let i = 0; i <= N; i++) {
    grid[i] = [];
    for (let j = 0; j <= N; j++) {
      grid[i][j] = { x: 0, y: 0, z: 0 };
    }
  }

  let raf: number;
  let time = 0;
  let audioBass = 0;

  const render = () => {
    time += 0.02;

    ctx.fillStyle = 'rgba(5, 10, 30, 0.2)';
    ctx.fillRect(0, 0, width, height);

    const waveAmplitude = 15 + audioBass * 30;

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = (i / N - 0.5) * width;
        const y = (j / N - 0.5) * height;
        const wave = Math.sin(time + i * 0.3) * Math.cos(time + j * 0.2) * 0.5 +
                     Math.sin(time * 0.7 + i * 0.1 + j * 0.1) * 0.3;
        grid[i][j].z = wave * waveAmplitude;
        grid[i][j].x = x;
        grid[i][j].y = y;
      }
    }

    ctx.strokeStyle = 'rgba(0, 100, 200, 0.6)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= N; i++) {
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const px = grid[i][j].x + grid[i][j].z + width / 2;
        const py = grid[i][j].y + grid[i][j].z + height / 2;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    for (let j = 0; j <= N; j++) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = grid[i][j].x + grid[i][j].z + width / 2;
        const py = grid[i][j].y + grid[i][j].z + height / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.7, 80, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(100, 200, 255, 0.5)';
    ctx.fillStyle = 'rgba(0, 150, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(width * 0.3, height * 0.3, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

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
    },
  };
}

import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'constellation',
  name: 'Constellation',
  description: 'Interactive star map with connecting constellation lines',
  icon: '⭐',
  category: 'ambient',
  renderer: 'canvas2d',
  useCases: [13, 26, 149, 79, 138],
  tags: ['stars', 'constellation', 'night sky', 'ambient', 'story'],
};

interface Star {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const stars: Star[] = [];
  const N = 150;
  const constellations: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
    [5, 6], [6, 7], [7, 8],
    [9, 10], [10, 11], [11, 9],
    [12, 13], [13, 14], [14, 15], [15, 12],
  ];

  for (let i = 0; i < N; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 0.8 + 0.2,
      vx: (Math.random() - 0.5) * 0.05,
      vy: (Math.random() - 0.5) * 0.05,
      brightness: Math.random() * 0.5 + 0.5,
      twinkleSpeed: Math.random() * 0.02 + 0.01,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }

  let raf: number;
  let time = 0;
  let audioBass = 0;

  const render = (frameTime: number) => {
    time = frameTime * 0.001;

    ctx.fillStyle = 'rgba(5, 10, 25, 0.15)';
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      star.x += star.vx * (1 + audioBass);
      star.y += star.vy * (1 + audioBass);

      if (star.x < 0) star.x = width;
      if (star.x > width) star.x = 0;
      if (star.y < 0) star.y = height;
      if (star.y > height) star.y = 0;

      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
      const alpha = star.brightness * twinkle * star.z;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      const size = star.z * 2;
      ctx.shadowBlur = 10 * star.z;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < constellations.length; i += 2) {
      const pairA = constellations[i];
      const pairB = constellations[i + 1];
      if (!pairA || !pairB) continue;
      const a = stars[pairA[0] % N];
      const b = stars[pairB[0] % N];
      if (a && b) {
        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        if (dist < 300) {
          ctx.strokeStyle = `rgba(200, 220, 255, ${0.3 * (1 - dist / 300) * a.z})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
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
    },
  };
}

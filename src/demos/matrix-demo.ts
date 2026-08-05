import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'matrix',
  name: 'Matrix Rain',
  description: 'Classic digital rain with glitch effects',
  icon: '🌧',
  category: 'interactive',
  renderer: 'canvas2d',
  useCases: [28],
  tags: ['matrix', 'rain', 'digital', 'code'],
};

interface Drop {
  x: number;
  y: number;
  speed: number;
  char: string;
  opacity: number;
}

const CHARS = 'アカサタナハマヤラワガザダバパイチリミヒマリユルワギジディビピウツクスツヌフムユルュグズデブプウ';

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for matrix demo');

  let width = canvas.width;
  let height = canvas.height;
  const drops: Drop[] = [];
  const cols = Math.floor(width / 24);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 3; j++) {
      drops.push({
        x: i * 24 + 6,
        y: -Math.random() * height * 0.8,
        speed: Math.random() * 3 + 1,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        opacity: Math.random() * 0.5 + 0.5,
      });
    }
  }

  let raf: number;
  let startTime = 0;
  let pulse = 0;

  const render = (time: number) => {
    if (!startTime) startTime = time;
    pulse += 0.02;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';

    for (const drop of drops) {
      drop.y += drop.speed;
      drop.char = CHARS[Math.floor(Math.random() * CHARS.length)];

      if (drop.y > height + 20) {
        drop.y = -20;
        drop.x = Math.floor(Math.random() * cols) * 24 + 6;
      }

      const isBright = Math.random() < 0.02;
      const alpha = isBright ? 0.9 : drop.opacity * (0.4 + Math.sin(pulse + drop.x * 0.01) * 0.1);

      ctx.fillStyle = isBright
        ? `rgba(200, 255, 200, ${alpha})`
        : `rgba(0, 200, 100, ${alpha})`;

      ctx.fillText(drop.char, drop.x, drop.y);
      ctx.fillStyle = `rgba(0, 100, 50, ${alpha * 0.3})`;
      ctx.fillText(drop.char, drop.x, drop.y + 2);
    }

    raf = requestAnimationFrame(render);
  };

  return {
    start() {
      startTime = 0;
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
      const newCols = Math.floor(width / 24);
      drops.length = 0;
      for (let i = 0; i < newCols; i++) {
        for (let j = 0; j < 3; j++) {
          drops.push({
            x: i * 24 + 6,
            y: -Math.random() * height * 0.8,
            speed: Math.random() * 3 + 1,
            char: CHARS[Math.floor(Math.random() * CHARS.length)],
            opacity: Math.random() * 0.5 + 0.5,
          });
        }
      }
    },
    setProps(_props: DemoProps) {},
  };
}

import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'dataviz',
  name: 'Data Visualization',
  description: 'Animated charts and graphs with audio reactivity',
  icon: '📊',
  category: 'audio',
  renderer: 'canvas2d',
  useCases: [161, 134, 149, 35, 211],
  tags: ['data', 'charts', 'education', 'corporate', 'science'],
};

interface Bar {
  x: number;
  targetHeight: number;
  currentHeight: number;
  color: string;
  label: string;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const data = [45, 72, 38, 91, 56, 63, 28, 82, 49, 71];
  const bars: Bar[] = [];
  const colors = ['#00d4ff', '#ff3366', '#ffcc00', '#00ff88', '#ff00ff',
                  '#33ff88', '#ff8844', '#88ffaa', '#ffaa00', '#aa55ff'];

  let audioBass = 0;
  let audioMids = 0;
  let time = 0;
  let raf: number;

  const initBars = () => {
    bars.length = 0;
    const barWidth = width / data.length * 0.7;
    const gap = width / data.length * 0.3;
    for (let i = 0; i < data.length; i++) {
      bars.push({
        x: i * (barWidth + gap) + gap / 2,
        targetHeight: (data[i] / 100) * (height * 0.6),
        currentHeight: 0,
        color: colors[i % colors.length],
        label: `Item ${i + 1}`,
      });
    }
  };

  initBars();

  const render = () => {
    time += 0.02;
    const animFactor = audioMids * 0.5 + 0.5;

    ctx.fillStyle = 'rgba(10, 10, 25, 0.2)';
    ctx.fillRect(0, 0, width, height);

    ctx.textBaseline = 'top';
    ctx.font = '12px monospace';

    const maxHeight = height * 0.6;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const target = bar.targetHeight * (1 + audioBass * 0.3);
      bar.currentHeight += (target - bar.currentHeight) * 0.1;

      const actualHeight = Math.max(2, bar.currentHeight);

      const barWidth = width / data.length * 0.7;
      const pulse = Math.sin(time + i * 0.3) * 2 * animFactor;

      ctx.fillStyle = bar.color;
      ctx.shadowBlur = 10 + audioBass * 20;
      ctx.shadowColor = bar.color;
      ctx.fillRect(bar.x, maxHeight - actualHeight + height * 0.1 + pulse, barWidth, actualHeight);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText(bar.label, bar.x + barWidth / 2, maxHeight + height * 0.1);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(Math.round(bar.targetHeight / maxHeight * 100).toString(), bar.x + barWidth / 2, maxHeight - actualHeight - 10);
      ctx.font = '12px monospace';
    }

    ctx.strokeStyle = 'rgba(200, 220, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, maxHeight + height * 0.1);
    ctx.lineTo(width, maxHeight + height * 0.1);
    ctx.stroke();

    if (audioBass > 0.3) {
      ctx.globalAlpha = 0.3 + audioBass * 0.4;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const y = height * 0.75 + Math.sin(time * 3 + i) * 5;
        ctx.beginPath();
        ctx.ellipse(width * 0.3 + i * 20, y, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(render);
  };

  return {
    start() {
      time = 0;
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
      initBars();
    },
    setProps(props: DemoProps) {
      if (props.bass !== undefined) audioBass = props.bass;
      if (props.mids !== undefined) audioMids = props.mids;
    },
  };
}

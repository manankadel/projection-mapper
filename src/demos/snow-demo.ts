import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'snow',
  name: 'Winter Snow',
  description: 'Gentle snowfall with wind and interactive flakes',
  icon: '❄️',
  category: 'ambient',
  renderer: 'canvas2d',
  useCases: [123, 5, 107, 124],
  tags: ['snow', 'winter', 'holiday', 'nature', 'ambient'],
};

interface Snowflake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  spin: number;
  spinSpeed: number;
  type: number;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const flakes: Snowflake[] = [];
  const N = 300;
  let windSpeed = 0.3;
  let windTarget = 0.3;
  let audioAmplitude = 0;

  for (let i = 0; i < N; i++) {
    flakes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: Math.random() * 1.5 + 0.5,
      radius: Math.random() * 4 + 1,
      opacity: Math.random() * 0.5 + 0.3,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.02,
      type: Math.floor(Math.random() * 3),
    });
  }

  let raf: number;

  const render = () => {
    ctx.fillStyle = 'rgba(5, 10, 30, 0.2)';
    ctx.fillRect(0, 0, width, height);

    windSpeed += (windTarget - windSpeed) * 0.01;

    for (const flake of flakes) {
      flake.x += flake.vx + windSpeed * 0.3;
      flake.y += flake.vy * (0.7 + audioAmplitude * 0.5);
      flake.spin += flake.spinSpeed;

      if (flake.y > height + flake.radius) {
        flake.y = -flake.radius;
        flake.x = Math.random() * width;
      }

      if (flake.x < -flake.radius) flake.x = width + flake.radius;
      if (flake.x > width + flake.radius) flake.x = -flake.radius;

      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate(flake.spin);

      ctx.strokeStyle = `rgba(200, 230, 255, ${flake.opacity * (0.5 + audioAmplitude * 0.5)})`;
      ctx.lineWidth = flake.radius * 0.4;

      if (flake.type === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, flake.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (flake.type === 1) {
        ctx.beginPath();
        ctx.moveTo(0, -flake.radius);
        ctx.lineTo(0, flake.radius);
        ctx.moveTo(-flake.radius, 0);
        ctx.lineTo(flake.radius, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6;
          const x = Math.cos(angle) * flake.radius;
          const y = Math.sin(angle) * flake.radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }

    raf = requestAnimationFrame(render);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    windTarget = (x / width - 0.5) * 3;
  };

  canvas.addEventListener('mousemove', handleMouseMove);

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
      if (props.amplitude !== undefined) audioAmplitude = props.amplitude;
      if (props.mouseX !== undefined && props.mouseActive) {
        windTarget = (props.mouseX - 0.5) * 3;
      }
    },
  };
}

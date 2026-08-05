import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'particles',
  name: 'Particle Field',
  description: 'Flowing particle system with magnetic attraction',
  icon: '✨',
  category: 'ambient',
  renderer: 'canvas2d',
  useCases: [7, 11, 37, 50],
  tags: ['particles', 'ambient', 'music', 'interactive'],
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
  baseX: number;
  baseY: number;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for particles demo');

  let width = canvas.width;
  let height = canvas.height;
  const N = 300;
  const particles: Particle[] = [];

  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N;
    const radius = Math.random() * 200 + 50;
    particles.push({
      x: width / 2 + Math.cos(angle) * radius * 0.3,
      y: height / 2 + Math.sin(angle) * radius * 0.3,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 3 + 1,
      hue: Math.random() * 60 + 180,
      life: Math.random(),
      baseX: 0,
      baseY: 0,
    });
  }

  const mouse = { x: width / 2, y: height / 2, active: false };
  let raf: number;

  let audioIntensity = 0;

  const render = () => {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.15)';
    ctx.fillRect(0, 0, width, height);

    const time = Date.now() * 0.001;

    for (const p of particles) {
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;
      p.vx *= 0.97 - audioIntensity * 0.03;
      p.vy *= 0.97 - audioIntensity * 0.03;

      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120 * 0.3;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      p.life += 0.01;
      p.life = p.life % 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      const alpha = 0.5 + Math.sin(time + p.life * Math.PI * 2) * 0.3;
      ctx.fillStyle = `hsla(${p.hue + Math.sin(time) * 30}, 80%, 70%, ${alpha})`;
      ctx.fill();

      for (let j = 0; j < particles.length; j++) {
        const other = particles[j];
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, ${0.3 * (1 - dist / 80)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(render);
  };

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

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
      if (props.mouseX !== undefined && props.mouseY !== undefined) {
        mouse.x = props.mouseX * width;
        mouse.y = props.mouseY * height;
        mouse.active = props.mouseActive ?? false;
      }
      if (props.amplitude !== undefined) audioIntensity = props.amplitude;
    },
  };
}

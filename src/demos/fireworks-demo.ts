import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'fireworks',
  name: 'Fireworks',
  description: 'Audio-reactive fireworks with colorful explosions',
  icon: '🎆',
  category: 'audio',
  renderer: 'canvas2d',
  useCases: [102, 103, 122, 126, 150],
  tags: ['fireworks', 'celebration', 'events', 'audio', 'music'],
};

interface Firework {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  color: string;
  isExploding: boolean;
  particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[];
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  const fireworks: Firework[] = [];
  let lastLaunch = 0;
  let raf: number;

  const colors = ['#ff3366', '#00d4ff', '#ffcc00', '#ff00ff', '#00ff88', '#ff8844'];

  const launchFirework = () => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fw: Firework = {
      x: Math.random() * (width - 200) + 100,
      y: height,
      vx: (Math.random() - 0.5) * 2,
      vy: -(Math.random() * 8 + 8),
      gravity: 0.15,
      life: 0,
      maxLife: 60,
      color,
      isExploding: false,
      particles: [],
    };
    fireworks.push(fw);
  };

  const explode = (fw: Firework) => {
    fw.isExploding = true;
    fw.particles = [];
    const count = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 3 + 2;
      fw.particles.push({
        x: fw.x,
        y: fw.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 20,
      });
    }
  };

  let audioTrigger = 0;

  const render = (time: number) => {
    ctx.fillStyle = 'rgba(5, 5, 10, 0.15)';
    ctx.fillRect(0, 0, width, height);

    if (time - lastLaunch > 300 + Math.random() * 700 - audioTrigger * 500) {
      launchFirework();
      lastLaunch = time;
    }

    if (audioTrigger > 0.5 && time - lastLaunch > 50) {
      launchFirework();
      lastLaunch = time + 500;
      audioTrigger = 0;
    }

    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];

      if (!fw.isExploding) {
        fw.vy += fw.gravity;
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.life++;

        if (fw.life >= fw.maxLife || fw.vy >= 0) {
          explode(fw);
        }

        ctx.beginPath();
        ctx.moveTo(fw.x, fw.y);
        ctx.lineTo(fw.x, fw.y + 10);
        ctx.strokeStyle = fw.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        for (const p of fw.particles) {
          p.vy += 0.05;
          p.x += p.vx;
          p.y += p.vy;
          p.life++;

          ctx.beginPath();
          const alpha = 1 - p.life / p.maxLife;
          ctx.fillStyle = `rgba(${parseInt(fw.color.slice(1, 3), 16) * 16}, ${parseInt(fw.color.slice(3, 5), 16) * 16}, ${parseInt(fw.color.slice(5, 7), 16) * 16}, ${alpha})`;
          ctx.arc(p.x, p.y, Math.max(0, alpha * 3), 0, Math.PI * 2);
          ctx.fill();
        }
        fw.particles = fw.particles.filter(p => p.life < p.maxLife);
        if (fw.particles.length === 0) {
          fireworks.splice(i, 1);
        }
      }
    }

    raf = requestAnimationFrame(render);
  };

  return {
    start() {
      lastLaunch = 0;
      raf = requestAnimationFrame(render);
    },
    stop() {
      cancelAnimationFrame(raf);
      fireworks.length = 0;
    },
    resize(w, h) {
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
    },
    setProps(props: DemoProps) {
      if (props.amplitude !== undefined) audioTrigger = props.amplitude;
    },
  };
}

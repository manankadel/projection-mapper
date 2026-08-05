import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'holiday',
  name: 'Holiday Lights',
  description: 'Seasonal holiday themes — Christmas, Halloween, Valentine\'s, New Year',
  icon: '🎄',
  category: 'audio',
  renderer: 'canvas2d',
  useCases: [123, 122, 124, 125, 126, 103, 102],
  tags: ['holiday', 'christmas', 'halloween', 'valentines', 'celebration'],
};

type Theme = 'christmas' | 'halloween' | 'valentines' | 'newyear' | 'easter';

interface Ornament {
  x: number;
  y: number;
  radius: number;
  color: string;
  glow: number;
  phase: number;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  let width = canvas.width;
  let height = canvas.height;
  let theme: Theme = 'christmas';
  let time = 0;
  let raf: number;
  let audioBass = 0;

  const ornaments: Ornament[] = [];
  const lights: { x: number; y: number; brightness: number; phase: number }[] = [];

  const themes: Record<Theme, { bg: string; colors: string[]; fg: string; elements: string }> = {
    christmas: {
      bg: 'rgba(5, 15, 40, 0.2)',
      colors: ['#ff3333', '#00d4ff', '#ffcc00'],
      fg: 'rgba(0, 100, 0, 0.3)',
      elements: 'tree',
    },
    halloween: {
      bg: 'rgba(15, 5, 30, 0.2)',
      colors: ['#ff6600', '#8800ff', '#ff3399'],
      fg: 'rgba(40, 20, 10, 0.3)',
      elements: 'ghost',
    },
    valentines: {
      bg: 'rgba(25, 5, 15, 0.2)',
      colors: ['#ff3366', '#ff88aa', '#ffffff'],
      fg: 'rgba(60, 10, 30, 0.3)',
      elements: 'heart',
    },
    newyear: {
      bg: 'rgba(0, 0, 25, 0.2)',
      colors: ['#00d4ff', '#ffcc00', '#ff3366'],
      fg: 'rgba(20, 20, 40, 0.3)',
      elements: 'star',
    },
    easter: {
      bg: 'rgba(10, 25, 15, 0.2)',
      colors: ['#ffcc00', '#88cc44', '#ff66aa'],
      fg: 'rgba(15, 40, 20, 0.3)',
      elements: 'egg',
    },
  };

  const initElements = () => {
    ornaments.length = 0;
    lights.length = 0;

    const colors = themes[theme].colors;
    const ornamentCount = 30;
    const lightCount = 50;

    for (let i = 0; i < ornamentCount; i++) {
      ornaments.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.8 + height * 0.1,
        radius: Math.random() * 15 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        glow: Math.random(),
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < lightCount; i++) {
      lights.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.8 + height * 0.1,
        brightness: Math.random() * 0.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  };

  initElements();

  const drawTree = () => {
    const t = themes[theme];
    const treeHeight = height * 0.5;
    const treeBottom = height * 0.8;
    const trunkWidth = treeHeight * 0.08;
    const trunkHeight = treeHeight * 0.15;

    ctx.fillStyle = '#443322';
    ctx.fillRect(width / 2 - trunkWidth / 2, treeBottom, trunkWidth, trunkHeight);

    for (let i = 0; i < 4; i++) {
      const y = treeBottom - i * (treeHeight / 4);
      const w = treeHeight * (1 - i * 0.2) * 0.8;
      ctx.fillStyle = t.colors[1];
      ctx.beginPath();
      ctx.moveTo(width / 2 - w / 2, y);
      ctx.lineTo(width / 2 + w / 2, y);
      ctx.lineTo(width / 2, y - treeHeight / 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = t.colors[0];
    ctx.shadowBlur = 20;
    ctx.shadowColor = t.colors[0];
    for (let i = 0; i < 20; i++) {
      const y = treeBottom - Math.random() * treeHeight;
      const x = width / 2 + (Math.random() - 0.5) * treeHeight * 0.6;
      const size = Math.random() * 5 + 2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };

  const drawGhost = () => {
    const t = themes[theme];
    const ghostCount = 5;

    for (let i = 0; i < ghostCount; i++) {
      const gx = (width / ghostCount) * i + (width / ghostCount) * 0.5;
      const gy = height * 0.4 + Math.sin(time + i * 2) * 20 + audioBass * 30;

      ctx.fillStyle = t.colors[1];
      ctx.shadowBlur = 15;
      ctx.shadowColor = t.colors[1];
      ctx.beginPath();
      ctx.arc(gx, gy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillRect(gx - 15, gy + 5, 30, 15);

      ctx.fillStyle = t.colors[2];
      ctx.beginPath();
      ctx.arc(gx - 8, gy - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + 8, gy - 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawHeart = () => {
    const t = themes[theme];
    ctx.fillStyle = t.colors[0];
    ctx.shadowBlur = 15;
    ctx.shadowColor = t.colors[0];
    for (let i = 0; i < 10; i++) {
      const hx = Math.random() * width;
      const hy = Math.random() * height * 0.8 + height * 0.1;
      const size = Math.random() * 15 + 10;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(size / 30, size / 30);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-1, -1, -2, 0, 0, 1.5);
      ctx.bezierCurveTo(2, 0, 1, -1, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  };

  const render = () => {
    time += 0.02;
    const t = themes[theme];

    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);

    if (t.elements === 'tree') drawTree();
    else if (t.elements === 'ghost') drawGhost();
    else if (t.elements === 'heart') drawHeart();

    for (const light of lights) {
      const brightness = light.brightness * (0.7 + Math.sin(time + light.phase) * 0.3 + audioBass * 0.5);
      const colorIdx = Math.floor(Math.sin(time + light.phase) * 1 + 1) % t.colors.length;
      const color = t.colors[colorIdx < 0 ? 0 : colorIdx];

      ctx.fillStyle = color;
      ctx.globalAlpha = brightness;
      ctx.beginPath();
      ctx.arc(light.x, light.y, 2 + audioBass * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const ornament of ornaments) {
      const glow = ornament.glow * (0.5 + Math.sin(time + ornament.phase) * 0.5);
      ctx.fillStyle = ornament.color;
      ctx.shadowBlur = 10 + glow * 20 + audioBass * 20;
      ctx.shadowColor = ornament.color;
      ctx.beginPath();
      ctx.arc(ornament.x, ornament.y, ornament.radius + glow * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
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
      initElements();
    },
    setProps(props: DemoProps) {
      if (props.theme !== undefined) {
        theme = props.theme;
        initElements();
      }
      if (props.bass !== undefined) audioBass = props.bass;
    },
  };
}

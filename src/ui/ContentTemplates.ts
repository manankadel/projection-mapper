/**
 * ContentTemplates — Pre-built animations for projection mapping.
 * Each template is a canvas-based animation that can be warped onto any surface.
 */

export interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, time: number, props: Record<string, any>) => void;
  props: { name: string; label: string; type: 'range' | 'color' | 'select'; min?: number; max?: number; step?: number; value: any; options?: string[] }[];
}

export class ContentTemplateEngine {
  private templates: Map<string, ContentTemplate> = new Map();
  private activeCanvas: HTMLCanvasElement | null = null;
  private activeCtx: CanvasRenderingContext2D | null = null;
  private animFrame: number = 0;
  private startTime: number = 0;
  private currentProps: Record<string, any> = {};

  constructor() {
    this.registerTemplates();
  }

  private registerTemplates() {
    // ===== MARIO =====
    this.templates.set('mario', {
      id: 'mario',
      name: 'Mario Runner',
      category: 'games',
      icon: '🍄',
      description: 'Mario runs and jumps across your surfaces. Classic platformer vibes.',
      props: [
        { name: 'speed', label: 'Speed', type: 'range', min: 0.5, max: 3, step: 0.1, value: 1.5 },
        { name: 'gravity', label: 'Jump Height', type: 'range', min: 0.3, max: 2, step: 0.1, value: 1 },
        { name: 'background', label: 'Background', type: 'color', value: '#5c94fc' },
      ],
      render: (ctx, w, h, time, props) => {
        const speed = props.speed || 1.5;
        const gravity = props.gravity || 1;

        // Sky
        ctx.fillStyle = props.background || '#5c94fc';
        ctx.fillRect(0, 0, w, h);

        // Clouds
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 5; i++) {
          const cx = ((time * 20 * speed + i * 300) % (w + 200)) - 100;
          const cy = 40 + i * 30;
          drawCloud(ctx, cx, cy, 30 + i * 5);
        }

        // Ground
        const groundY = h * 0.75;
        ctx.fillStyle = '#c84c09';
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = '#e09050';
        ctx.fillRect(0, groundY, w, 8);

        // Bricks
        ctx.fillStyle = '#c84c09';
        for (let i = 0; i < w / 40 + 2; i++) {
          const bx = (i * 40) % w;
          ctx.fillRect(bx, groundY + 10, 36, 16);
          ctx.strokeStyle = '#8b3000';
          ctx.strokeRect(bx, groundY + 10, 36, 16);
        }

        // Question blocks
        ctx.fillStyle = '#f0a030';
        for (let i = 0; i < 3; i++) {
          const qx = ((time * 30 * speed + i * 200) % (w + 100)) - 50;
          const qy = groundY - 80;
          ctx.fillRect(qx, qy, 32, 32);
          ctx.strokeStyle = '#8b5a00';
          ctx.lineWidth = 2;
          ctx.strokeRect(qx, qy, 32, 32);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 20px monospace';
          ctx.fillText('?', qx + 10, qy + 24);
          ctx.fillStyle = '#f0a030';
        }

        // Mario
        const marioX = w * 0.3;
        const jumpPhase = Math.sin(time * 3 * speed) * gravity;
        const marioY = groundY - 40 - Math.max(0, jumpPhase * 60);

        drawMario(ctx, marioX, marioY, time, speed);

        // Pipes
        for (let i = 0; i < 2; i++) {
          const px = ((time * 30 * speed + i * 500 + 300) % (w + 200)) - 100;
          drawPipe(ctx, px, groundY, 40, 60);
        }
      },
    });

    // ===== BOUNCING BALL =====
    this.templates.set('bouncing-ball', {
      id: 'bouncing-ball',
      name: 'Bouncing Ball',
      category: 'physics',
      icon: '⚽',
      description: 'A ball bounces realistically across your surfaces with gravity.',
      props: [
        { name: 'ballCount', label: 'Ball Count', type: 'range', min: 1, max: 10, step: 1, value: 3 },
        { name: 'gravity', label: 'Gravity', type: 'range', min: 0.2, max: 3, step: 0.1, value: 1 },
        { name: 'bounce', label: 'Bounciness', type: 'range', min: 0.3, max: 1, step: 0.05, value: 0.7 },
        { name: 'trail', label: 'Trail', type: 'range', min: 0, max: 1, step: 0.1, value: 0.3 },
      ],
      render: (ctx, w, h, time, props) => {
        const count = props.ballCount || 3;
        const grav = (props.gravity || 1) * 0.5;
        const trail = props.trail || 0.3;

        // Fade background for trail effect
        ctx.fillStyle = `rgba(10, 10, 30, ${1 - trail})`;
        ctx.fillRect(0, 0, w, h);

        // Ground
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(0, h * 0.85, w, h * 0.15);
        ctx.strokeStyle = '#333366';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.85);
        ctx.lineTo(w, h * 0.85);
        ctx.stroke();

        const colors = ['#ff3366', '#00d4ff', '#33ff88', '#ffaa00', '#aa55ff', '#ff5500', '#00ffaa', '#5588ff'];

        for (let i = 0; i < count; i++) {
          const phase = (time * (1 + i * 0.3) + i * 1.5) % 4;
          const bx = (w * 0.1) + (w * 0.8) * ((Math.sin(time * 0.5 + i * 2) + 1) / 2);
          let by: number;

          if (phase < 1) {
            by = h * 0.85 - (Math.sin(phase * Math.PI) * h * 0.6 * grav);
          } else {
            by = h * 0.85;
          }

          const radius = 15 + i * 3;
          const color = colors[i % colors.length];

          // Glow
          const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, radius * 3);
          gradient.addColorStop(0, color + '40');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fillRect(bx - radius * 3, by - radius * 3, radius * 6, radius * 6);

          // Ball
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Highlight
          ctx.beginPath();
          ctx.arc(bx - radius * 0.3, by - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fill();

          // Shadow
          ctx.beginPath();
          ctx.ellipse(bx, h * 0.85, radius * 0.8, 4, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fill();
        }
      },
    });

    // ===== RAIN =====
    this.templates.set('rain', {
      id: 'rain',
      name: 'Rain',
      category: 'nature',
      icon: '🌧',
      description: 'Realistic rain falling across your surfaces.',
      props: [
        { name: 'intensity', label: 'Intensity', type: 'range', min: 20, max: 200, step: 10, value: 80 },
        { name: 'wind', label: 'Wind', type: 'range', min: -2, max: 2, step: 0.1, value: 0.5 },
        { name: 'dropSize', label: 'Drop Size', type: 'range', min: 1, max: 5, step: 0.5, value: 2 },
      ],
      render: (ctx, w, h, time, props) => {
        const intensity = props.intensity || 80;
        const wind = props.wind || 0.5;
        const dropSize = props.dropSize || 2;

        ctx.fillStyle = 'rgba(10, 15, 30, 0.15)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(150, 180, 255, 0.6)';
        ctx.lineWidth = dropSize;

        for (let i = 0; i < intensity; i++) {
          const seed = i * 137.508;
          const x = ((seed + time * 300 * (0.8 + (i % 3) * 0.1)) % (w + 100)) - 50;
          const y = ((seed * 0.7 + time * 600) % (h + 100)) - 50;
          const len = 15 + (i % 5) * 5;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + wind * 10, y + len);
          ctx.stroke();
        }

        // Splash effects at bottom
        const groundY = h * 0.9;
        for (let i = 0; i < intensity / 5; i++) {
          const sx = (i * 97.3 + time * 100) % w;
          const splashPhase = (time * 5 + i) % 1;
          if (splashPhase < 0.3) {
            const splashR = splashPhase * 20;
            ctx.beginPath();
            ctx.arc(sx, groundY, splashR, Math.PI, 0);
            ctx.strokeStyle = `rgba(150, 180, 255, ${0.5 - splashPhase})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      },
    });

    // ===== FIRE =====
    this.templates.set('fire', {
      id: 'fire',
      name: 'Fire',
      category: 'nature',
      icon: '🔥',
      description: 'Realistic fire effect climbing up your surfaces.',
      props: [
        { name: 'intensity', label: 'Intensity', type: 'range', min: 0.5, max: 2, step: 0.1, value: 1 },
        { name: 'baseColor', label: 'Base Color', type: 'color', value: '#ff4400' },
        { name: 'height', label: 'Height', type: 'range', min: 0.3, max: 1, step: 0.05, value: 0.7 },
      ],
      render: (ctx, w, h, time, props) => {
        const intensity = props.intensity || 1;
        const height = props.height || 0.7;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, w, h);

        const particles = 60 * intensity;
        for (let i = 0; i < particles; i++) {
          const seed = i * 73.137;
          const x = w * 0.3 + Math.sin(seed + time * 2) * w * 0.2;
          const progress = ((time * 2 + seed) % 3) / 3;
          const y = h - progress * h * height;

          const size = (1 - progress) * 30 * intensity;
          const alpha = (1 - progress) * 0.8;

          // Color gradient from white center to red edge
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
          gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
          gradient.addColorStop(0.3, `rgba(255, 200, 50, ${alpha * 0.8})`);
          gradient.addColorStop(0.6, `rgba(255, 100, 0, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(255, 30, 0, 0)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(x - size, y - size, size * 2, size * 2);
        }

        // Embers
        for (let i = 0; i < 15; i++) {
          const ex = w * 0.3 + Math.sin(time * 3 + i * 5) * w * 0.15;
          const ey = h - ((time * 100 + i * 50) % (h * height));
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 200, 50, ${0.8 - (h - ey) / (h * height) * 0.8})`;
          ctx.fill();
        }
      },
    });

    // ===== STARS =====
    this.templates.set('stars', {
      id: 'stars',
      name: 'Starfield',
      category: 'space',
      icon: '✨',
      description: 'A parallax starfield flying through space.',
      props: [
        { name: 'starCount', label: 'Star Count', type: 'range', min: 50, max: 300, step: 10, value: 150 },
        { name: 'speed', label: 'Speed', type: 'range', min: 0.5, max: 3, step: 0.1, value: 1 },
        { name: 'color', label: 'Star Color', type: 'color', value: '#ffffff' },
      ],
      render: (ctx, w, h, time, props) => {
        const count = props.starCount || 150;
        const speed = props.speed || 1;

        ctx.fillStyle = '#000008';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        for (let i = 0; i < count; i++) {
          const seed = i * 137.508;
          const angle = seed * 0.0174533;
          const dist = ((time * speed * 50 + seed * 3) % Math.max(w, h));
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          const brightness = 1 - dist / Math.max(w, h);
          const size = brightness * 3;

          if (x < 0 || x > w || y < 0 || y > h) continue;

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = props.color || '#ffffff';
          ctx.globalAlpha = brightness;
          ctx.fill();

          // Star trail
          if (brightness > 0.5) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - Math.cos(angle) * size * 3, y - Math.sin(angle) * size * 3);
            ctx.strokeStyle = props.color || '#ffffff';
            ctx.lineWidth = size * 0.5;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      },
    });

    // ===== MATRIX =====
    this.templates.set('matrix', {
      id: 'matrix',
      name: 'Matrix Rain',
      category: 'digital',
      icon: '🔢',
      description: 'The Matrix digital rain effect.',
      props: [
        { name: 'speed', label: 'Speed', type: 'range', min: 0.5, max: 3, step: 0.1, value: 1 },
        { name: 'density', label: 'Density', type: 'range', min: 10, max: 60, step: 5, value: 30 },
      ],
      render: (ctx, w, h, time, props) => {
        const speed = props.speed || 1;
        const density = props.density || 30;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, w, h);

        const fontSize = 14;
        ctx.font = `${fontSize}px monospace`;

        const columns = Math.floor(w / fontSize);
        for (let i = 0; i < columns; i++) {
          if (i % Math.floor(columns / density) !== 0) continue;

          const x = i * fontSize;
          const chars = Math.floor(h / fontSize);
          const offset = (time * speed * 3 + i * 7) % (chars + 10);

          for (let j = 0; j < chars; j++) {
            const y = j * fontSize - offset * fontSize + h;
            if (y < -fontSize || y > h + fontSize) continue;

            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            const alpha = 1 - Math.abs(y - h / 2) / (h / 2);

            if (j === Math.floor(offset)) {
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = alpha;
            } else {
              ctx.fillStyle = '#00ff41';
              ctx.globalAlpha = alpha * 0.7;
            }
            ctx.fillText(char, x, y);
          }
        }
        ctx.globalAlpha = 1;
      },
    });

    // ===== WATER =====
    this.templates.set('water', {
      id: 'water',
      name: 'Water Ripples',
      category: 'nature',
      icon: '💧',
      description: 'Calm water ripples spreading across your surfaces.',
      props: [
        { name: 'rippleCount', label: 'Ripple Count', type: 'range', min: 1, max: 8, step: 1, value: 3 },
        { name: 'color', label: 'Water Color', type: 'color', value: '#0066aa' },
        { name: 'calm', label: 'Calmness', type: 'range', min: 0.5, max: 3, step: 0.1, value: 1 },
      ],
      render: (ctx, w, h, time, props) => {
        const count = props.rippleCount || 3;
        const color = props.color || '#0066aa';
        const calm = props.calm || 1;

        ctx.fillStyle = '#001122';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < count; i++) {
          const cx = w * (0.3 + i * 0.2);
          const cy = h * 0.5;
          const phase = (time * calm + i * 2) % 4;

          for (let r = 0; r < 5; r++) {
            const rPhase = (phase + r * 0.5) % 4;
            const radius = rPhase * 100;
            const alpha = Math.max(0, 1 - rPhase / 4);

            ctx.beginPath();
            ctx.ellipse(cx, cy, radius, radius * 0.3, 0, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha * 0.5;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        // Caustic light patterns
        for (let i = 0; i < 20; i++) {
          const x = (i * 97 + time * 20) % w;
          const y = h * 0.5 + Math.sin(time + i) * h * 0.3;
          const size = 20 + Math.sin(time * 2 + i) * 10;

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100, 200, 255, ${0.05 + Math.sin(time + i) * 0.03})`;
          ctx.fill();
        }
      },
    });

    // ===== SNOW =====
    this.templates.set('snow', {
      id: 'snow',
      name: 'Snowfall',
      category: 'nature',
      icon: '❄',
      description: 'Gentle snowfall with accumulation.',
      props: [
        { name: 'flakes', label: 'Flake Count', type: 'range', min: 30, max: 200, step: 10, value: 80 },
        { name: 'wind', label: 'Wind', type: 'range', min: -1, max: 1, step: 0.1, value: 0.3 },
        { name: 'size', label: 'Flake Size', type: 'range', min: 1, max: 6, step: 0.5, value: 3 },
      ],
      render: (ctx, w, h, time, props) => {
        const count = props.flakes || 80;
        const wind = props.wind || 0.3;
        const size = props.size || 3;

        ctx.fillStyle = 'rgba(15, 20, 40, 0.1)';
        ctx.fillRect(0, 0, w, h);

        // Ground snow
        ctx.fillStyle = 'rgba(220, 230, 255, 0.3)';
        ctx.fillRect(0, h * 0.85, w, h * 0.15);

        for (let i = 0; i < count; i++) {
          const seed = i * 137.508;
          const x = ((seed + time * 30 * wind + Math.sin(time + seed) * 30) % (w + 40)) - 20;
          const y = ((seed * 0.7 + time * 80) % (h + 20)) - 10;
          const flakeSize = size * (0.5 + (seed % 1) * 0.5);

          ctx.beginPath();
          ctx.arc(x, y, flakeSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + (seed % 0.4)})`;
          ctx.fill();
        }
      },
    });
  }

  getTemplates(): ContentTemplate[] {
    return Array.from(this.templates.values());
  }

  getCategories(): string[] {
    const cats = new Set<string>();
    for (const t of this.templates.values()) {
      cats.add(t.category);
    }
    return Array.from(cats);
  }

  getTemplate(id: string): ContentTemplate | undefined {
    return this.templates.get(id);
  }

  startRendering(templateId: string, canvas: HTMLCanvasElement, props?: Record<string, any>) {
    this.stopRendering();

    const template = this.templates.get(templateId);
    if (!template) return;

    this.activeCanvas = canvas;
    this.activeCtx = canvas.getContext('2d');
    this.currentProps = { ...template.props.reduce((acc, p) => ({ ...acc, [p.name]: p.value }), {}), ...props };
    this.startTime = performance.now();

    const render = () => {
      if (!this.activeCtx || !this.activeCanvas) return;
      const time = (performance.now() - this.startTime) / 1000;
      template.render(this.activeCtx, this.activeCanvas.width, this.activeCanvas.height, time, this.currentProps);
      this.animFrame = requestAnimationFrame(render);
    };
    render();
  }

  stopRendering() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = 0;
    }
  }

  updateProp(name: string, value: any) {
    this.currentProps[name] = value;
  }
}

// Helper functions
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.arc(x + size, y - size * 0.3, size * 0.8, 0, Math.PI * 2);
  ctx.arc(x + size * 1.5, y, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x - size * 0.5, y + size * 0.2, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMario(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, speed: number) {
  const frame = Math.floor(time * speed * 4) % 4;

  // Body
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(x - 12, y - 10, 24, 16);

  // Head
  ctx.fillStyle = '#ffb88c';
  ctx.fillRect(x - 10, y - 24, 20, 14);

  // Hat
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(x - 12, y - 30, 24, 8);
  ctx.fillRect(x - 8, y - 34, 16, 6);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 4, y - 20, 3, 3);
  ctx.fillRect(x + 4, y - 20, 3, 3);

  // Mustache
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(x - 6, y - 14, 12, 3);

  // Legs
  ctx.fillStyle = '#0000ff';
  const legOffset = frame % 2 === 0 ? 0 : 4;
  ctx.fillRect(x - 10, y + 6, 8, 10 + legOffset);
  ctx.fillRect(x + 2, y + 6, 8, 10 - legOffset);

  // Shoes
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(x - 12, y + 14 + legOffset, 12, 4);
  ctx.fillRect(x + 0, y + 14 - legOffset, 12, 4);
}

function drawPipe(ctx: CanvasRenderingContext2D, x: number, groundY: number, width: number, height: number) {
  // Pipe body
  ctx.fillStyle = '#00aa00';
  ctx.fillRect(x, groundY - height, width, height);

  // Pipe top
  ctx.fillStyle = '#00cc00';
  ctx.fillRect(x - 6, groundY - height - 10, width + 12, 14);

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 4, groundY - height, 6, height);
}

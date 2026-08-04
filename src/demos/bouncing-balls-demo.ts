import type { DemoInstance, DemoMeta } from './types';

export const meta: DemoMeta = {
  id: 'bouncing',
  name: 'Bouncing Balls',
  description: 'Interactive physics simulation with mouse repulsion',
  icon: '⚽',
  category: 'interactive',
  renderer: 'canvas2d',
};

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  gravity: number;
}

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for bouncing balls demo');

  let width = canvas.width;
  let height = canvas.height;
  const balls: Ball[] = [];
  const GRAVITY = 0.3;
  const colors = ['#ff3366', '#00d4ff', '#ffcc00', '#00ff88', '#ff00ff'];

  const mouse = { x: 0, y: 0, active: false };

  for (let i = 0; i < 12; i++) {
    balls.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.5,
      vx: (Math.random() - 0.5) * 4,
      vy: 0,
      radius: Math.random() * 20 + 10,
      color: colors[i % colors.length],
      gravity: GRAVITY + Math.random() * 0.2,
    });
  }

  let raf: number;

  const render = () => {
    ctx.fillStyle = 'rgba(5, 5, 10, 0.3)';
    ctx.fillRect(0, 0, width, height);

    for (const ball of balls) {
      ball.vy += ball.gravity;
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.vx *= -0.7;
      }
      if (ball.x > width - ball.radius) {
        ball.x = width - ball.radius;
        ball.vx *= -0.7;
      }

      if (ball.y > height - ball.radius) {
        ball.y = height - ball.radius;
        ball.vy *= -0.7;
        ball.vy *= 0.95;
      }

      if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.vy = 0;
      }

      if (mouse.active) {
        const dx = mouse.x - ball.x;
        const dy = mouse.y - ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 4;
          ball.vx -= (dx / dist) * force;
          ball.vy -= (dy / dist) * force;
        }
      }

      ctx.beginPath();
      const grad = ctx.createRadialGradient(
        ball.x - ball.radius / 3, ball.y - ball.radius / 3,
        ball.radius / 4, ball.x, ball.y, ball.radius
      );
      grad.addColorStop(0, ball.color);
      grad.addColorStop(1, ball.color.replace(/,\s*\d+%/, ', 30%)'));
      ctx.fillStyle = grad;

      ctx.shadowBlur = 20;
      ctx.shadowColor = ball.color;
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (ball.vy !== 0 || Math.abs(ball.vx) > 0.1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.stroke();
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

  canvas.addEventListener('click', () => {
    for (let i = 0; i < 3; i++) {
      balls.push({
        x: width / 2,
        y: height / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 4,
        radius: Math.random() * 15 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: GRAVITY + Math.random() * 0.2,
      });
    }
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
    setProps() {},
  };
}

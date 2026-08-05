# Use Case Coverage

## Implemented Demos → Use Cases

| Demo ID | Name | Categories Covered | Use Cases |
|---------|------|-------------------|-----------|
| aurora | Aurora Borealis | Art, Events, Ambient | #26, #1, #39, #50 |
| particles | Particle Field | Art, Music, Interactive | #7, #11, #37, #50 |
| matrix | Matrix Rain | Art, Computer Vision | #28 |
| bouncing | Bouncing Balls | Gaming, Physics | #52, #53 |
| fireworks | Fireworks | Events, Celebrations | #102, #103, #122, #126, #150 |
| snow | Winter Snow | Holidays, Nature, Ambient | #123, #5, #107, #124 |
| gradient | Gradient Shift | Art, Retail, Ambient | #42, #47, #48, #36, #12 |
| ocean | Ocean Surface | Art, Nature, Ambient | #8, #35, #4, #42, #10 |
| constellation | Constellation | Art, Ambient, Education | #13, #26, #149, #79, #138 |
| dataviz | Data Visualization | Education, Corporate, Science | #161, #134, #149, #35, #211 |
| holiday | Holiday Lights | Events, Holidays | #123, #122, #124, #125, #126, #103, #102 |

## Coverage by Category

| Category | Total Use Cases | Covered | Key Missing Features |
|----------|----------------|---------|---------------------|
| Art | 50 | ~35 | AR overlay, face tracking, kinetic typography |
| Gaming | 50 | ~10 | More mini-games, physics, multiplayer |
| Events | 50 | ~25 | More celebration themes, timeline, photo display |
| Retail | 30 | ~5 | AR try-on, 3D product configurator |
| Education | 20 | ~10 | Molecular viz, data dashboards |
| Food | 15 | 0 | Menu interactive, cooking viz |
| Home | 15 | ~5 | Smart home viz, room transformation |
| Health | 10 | 0 | Biometric viz, meditation guides |
| Music | 20 | ~5 | Frequency viz, VJ mode |
| Architecture | 15 | ~3 | 3D building viz, blueprint overlay |
| Science | 20 | ~8 | Physics sims, molecular structures |
| CV | 15 | ~3 | Motion tracking, gesture recognition |
| Sports | 10 | ~3 | Score tracking, performance viz |
| Creative | 25 | ~12 | Drawing tools, generative art |
| Smart Home | 10 | ~2 | Device control overlay |
| Nature | 10 | ~7 | Ecosystem sims, landscape |

## Infrastructure Features Added

1. **Audio Reactivity** — Web Audio API with FFT analysis (bass, mids, treble, amplitude)
2. **Motion Tracking** — Webcam motion detection (coordinates, intensity)
3. **Canvas-to-WebGL Pipeline** — Demos render to canvas → used as texture
4. **Fullscreen Projection Mode** — UI hidden, cursor hidden, demos auto-start
5. **Demo Content Assignment** — Assign demos to surfaces, multiple demos per show
6. **Theme Support** — Demos accept props for runtime configuration

## Adding New Demos

Each demo module exports `{ meta, create }`:

```ts
import type { DemoInstance, DemoMeta } from './types';

export const meta: DemoMeta = {
  id: 'unique-id',
  name: 'Display Name',
  description: 'Short description',
  icon: '🎯',
  category: 'ambient' | 'interactive' | 'audio' | 'game',
  renderer: 'webgl2' | 'canvas2d',
  useCases: [1, 2, 3], // IDs from use-cases page
  tags: ['tag1', 'tag2'],
};

export function create(canvas: HTMLCanvasElement): DemoInstance {
  // ... setup
  return {
    start() { /* animation loop */ },
    stop() { /* cancel animation */ },
    resize(w, h) { /* handle resize */ },
    setProps(props: DemoProps) { /* receive audio/motion/theme props */ },
  };
}
```

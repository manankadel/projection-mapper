import type { DemoInstance, DemoMeta, DemoProps } from './types';

export const meta: DemoMeta = {
  id: 'aurora',
  name: 'Aurora Borealis',
  description: 'Real-time procedural aurora with dynamic wave distortion',
  icon: '🌌',
  category: 'ambient',
  renderer: 'webgl2',
  useCases: [26, 1, 39, 50],
  tags: ['aurora', 'ambient', 'ambient', 'music'],
};

const VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0, 1);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289((x - 1.0) * (x - 2.0) * (x - 3.0)); }
vec3 taylorInvSqrt(vec3 x) { return 0.5 * (1.0 / 2.75 + x * (-0.5)); }
vec2 taylorInvSqrt(vec2 x) { return 0.5 * (1.0 / 2.75 + x * (-0.5)); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.0, -1.0 / 6.0, 1.0 / 12.0, 0.0);
  const vec2 D = vec2(0.0, 0.5);
  float n = v.x + v.y;
  vec2  n2 = n * C.xx + D.xy;
  vec2  n3 = n2.x + n2.y;
  vec2  g = fract(n3);
  vec2  t = floor(g + 0.5);
  g = g - t;
  vec4 x = (t.x * C.x + t.y * C.y) + (g.x * C.z + g.y * C.w);
  vec2  i = (t + n2) - n3 + D.xxx;
  vec2  f = step(x, vec2(0.5));
  vec2  r = (i + f) - x;
  return r.x;
}

vec3 aurora(vec2 uv, float t) {
  float a = uv.y * 0.5;
  float intensity = smoothstep(0.0, 0.4, a) * (1.0 - smoothstep(0.3, 1.0, a));
  
  vec2 st = uv * 3.0;
  float n1 = snoise(st + t * 0.02);
  float n2 = snoise(st * 0.5 + t * 0.01);
  
  float waves = sin(uv.x * 3.0 + t * 0.3) * 0.5 + cos(uv.x * 5.0 + t * 0.2) * 0.3;
  waves += sin(uv.x * 7.0 + t * 0.15 + n1 * 0.5) * 0.2;
  
  float aurora1 = sin(uv.x * 2.0 + t * 0.4 + n1 * 0.5) * intensity * 0.3;
  float aurora2 = cos(uv.x * 3.5 + t * 0.25 + n2 * 0.8) * intensity * 0.2;
  float aurora3 = sin(uv.x * 5.0 + t * 0.1 + n1 * 0.3) * intensity * 0.15;
  
  float total = aurora1 + aurora2 + aurora3;
  total = max(total, 0.0) * (waves + 1.0) * 0.5;
  total *= (1.0 + u_bass * 0.5);
  
  vec3 color = mix(
    vec3(0.1, 0.4, 0.6),
    vec3(0.6, 0.8, 1.0),
    smoothstep(0.0, 0.3, total)
  );
  color = mix(color, vec3(0.9, 0.95, 1.0), smoothstep(0.3, 0.7, total));
  
  return color * total * 1.5;
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;
  uv.y = abs(uv.y);
  uv.x *= 1.0 + (1.0 - uv.y) * 0.3;
  
  float t = u_time * 0.3;
  
  vec3 color = aurora(uv, t);
  
  float star = pow(snoise(v_uv * 1000.0), 60.0);
  color += vec3(star * 0.5);
  
  fragColor = vec4(color, 1.0);
}`;

export function create(canvas: HTMLCanvasElement): DemoInstance {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 not available for aurora demo');

  const prog = gl.createProgram()!;
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time')!;
  const uRes = gl.getUniformLocation(prog, 'u_resolution')!;
  const uBass = gl.getUniformLocation(prog, 'u_bass')!;
  const uMids = gl.getUniformLocation(prog, 'u_mids')!;
  const uTreble = gl.getUniformLocation(prog, 'u_treble')!;

  let raf: number;
  let startTime = 0;
  let width = canvas.width;
  let height = canvas.height;
  let bass = 0;
  let mids = 0;
  let treble = 0;

  const render = (time: number) => {
    if (!startTime) startTime = time;
    const t = (time - startTime) * 0.001;

    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, width, height);
    gl.uniform1f(uBass, bass);
    gl.uniform1f(uMids, mids);
    gl.uniform1f(uTreble, treble);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

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
      gl.viewport(0, 0, w, h);
    },
    setProps(props: DemoProps) {
      if (props.bass !== undefined) bass = props.bass;
      if (props.mids !== undefined) mids = props.mids;
      if (props.treble !== undefined) treble = props.treble;
    },
  };
}

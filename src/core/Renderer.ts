import type { SurfaceData, ContentItem } from '../types';
import { tessellateBezierMesh } from '../utils/math';
import { hexToRGB } from '../utils/color';

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_texCoord;
uniform vec2 u_resolution;
out vec2 v_texCoord;
void main() {
  vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_texCoord = a_texCoord;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_opacity;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;
uniform float u_gamma;
uniform float u_hasTexture;
uniform vec3 u_color;
uniform float u_edgeBlend;
uniform float u_edgeBlendSide;
uniform vec2 u_resolution;
uniform float u_flipH;
uniform float u_flipV;
out vec4 fragColor;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float edgeBlendFactor(vec2 uv, float side, float width) {
  if (width <= 0.0) return 1.0;
  float w = width;
  if (side == 0.0) return 1.0;
  else if (side == 1.0) return clamp(uv.x / w, 0.0, 1.0);
  else if (side == 2.0) return clamp((1.0 - uv.x) / w, 0.0, 1.0);
  else if (side == 3.0) return clamp(uv.y / w, 0.0, 1.0);
  else if (side == 4.0) return clamp((1.0 - uv.y) / w, 0.0, 1.0);
  return 1.0;
}

void main() {
  vec2 uv = v_texCoord;
  if (u_flipH > 0.5) uv.x = 1.0 - uv.x;
  if (u_flipV > 0.5) uv.y = 1.0 - uv.y;

  vec4 color;
  if (u_hasTexture > 0.5) {
    color = texture(u_texture, uv);
  } else {
    color = vec4(u_color, 1.0);
  }

  if (u_gamma > 0.01 && abs(u_gamma - 1.0) > 0.01) {
    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
  }

  color.rgb *= u_brightness;
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

  vec3 hsv = rgb2hsv(color.rgb);
  hsv.y *= u_saturation;
  color.rgb = hsv2rgb(hsv);

  hsv = rgb2hsv(color.rgb);
  hsv.x = fract(hsv.x + u_hue);
  color.rgb = hsv2rgb(hsv);

  float blend = edgeBlendFactor(v_texCoord, u_edgeBlendSide, u_edgeBlend);
  color.rgb *= blend;

  color.a *= u_opacity;
  fragColor = color;
}`;

// Edge blend shader for overlap regions
const BLEND_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_blendWidth;
uniform float u_blendGamma;
uniform float u_side;
uniform vec2 u_resolution;
out vec4 fragColor;

void main() {
  vec4 a = texture(u_textureA, v_texCoord);
  vec4 b = texture(u_textureB, v_texCoord);

  float t;
  if (u_side == 1.0) t = v_texCoord.x;
  else if (u_side == 2.0) t = 1.0 - v_texCoord.x;
  else if (u_side == 3.0) t = v_texCoord.y;
  else t = 1.0 - v_texCoord.y;

  float blend = smoothstep(0.0, u_blendWidth, t);
  blend = pow(blend, 1.0 / u_blendGamma);

  vec3 color = a.rgb * (1.0 - blend) + b.rgb * blend;
  fragColor = vec4(color, max(a.a, b.a));
}`;

export class Renderer {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  private mainProgram: WebGLProgram;
  private blendProgram: WebGLProgram;
  private posBuffer: WebGLBuffer;
  private texBuffer: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private textures: Map<string, WebGLTexture> = new Map();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private patternCanvas: HTMLCanvasElement;
  private patternCtx: CanvasRenderingContext2D;
  private patternTexture: WebGLTexture | null = null;
  private lastPatternType: string = '';
  private frameCount = 0;
  private lastFpsTime = performance.now();
  fps = 0;

  // Uniform locations (main program)
  private u: Record<string, WebGLUniformLocation> = {};

  // Uniform locations (blend program)
  private ub: Record<string, WebGLUniformLocation> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.mainProgram = this.createProgram(VERT_SRC, FRAG_SRC);
    this.blendProgram = this.createProgram(VERT_SRC, BLEND_FRAG_SRC);

    // Cache uniform locations
    ['u_opacity', 'u_brightness', 'u_contrast', 'u_saturation', 'u_hue', 'u_gamma',
     'u_hasTexture', 'u_color', 'u_texture', 'u_resolution', 'u_edgeBlend', 'u_edgeBlendSide',
     'u_flipH', 'u_flipV'].forEach(name => {
      this.u[name] = gl.getUniformLocation(this.mainProgram, name)!;
    });

    ['u_textureA', 'u_textureB', 'u_blendWidth', 'u_blendGamma', 'u_side', 'u_resolution'].forEach(name => {
      this.ub[name] = gl.getUniformLocation(this.blendProgram, name)!;
    });

    this.posBuffer = gl.createBuffer()!;
    this.texBuffer = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;

    this.patternCanvas = document.createElement('canvas');
    this.patternCtx = this.patternCanvas.getContext('2d')!;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vertSrc);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(surfaces: SurfaceData[], contentMap: Map<string, ContentItem>) {
    const gl = this.gl;
    this.resize();

    // FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const surf of surfaces) {
      if (!surf.visible) continue;
      this.renderSurface(surf, contentMap, w, h);
    }
  }

  private renderSurface(surf: SurfaceData, contentMap: Map<string, ContentItem>, w: number, h: number) {
    const gl = this.gl;
    const segs = 8; // tessellation segments per cell
    const { positions, texCoords } = tessellateBezierMesh(
      surf.mesh.points, surf.mesh.cols, surf.mesh.rows, segs
    );

    if (positions.length === 0) return;

    gl.useProgram(this.mainProgram);

    // Upload geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.mainProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);
    const texLoc = gl.getAttribLocation(this.mainProgram, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniform2f(this.u.u_resolution, w, h);
    gl.uniform1f(this.u.u_opacity, surf.opacity);
    gl.uniform1f(this.u.u_brightness, surf.brightness);
    gl.uniform1f(this.u.u_contrast, surf.contrast);
    gl.uniform1f(this.u.u_saturation, surf.saturation);
    gl.uniform1f(this.u.u_hue, surf.hue / 360);
    gl.uniform1f(this.u.u_gamma, surf.gamma);
    gl.uniform1f(this.u.u_flipH, surf.flipH ? 1 : 0);
    gl.uniform1f(this.u.u_flipV, surf.flipV ? 1 : 0);

    // Edge blending
    const eb = surf.edgeBlend;
    gl.uniform1f(this.u.u_edgeBlend, eb.enabled ? eb.width : 0);
    const sideMap: Record<string, number> = { none: 0, left: 1, right: 2, top: 3, bottom: 4 };
    gl.uniform1f(this.u.u_edgeBlendSide, sideMap[eb.side] || 0);

    // Bind texture or color
    let hasTex = false;
    if (surf.contentId) {
      const content = contentMap.get(surf.contentId);
      if (content) {
        const tex = this.getTexture(content);
        if (tex) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(this.u.u_texture, 0);
          hasTex = true;

          // Update video textures
          if (content.type === 'video' || content.type === 'webcam') {
            this.updateVideoTexture(content);
          }
        }
      }
    }

    gl.uniform1f(this.u.u_hasTexture, hasTex ? 1 : 0);
    if (!hasTex) {
      const c = hexToRGB(surf.color);
      gl.uniform3f(this.u.u_color, c.r, c.g, c.b);
    }

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
  }

  private getTexture(content: ContentItem): WebGLTexture | null {
    if (content.type === 'pattern') {
      return this.getPatternTexture(content.src);
    }
    return this.textures.get(content.id) || null;
  }

  private getPatternTexture(type: string): WebGLTexture {
    if (this.patternTexture && this.lastPatternType === type) {
      return this.patternTexture;
    }

    const w = 1024, h = 1024;
    this.patternCanvas.width = w;
    this.patternCanvas.height = h;
    const ctx = this.patternCtx;

    switch (type) {
      case 'checker': {
        const size = 64;
        for (let y = 0; y < h; y += size) {
          for (let x = 0; x < w; x += size) {
            ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ffffff' : '#333333';
            ctx.fillRect(x, y, size, size);
          }
        }
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.stroke();
        break;
      }
      case 'colorbars': {
        const colors = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
        const barW = w / colors.length;
        colors.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(i * barW, 0, barW, h * 0.75);
        });
        const bottomColors = ['#0000ff', '#000000', '#ff00ff', '#000000', '#00ffff', '#000000', '#ffffff', '#000000'];
        bottomColors.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(i * barW, h * 0.75, barW, h * 0.25);
        });
        break;
      }
      case 'grid': {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1;
        const step = 50;
        for (let x = 0; x <= w; x += step) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y <= h; y += step) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        ctx.fillStyle = '#ff3366';
        ctx.font = '14px monospace';
        for (let x = step; x < w; x += step * 2) {
          for (let y = step; y < h; y += step * 2) {
            ctx.fillText(`${x},${y}`, x + 4, y - 4);
          }
        }
        break;
      }
      case 'gradient': {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ff0000');
        grad.addColorStop(0.17, '#ffff00');
        grad.addColorStop(0.33, '#00ff00');
        grad.addColorStop(0.5, '#00ffff');
        grad.addColorStop(0.67, '#0000ff');
        grad.addColorStop(0.83, '#ff00ff');
        grad.addColorStop(1, '#ff0000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'brightness': {
        for (let x = 0; x < w; x++) {
          const v = Math.round((x / w) * 255);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
        }
        ctx.fillStyle = '#ff3366';
        ctx.font = '16px monospace';
        ctx.fillText('0', 10, 30);
        ctx.fillText('128', w / 2 - 15, 30);
        ctx.fillText('255', w - 50, 30);
        break;
      }
      default: {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);
      }
    }

    this.patternTexture = this.createGLTexture(this.patternCanvas);
    this.lastPatternType = type;
    return this.patternTexture;
  }

  loadImage(id: string, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = this.createGLTexture(img);
        this.textures.set(id, tex);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  loadVideo(id: string, src: string): HTMLVideoElement {
    let video = this.videoElements.get(id);
    if (!video) {
      video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.src = src;
      video.play().catch(() => {});
      this.videoElements.set(id, video);
    }
    return video;
  }

  startWebcam(id: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
      let video = this.videoElements.get(id);
      if (!video) {
        video = document.createElement('video');
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        this.videoElements.set(id, video);
      }
      video.srcObject = stream;
      video.play();
      return stream;
    });
  }

  stopWebcam(id: string) {
    const video = this.videoElements.get(id);
    if (video) {
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
  }

  private updateVideoTexture(content: ContentItem) {
    const video = this.videoElements.get(content.id);
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;

    let tex = this.textures.get(content.id);
    if (!tex) {
      tex = this.createGLTexture(video);
      this.textures.set(content.id, tex);
    } else {
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
    }
  }

  private createGLTexture(source: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return tex;
  }

  destroy() {
    this.textures.forEach(t => this.gl.deleteTexture(t));
    this.videoElements.forEach(v => {
      const stream = v.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    });
    this.gl.deleteProgram(this.mainProgram);
    this.gl.deleteProgram(this.blendProgram);
    this.gl.deleteBuffer(this.posBuffer);
    this.gl.deleteBuffer(this.texBuffer);
    this.gl.deleteVertexArray(this.vao);
  }
}

// Adapted from TuneShape Liquid Carousel. See /License/tuneshape-liquid-carousel.txt.
const boundaryProfile = [.0225, -.0375, -.015, .03, 0, -.09, -.105, .0075];
const edge = .1;
const referenceRadius = Math.hypot(311.15 / 463, .5);

export type LiquidDirection = -1 | 1;

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function boundaryWave(angle: number) {
  let wave = 0;
  for (let i = 0; i < 4; i++) {
    const harmonic = (i + 1) * angle;
    wave += boundaryProfile[i * 2] * Math.sin(harmonic) + boundaryProfile[i * 2 + 1] * Math.cos(harmonic);
  }
  return wave;
}

const boundarySamples = Array.from({ length: 96 }, (_, index) => {
  const angle = index / 96 * Math.PI * 2;
  const x = Math.cos(angle), y = Math.sin(angle);
  return { x, y, left: boundaryWave(Math.atan2(-y, x)), right: boundaryWave(Math.atan2(-y, -x)) };
});

export type LiquidFace = { tint: string; number: string; title: string; image: HTMLImageElement };

type LiquidRenderer = {
  prepare: (from: HTMLCanvasElement, to: HTMLCanvasElement) => void;
  draw: (progress: number, direction: LiquidDirection) => void;
  dispose: () => void;
};

export function createLiquidRenderer(canvas: HTMLCanvasElement): LiquidRenderer | null {
  const gl = canvas.getContext('webgl', {
    antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true,
  });
  if (gl) return gl.isContextLost() ? null : createRefractionRenderer(gl);

  const context = canvas.getContext('2d');
  if (!context) return null;
  let faces: [HTMLCanvasElement, HTMLCanvasElement] | undefined;
  return {
    prepare(from, to) { faces = [from, to]; },
    draw(progress, direction) { if (faces) drawLiquidFrame(context, ...faces, progress, direction); },
    dispose() { faces = undefined; },
  };
}

function createRefractionRenderer(gl: WebGLRenderingContext): LiquidRenderer | null {
  const program = gl.createProgram();
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  const quad = gl.createBuffer();
  const fromTexture = gl.createTexture();
  const toTexture = gl.createTexture();
  const dispose = () => {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    gl.deleteBuffer(quad);
    gl.deleteTexture(fromTexture);
    gl.deleteTexture(toTexture);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  if (!program || !vertex || !fragment || !quad || !fromTexture || !toTexture) {
    dispose();
    return null;
  }
  gl.shaderSource(vertex, `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * .5 + .5;
      gl_Position = vec4(aPosition, 0., 1.);
    }
  `);
  gl.shaderSource(fragment, `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uFrom, uTo;
    uniform float uProgress, uRadius, uAspect, uDirection, uTexel;
    uniform vec4 uWave, uRipple;
    void main() {
      vec2 uv = vUv;
      if (uProgress <= 0.) { gl_FragColor = texture2D(uFrom, uv); return; }
      if (uProgress >= 1.) { gl_FragColor = texture2D(uTo, uv); return; }

      vec2 origin = vec2(uDirection > 0. ? .889 : .111, .5);
      vec2 q = (uv - origin) * vec2(uAspect, 1.);
      float distance = length(q);
      vec2 direction = q / max(distance, .001);
      float angle = atan(q.y, -q.x * uDirection + .000001);
      float wave = dot(uWave, vec4(sin(angle), cos(angle), sin(2. * angle), cos(2. * angle)))
        + dot(uRipple, vec4(sin(3. * angle), cos(3. * angle), sin(4. * angle), cos(4. * angle)));
      float gate = smoothstep(0., .12, uProgress) * (1. - smoothstep(.8, 1., uProgress));
      float boundary = distance + wave * ${edge.toFixed(2)} * gate - uRadius;
      float feather = max(uTexel * .9, .0015);
      float mask = 1. - smoothstep(-feather, feather, boundary);
      float distortion = .2;
      float width = .05 + .22 * distortion;
      float band = exp(-pow(abs(boundary) / width, 2.)) * sin(3.14159265 * uProgress);
      float strength = distortion / (1. + 2. * distortion);
      vec2 offset = direction / vec2(uAspect, 1.) * strength * band;
      vec2 fromUv = clamp(uv + offset * .52, .001, .999);
      vec2 toUv = clamp(uv - offset * .34, .001, .999);
      gl_FragColor = mix(texture2D(uFrom, fromUv), texture2D(uTo, toUv), mask);
    }
  `);
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return null;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform('uFrom'), 0);
  gl.uniform1i(uniform('uTo'), 1);
  gl.uniform4f(uniform('uWave'), boundaryProfile[0], boundaryProfile[1], boundaryProfile[2], boundaryProfile[3]);
  gl.uniform4f(uniform('uRipple'), boundaryProfile[4], boundaryProfile[5], boundaryProfile[6], boundaryProfile[7]);
  const progressUniform = uniform('uProgress');
  const radiusUniform = uniform('uRadius');
  const directionUniform = uniform('uDirection');
  const aspectUniform = uniform('uAspect');
  const texelUniform = uniform('uTexel');

  function upload(texture: WebGLTexture, face: HTMLCanvasElement, unit: number) {
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face);
  }

  return {
    prepare(from, to) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      upload(fromTexture, from, gl.TEXTURE0);
      upload(toTexture, to, gl.TEXTURE1);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(aspectUniform, gl.drawingBufferWidth / gl.drawingBufferHeight);
      gl.uniform1f(texelUniform, 1 / gl.drawingBufferHeight);
    },
    draw(progress, direction) {
      const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      gl.uniform1f(progressUniform, progress);
      gl.uniform1f(radiusUniform, liquidRadius(progress, aspect));
      gl.uniform1f(directionUniform, direction);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose,
  };
}

export function measureLiquidCard(card: HTMLElement) {
  const frame = card.getBoundingClientRect();
  const parts = card.querySelectorAll<HTMLElement>('[data-liquid-part]');
  const [number, firstRule, secondRule, art, title] = Array.from(parts, part => {
    const rect = part.getBoundingClientRect();
    return {
      x: rect.x - frame.x, y: rect.y - frame.y, width: rect.width, height: rect.height,
      style: window.getComputedStyle(part),
    };
  });
  return { width: frame.width, height: frame.height, number, rules: [firstRule, secondRule], art, title };
}

export function drawLiquidFace(
  canvas: HTMLCanvasElement,
  layout: ReturnType<typeof measureLiquidCard>,
  face: LiquidFace,
  width: number,
  height: number,
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return false;

  context.scale(width / layout.width, height / layout.height);
  context.fillStyle = face.tint;
  context.fillRect(0, 0, layout.width, layout.height);
  for (const rule of layout.rules) {
    context.globalAlpha = Number(rule.style.opacity);
    context.fillStyle = rule.style.backgroundColor;
    context.fillRect(rule.x, rule.y, rule.width, rule.height);
  }
  context.globalAlpha = 1;

  const { art } = layout;
  const { image } = face;
  const scale = Math.min(art.width / image.naturalWidth, art.height / image.naturalHeight);
  const artWidth = image.naturalWidth * scale;
  const artHeight = image.naturalHeight * scale;
  context.drawImage(image, art.x + (art.width - artWidth) / 2, art.y + (art.height - artHeight) / 2, artWidth, artHeight);

  const drawLabel = (label: string, slot: typeof layout.number, center: boolean) => {
    const { color, fontFamily, fontSize, fontWeight, letterSpacing } = slot.style;
    context.fillStyle = color;
    context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
    if ('letterSpacing' in context) context.letterSpacing = letterSpacing;
    context.textAlign = center ? 'center' : 'left';
    const font = context.measureText(label);
    const x = slot.x + (center ? slot.width / 2 : 0);
    const y = slot.y + (slot.height + font.fontBoundingBoxAscent - font.fontBoundingBoxDescent) / 2;
    context.fillText(label, x, y);
  };
  drawLabel(face.number, layout.number, false);
  drawLabel(face.title, layout.title, true);
  return true;
}

export function captureLiquidFrame(canvas: HTMLCanvasElement, snapshot: HTMLCanvasElement) {
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const context = snapshot.getContext('2d');
  if (!context) return false;
  context.drawImage(canvas, 0, 0);
  return true;
}

function liquidRadius(progress: number, aspect: number) {
  const curve = -.05 + .84 * progress + .235 * (1 - Math.exp(-196 * progress * progress));
  return curve * Math.hypot(.889 * aspect, .5) / referenceRadius;
}

function drawLiquidFrame(
  context: CanvasRenderingContext2D,
  from: HTMLCanvasElement,
  to: HTMLCanvasElement,
  progress: number,
  direction: LiquidDirection,
) {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  if (progress >= 1) {
    context.drawImage(to, 0, 0, width, height);
    return;
  }

  context.drawImage(from, 0, 0, width, height);
  const radius = liquidRadius(progress, width / height) * height;
  if (radius <= 0) return;

  const gate = smoothstep(progress / .12) * (1 - smoothstep((progress - .8) / .2));
  const originX = width * (direction > 0 ? .889 : .111);
  const originY = height * .5;
  const boundary = new Path2D();
  boundarySamples.forEach(({ x, y, left, right }, index) => {
    const offset = (direction > 0 ? right : left) * edge * gate * height;
    const r = Math.max(0, radius - offset);
    const px = originX + x * r, py = originY + y * r;
    if (index === 0) boundary.moveTo(px, py);
    else boundary.lineTo(px, py);
  });
  boundary.closePath();

  context.save();
  context.clip(boundary);
  context.clearRect(0, 0, width, height);
  context.drawImage(to, 0, 0, width, height);
  context.restore();
}

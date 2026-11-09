// ═══════════════════════════════════════════════════════════════
//  kage3d.js — 카게의 일본도 3D 모델(GLB)을 그리는 작은 WebGL 표시기
//  · 외부 라이브러리 없음 (GLB 읽기 + 셰이더 직접 구현)
//  · 모델: assets/models/kage_blade.glb (Meshy AI로 직접 제작, 텍스처 1024px로 축소)
//  · 서버 없이 index.html을 바로 열면(file://) fetch가 막히므로
//    같은 내용을 담은 assets/models/kage_blade.glb.js를 대신 읽는다
//  · WebGL2가 없거나 읽기에 실패하면 ready=false 그대로 → 게임은 기존 2D 칼을 그린다
// ═══════════════════════════════════════════════════════════════
const Kage3D = (() => {
  const GLB_URL = 'assets/models/kage_blade.glb';
  const GLB_JS  = 'assets/models/kage_blade.glb.js';

  // 모델 치수 (모델 좌표, 칼끝이 +Y). 직접 측정한 값
  const GUARD_Y = -0.58;   // 쓰바(코등이)의 자루 쪽 면 = 손 기준점
  const WRAP_Y0 = -0.66;   // 자루 감기 시작 (쓰바 쪽)
  const WRAP_Y1 = -0.86;   // 자루 감기 끝 (폼멜 쪽)
  const TIP_Y   =  0.9476; // 칼끝
  const BUTT_Y  = -0.9525; // 폼멜 끝
  // 모델의 자루는 두 손이 들어가기엔 짧아서(칼날의 약 20%) 감기 부분만 늘린다 → 실제 일본도 비율(약 30%)
  const WRAP_STRETCH = 1.6;
  // 화면에서 손에 비해 자루가 너무 가늘어 보이지 않게 자루·폼멜만 살짝 굵게
  const GRIP_THICK = 1.18;

  const st = { ready:false, failed:false, gl:null, cv:null, prog:null, vao:null, count:0,
               u:{}, tex:[], tipLen:0, wrap0:0, wrap1:0, buttLen:0 };

  // ── GLB 읽기 ──────────────────────────────────────────────
  function parseGLB(buf){
    const dv = new DataView(buf);
    if (dv.getUint32(0,true) !== 0x46546C67) throw new Error('GLB 아님');
    let off = 12, json = null, bin = null;
    while (off < buf.byteLength){
      const len = dv.getUint32(off,true), type = dv.getUint32(off+4,true);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off+8, len)));
      else if (type === 0x004E4942) bin = new Uint8Array(buf, off+8, len);
      off += 8 + len;
    }
    if (!json || !bin) throw new Error('GLB 조각 없음');
    return { json, bin };
  }
  function accessor(g, i){
    const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView];
    const T = {5126:Float32Array, 5125:Uint32Array, 5123:Uint16Array, 5121:Uint8Array}[a.componentType];
    const n = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4}[a.type];
    if (bv.byteStride && bv.byteStride !== T.BYTES_PER_ELEMENT*n) throw new Error('stride 미지원');
    const start = g.bin.byteOffset + (bv.byteOffset||0) + (a.byteOffset||0);
    return new T(g.bin.buffer.slice(start, start + a.count*n*T.BYTES_PER_ELEMENT));
  }
  function imageBytes(g, i){
    const im = g.json.images[i], bv = g.json.bufferViews[im.bufferView];
    return new Blob([g.bin.subarray(bv.byteOffset||0, (bv.byteOffset||0)+bv.byteLength)], {type: im.mimeType});
  }
  function loadImage(blob){
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(blob); });
  }

  // ── 셰이더 ────────────────────────────────────────────────
  // 좌표: 화면 픽셀 공간 (x 오른쪽, y 아래, z 보는 사람 쪽). 정사영 → 2D 손과 위치가 정확히 맞는다
  const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv;
uniform mat3 uM; uniform vec3 uT; uniform vec2 uRes;
out vec3 vP; out vec3 vN; out vec2 vUv;
void main(){
  vec3 p = uM*aPos + uT;
  vP = p; vN = uM*aNor; vUv = aUv;
  gl_Position = vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, -p.z/4000.0, 1.0);
}`;
  // 금속 PBR(GGX) + 가짜 환경 반사 + 하늘색 발광선
  const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vUv;
uniform sampler2D uBase, uMR, uNrm;
uniform float uGlow, uGlint, uAlpha;
out vec4 o;
const float PI = 3.14159265;
vec3 env(vec3 r, float rough){
  // 위: 차가운 푸른 하늘빛, 아래: 어두운 바닥, 지평선 근처에 밝은 띠 (금속이 금속처럼 보이게)
  float up = -r.y;
  vec3 sky = mix(vec3(0.20,0.24,0.30), vec3(0.62,0.72,0.86), smoothstep(-0.1,0.9,up));
  vec3 col = mix(vec3(0.16,0.15,0.16), sky, smoothstep(-0.35,0.15,up));   // 바닥 쪽도 너무 검지 않게 (날이 까맣게 보이지 않도록)
  float band = exp(-pow((up-0.12)/(0.10+rough*0.5),2.0));
  col += vec3(1.0,0.97,0.92)*band*(1.2-rough);
  // 베기 때 날을 따라 지나가는 섬광
  float g = exp(-pow((r.x*0.8+up*0.6-uGlint)/(0.07+rough*0.3),2.0));
  col += vec3(0.85,0.95,1.0)*g*1.6*(1.0-rough*0.6);
  return col;
}
void main(){
  vec3 N = normalize(vN);
  if (N.z < 0.0) N = -N;                         // 양면 재질
  // 노멀맵: 탄젠트 데이터가 없어서 화면 미분으로 접선 공간을 만든다
  vec3 dp1 = dFdx(vP), dp2 = dFdy(vP); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
  vec3 dp2p = cross(dp2, N), dp1p = cross(N, dp1);
  vec3 T = dp2p*du1.x + dp1p*du2.x, B = dp2p*du1.y + dp1p*du2.y;
  float m = max(dot(T,T), dot(B,B));
  vec3 nm = texture(uNrm, vUv).xyz*2.0 - 1.0; nm.y = -nm.y;
  if (m > 1e-12){ float k = inversesqrt(m); N = normalize(mat3(T*k, B*k, N) * nm); }

  vec4 bs = texture(uBase, vUv);
  vec3 base = pow(bs.rgb, vec3(2.2));
  vec3 mr = texture(uMR, vUv).rgb;
  float rough = clamp(mr.g, 0.10, 1.0), metal = mr.b, ao = mix(1.0, mr.r, 0.6);
  vec3 V = vec3(0.0,0.0,1.0);
  float NdV = max(dot(N,V), 0.02);
  vec3 F0 = mix(vec3(0.04), base, metal);
  vec3 dif = base*(1.0-metal);
  float a2 = pow(rough*rough, 2.0);
  vec3 col = vec3(0.0);
  vec3 Ls[3]; vec3 Lc[3];
  Ls[0] = normalize(vec3(-0.45,-0.75,0.55)); Lc[0] = vec3(2.6,2.5,2.35);   // 왼쪽 위 앞 (주광)
  Ls[1] = normalize(vec3( 0.80,-0.10,0.45)); Lc[1] = vec3(0.55,0.70,1.00); // 오른쪽 (푸른 보조광)
  Ls[2] = normalize(vec3( 0.10,-0.60,-0.80)); Lc[2] = vec3(0.9,1.0,1.2);   // 뒤 위 (윤곽광)
  for (int i=0;i<3;i++){
    vec3 L = Ls[i]; float NdL = max(dot(N,L),0.0);
    if (NdL <= 0.0) continue;
    vec3 H = normalize(L+V); float NdH = max(dot(N,H),0.0);
    float d = NdH*NdH*(a2-1.0)+1.0; float D = a2/(PI*d*d);
    float kk = (rough+1.0)*(rough+1.0)/8.0;
    float G = (NdV/(NdV*(1.0-kk)+kk)) * (NdL/(NdL*(1.0-kk)+kk));
    vec3 F = F0 + (1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);
    vec3 spec = D*G*F/(4.0*NdV*NdL+1e-4);
    col += ((1.0-F)*dif/PI + spec) * Lc[i] * NdL;
  }
  vec3 Fr = F0 + (max(vec3(1.0-rough),F0)-F0)*pow(1.0-NdV,5.0);
  col += env(reflect(-V,N), rough) * Fr * ao;
  col += dif * vec3(0.16,0.18,0.22) * ao;       // 주변광
  // 하늘색 발광선: 텍스처에서 청록색인 부분만 스스로 빛남
  float cy = smoothstep(0.10,0.40, bs.b-bs.r) * smoothstep(0.45,0.80, bs.b);
  col += vec3(0.25,0.85,1.00) * cy * uGlow;
  col = col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);   // ACES 톤매핑
  col = pow(clamp(col,0.0,1.0), vec3(1.0/2.2));
  o = vec4(col*uAlpha, uAlpha);
}`;

  function compile(gl, type, src){
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  async function fetchGLB(){
    try {
      const r = await fetch(GLB_URL);
      if (!r.ok) throw new Error(r.status);
      return await r.arrayBuffer();
    } catch(e){
      // file:// 로 열었을 때: 스크립트 태그로 base64 판을 읽는다
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = GLB_JS; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const b64 = window.KAGE_BLADE_GLB_B64; if (!b64) throw new Error('모델 없음');
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    }
  }

  async function load(){
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:true, preserveDrawingBuffer:true});
      if (!gl) throw new Error('WebGL2 없음');
      const g = parseGLB(await fetchGLB());
      const prim = g.json.meshes[0].primitives[0], mat = g.json.materials[prim.material];
      const pos = accessor(g, prim.attributes.POSITION), nor = accessor(g, prim.attributes.NORMAL);
      const uv = accessor(g, prim.attributes.TEXCOORD_0), idx = accessor(g, prim.indices);

      // 손 기준점(쓰바 자루쪽 면)을 원점으로 옮기고, 자루 감기 부분만 길게 늘린다
      const wrapLen = WRAP_Y0 - WRAP_Y1, extra = wrapLen*(WRAP_STRETCH-1);
      for (let i=1;i<pos.length;i+=3){
        let y = pos[i];
        if (y < WRAP_Y1) y -= extra;                                        // 폼멜: 통째로 아래로
        else if (y < WRAP_Y0) y = WRAP_Y0 - (WRAP_Y0-y)*WRAP_STRETCH;       // 감기: 늘림
        if (pos[i] < GUARD_Y - 0.01){ pos[i-1] *= GRIP_THICK; pos[i+1] *= GRIP_THICK; }
        pos[i] = y - GUARD_Y;
      }
      st.tipLen  = TIP_Y - GUARD_Y;
      st.wrap0   = GUARD_Y - WRAP_Y0;
      st.wrap1   = GUARD_Y - WRAP_Y1 + extra;
      st.buttLen = GUARD_Y - BUTT_Y + extra;

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const attr = (name, data, n) => {
        const loc = gl.getAttribLocation(prog, name); if (loc < 0) return;
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
      };
      attr('aPos', pos, 3); attr('aNor', nor, 3); attr('aUv', uv, 2);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);

      const pbr = mat.pbrMetallicRoughness;
      const texIdx = [pbr.baseColorTexture.index, pbr.metallicRoughnessTexture.index, mat.normalTexture.index];
      const imgs = await Promise.all(texIdx.map(t => loadImage(imageBytes(g, g.json.textures[t].source))));
      st.tex = imgs.map(im => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return t;
      });

      for (const n of ['uM','uT','uRes','uBase','uMR','uNrm','uGlow','uGlint','uAlpha']) st.u[n] = gl.getUniformLocation(prog, n);
      Object.assign(st, { gl, cv, prog, vao, count: idx.length, ready: true });
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.ready = false; });
    } catch(e){
      st.failed = true;
      console.warn('[Kage3D] 3D 칼을 불러오지 못해 2D 칼을 씁니다:', e && e.message);
    }
  }

  // 칼 그리기
  //  ctx: 지금 변환이 걸린 2D 컨텍스트 (무기 위치·흔들림·크기 포함)
  //  o.px,o.py : 손 기준점(쓰바 자루쪽 면) — ctx 좌표
  //  o.dx,o.dy : 칼끝 방향 (ctx 화면 평면, 단위벡터)
  //  o.lean    : 보이는 길이 비율(1=화면과 나란함, 작을수록 칼끝이 화면 안쪽으로 들어감)
  //  o.roll    : 칼 축을 중심으로 한 비틀림(라디안). 0이면 날이 (dy,-dx) 쪽을 향함
  //  o.unit    : 모델 1단위 = ctx 몇 픽셀
  function draw(ctx, o){
    if (!st.ready) return false;
    const gl = st.gl, cv = st.cv, W = ctx.canvas.width, H = ctx.canvas.height;
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    const M = ctx.getTransform();
    const sc = Math.sqrt(Math.abs(M.a*M.d - M.b*M.c));
    const c = Math.max(0.2, Math.min(1, o.lean)), s = Math.sqrt(1 - c*c);
    // 보기 공간(y 위쪽): 칼 축 u, 날 방향 e, 면 방향 f
    const u = [o.dx*c, -o.dy*c, -s];
    const w0 = [o.dy, o.dx, 0];
    const n0 = [u[1]*w0[2]-u[2]*w0[1], u[2]*w0[0]-u[0]*w0[2], u[0]*w0[1]-u[1]*w0[0]];
    const cr = Math.cos(o.roll), sr = Math.sin(o.roll);
    const e = [w0[0]*cr+n0[0]*sr, w0[1]*cr+n0[1]*sr, w0[2]*cr+n0[2]*sr];
    const f = [u[1]*e[2]-u[2]*e[1], u[2]*e[0]-u[0]*e[2], u[0]*e[1]-u[1]*e[0]];   // u×e : 보는 사람 쪽 면
    // 모델 축 → 화면 픽셀: 모델 +X가 날(edge, 휘어진 바깥쪽), +Y가 칼끝, +Z가 무늬 있는 면(자루 마름모·하바키 보석)
    // 무늬 있는 면이 플레이어 쪽을 보도록 좌우 거울상으로 놓는다 (칼은 좌우 대칭에 가까워 티가 나지 않음)
    const D = v => [ (M.a*v[0] - M.c*v[1])*o.unit, (M.b*v[0] - M.d*v[1])*o.unit, v[2]*sc*o.unit ];
    const X = D(e), Y = D(u), Z = D(f);
    const T = [M.a*o.px + M.c*o.py + M.e, M.b*o.px + M.d*o.py + M.f, 0];

    // 칼이 차지하는 화면 영역만 지우고 옮겨 그린다 (빠르게)
    const ext = [[-0.13,0.13],[-(st.buttLen+0.02), st.tipLen+0.02],[-0.05,0.05]];
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for (const ax of ext[0]) for (const ay of ext[1]) for (const az of ext[2]){
      const px = T[0]+X[0]*ax+Y[0]*ay+Z[0]*az, py = T[1]+X[1]*ax+Y[1]*ay+Z[1]*az;
      if (px<x0) x0=px; if (px>x1) x1=px; if (py<y0) y0=py; if (py>y1) y1=py;
    }
    x0 = Math.max(0, Math.floor(x0)-4); y0 = Math.max(0, Math.floor(y0)-4);
    x1 = Math.min(W, Math.ceil(x1)+4);  y1 = Math.min(H, Math.ceil(y1)+4);
    if (x1 <= x0 || y1 <= y0) return true;

    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H-y1, x1-x0, y1-y0);
    gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    gl.useProgram(st.prog); gl.bindVertexArray(st.vao);
    gl.uniformMatrix3fv(st.u.uM, false, [...X, ...Y, ...Z]);
    gl.uniform3fv(st.u.uT, T); gl.uniform2f(st.u.uRes, W, H);
    gl.uniform1f(st.u.uGlow, o.glow ?? 1); gl.uniform1f(st.u.uGlint, o.glint ?? -9); gl.uniform1f(st.u.uAlpha, o.alpha ?? 1);
    ['uBase','uMR','uNrm'].forEach((n,i) => { gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D, st.tex[i]); gl.uniform1i(st.u[n], i); });
    gl.drawElements(gl.TRIANGLES, st.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null); gl.disable(gl.SCISSOR_TEST);

    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(cv, x0, y0, x1-x0, y1-y0, x0, y0, x1-x0, y1-y0);
    ctx.restore();
    return true;
  }

  return { load, draw, get ready(){ return st.ready; }, get failed(){ return st.failed; },
           get tipLen(){ return st.tipLen; }, get wrap0(){ return st.wrap0; },
           get wrap1(){ return st.wrap1; }, get buttLen(){ return st.buttLen; } };
})();

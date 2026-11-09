// ═══════════════════════════════════════════════════════════════
//  kage3d.js — 카게의 일본도와 두 손 3D 모델(GLB)을 그리는 작은 WebGL 표시기
//  · 외부 라이브러리 없음 (GLB 읽기 + 셰이더 직접 구현)
//  · 모델: assets/models/kage_blade.glb (칼, Meshy AI로 직접 제작)
//          assets/models/kage_hands.glb (두 손, Tripo로 직접 제작) — 둘 다 텍스처 1024px로 축소
//  · 서버 없이 index.html을 바로 열면(file://) fetch가 막히므로
//    같은 내용을 담은 *.glb.js(base64)를 대신 읽는다
//  · WebGL2가 없거나 읽기에 실패하면 ready=false 그대로 → 게임은 기존 2D 칼을 그린다
// ═══════════════════════════════════════════════════════════════
const Kage3D = (() => {
  const BLADE_URL = 'assets/models/kage_blade.glb', BLADE_JS = 'assets/models/kage_blade.glb.js';
  const HANDS_URL = 'assets/models/kage_hands.glb', HANDS_JS = 'assets/models/kage_hands.glb.js';

  // 손 모델(장갑 낀 손 하나, 주먹으로 자루를 쥔 자세)을 칼 자루에 맞추는 값 — 손 모델 좌표로 직접 측정
  //  c: 주먹이 쥔 자루 축의 가운데, a: 자루 축(칼끝 쪽), q: 팔 보호대 끝(구멍) 가운데, qr: 그 구멍 반지름, scale: 크기 배율
  //  (모델 속 자루 반지름 0.033 × 배율 1.25 ≈ 칼 자루 반지름 0.029 × GRIP_THICK 1.4 → 손가락이 자루에 딱 감김)
  //  두 손: y = 칼 자루 위치(쓰바 면에서 폼멜 쪽으로 음수), mirror = 거울상(같은 손 모델을 한쪽은 그대로, 한쪽은 뒤집어 씀)
  //  dir = 팔이 향할 화면 방향 [x 오른쪽, y 위쪽, z 보는 사람 쪽] — 칼을 어떻게 돌려도 팔은 늘 몸(화면 아래) 쪽으로
  //        (손목이 돌아가는 것처럼, 자루를 축으로 손을 돌려 팔 방향을 이쪽에 가장 가깝게 맞춤)
  const HAND_FIT = {
    c: [0.1523, -0.0487, -0.0747], a: [-0.1917, 0.8808, 0.4330], q: [-0.016, -0.365, -0.473], qr: 0.12, scale: 1.25,
    // 오른손(위, 쓰바 바로 아래): 모델 그대로 = 오른손 — 감싼 손가락 쪽이 보임
    // 왼손(아래, 자루 끝): 거울상 = 왼손 — 손등(갑옷 판) 쪽이 보임
    right: { y: -0.088, dir: [ 0.30, -1, -0.15], mirror: false },
    left:  { y: -0.445, dir: [-0.10, -1, -0.15], mirror: true  },
  };

  // 모델 치수 (모델 좌표, 칼끝이 +Y). 직접 측정한 값
  const GUARD_Y = -0.58;   // 쓰바(코등이)의 자루 쪽 면 = 손 기준점
  const WRAP_Y0 = -0.66;   // 자루 감기 시작 (쓰바 쪽)
  const WRAP_Y1 = -0.86;   // 자루 감기 끝 (폼멜 쪽)
  const TIP_Y   =  0.9476; // 칼끝
  const BUTT_Y  = -0.9525; // 폼멜 끝
  // 모델의 자루는 두 손이 들어가기엔 짧아서(칼날의 약 20%) 감기 부분만 늘린다 → 실제 일본도 비율(약 30%)
  const WRAP_STRETCH = 2.15;
  // 1인칭 화면에서 손이 너무 작아 보이지 않게 손을 1.25배로 키우고, 자루·폼멜도 그만큼 굵게 (손가락이 자루에 맞게)
  const GRIP_THICK = 1.4;

  const st = { ready:false, handsReady:false, failed:false, gl:null, cv:null, prog:null,
               blade:null, hands:null, u:{}, tipLen:0, wrap0:0, wrap1:0, buttLen:0 };

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

  // GLB 받기: 보통은 fetch, file://로 열었으면 같은 내용의 base64 스크립트를 읽는다
  async function fetchGLB(url, jsUrl, varName){
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      return await r.arrayBuffer();
    } catch(e){
      if (!window[varName]) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = jsUrl; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const b64 = window[varName]; if (!b64) throw new Error('모델 없음: ' + url);
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    }
  }

  // GLB 한 개를 GPU에 올린다. edit(pos)로 꼭짓점을 미리 손볼 수 있음
  async function uploadModel(gl, prog, buf, edit){
    const g = parseGLB(buf);
    const prim = g.json.meshes[0].primitives[0], mat = g.json.materials[prim.material];
    const pos = accessor(g, prim.attributes.POSITION), nor = accessor(g, prim.attributes.NORMAL);
    const uv = accessor(g, prim.attributes.TEXCOORD_0), idx = accessor(g, prim.indices);
    if (edit) edit(pos);
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
    const tex = imgs.map(im => {
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
    const itype = idx instanceof Uint32Array ? gl.UNSIGNED_INT : idx instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE;
    // 모델이 차지하는 상자 (화면 영역 계산용)
    const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
    for (let i=0;i<pos.length;i+=3) for (let k=0;k<3;k++){ const v = pos[i+k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
    return { vao, count: idx.length, itype, tex, mn, mx };
  }

  async function load(){
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:true, preserveDrawingBuffer:true});
      if (!gl) throw new Error('WebGL2 없음');
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      for (const n of ['uM','uT','uRes','uBase','uMR','uNrm','uGlow','uGlint','uAlpha']) st.u[n] = gl.getUniformLocation(prog, n);
      Object.assign(st, { gl, cv, prog });

      // 칼: 손 기준점(쓰바 자루쪽 면)을 원점으로 옮기고, 자루 감기 부분만 길게 늘린다
      const wrapLen = WRAP_Y0 - WRAP_Y1, extra = wrapLen*(WRAP_STRETCH-1);
      st.blade = await uploadModel(gl, prog, await fetchGLB(BLADE_URL, BLADE_JS, 'KAGE_BLADE_GLB_B64'), pos => {
        for (let i=1;i<pos.length;i+=3){
          let y = pos[i];
          if (y < WRAP_Y1) y -= extra;                                        // 폼멜: 통째로 아래로
          else if (y < WRAP_Y0) y = WRAP_Y0 - (WRAP_Y0-y)*WRAP_STRETCH;       // 감기: 늘림
          if (pos[i] < GUARD_Y - 0.01){ pos[i-1] *= GRIP_THICK; pos[i+1] *= GRIP_THICK; }
          pos[i] = y - GUARD_Y;
        }
      });
      st.tipLen  = TIP_Y - GUARD_Y;
      st.wrap0   = GUARD_Y - WRAP_Y0;
      st.wrap1   = GUARD_Y - WRAP_Y1 + extra;
      st.buttLen = GUARD_Y - BUTT_Y + extra;
      st.ready = true;
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.ready = false; st.handsReady = false; });

      // 손: 실패해도 칼은 그대로 쓰고 손만 2D로 그린다
      try {
        st.hands = await uploadModel(gl, prog, await fetchGLB(HANDS_URL, HANDS_JS, 'KAGE_HANDS_GLB_B64'));
        st.handsReady = true;
      } catch(e){ console.warn('[Kage3D] 3D 손을 불러오지 못해 2D 손을 씁니다:', e && e.message); }
    } catch(e){
      st.failed = true;
      console.warn('[Kage3D] 3D 칼을 불러오지 못해 2D 칼을 씁니다:', e && e.message);
    }
  }

  // 3x3 행렬(열 3개)·벡터 계산
  const mulMV = (A, v) => [A[0][0]*v[0]+A[1][0]*v[1]+A[2][0]*v[2], A[0][1]*v[0]+A[1][1]*v[1]+A[2][1]*v[2], A[0][2]*v[0]+A[1][2]*v[1]+A[2][2]*v[2]];
  const mulMM = (A, B) => B.map(col => mulMV(A, col));

  // 모델 하나를 화면 픽셀 공간 행렬(열 X,Y,Z)과 위치 T로 그린다
  function renderModel(m, cols, T, glow, glint){
    const gl = st.gl;
    gl.bindVertexArray(m.vao);
    gl.uniformMatrix3fv(st.u.uM, false, [...cols[0], ...cols[1], ...cols[2]]);
    gl.uniform3fv(st.u.uT, T);
    gl.uniform1f(st.u.uGlow, glow); gl.uniform1f(st.u.uGlint, glint);
    ['uBase','uMR','uNrm'].forEach((n,i) => { gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D, m.tex[i]); gl.uniform1i(st.u[n], i); });
    gl.drawElements(gl.TRIANGLES, m.count, m.itype, 0);
  }
  // 모델 상자가 화면에서 차지하는 영역을 rect에 넓혀 넣는다
  function grow(rect, m, cols, T){
    for (const ax of [m.mn[0], m.mx[0]]) for (const ay of [m.mn[1], m.mx[1]]) for (const az of [m.mn[2], m.mx[2]]){
      const x = T[0]+cols[0][0]*ax+cols[1][0]*ay+cols[2][0]*az, y = T[1]+cols[0][1]*ax+cols[1][1]*ay+cols[2][1]*az;
      rect[0] = Math.min(rect[0], x); rect[1] = Math.min(rect[1], y); rect[2] = Math.max(rect[2], x); rect[3] = Math.max(rect[3], y);
    }
  }
  // 여러 모델을 한 번에 그려서(서로 깊이로 가려짐) 2D 화면에 옮겨 붙인다. 바뀐 영역만 지우고 옮김 (빠르게)
  function renderAll(ctx, items){
    const gl = st.gl, cv = st.cv, W = ctx.canvas.width, H = ctx.canvas.height;
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    const r = [1e9,1e9,-1e9,-1e9];
    for (const it of items) grow(r, it.m, it.cols, it.T);
    const x0 = Math.max(0, Math.floor(r[0])-4), y0 = Math.max(0, Math.floor(r[1])-4);
    const x1 = Math.min(W, Math.ceil(r[2])+4),  y1 = Math.min(H, Math.ceil(r[3])+4);
    if (x1 <= x0 || y1 <= y0) return;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H-y1, x1-x0, y1-y0);
    gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    gl.useProgram(st.prog); gl.uniform2f(st.u.uRes, W, H); gl.uniform1f(st.u.uAlpha, 1);
    for (const it of items) renderModel(it.m, it.cols, it.T, it.glow, it.glint);
    gl.bindVertexArray(null); gl.disable(gl.SCISSOR_TEST);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(cv, x0, y0, x1-x0, y1-y0, x0, y0, x1-x0, y1-y0);
    ctx.restore();
  }

  // 손 좌표 → 칼 좌표 회전 (scale 포함). 손의 (팔 방향, 자루 축, 둘의 외적)을 칼의 (D1, +Y, D3)로 보낸다
  const handBasis = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const n = v => { const L = Math.hypot(v[0],v[1],v[2]); return v.map(x => x/L); };
      const a = n(HAND_FIT.a), w = HAND_FIT.q.map((x,i) => x - HAND_FIT.c[i]);
      const wa = w[0]*a[0]+w[1]*a[1]+w[2]*a[2];
      const e1 = n(w.map((x,i) => x - wa*a[i]));
      const e3 = [e1[1]*a[2]-e1[2]*a[1], e1[2]*a[0]-e1[0]*a[2], e1[0]*a[1]-e1[1]*a[0]];
      return (cache = [e1, a, e3]);
    };
  })();
  function handRot(h, sw){
    const [e1, e2, e3] = handBasis();
    // 원하는 팔 방향(화면)을 칼 좌표로 바꾸고 자루 축 성분을 뺀다 → 자루를 축으로 돈 방향 D1
    const g = h.dir, gx = g[0]*sw.e[0]+g[1]*sw.e[1]+g[2]*sw.e[2], gz = g[0]*sw.f[0]+g[1]*sw.f[1]+g[2]*sw.f[2];
    const gl = Math.hypot(gx, gz) || 1;
    const D1 = [gx/gl, 0, gz/gl];                               // 칼 좌표: +X 날 쪽, +Z 보는 사람 쪽
    const Y = [0, 1, 0];
    let D3 = [D1[1]*Y[2]-D1[2]*Y[1], D1[2]*Y[0]-D1[0]*Y[2], D1[0]*Y[1]-D1[1]*Y[0]];
    if (h.mirror) D3 = D3.map(x => -x);
    const k = HAND_FIT.scale;
    // 열 j = 손 좌표 단위벡터 j가 칼 좌표에서 가는 곳
    return [0,1,2].map(j => [0,1,2].map(i => k*(D1[i]*e1[j] + Y[i]*e2[j] + D3[i]*e3[j])));
  }

  // 칼(+손) 그리기
  //  ctx: 지금 변환이 걸린 2D 컨텍스트 (무기 위치·흔들림·크기 포함)
  //  o.px,o.py : 손 기준점(쓰바 자루쪽 면) — ctx 좌표
  //  o.dx,o.dy : 칼끝 방향 (ctx 화면 평면, 단위벡터)
  //  o.lean    : 보이는 길이 비율(1=화면과 나란함, 작을수록 칼끝이 화면 안쪽으로 들어감)
  //  o.roll    : 칼 축을 중심으로 한 비틀림(라디안). 0이면 날이 (dy,-dx) 쪽을 향함
  //  o.unit    : 모델 1단위 = ctx 몇 픽셀
  //  o.under(wrists): 3D를 그리기 직전에 부름 — 손을 3D로 그릴 때 두 팔 보호대 끝 {right,left: {end,dir,r}} (ctx 좌표)을 넘김
  function draw(ctx, o){
    if (!st.ready) return null;
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
    // 모델 축 → 화면 픽셀: 모델 -X가 날(edge — 칼날이 휘어진 바깥쪽, 더 얇은 쪽), +Y가 칼끝, +Z가 무늬 있는 면(자루 마름모·하바키 보석)
    // 날(-X)을 e(베는 방향 = 앞장서는 쪽)로 보낸다 → 모델 +X는 -e. 회전만 쓰므로 거울상 없음
    const D = v => [ (M.a*v[0] - M.c*v[1])*o.unit, (M.b*v[0] - M.d*v[1])*o.unit, v[2]*sc*o.unit ];
    const ex = e.map(x => -x);
    const B = [D(ex), D(u), D(f)];
    const T = [M.a*o.px + M.c*o.py + M.e, M.b*o.px + M.d*o.py + M.f, 0];
    const items = [{ m: st.blade, cols: B, T, glow: o.glow ?? 1, glint: o.glint ?? -9 }];
    let wrists = {};
    if (st.handsReady && o.hands !== false){
      // 칼 좌표의 손 하나 = 칼 화면 행렬 B × (손 좌표 → 칼 좌표 회전 R) — 손이 칼과 한 몸처럼 같이 움직임
      const inv = M.inverse();
      const toCtx = (cols, Tp, p) => { const r = mulMV(cols, p); const x = Tp[0]+r[0], y = Tp[1]+r[1]; return [inv.a*x+inv.c*y+inv.e, inv.b*x+inv.d*y+inv.f]; };
      for (const side of ['right','left']){
        const h = HAND_FIT[side], R = handRot(h, { e: ex, f });
        const Hc = mulMM(B, R);
        const off = mulMV(R, HAND_FIT.c.map(x => -x)); off[1] += h.y;
        const bo = mulMV(B, off), HT = [T[0]+bo[0], T[1]+bo[1], T[2]+bo[2]];
        items.push({ m: st.hands, cols: Hc, T: HT, glow: 0.25, glint: -9 });
        // 팔 보호대 끝: 위치·팔이 뻗는 방향·굵기 (ctx 좌표) — 그 뒤로 2D 소매를 이어 그림
        const end = toCtx(Hc, HT, HAND_FIT.q), fist = toCtx(Hc, HT, HAND_FIT.c);
        const L = Math.hypot(end[0]-fist[0], end[1]-fist[1]) || 1;
        wrists[side] = { end, dir: [(end[0]-fist[0])/L, (end[1]-fist[1])/L], r: HAND_FIT.qr*HAND_FIT.scale*o.unit };
      }
    }
    if (o.under) o.under(wrists);                     // 3D보다 뒤에 깔릴 2D 그림(소매)
    renderAll(ctx, items);
    return wrists;
  }

  // 모델 하나를 아무 방향으로 보기 (모델 확인용)
  function view(ctx, name, cols, T){ if (st.ready && st[name]) renderAll(ctx, [{ m: st[name], cols, T, glow: 1, glint: -9 }]); }

  return { load, draw, view, fit: HAND_FIT,
           get ready(){ return st.ready; }, get handsReady(){ return st.handsReady; }, get failed(){ return st.failed; },
           get tipLen(){ return st.tipLen; }, get wrap0(){ return st.wrap0; },
           get wrap1(){ return st.wrap1; }, get buttLen(){ return st.buttLen; } };
})();

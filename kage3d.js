// ═══════════════════════════════════════════════════════════════
//  kage3d.js — 카게의 일본도와 두 팔 3D 모델(GLB)을 그리는 작은 WebGL 표시기
//  · 외부 라이브러리 없음 (GLB 읽기 + 셰이더 직접 구현)
//  · 모델: assets/models/kage_blade.glb (칼, Meshy AI로 직접 제작)
//          assets/models/kage_arms.glb  (칼을 두 손으로 쥔 두 팔, Meshy AI로 직접 제작 — 원래 들어 있던 칼은 잘라냄)
//          둘 다 텍스처 1024px로 축소
//  · 1인칭 원근: 팔과 칼이 한 몸으로, 화면 아래 밖의 어깨를 축으로 돌아 손과 칼이 호를 그림
//  · 서버 없이 index.html을 바로 열면(file://) fetch가 막히므로 같은 내용을 담은 *.glb.js(base64)를 대신 읽는다
//  · WebGL2가 없거나 칼을 못 읽으면 ready=false → 게임은 2D 칼, 팔만 못 읽으면 3D 칼 + 2D 손
// ═══════════════════════════════════════════════════════════════
const Kage3D = (() => {
  const BLADE_URL = 'assets/models/kage_blade.glb', BLADE_JS = 'assets/models/kage_blade.glb.js';
  const ARMS_URL  = 'assets/models/kage_arms.glb',  ARMS_JS  = 'assets/models/kage_arms.glb.js';

  // 칼 모델 치수 (모델 좌표, 칼끝이 +Y). 직접 측정한 값
  const GUARD_Y = -0.58;   // 쓰바(코등이)의 자루 쪽 면 = 손 기준점
  const WRAP_Y0 = -0.66;   // 자루 감기 시작 (쓰바 쪽)
  const WRAP_Y1 = -0.86;   // 자루 감기 끝 (폼멜 쪽)
  const TIP_Y   =  0.9476; // 칼끝
  const BUTT_Y  = -0.9525; // 폼멜 끝
  // 모델의 자루는 두 주먹이 들어가기엔 짧아서 감기 부분만 늘림 → 팔 모델의 두 주먹(쓰바 아래 ~ 폼멜) 길이에 맞춤
  const WRAP_STRETCH = 2.85;
  // 자루·폼멜을 굵게 → 팔 모델 주먹 속 자루 굵기(반지름 약 0.035~0.04)에 맞춤
  const GRIP_THICK = 1.55;

  // 두 팔 모델 치수 (팔 모델 좌표: x 오른쪽, y 위, z 보는 사람(어깨) 쪽). 직접 측정한 값
  //  c·axis: 두 주먹이 쥔 자루 축(칼끝 쪽 방향), guardT: 축 위 코등이 자리(여기에 칼 쓰바 면을 놓음)
  //  gripT: 두 주먹 가운데, pivot: 어깨 사이(팔 끝) — 이 점을 축으로 돌림
  //  swordScale: 칼 크기 배율, focal: 원근 초점 거리(화면 높이 720 기준 픽셀), twist: 칼을 자루 축으로 비튼 각도(칼면이 보이게)
  //  gripD: 두 주먹이 눈에서 떨어진 거리 (1 = 화면 면, 작을수록 가까이·크게)
  const RIG = {
    c: [0.009, 0.612, -0.4285], axis: [0.0097, 0.9801, -0.1984],
    guardT: -0.715, gripT: -1.0, pivot: [0, -0.9, 0.35],
    swordScale: 0.8, focal: 500, twist: -0.75, gripD: 0.62,
  };

  const st = { ready:false, rigReady:false, failed:false, gl:null, cv:null, prog:null,
               blade:null, arms:null, u:{}, tipLen:0, wrap0:0, wrap1:0, buttLen:0 };

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
  // 좌표: 화면 픽셀 공간 (x 오른쪽, y 아래, z 보는 사람 쪽)
  // uF > 0 이면 1인칭 원근 카메라: 눈은 화면 가운데 uC 앞 z = uF 에 있음. 가까울수록 크게, 눈 뒤(가까운 면 앞)는 잘림
  //  (깊이 d = 1 - z/uF : 1이면 화면 면, 0이면 눈. 동차 좌표로 내보내 GPU가 원근 보간·근평면 자르기를 함)
  const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv;
uniform mat3 uM; uniform vec3 uT; uniform vec2 uRes; uniform float uF; uniform vec2 uC;
out vec3 vP; out vec3 vN; out vec2 vUv;
void main(){
  vec3 p = uM*aPos + uT;
  vP = p; vN = uM*aNor; vUv = aUv;
  if (uF > 0.0){
    float d = 1.0 - p.z/uF;                                   // 눈에서의 거리 (화면 면 = 1)
    const float dn = 0.12, df = 8.0;                          // 가까운 면 / 먼 면
    float k = 1.0/dn - 1.0/df;
    vec2 c = vec2(uC.x/uRes.x*2.0-1.0, 1.0-uC.y/uRes.y*2.0);
    vec2 r = vec2((p.x-uC.x)/uRes.x*2.0, -(p.y-uC.y)/uRes.y*2.0);
    gl_Position = vec4(c*d + r, 2.0*(d/dn - 1.0)/k - d, d);
  } else {
    gl_Position = vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, -p.z/4000.0, 1.0);
  }
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
      for (const n of ['uM','uT','uRes','uF','uC','uBase','uMR','uNrm','uGlow','uGlint','uAlpha']) st.u[n] = gl.getUniformLocation(prog, n);
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
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.ready = false; st.rigReady = false; });

      // 두 팔(칼 쥔 자세): 실패해도 칼은 그대로 쓰고 손만 2D로 그린다
      try {
        st.arms = await uploadModel(gl, prog, await fetchGLB(ARMS_URL, ARMS_JS, 'KAGE_ARMS_GLB_B64'));
        st.rigReady = true;
      } catch(e){ console.warn('[Kage3D] 3D 팔을 불러오지 못해 2D 손을 씁니다:', e && e.message); }
    } catch(e){
      st.failed = true;
      console.warn('[Kage3D] 3D 칼을 불러오지 못해 2D 칼을 씁니다:', e && e.message);
    }
  }

  // ── 행렬·투영 도우미 ───────────────────────────────────────
  const mulMV = (A, v) => [A[0][0]*v[0]+A[1][0]*v[1]+A[2][0]*v[2], A[0][1]*v[0]+A[1][1]*v[1]+A[2][1]*v[2], A[0][2]*v[0]+A[1][2]*v[1]+A[2][2]*v[2]];
  const mulMM = (A, B) => B.map(col => mulMV(A, col));
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const norm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return v.map(x => x/L); };
  // 화면 픽셀 공간의 점 p(z = 보는 사람 쪽) → 원근 투영된 화면 위치 (셰이더와 같은 식)
  function project(p, F, C){
    if (!F) return [p[0], p[1]];
    const w = 1 - p[2]/F;
    if (w < 0.12) return null;                                 // 눈 뒤 (잘림)
    return [C[0] + (p[0]-C[0])/w, C[1] + (p[1]-C[1])/w];
  }

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
  function grow(rect, m, cols, T, F, C){
    for (const ax of [m.mn[0], m.mx[0]]) for (const ay of [m.mn[1], m.mx[1]]) for (const az of [m.mn[2], m.mx[2]]){
      const p = [T[0]+cols[0][0]*ax+cols[1][0]*ay+cols[2][0]*az, T[1]+cols[0][1]*ax+cols[1][1]*ay+cols[2][1]*az, T[2]+cols[0][2]*ax+cols[1][2]*ay+cols[2][2]*az];
      const q = project(p, F, C);
      if (!q){ rect[0] = -1e9; rect[1] = -1e9; rect[2] = 1e9; rect[3] = 1e9; return; }   // 눈 가까이까지 오면 화면 전체
      const [x, y] = q;
      rect[0] = Math.min(rect[0], x); rect[1] = Math.min(rect[1], y); rect[2] = Math.max(rect[2], x); rect[3] = Math.max(rect[3], y);
    }
  }
  // 여러 모델을 한 번에 그려서(서로 깊이로 가려짐) 2D 화면에 옮겨 붙인다. 차지한 영역만 지우고 옮김 (빠르게)
  //  F: 원근 초점 거리(픽셀, 0이면 원근 없음), C: 원근 중심(화면 가운데)
  function renderAll(ctx, items, F, C){
    const gl = st.gl, cv = st.cv, W = ctx.canvas.width, H = ctx.canvas.height;
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    F = F || 0; C = C || [W/2, H/2];
    const r = [1e9,1e9,-1e9,-1e9];
    for (const it of items) grow(r, it.m, it.cols, it.T, F, C);
    const x0 = Math.max(0, Math.floor(r[0])-4), y0 = Math.max(0, Math.floor(r[1])-4);
    const x1 = Math.min(W, Math.ceil(r[2])+4),  y1 = Math.min(H, Math.ceil(r[3])+4);
    if (x1 <= x0 || y1 <= y0) return;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H-y1, x1-x0, y1-y0);
    gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    gl.useProgram(st.prog); gl.uniform2f(st.u.uRes, W, H); gl.uniform1f(st.u.uAlpha, 1);
    gl.uniform1f(st.u.uF, F); gl.uniform2f(st.u.uC, C[0], C[1]);
    for (const it of items) renderModel(it.m, it.cols, it.T, it.glow, it.glint);
    gl.bindVertexArray(null); gl.disable(gl.SCISSOR_TEST);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(cv, x0, y0, x1-x0, y1-y0, x0, y0, x1-x0, y1-y0);
    ctx.restore();
  }

  // 칼만 그리기 (3D 팔을 못 읽었을 때 — 손은 게임이 2D로 그림). 정사영
  //  o.px,o.py : 손 기준점(쓰바 자루쪽 면) — ctx 좌표,  o.dx,o.dy : 칼끝 방향(ctx 화면 평면, 단위벡터)
  //  o.lean : 보이는 길이 비율(1=화면과 나란함),  o.roll : 칼 축 비틀림,  o.unit : 모델 1단위 = ctx 몇 픽셀
  function draw(ctx, o){
    if (!st.ready) return null;
    const M = ctx.getTransform();
    const sc = Math.sqrt(Math.abs(M.a*M.d - M.b*M.c));
    const c = Math.max(0.2, Math.min(1, o.lean)), s = Math.sqrt(1 - c*c);
    // 보기 공간(y 위쪽): 칼 축 u, 날 방향 e(베는 방향), 면 방향 f
    const u = [o.dx*c, -o.dy*c, -s];
    const w0 = [o.dy, o.dx, 0];
    const n0 = cross(u, w0);
    const cr = Math.cos(o.roll), sr = Math.sin(o.roll);
    const e = [w0[0]*cr+n0[0]*sr, w0[1]*cr+n0[1]*sr, w0[2]*cr+n0[2]*sr];
    const f = cross(u, e);   // 보는 사람 쪽 면
    // 모델 -X(날 — 칼날이 휘어진 바깥쪽, 더 얇은 쪽)를 e로, +Y(칼끝)를 u로, +Z(무늬 있는 면)를 f로. 회전만 씀
    const D = v => [ (M.a*v[0] - M.c*v[1])*o.unit, (M.b*v[0] - M.d*v[1])*o.unit, v[2]*sc*o.unit ];
    const B = [D(e.map(x => -x)), D(u), D(f)];
    const T = [M.a*o.px + M.c*o.py + M.e, M.b*o.px + M.d*o.py + M.f, 0];
    renderAll(ctx, [{ m: st.blade, cols: B, T, glow: o.glow ?? 1, glint: o.glint ?? -9 }], 0);
    return {};
  }

  // 회전 행렬(보기 공간, y 위쪽): roll(화면 안 돌림) · pitch(칼끝이 앞뒤로) · yaw(좌우로 돌림)
  function poseRot(pitch, yaw, roll){
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
    const Rx = [[1,0,0],[0,cp,sp],[0,-sp,cp]];          // 열 3개. pitch>0: 칼끝(+y)이 보는 사람 쪽으로
    const Ry = [[cy,0,-sy],[0,1,0],[sy,0,cy]];          // yaw>0: 앞(-z)이 왼쪽으로
    const Rz = [[cr,sr,0],[-sr,cr,0],[0,0,1]];          // roll>0: 칼끝이 왼쪽으로 (반시계)
    return mulMM(Rz, mulMM(Rx, Ry));
  }

  // 두 팔 + 칼 그리기 (1인칭 원근). 팔·칼이 한 몸 — 어깨(화면 아래 밖)를 축으로 돌아서 손과 칼이 호를 그리며 움직임
  //  p.x,p.y : 두 주먹 가운데의 ctx 좌표(원근 전),  p.pitch/yaw/roll : 어깨를 축으로 한 회전(라디안),  p.scale : 모델 1단위 = 픽셀
  //  p.twist : 손 안에서 칼을 자루 축으로 돌린 각도 — 날이 베는 방향을 향하게
  //  돌려주는 값: 칼끝·칼 중간·주먹의 ctx 좌표 {tip, mid, grip} — 궤적·빛 효과용
  function drawRig(ctx, p){
    if (!st.ready || !st.rigReady) return null;
    const M = ctx.getTransform(), W = ctx.canvas.width, H = ctx.canvas.height;
    const sc = Math.sqrt(Math.abs(M.a*M.d - M.b*M.c));
    const R = poseRot(p.pitch, p.yaw, p.roll);
    const k = p.scale;
    // 보기 공간 → 화면 픽셀 (y 뒤집기 + ctx 변환), 크기 k 포함
    const D = v => [ (M.a*v[0] - M.c*v[1])*k, (M.b*v[0] - M.d*v[1])*k, v[2]*sc*k ];
    const A = mulMM(R, [[1,0,0],[0,1,0],[0,0,1]]).map(D);     // 팔 모델 → 화면
    const F = RIG.focal * Math.min(W, H) / 720, C = [W/2, H/2];
    // p.x,p.y 는 두 주먹(가운데)의 위치. 주먹은 늘 눈에서 같은 거리(gripD)에 두고, 어깨(돌림 축)는 거꾸로 계산
    //  → 손이 카메라로 달려들지 않고, 팔 끝(어깨 쪽)은 눈 옆·뒤에 있어 화면에 안 보임
    const ax0 = norm(RIG.axis);
    const gripM = RIG.c.map((x,i) => x + ax0[i]*RIG.gripT);
    const rel = mulMV(A, gripM.map((x,i) => x - RIG.pivot[i]));
    const G = [M.a*p.x + M.c*p.y + M.e, M.b*p.x + M.d*p.y + M.f];
    const zg = F*(1 - RIG.gripD*(p.depth ?? 1));                // 주먹 깊이 (p.depth로 앞뒤로 조금 밀고 당김)
    const T0 = [G[0]-rel[0], G[1]-rel[1], zg - rel[2]];
    const at = q => { const d = mulMV(A, q.map((x,i) => x - RIG.pivot[i])); return [T0[0]+d[0], T0[1]+d[1], T0[2]+d[2]]; };
    // 칼 → 팔 모델 좌표: 칼 +Y = 자루 축, 칼 -X(날) = 앞(팔 모델 -z를 축에 수직으로), 칼 쓰바 면 = 팔 모델의 코등이 자리
    const ax = norm(RIG.axis);
    const fw = norm((() => { const z = [0,0,-1], d = z[0]*ax[0]+z[1]*ax[1]+z[2]*ax[2]; return z.map((x,i) => x - d*ax[i]); })());
    // twist: 칼을 자루 축으로 비틂 — 날이 정면만 향하면 뒤에서 칼등만 보여 가는 선이 되므로, 칼면이 보이게 조금 돌림
    //  날 방향 = 앞·cos(tw) + 오른쪽·sin(tw)  (tw<0 이면 앞-왼쪽, tw>0 이면 앞-오른쪽) → 베는 방향 쪽으로 날을 돌림
    const tw = p.twist ?? RIG.twist;
    const kx0 = fw.map(x => -x), kz0 = cross(kx0, ax), ct = Math.cos(tw), stw = Math.sin(tw);
    const kx = kx0.map((x,i) => x*ct + kz0[i]*stw), kz = kz0.map((x,i) => -kx0[i]*stw + x*ct);
    const s = RIG.swordScale;
    const Ks = [kx.map(x => x*s), ax.map(x => x*s), kz.map(x => x*s)];
    const guard = RIG.c.map((x,i) => x + ax[i]*RIG.guardT);
    const Bc = mulMM(A, Ks), BT = at(guard);
    const items = [
      { m: st.arms,  cols: A,  T: at([0,0,0]), glow: 0.35, glint: -9 },
      { m: st.blade, cols: Bc, T: BT,          glow: p.glow ?? 1, glint: p.glint ?? -9 },
    ];
    renderAll(ctx, items, F, C);
    // 칼끝·중간·주먹 위치 (원근 투영 후 → ctx 좌표)
    const inv = M.inverse();
    const toCtx = q => { const r = project(q, F, C) || [C[0], C[1]]; const x = r[0], y = r[1]; return [inv.a*x+inv.c*y+inv.e, inv.b*x+inv.d*y+inv.f]; };
    const bladePt = t => { const d = mulMV(Bc, [0, t, 0]); return [BT[0]+d[0], BT[1]+d[1], BT[2]+d[2]]; };
    return { tip: toCtx(bladePt(st.tipLen)), mid: toCtx(bladePt(st.tipLen*0.6)), grip: toCtx(at(gripM)) };
  }

  // 모델 하나를 아무 방향으로 보기 (모델 확인용)
  function view(ctx, name, cols, T){ if (st.ready && st[name]) renderAll(ctx, [{ m: st[name], cols, T, glow: 1, glint: -9 }], 0); }

  return { load, draw, drawRig, view, rig: RIG,
           get ready(){ return st.ready; }, get rigReady(){ return !!st.rigReady; }, get failed(){ return st.failed; },
           get tipLen(){ return st.tipLen; }, get wrap0(){ return st.wrap0; },
           get wrap1(){ return st.wrap1; }, get buttLen(){ return st.buttLen; } };
})();

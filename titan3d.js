// ═══════════════════════════════════════════════════════════════
//  titan3d.js — 타이탄(탱커)의 1인칭 3D 장비: 전투 망치 SENTINEL MAUL + 장갑 두 팔 + 육각 방어막
//  · 공용 엔진 fp3d.js 위에서 망치 모델과 방어막 셰이더만 정의한다
//  · 두 손은 자루를 감아 쥔 채 망치에 붙어 있고, 팔은 관절 계산으로 따라온다
//  · 방어막: 굽은 판 위에 육각 벌집 무늬를 셰이더로 그림 (펼쳐짐·피격 물결·꺼짐 연출)
//  · WebGL2가 없으면 ready=false → 게임은 예전 2D 망치·방벽을 그대로 쓴다
// ═══════════════════════════════════════════════════════════════
const Titan3D = (() => {
  'use strict';
  const { add, sub, mul, mv, rotX, rotY, rotZ, matFromQuat } = FP3D.V;
  const { Builder, STEEL, DARK } = FP3D, PAL = FP3D.PAL_TITAN;
  const GUN = ['#565d68', 1, 0.44], RUB = ['#0e0f12', 0, 0.82], ORG = PAL.trim, GLOW = PAL.glow;
  // 그림판 영역 (512×512): 명판 / 계기판 / 팔 글자
  const R_PLATE = [0, 0, 1, 0.5], R_GAUGE = [0, 0.5, 0.5, 1], R_LABEL = [0.5, 0.5, 1, 0.75];

  // 망치 치수 (망치 좌표: 자루 = +y, 자루 끝(폼멜) = 원점, 타격면 = -z, 에너지 셀 = +z)
  const HY = 0.70;                       // 머리 중심 높이
  const HAND_L = 0.135, HAND_R = 0.345;  // 두 손이 쥐는 높이
  const GRIP_Y = 0.24;                   // 자세의 기준점 (두 손 사이)

  function buildHammer(){
    const b = Builder(), Y = [0,1,0], Zr = [0,0,1];
    const L = (secs, n, o) => b.lathe([0,0,0], Y, Zr, secs, n, o);
    // ─ 자루 ─
    b.mat(...STEEL); L([[-0.034,0.014],[-0.028,0.030],[0.0,0.035],[0.014,0.035],[0.022,0.024]], 8);       // 폼멜
    b.mat(...ORG);   L([[0.022,0.0285],[0.034,0.0285]], 16, {smooth:true});
    b.mat('#2a2e34', 1, 0.32); L([[0.034,0.0205],[0.56,0.0205]], 16, {smooth:true, cap0:false, cap1:false}); // 자루 심
    for (const [y0, y1] of [[0.05,0.222],[0.262,0.435]]){                                                  // 손잡이 감기 2곳
      b.mat(...RUB); L([[y0,0.0238],[y1,0.0238]], 16, {smooth:true});
      b.mat('#1b1d22', 0.1, 0.6);
      for (let y=y0+0.008; y<y1-0.008; y+=0.0152) L([[y,0.0238],[y+0.002,0.0262],[y+0.0065,0.0262],[y+0.0085,0.0238]], 16, {smooth:true, cap0:false, cap1:false});
    }
    b.mat(...STEEL); L([[0.226,0.024],[0.231,0.0315],[0.253,0.0315],[0.258,0.024]], 8);                    // 두 손 사이 고리
    b.mat(...STEEL); L([[0.44,0.024],[0.446,0.033],[0.476,0.033],[0.482,0.026]], 8);                       // 윗고리
    b.mat(...ORG);   L([[0.484,0.0285],[0.496,0.0285]], 16, {smooth:true});
    b.mat(GLOW, 0, 0.3, 2.6, 5); L([[0.505,0.0262],[0.519,0.0262]], 16, {smooth:true});                    // 푸른 빛 고리
    b.mat(...DARK);  L([[0.527,0.0245],[0.545,0.030],[0.562,0.047],[HY-0.105,0.052]], 8);                   // 머리 받침 목
    b.mat(...GUN);   b.box([0,HY-0.118,0], [0.125,0.03,0.15], 0.009);
    for (const sx of [-1,1]){ b.mat(...STEEL); b.lathe([sx*0.045,HY-0.136,0.05], Y, Zr, [[0,0.008],[0.012,0.008]], 6);
                              b.lathe([sx*0.045,HY-0.136,-0.05], Y, Zr, [[0,0.008],[0.012,0.008]], 6); }

    // ─ 머리 ─
    b.mat(...GUN);  b.box([0,HY,-0.02], [0.176,0.206,0.33], 0.016);                                        // 몸통
    b.mat(...DARK); b.box([0,HY,-0.166], [0.196,0.226,0.03], 0.008);                                        // 목 띠
    b.mat('#565d67', 1, 0.40); b.box([0,HY,-0.215], [0.216,0.250,0.072], 0.02);                             // 타격 블록
    b.mat(...STEEL); b.box([0,HY,-0.258], [0.172,0.204,0.022], 0.009);                                      // 타격면
    b.mat('#9aa2ad', 1, 0.30);
    for (const sx of [-1,1]) for (const sy of [-1,1])                                                       // 타격면 징 4개
      b.lathe([sx*0.05,HY+sy*0.062,-0.268], [0,0,-1], Y, [[0,0.021],[0.018,0.007]], 4, {phase:Math.PI/4});
    b.mat(GLOW, 0, 0.3, 2.2, 4); b.box([0,HY,-0.2695], [0.058,0.012,0.003]); b.box([0,HY,-0.2695], [0.012,0.058,0.003]);   // 타격면 십자 (휘두를 때 달아오름)
    // 가시: 타격 블록 위·아래 + 몸통 뒤쪽
    b.mat('#8c949f', 1, 0.30);
    for (const sx of [-1,1]){
      b.lathe([sx*0.062,HY+0.118,-0.215], Y, Zr, [[0,0.024],[0.012,0.022],[0.085,0]], 6);
      b.lathe([sx*0.062,HY-0.118,-0.215], [0,-1,0], Zr, [[0,0.022],[0.055,0]], 6);
      b.lathe([sx*0.050,HY+0.100,-0.105], Y, Zr, [[0,0.018],[0.010,0.016],[0.060,0]], 6);
      b.lathe([sx*0.104,HY+0.062,-0.215], [sx,0,0], Y, [[0,0.020],[0.055,0]], 6);
    }
    // 타격 블록 옆면의 푸른 세로 틈
    b.mat(GLOW, 0, 0.3, 2.4, 5);
    for (const sx of [-1,1]) for (const z of [-0.198,-0.218,-0.238]) b.box([sx*0.1075,HY-0.03,z], [0.004,0.10,0.008]);
    // 윗면 장갑판 + 푸른 선
    b.mat('#4a515b', 1, 0.42); b.box([0,HY+0.108,0.005], [0.132,0.02,0.20], 0.007);
    b.mat(GLOW, 0, 0.3, 2.0, 5); b.box([0,HY+0.1185,0.005], [0.012,0.003,0.15]);
    // 옆면: 명판(글자) + 푸른 띠 + 볼트
    for (const sx of [-1,1]){
      b.mat('#4d545e', 1, 0.44); b.box([sx*0.092,HY+0.022,-0.02], [0.016,0.128,0.215], 0.006);
      b.mat('#ffffff', 0.85, 0.42); b.decal([sx*0.1008,HY+0.022,-0.02], [0,0,-sx], Y, 0.196, 0.108, R_PLATE);
      b.mat(GLOW, 0, 0.3, 2.4, 5); b.box([sx*0.0895,HY-0.066,-0.02], [0.006,0.012,0.215]);
      b.mat('#a4acb7', 1, 0.3);
      for (const z of [-0.118,0.078]) for (const y of [-0.035,0.079]) b.lathe([sx*0.098,HY+y,z], [sx,0,0], Y, [[0,0.0065],[0.006,0.0065]], 6);
      b.mat(...ORG); b.box([sx*0.0895,HY-0.088,0.07], [0.006,0.016,0.07], 0.002);                           // 주황 표식
    }
    // 뒤쪽 덮개 + 방열 홈
    b.mat('#484e58', 1, 0.48); b.box([0,HY+0.034,0.168], [0.186,0.142,0.074], 0.016);
    b.mat(...DARK); for (const y of [0.0,0.03,0.06]) b.box([0,HY+y,0.2065], [0.12,0.012,0.006], 0.002);
    b.mat(...ORG); b.box([0,HY+0.094,0.2055], [0.13,0.008,0.006]);
    // 에너지 셀 3개 (뒤 아래쪽으로 튀어나온 푸른 원통)
    [-0.062, 0, 0.062].forEach((x, i) => {
      const o = [x, HY-0.066, 0], Lz = (secs, n, o2) => b.lathe(o, Zr, Y, secs, n, o2);
      b.mat(...STEEL); Lz([[0.10,0.030],[0.128,0.030],[0.132,0.027]], 12, {smooth:true});
      b.mat('#4fa6ff', 0, 0.25, 1.5, i+1); Lz([[0.132,0.0258],[0.236,0.0258]], 14, {smooth:true, cap0:false, cap1:false});
      b.mat('#15171b', 0.6, 0.5);
      for (const z of [0.157,0.197]) Lz([[z,0.0285],[z+0.013,0.0285]], 12, {smooth:true});
      b.mat(...STEEL); Lz([[0.236,0.027],[0.240,0.030],[0.258,0.030],[0.264,0.022]], 12, {smooth:true});
      b.mat('#4fa6ff', 0, 0.25, 1.5, i+1); Lz([[0.2645,0.013],[0.266,0.013]], 10, {smooth:true});
    });
    b.mat(...DARK); b.box([0,HY-0.066,0.118], [0.20,0.076,0.04], 0.008);                                    // 셀 고정대
    return b.data();
  }

  // 팔뚝 덧붙임: 오른팔 안쪽(손바닥 쪽)에 방어막 충전 계기판, 왼팔 손등 쪽에 부대 글자
  const gaugeExtra = b => {
    b.mat(...DARK); b.lathe([0,-0.036,0.118], [0,-1,0], [0,0,1], [[0,0.040],[0.012,0.040],[0.016,0.036]], 16, {smooth:true});
    b.mat(...ORG);  b.lathe([0,-0.050,0.118], [0,-1,0], [0,0,1], [[0,0.0385],[0.006,0.0385],[0.006,0.031],[0.002,0.031]], 20, {smooth:true, cap0:false, cap1:false});
    b.mat('#ffffff', 0, 0.35, 1.6); b.decal([0,-0.0535,0.118], [-1,0,0], [0,0,-1], 0.062, 0.062, R_GAUGE);
  };
  const labelExtra = b => { b.mat('#ffffff', 0.5, 0.4, 0.9); b.decal([0,0.0516,0.118], [1,0,0], [0,0,-1], 0.05, 0.072, R_LABEL); };

  // 방어막: 굽은 판. aPos.xy = 판 위의 자리(-1~1)
  const SVS = `#version 300 es
in vec2 aPos;
uniform vec4 uProj; uniform vec4 uDim;   // 반너비, 반높이, 거리, 굽은 정도
uniform vec2 uOff;
out vec2 vQ; out vec3 vP;
void main(){
  vec2 q = aPos; vQ = q;
  vec3 p = vec3(q.x*uDim.x + uOff.x, q.y*uDim.y + uOff.y, -uDim.z + uDim.w*(q.x*q.x*1.0 + q.y*q.y*0.45));
  vP = p;
  gl_Position = vec4(p.x*uProj.x, p.y*uProj.y, p.z*uProj.z + uProj.w, -p.z);
}`;
  const SFS = `#version 300 es
precision highp float;
in vec2 vQ; in vec3 vP;
uniform vec4 uDim; uniform float uTime, uK, uFade, uLow;
uniform vec3 uHit[4];
out vec4 o;
const vec2 S = vec2(1.0, 1.7320508);
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 q = vQ;
  // 모서리가 둥근 판
  vec2 dq = abs(q) - (vec2(1.0) - 0.22*vec2(uDim.y/uDim.x, 1.0));
  float sd = length(max(dq,0.0)/vec2(uDim.y/uDim.x,1.0)) - 0.22;       // <0 안쪽
  if (sd > 0.0) discard;
  float edge = -sd;                                                    // 테두리에서의 거리
  // 육각 벌집
  vec2 p = q*uDim.xy*9.0;
  vec4 hc = floor(vec4(p, p - vec2(0.5,1.0))/S.xyxy) + 0.5;
  vec4 hh = vec4(p - hc.xy*S, p - (hc.zw+0.5)*S);
  vec4 h = dot(hh.xy,hh.xy) < dot(hh.zw,hh.zw) ? vec4(hh.xy, hc.xy) : vec4(hh.zw, hc.zw+0.5);
  vec2 ah = abs(h.xy); float hd = 0.5 - max(dot(ah, S*0.5), ah.x);     // 칸 테두리에서의 거리
  vec2 cq = (h.zw*S)/(uDim.xy*9.0);                                    // 이 칸의 중심 (판 좌표)
  float rnd = h21(h.zw);
  // 펼쳐짐: 가운데에서 바깥으로 칸이 하나씩 켜짐
  float front = uK*1.75, cr = length(cq*vec2(1.0,0.8)) + rnd*0.12;
  float on = smoothstep(front, front-0.06, cr);
  float flash = exp(-max(0.0, front-cr)*7.0) * (1.0 - smoothstep(0.92,1.0,uK));
  // 꺼짐: 칸이 무작위로 떨어져 나감
  on *= step(rnd, uFade*1.25 - 0.12);
  if (on <= 0.001) discard;
  float w = fwidth(hd)*1.2;
  float line = smoothstep(0.035+w, 0.035-w*0.2, hd);
  float lineGlow = exp(-hd*14.0);
  // 맞은 자리에서 퍼지는 물결
  float rip = 0.0, hot = 0.0;
  for (int i=0;i<4;i++){
    float age = uHit[i].z; if (age < 0.0) continue;
    float d = length((cq - uHit[i].xy)*vec2(uDim.x/uDim.y,1.0));
    rip += exp(-pow((d - age*1.5)/0.085,2.0)) * exp(-age*3.2);
    hot += exp(-d*d/0.012) * exp(-age*9.0);
  }
  float tw = 0.5 + 0.5*sin(uTime*1.7 + rnd*40.0);                      // 칸마다 은은히 숨쉼
  float sweep = exp(-pow((q.y + 1.3 - mod(uTime*0.55, 2.6))/0.16,2.0)); // 위로 훑는 빛 띠
  float rim = exp(-edge*11.0), rimLine = smoothstep(0.035,0.012,edge);
  float fres = pow(clamp(length(q*vec2(0.9,0.75)),0.0,1.0), 2.4);
  float low = uLow*(0.5+0.5*sin(uTime*22.0));                          // 곧 꺼질 때 깜빡임
  vec3 cA = vec3(0.10,0.46,1.0), cB = vec3(0.55,0.86,1.0);
  float fill = 0.085 + 0.06*tw*rnd + 0.16*fres + 0.10*sweep + 0.5*rip + 0.9*hot + 0.5*flash;
  float ln = line*(0.50 + 0.35*fres + 0.5*sweep + 1.4*rip + 1.2*flash + 0.25*tw) + lineGlow*(0.10 + 0.5*rip + 0.3*flash);
  vec3 col = cA*fill + mix(cA,cB,0.55)*ln + cB*(rim*0.55 + rimLine*0.9) + vec3(0.9,0.97,1.0)*(hot*0.9 + flash*0.35 + rip*line*0.6);
  col *= on * (1.0 - 0.45*low) * (0.55 + 0.45*uFade);
  float a = clamp((0.06 + 0.05*fres + line*0.10 + rimLine*0.2 + hot*0.3) * on, 0.0, 1.0) * uFade;
  o = vec4(col, a);
}`;

  const st = { ready:false, failed:false, sprog:null, su:{}, parts:{}, shield:null, tex:null, texCv:null, gauge:-1 };
  // 그림판: 명판 글자 · 방어막 충전 계기판 · 팔 글자 (한 장의 캔버스에 그려 텍스처로 씀)
  function paintDecals(pct){
    const c = st.texCv, x = c.getContext('2d');
    if (st.gauge < 0){
      // 명판 (0,0)-(512,256): 닳은 금속판에 새긴 글자
      const g = x.createLinearGradient(0,0,0,256); g.addColorStop(0,'#aab0b8'); g.addColorStop(1,'#858b94');
      x.fillStyle = g; x.fillRect(0,0,512,256);
      for (let i=0;i<900;i++){ x.fillStyle = `rgba(${Math.random()<0.5?255:0},${Math.random()<0.5?255:0},${Math.random()<0.5?255:20},${Math.random()*0.05})`;
        x.fillRect(Math.random()*512, Math.random()*256, 1+Math.random()*26, 1); }
      x.strokeStyle = 'rgba(30,33,38,0.75)'; x.lineWidth = 3; x.strokeRect(14,14,484,228);
      x.fillStyle = '#23262b'; x.textBaseline = 'middle';
      x.font = '900 46px Orbitron, "Arial Black", Arial, sans-serif'; x.fillText('SENTINEL MAUL', 34, 62);
      x.fillRect(34, 96, 444, 4);
      x.font = '700 25px Orbitron, Arial, sans-serif';
      x.fillText('POWER UNIT 03', 34, 128); x.fillText('AEGIS SHIELD SYSTEM', 34, 166); x.fillText('BULWARK GUARD', 34, 204);
      x.fillStyle = '#c9541a'; x.fillRect(404, 190, 74, 28); x.fillStyle = '#23262b'; x.font = '700 18px Arial, sans-serif'; x.fillText('T-01', 420, 205);
      // 팔 글자 (256,256)-(512,384): 세로로 읽히는 흰 글자
      x.fillStyle = '#16335f'; x.fillRect(256,256,256,128);
      x.save(); x.translate(384,320); x.fillStyle = '#e9f2ff'; x.textAlign = 'center';
      x.font = '900 34px Orbitron, "Arial Black", Arial, sans-serif'; x.fillText('BULWARK', 0, -14);
      x.fillStyle = '#ff9a3c'; x.fillRect(-100, 16, 200, 6);
      x.font = '700 20px Arial, sans-serif'; x.fillStyle = '#9fc4ff'; x.fillText('TITAN · 01', 0, 42); x.restore();
    }
    // 계기판 (0,256)-(256,512): 방어막 충전량
    x.save(); x.beginPath(); x.rect(0,256,256,256); x.clip();
    x.fillStyle = '#07090c'; x.fillRect(0,256,256,256);
    const cx = 128, cy = 384, a0 = Math.PI*0.75, a1 = Math.PI*2.25;
    x.lineCap = 'butt'; x.lineWidth = 20; x.strokeStyle = '#2a1a0c'; x.beginPath(); x.arc(cx,cy,92,a0,a1); x.stroke();
    x.strokeStyle = pct >= 100 ? '#58c8ff' : '#ff8a1e'; x.beginPath(); x.arc(cx,cy,92,a0,a0+(a1-a0)*pct/100); x.stroke();
    x.strokeStyle = '#07090c'; x.lineWidth = 5;
    for (let i=1;i<10;i++){ const a = a0+(a1-a0)*i/10; x.beginPath(); x.moveTo(cx+Math.cos(a)*78, cy+Math.sin(a)*78); x.lineTo(cx+Math.cos(a)*106, cy+Math.sin(a)*106); x.stroke(); }
    x.fillStyle = pct >= 100 ? '#bfeaff' : '#ffd9a8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 56px Orbitron, "Arial Black", Arial, sans-serif'; x.fillText(pct + '%', cx, cy-2);
    x.font = '700 20px Arial, sans-serif'; x.fillStyle = pct >= 100 ? '#58c8ff' : '#b0621e'; x.fillText(pct >= 100 ? 'READY' : 'SHIELD', cx, cy+46);
    x.restore();
    st.gauge = pct;
    st.tex = FP3D.texture(c, st.tex);
  }

  function load(){
    if (st.ready || st.failed) return;
    try {
      if (!FP3D.init()) throw new Error('WebGL2 없음');
      const gl = FP3D.st.gl;
      [st.sprog, st.su] = FP3D.program(gl, SVS, SFS, ['uProj','uDim','uOff','uTime','uK','uFade','uLow','uHit']);
      st.parts = {
        hammer: FP3D.mesh(buildHammer()),
        handR: FP3D.mesh(FP3D.buildHand(-1, PAL)), handL: FP3D.mesh(FP3D.buildHand(1, PAL)),
        foreR: FP3D.mesh(FP3D.buildForearm(PAL, gaugeExtra)), foreL: FP3D.mesh(FP3D.buildForearm(PAL, labelExtra)),
        upper: FP3D.mesh(FP3D.buildUpper(PAL)),
      };
      // 방어막 격자
      const N = 28, sp = [];
      for (let j=0;j<N;j++) for (let i=0;i<N;i++){
        const x0 = -1+2*i/N, x1 = -1+2*(i+1)/N, y0 = -1+2*j/N, y1 = -1+2*(j+1)/N;
        sp.push(x0,y0, x1,y0, x1,y1, x0,y0, x1,y1, x0,y1);
      }
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sp), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(st.sprog, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      st.shield = { vao, count: sp.length/2 };
      st.texCv = document.createElement('canvas'); st.texCv.width = st.texCv.height = 512;
      paintDecals(100);
      st.ready = true;
      // 글꼴이 늦게 도착하면 명판을 다시 그린다
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.ready){ const p = st.gauge; st.gauge = -1; paintDecals(p); } });
    } catch(e){
      st.failed = true;
      console.warn('[Titan3D] 3D 망치를 준비하지 못해 2D 망치를 씁니다:', e && e.message);
    }
  }

  // 망치 + 두 팔 그리기 (1인칭 원근)
  //  P: pose()/mix()로 만든 자세.  o.cells: 에너지 셀 3개의 밝기, o.hot: 타격면 열기, o.glow: 푸른 선 밝기, o.shield: 방어막 빛(0~1), o.charge: 계기판 충전(0~100)
  //  돌려주는 값: 화면 좌표(캔버스 픽셀) {face, head, rear, top, bottom, cells, ring, scale} — 궤적·빛 번짐 효과용
  function frame(ctx, P){
    const R = matFromQuat(P.q), T = sub([P.p[0]-FP3D.narrow(ctx), P.p[1], P.p[2]], mv(R, [0, GRIP_Y, 0]));
    return { R, T, at: q => add(mv(R, q), T) };
  }
  function drawRig(ctx, P, o = {}){
    if (!st.ready || !FP3D.ready) return null;
    if (o.charge != null){ const c = Math.max(0, Math.min(100, Math.round(o.charge))); if (c !== st.gauge) paintDecals(c); }
    const f = frame(ctx, P), items = [{ m: st.parts.hammer, R: f.R, T: f.T }], nr = FP3D.narrow(ctx);
    for (const s of [1, -1])
      FP3D.arm(items, s, f.at([0, s > 0 ? HAND_R : HAND_L, 0]), f.R[1], { hand: s > 0 ? st.parts.handR : st.parts.handL,
        fore: s > 0 ? st.parts.foreR : st.parts.foreL, upper: st.parts.upper, shoulder: [s*0.21 - nr*0.5, -0.235, 0.13] });
    const c = o.cells || [1,1,1], sh = o.shield ?? 0;
    FP3D.draw(ctx, items, { tex: st.tex, E: [1, c[0], c[1], c[2], o.hot ?? 0, o.glow ?? 1], front: [0.35*sh*1.5, 0.95*sh*1.5, 2.2*sh*1.5] });
    return marks(ctx, f.at);
  }
  // 효과용 표식 자리 (화면 좌표, 캔버스 픽셀. 눈 뒤로 넘어간 점은 null)
  function marks(ctx, at){
    const S2 = q => FP3D.screen(ctx, at(q));
    return { face: S2([0,HY,-0.27]), head: S2([0,HY,0]), rear: S2([0,HY-0.066,0.25]), ring: S2([0,0.512,0]),
             top: S2([0,HY+0.125,-0.2]), bottom: S2([0,HY-0.125,-0.2]),
             cells: [-0.062,0,0.062].map(x => S2([x,HY-0.066,0.2])),
             scale: FP3D.pxPerM(ctx, at([0, HY, -0.27])[2]) };     // 1미터가 타격면 자리에서 몇 픽셀인지
  }
  // 그리지 않고 표식 자리만 계산 (휘두르는 궤적을 지난 자세들로 그릴 때 씀)
  const points = (ctx, P) => marks(ctx, frame(ctx, P).at);

  //  o.hits: [{x: 화면 가로 위치(-1~1), y: 세로(-1~1), age: 초}] 최대 4개,  o.ox/oy: 살짝 밀리는 양(미터)
  const SH = { hw: 0.74, hh: 0.60, dist: 1.62, bend: 0.17, y: 0.02, x: -0.10 };
  function drawShield(ctx, o){
    if (!st.ready) return false;
    const [gl, W, H, pr] = FP3D.begin(ctx);
    gl.disable(gl.SCISSOR_TEST); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(st.sprog);
    gl.uniform4fv(st.su.uProj, pr);
    gl.uniform4f(st.su.uDim, SH.hw, SH.hh, SH.dist, SH.bend);
    gl.uniform2f(st.su.uOff, SH.x + (o.ox||0), SH.y + (o.oy||0));
    gl.uniform1f(st.su.uTime, o.time || 0); gl.uniform1f(st.su.uK, o.k ?? 1); gl.uniform1f(st.su.uFade, o.fade ?? 1); gl.uniform1f(st.su.uLow, o.low || 0);
    const hv = new Float32Array(12).fill(-1), hits = o.hits || [];
    for (let i=0;i<Math.min(4,hits.length);i++){
      // 화면 위치 → 판 위의 자리
      hv[i*3]   = Math.max(-0.9, Math.min(0.9, (hits[i].x/pr[0]*SH.dist - SH.x)/SH.hw));
      hv[i*3+1] = Math.max(-0.8, Math.min(0.8, (hits[i].y/pr[1]*SH.dist - SH.y)/SH.hh));
      hv[i*3+2] = hits[i].age;
    }
    gl.uniform3fv(st.su.uHit, hv);
    gl.bindVertexArray(st.shield.vao); gl.drawArrays(gl.TRIANGLES, 0, st.shield.count); gl.bindVertexArray(null);
    ctx.drawImage(FP3D.st.cv, 0, 0);
    return true;
  }


  return { load, pose: FP3D.pose, mix: FP3D.mix, drawRig, drawShield, points,
           get ready(){ return st.ready && FP3D.ready; }, get failed(){ return st.failed; } };
})();

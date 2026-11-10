// ═══════════════════════════════════════════════════════════════
//  titan3d.js — 타이탄(탱커)의 1인칭 3D 장비: 전투 망치 SENTINEL MAUL + 장갑 두 팔 + 육각 방어막
//  · 외부 라이브러리·모델 파일 없음: 모든 형태를 코드로 직접 빚는다 (깎인 모서리 상자, 회전체, 가시 …)
//  · 두 손은 자루를 감아 쥔 채 망치에 붙어 있고, 팔뚝·위팔은 어깨에서 손목까지 관절 계산(2관절 IK)으로 따라온다
//    → 망치를 어떻게 휘둘러도 손이 자루에서 떨어지지 않고 팔이 자연스럽게 이어짐
//  · 금속 PBR(GGX) 조명 + 가짜 환경 반사 + 스스로 빛나는 에너지 셀
//  · 방어막: 굽은 판 위에 육각 벌집 무늬를 셰이더로 그림 (펼쳐짐·피격 물결·꺼짐 연출)
//  · WebGL2가 없으면 ready=false → 게임은 예전 2D 망치·방벽을 그대로 쓴다
//  좌표: 보기 공간 — 눈이 원점, x 오른쪽, y 위, -z 앞. 단위는 대략 미터
// ═══════════════════════════════════════════════════════════════
const Titan3D = (() => {
  'use strict';
  // ── 벡터·행렬(열 3개)·사원수 ─────────────────────────────────
  const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const len = a => Math.hypot(a[0],a[1],a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
  const orth = (v, n) => norm(sub(v, mul(n, dot(v,n))));      // v에서 n 방향 성분을 뺀 단위벡터
  const I3 = [[1,0,0],[0,1,0],[0,0,1]];
  const mv = (M,v) => [M[0][0]*v[0]+M[1][0]*v[1]+M[2][0]*v[2], M[0][1]*v[0]+M[1][1]*v[1]+M[2][1]*v[2], M[0][2]*v[0]+M[1][2]*v[1]+M[2][2]*v[2]];
  const rotX = a => { const c=Math.cos(a), s=Math.sin(a); return [[1,0,0],[0,c,s],[0,-s,c]]; };
  const rotY = a => { const c=Math.cos(a), s=Math.sin(a); return [[c,0,-s],[0,1,0],[s,0,c]]; };
  const rotZ = a => { const c=Math.cos(a), s=Math.sin(a); return [[c,s,0],[-s,c,0],[0,0,1]]; };
  function quatFromMat(M){
    const m00=M[0][0], m10=M[0][1], m20=M[0][2], m01=M[1][0], m11=M[1][1], m21=M[1][2], m02=M[2][0], m12=M[2][1], m22=M[2][2];
    const tr = m00+m11+m22; let q;
    if (tr > 0){ const s = Math.sqrt(tr+1)*2; q = [(m21-m12)/s, (m02-m20)/s, (m10-m01)/s, s/4]; }
    else if (m00 > m11 && m00 > m22){ const s = Math.sqrt(1+m00-m11-m22)*2; q = [s/4, (m01+m10)/s, (m02+m20)/s, (m21-m12)/s]; }
    else if (m11 > m22){ const s = Math.sqrt(1+m11-m00-m22)*2; q = [(m01+m10)/s, s/4, (m12+m21)/s, (m02-m20)/s]; }
    else { const s = Math.sqrt(1+m22-m00-m11)*2; q = [(m02+m20)/s, (m12+m21)/s, s/4, (m10-m01)/s]; }
    return q;
  }
  function matFromQuat(q){
    const [x,y,z,w] = q;
    return [[1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w)], [2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w)], [2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y)]];
  }
  function slerp(a, b, u){
    let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
    if (d < 0){ b = b.map(x => -x); d = -d; }
    let k0, k1;
    if (d > 0.9995){ k0 = 1-u; k1 = u; }
    else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1-u)*th)/s; k1 = Math.sin(u*th)/s; }
    const q = [a[0]*k0+b[0]*k1, a[1]*k0+b[1]*k1, a[2]*k0+b[2]*k1, a[3]*k0+b[3]*k1];
    const l = Math.hypot(q[0],q[1],q[2],q[3]) || 1; return q.map(x => x/l);
  }

  // ── 형태 빚기 ────────────────────────────────────────────────
  //  꼭짓점마다: 위치, 법선, 색(선형), 재질(금속성, 거칠기, 발광 세기, 발광 묶음), 그림판 좌표(없으면 -1)
  const lin = c => Math.pow(c/255, 2.2);
  const hex = h => { const n = parseInt(h.slice(1),16); return [lin(n>>16&255), lin(n>>8&255), lin(n&255)]; };
  function Builder(){
    const pos=[], nor=[], col=[], mat=[], uv=[];
    let R = I3, t = [0,0,0], M = { c:[.5,.5,.5], m:0, r:.5, e:0, g:0 };
    const P = p => add(mv(R,p), t);
    const vert = (p, n, u) => { pos.push(p[0],p[1],p[2]); nor.push(n[0],n[1],n[2]); col.push(M.c[0],M.c[1],M.c[2]); mat.push(M.m,M.r,M.e,M.g); uv.push(u?u[0]:-1, u?u[1]:-1); };
    const B = {
      // 재질 고르기: 색, 금속성, 거칠기, 발광 세기, 발광 묶음(1~3 에너지 셀, 4 타격면 열기)
      mat(h, m=0, r=0.5, e=0, g=0){ M = { c:hex(h), m, r, e, g }; return B; },
      // 변환을 잠깐 얹고 fn 안의 형태를 그 자리에 빚는다
      at(Rn, tn, fn){ const R0 = R, t0 = t; t = add(mv(R, tn), t); R = Rn.map(c => mv(R0, c)); fn(); R = R0; t = t0; },
      // 볼록 다각형 (면 법선은 ref 점에서 바깥쪽을 향하게)
      poly(pts, ref, uvs){
        const w = pts.map(P); let n = [0,0,0];
        for (let i=1;i+1<w.length && len(n)<1e-12;i++) n = cross(sub(w[i],w[0]), sub(w[i+1],w[0]));
        n = norm(n);
        if (ref){ let c=[0,0,0]; for (const p of w) c = add(c,p); c = mul(c,1/w.length); if (dot(n, sub(c, P(ref))) < 0) n = mul(n,-1); }
        for (let i=1;i+1<w.length;i++){ vert(w[0],n,uvs&&uvs[0]); vert(w[i],n,uvs&&uvs[i]); vert(w[i+1],n,uvs&&uvs[i+1]); }
      },
      // 모서리를 깎은 상자: c 중심, s 크기, b 깎는 폭
      box(c, s, b=0){
        const h = [s[0]/2, s[1]/2, s[2]/2]; b = Math.min(b, h[0]*0.98, h[1]*0.98, h[2]*0.98);
        const pt = (i,vi,j,vj,k,vk) => { const p = [0,0,0]; p[i]=c[i]+vi; p[j]=c[j]+vj; p[k]=c[k]+vk; return p; };
        for (let i=0;i<3;i++){ const j=(i+1)%3, k=(i+2)%3;
          for (const sg of [-1,1]){ const a=h[j]-b, d=h[k]-b;
            B.poly([pt(i,sg*h[i],j,-a,k,-d), pt(i,sg*h[i],j,a,k,-d), pt(i,sg*h[i],j,a,k,d), pt(i,sg*h[i],j,-a,k,d)], c); }
          if (b > 0) for (const si of [-1,1]) for (const sj of [-1,1]){ const d=h[k]-b;       // 모서리 띠 (i·j 면 사이)
            B.poly([pt(i,si*h[i],j,sj*(h[j]-b),k,-d), pt(i,si*h[i],j,sj*(h[j]-b),k,d), pt(i,si*(h[i]-b),j,sj*h[j],k,d), pt(i,si*(h[i]-b),j,sj*h[j],k,-d)], c); }
        }
        if (b > 0) for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1])   // 꼭짓점 삼각형
          B.poly([[c[0]+sx*h[0], c[1]+sy*(h[1]-b), c[2]+sz*(h[2]-b)], [c[0]+sx*(h[0]-b), c[1]+sy*h[1], c[2]+sz*(h[2]-b)], [c[0]+sx*(h[0]-b), c[1]+sy*(h[1]-b), c[2]+sz*h[2]]], c);
      },
      // 회전체/각기둥: o에서 axis 방향으로 단면 [t, rx, ry]들을 이어 붙임. n각형, smooth면 둥근 법선
      lathe(o, axis, up, secs, n, o2 = {}){
        const Z = norm(axis), X = norm(cross(up, Z)), Y = cross(Z, X), ph = o2.phase ?? Math.PI/n;
        const ring = s => { const a = []; for (let k=0;k<=n;k++){ const an = ph + k*2*Math.PI/n;
          a.push(add(add(o, mul(Z,s[0])), add(mul(X, Math.cos(an)*s[1]), mul(Y, Math.sin(an)*(s[2] ?? s[1]))))); } return a; };
        const rings = secs.map(ring);
        for (let i=0;i+1<secs.length;i++){
          const s0 = secs[i], s1 = secs[i+1], r0 = rings[i], r1 = rings[i+1];
          for (let k=0;k<n;k++){
            if (s0[1] < 1e-6 && s1[1] < 1e-6) continue;
            if (!o2.smooth){ B.poly(s0[1] < 1e-6 ? [r0[k], r1[k+1], r1[k]] : s1[1] < 1e-6 ? [r0[k], r0[k+1], r1[k]] : [r0[k], r0[k+1], r1[k+1], r1[k]], add(o, mul(Z,(s0[0]+s1[0])/2))); continue; }
            const slope = (s1[1]-s0[1])/((s1[0]-s0[0]) || 1e-6);
            const nrm = kk => { const an = ph + kk*2*Math.PI/n; return mv(R, norm(sub(add(mul(X,Math.cos(an)), mul(Y,Math.sin(an))), mul(Z, slope)))); };
            const n0 = nrm(k), n1 = nrm(k+1), a = P(r0[k]), b2 = P(r0[k+1]), c2 = P(r1[k+1]), d = P(r1[k]);
            vert(a,n0); vert(b2,n1); vert(c2,n1); vert(a,n0); vert(c2,n1); vert(d,n0);
          }
        }
        if (o2.cap0 !== false && secs[0][1] > 1e-6) B.poly(rings[0].slice(0,n), add(o, mul(Z, secs[0][0]+1)));
        const L = secs.length-1;
        if (o2.cap1 !== false && secs[L][1] > 1e-6) B.poly(rings[L].slice(0,n), add(o, mul(Z, secs[L][0]-1)));
      },
      // 그림판(글자·계기판) 붙이기: c 중심, r 오른쪽·u 위쪽 방향, 크기 w×h, rect = 그림판 안의 영역 [u0,v0,u1,v1]
      decal(c, r, u, w, h, rect){
        const rr = mul(norm(r), w/2), uu = mul(norm(u), h/2);
        B.poly([add(sub(c,rr),uu), add(add(c,rr),uu), sub(add(c,rr),uu), sub(sub(c,rr),uu)], sub(c, cross(r,u)),
               [[rect[0],rect[1]], [rect[2],rect[1]], [rect[2],rect[3]], [rect[0],rect[3]]]);
      },
      data(){ return { pos:new Float32Array(pos), nor:new Float32Array(nor), col:new Float32Array(col), mat:new Float32Array(mat), uv:new Float32Array(uv) }; },
    };
    return B;
  }

  // 재질 (색, 금속성, 거칠기)
  const STEEL = ['#7b838e', 1, 0.36], GUN = ['#565d68', 1, 0.44], DARK = ['#2a2e35', 0.9, 0.52], RUB = ['#0e0f12', 0, 0.82];
  const ORG = ['#ee7d18', 0.35, 0.42], ARM = ['#1b4c9c', 0.75, 0.34], ARM2 = ['#2a66c4', 0.75, 0.30], GLOVE = ['#13161b', 0, 0.78];
  const GLOW = '#3d9bff';
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

  // 자루를 감아 쥔 손. 손 좌표: x = 손목 쪽, y = 자루 축(엄지·검지 쪽이 +), z = 손등 쪽. s = -1이면 오른손(z를 뒤집음)
  //  손가락은 마디마다 둥근 토막(캡슐)을 자루 둘레로 말아 붙이고, 바깥쪽에 장갑판을 얹는다
  const WRIST = [0.088, 0, 0.012];
  function buildHand(s){
    const b = Builder();
    // 손가락 한 마디: p0 → p1 (x,z 평면), y 높이, 굵기 r. plate = 바깥쪽 장갑판 재질(없으면 생략)
    const seg = (p0, p1, y0, y1, r, plate, tip) => {
      const a = [p0[0], y0, p0[1]], c = [p1[0], y1, p1[1]], d = sub(c, a), L = len(d), Z = norm(d);
      const Yl = orth([0,1,0], Z), X = cross(Yl, Z);
      const mid = mul(add(a, c), 0.5), out = dot(X, [mid[0], 0, mid[2]]) > 0 ? 1 : -1;
      b.at([X, Yl, Z], a, () => {
        b.mat(...GLOVE);
        b.lathe([0,0,0], [0,0,1], [0,1,0], [[-r*0.55,r*0.55],[-r*0.1,r*0.96,r],[L+r*0.1,r*0.96,r],[L+r*(tip?0.75:0.55),r*(tip?0.5:0.55)]], 10, {smooth:true});
        if (plate){ b.mat(...plate); b.box([out*(r*0.93), 0, L*0.5], [r*0.5, r*1.55, L*0.74], r*0.2); }
      });
    };
    b.at([[1,0,0],[0,1,0],[0,0,s]], [0,0,0], () => {
      // 손등: 속 장갑 → 푸른 장갑판 → 가운데 돋은 판 + 빛줄 + 손목 쪽 주황 띠
      b.mat(...GLOVE); b.box([0.012,0,0.040], [0.092,0.098,0.026], 0.009);
      b.mat(...ARM);   b.box([0.014,0,0.0545], [0.070,0.090,0.012], 0.0045);
      b.mat(...ARM2);  b.box([0.020,0,0.0615], [0.040,0.056,0.006], 0.0025);
      b.mat(GLOW, 0, 0.3, 2.0, 5); b.box([0.020,0,0.0648], [0.020,0.007,0.002]);
      b.mat(...ORG);   b.box([0.048,0,0.0585], [0.008,0.082,0.009], 0.0025);
      const ys = [-0.0358,-0.0120,0.0120,0.0358];
      ys.forEach((y, i) => {
        const r = i === 0 ? 0.0100 : 0.0112, k = i === 0 ? 0.94 : 1;      // 새끼손가락은 조금 가늘고 짧게
        const MCP = [-0.030,0.041], PIP = [-0.0485*k,-0.010], DIP = [-0.020*k,-0.0465*k], TIP = [0.017,-0.041*k];
        seg(MCP, PIP, y, y, r, ARM);                                       // 첫 마디
        seg(PIP, DIP, y, y, r, ARM);                                       // 둘째 마디
        seg(DIP, TIP, y, y, r*0.94, ORG, true);                            // 끝 마디 (손바닥 쪽으로 말림)
        // 주먹 관절 덮개 (주황): 손등과 손가락이 만나는 모서리를 비스듬히 덮음
        b.at(rotY(-0.72), [MCP[0]-0.004, y, MCP[1]+0.004], () => { b.mat(...ORG); b.box([0,0,0], [0.030,r*1.86,0.022], 0.007); });
        // 가운데 관절 덮개 (강철)
        b.at(rotY(0.80), [PIP[0]-0.003, y, PIP[1]-0.004], () => { b.mat(...STEEL); b.box([0,0,0], [0.016,r*1.7,0.018], 0.005); });
      });
      // 손바닥 두덩
      b.mat(...GLOVE); b.box([0.047,0.0,0.004], [0.032,0.094,0.060], 0.011);
      // 엄지: 두덩에서 나와 검지 위에서 자루를 반대쪽으로 감쌈
      b.box([0.044,0.046,-0.004], [0.036,0.036,0.044], 0.012);
      seg([0.046,-0.022], [0.006,-0.049], 0.056, 0.060, 0.0128, ARM);
      seg([0.006,-0.049], [-0.034,-0.036], 0.060, 0.057, 0.0120, ORG, true);
      // 손목 (팔뚝과 이어지는 관절)
      b.mat(...GLOVE); b.box([0.078,0,0.012], [0.046,0.076,0.058], 0.017);
    });
    return b.data();
  }

  // 팔뚝. 좌표: 손목 = 원점, +z = 팔꿈치 쪽, +y = 손등 쪽. side = 1 오른팔(안쪽에 충전 계기판), -1 왼팔(손등 쪽에 글자)
  const FORE = 0.31, UPPER = 0.36;
  function buildForearm(side){
    const b = Builder(), Z = [0,0,1], Y = [0,1,0];
    const L = (secs, o) => b.lathe([0,0,0], Z, Y, secs, 8, o);
    b.mat(...GLOVE); L([[-0.012,0.030,0.026],[0.0,0.036,0.030],[0.034,0.038,0.032]], {cap0:true});
    b.mat(...ORG);   L([[0.030,0.045,0.039],[0.036,0.048,0.042],[0.047,0.048,0.042],[0.052,0.045,0.039]]);
    b.mat(...ARM);   L([[0.052,0.045,0.039],[0.185,0.058,0.050],[0.192,0.054,0.046]]);
    b.mat(...DARK);  L([[0.192,0.051,0.044],[0.212,0.052,0.045]]);
    b.mat(...ARM);   L([[0.212,0.056,0.048],[0.218,0.060,0.052],[0.30,0.058,0.052],[FORE+0.02,0.050,0.046]]);
    // 손등 쪽 장갑판 + 주황 줄
    b.mat(...ARM2);  b.box([0,0.044,0.118], [0.058,0.014,0.118], 0.005);
    b.mat(...ORG);   b.box([0,0.0515,0.070], [0.05,0.004,0.010]); b.box([0,0.0515,0.166], [0.05,0.004,0.010]);
    // 바깥·안쪽 옆판 + 푸른 빛줄
    for (const sx of [-1,1]){
      b.mat(...ARM2); b.box([sx*0.050,0.0,0.125], [0.012,0.046,0.11], 0.004);
      b.mat(GLOW, 0, 0.3, 1.8, 5); b.box([sx*0.0565,0.0,0.125], [0.003,0.008,0.08]);
    }
    if (side > 0){   // 오른팔 안쪽(손바닥 쪽): 방어막 충전 계기판
      b.mat(...DARK); b.lathe([0,-0.036,0.118], [0,-1,0], Z, [[0,0.040],[0.012,0.040],[0.016,0.036]], 16, {smooth:true});
      b.mat(...ORG);  b.lathe([0,-0.050,0.118], [0,-1,0], Z, [[0,0.0385],[0.006,0.0385],[0.006,0.031],[0.002,0.031]], 20, {smooth:true, cap0:false, cap1:false});
      b.mat('#ffffff', 0, 0.35, 1.6); b.decal([0,-0.0535,0.118], [-1,0,0], [0,0,-1], 0.062, 0.062, R_GAUGE);
    } else {         // 왼팔 손등 쪽: 부대 글자
      b.mat('#ffffff', 0.5, 0.4, 0.9); b.decal([0,0.0516,0.118], [1,0,0], [0,0,-1], 0.05, 0.072, R_LABEL);
    }
    // 팔꿈치 관절
    b.mat(...GLOVE); b.lathe([0,0,FORE], Z, Y, [[-0.02,0.046],[0.0,0.052],[0.02,0.046]], 8);
    return b.data();
  }
  // 위팔. 좌표: 팔꿈치 = 원점, +z = 어깨 쪽
  function buildUpper(){
    const b = Builder(), Z = [0,0,1], Y = [0,1,0];
    b.mat(...GLOVE); b.lathe([0,0,0], Z, Y, [[0.0,0.048],[0.05,0.052]], 8);
    b.mat(...ORG);   b.lathe([0,0,0], Z, Y, [[0.05,0.060],[0.064,0.060]], 8);
    b.mat(...ARM);   b.lathe([0,0,0], Z, Y, [[0.064,0.060],[0.09,0.068],[0.60,0.078]], 8);
    b.mat(...ARM2);  b.box([0,0.062,0.26], [0.07,0.016,0.30], 0.006);
    return b.data();
  }

  // ── 셰이더 ────────────────────────────────────────────────
  const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec3 aCol; in vec4 aMat; in vec2 aUv;
uniform mat3 uM; uniform vec3 uT; uniform vec4 uProj;
out vec3 vP; out vec3 vN; out vec3 vO; out vec3 vCol; out vec4 vMat; out vec2 vUv;
void main(){
  vec3 p = uM*aPos + uT;
  vP = p; vN = uM*aNor; vO = aPos; vCol = aCol; vMat = aMat; vUv = aUv;
  gl_Position = vec4(p.x*uProj.x, p.y*uProj.y, p.z*uProj.z + uProj.w, -p.z);
}`;
  const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec3 vO; in vec3 vCol; in vec4 vMat; in vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uCells; uniform float uHot, uGlow, uShield;
out vec4 o;
const float PI = 3.14159265;
float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 env(vec3 r, float rough){
  // 위: 차가운 하늘빛, 아래: 어두운 바닥, 지평선에 밝은 띠 (금속이 금속처럼 보이게)
  float up = r.y;
  vec3 sky = mix(vec3(0.20,0.25,0.33), vec3(0.60,0.72,0.90), smoothstep(-0.1,0.9,up));
  vec3 col = mix(vec3(0.30,0.29,0.30), sky, smoothstep(-0.45,0.15,up));
  float band = exp(-pow((up-0.10)/(0.10+rough*0.5),2.0));
  col += vec3(1.0,0.96,0.90)*band*(1.1-rough);
  col += vec3(0.25,0.65,1.3)*uShield*smoothstep(0.2,-0.9,r.z)*0.9;       // 방어막이 켜지면 앞쪽에서 푸른 빛이 비침
  return col;
}
void main(){
  vec3 N = normalize(vN), V = normalize(-vP);
  if (dot(N,V) < 0.0) N = -N;
  vec3 base = vCol; float metal = vMat.x, rough = vMat.y, em = vMat.z, grp = vMat.w;
  vec3 emis = vec3(0.0);
  if (vUv.x >= 0.0){                                // 글자·계기판 그림
    vec3 tx = pow(texture(uTex, vUv).rgb, vec3(2.2));
    base *= tx;
    emis = tx * smoothstep(0.25,0.7,max(tx.r,max(tx.g,tx.b))) * em;
    rough = mix(rough, 0.7, 1.0 - min(1.0, tx.g*3.0));
  } else if (em > 0.0){
    float k = uGlow;
    if (grp > 0.5 && grp < 3.5) k = grp < 1.5 ? uCells.x : grp < 2.5 ? uCells.y : uCells.z;
    else if (grp > 3.5 && grp < 4.5) k = uHot;
    emis = vCol * em * k;
    base *= 0.25;
  }
  // 긁힘·때: 거칠기와 색을 조금씩 흔들어 새것 같지 않게
  float n1 = noise(vO*46.0), n2 = noise(vO*190.0 + 7.0);
  rough = clamp(rough + (n1-0.5)*0.22 + (n2-0.5)*0.10, 0.08, 1.0);
  base *= 0.86 + 0.20*n1 + 0.08*n2;

  float NdV = max(dot(N,V), 0.02);
  vec3 F0 = mix(vec3(0.04), base, metal), dif = base*(1.0-metal);
  float a2 = pow(rough*rough, 2.0);
  vec3 col = vec3(0.0);
  vec3 Ls[4]; vec3 Lc[4];
  Ls[0] = normalize(vec3(-0.45, 0.75, 0.55)); Lc[0] = vec3(2.9,2.75,2.55);      // 왼쪽 위 앞 (주광)
  Ls[1] = normalize(vec3( 0.80, 0.10, 0.45)); Lc[1] = vec3(0.60,0.74,1.05);     // 오른쪽 (푸른 보조광)
  Ls[2] = normalize(vec3( 0.10, 0.60,-0.80)); Lc[2] = vec3(1.0,1.1,1.3);        // 뒤 위 (윤곽광)
  Ls[3] = normalize(vec3(-0.25, 0.05,-0.97)); Lc[3] = vec3(0.35,0.95,2.2)*uShield*1.5;   // 방어막 빛
  for (int i=0;i<4;i++){
    vec3 L = Ls[i]; float NdL = max(dot(N,L),0.0);
    if (NdL <= 0.0) continue;
    vec3 H = normalize(L+V); float NdH = max(dot(N,H),0.0);
    float d = NdH*NdH*(a2-1.0)+1.0; float D = a2/(PI*d*d);
    float kk = (rough+1.0)*(rough+1.0)/8.0;
    float G = (NdV/(NdV*(1.0-kk)+kk)) * (NdL/(NdL*(1.0-kk)+kk));
    vec3 F = F0 + (1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);
    col += ((1.0-F)*dif/PI + min(D*G/(4.0*NdV*NdL+1e-4), 30.0)*F) * Lc[i] * NdL;
  }
  vec3 Fr = F0 + (max(vec3(1.0-rough),F0)-F0)*pow(1.0-NdV,5.0);
  col += env(reflect(-V,N), rough) * Fr;
  col += dif * mix(vec3(0.10,0.11,0.13), vec3(0.20,0.23,0.28), N.y*0.5+0.5);
  col += emis;
  col = col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);   // ACES 톤매핑
  o = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;
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

  const st = { ready:false, failed:false, gl:null, cv:null, prog:null, sprog:null, u:{}, su:{}, parts:{}, shield:null, tex:null, texCv:null, gauge:-1 };
  const FOV = 56 * Math.PI/180, NEAR = 0.03, FAR = 30;

  function compile(gl, type, src){
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs, names){
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return [p, u];
  }
  function upload(gl, prog, d){
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const attr = (name, data, n) => { const loc = gl.getAttribLocation(prog, name); if (loc < 0) return;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    attr('aPos', d.pos, 3); attr('aNor', d.nor, 3); attr('aCol', d.col, 3); attr('aMat', d.mat, 4); attr('aUv', d.uv, 2);
    gl.bindVertexArray(null);
    const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
    for (let i=0;i<d.pos.length;i+=3) for (let k=0;k<3;k++){ const v = d.pos[i+k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
    return { vao, count: d.pos.length/3, mn, mx };
  }

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
    const gl = st.gl; gl.bindTexture(gl.TEXTURE_2D, st.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  function load(){
    if (st.ready || st.failed) return;
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', { alpha:true, premultipliedAlpha:true, antialias:true });
      if (!gl) throw new Error('WebGL2 없음');
      st.gl = gl; st.cv = cv;
      [st.prog, st.u] = program(gl, VS, FS, ['uM','uT','uProj','uTex','uCells','uHot','uGlow','uShield']);
      [st.sprog, st.su] = program(gl, SVS, SFS, ['uProj','uDim','uOff','uTime','uK','uFade','uLow','uHit']);
      st.parts = {
        hammer: upload(gl, st.prog, buildHammer()),
        handR: upload(gl, st.prog, buildHand(-1)), handL: upload(gl, st.prog, buildHand(1)),
        foreR: upload(gl, st.prog, buildForearm(1)), foreL: upload(gl, st.prog, buildForearm(-1)),
        upper: upload(gl, st.prog, buildUpper()),
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
      // 그림판 텍스처
      st.texCv = document.createElement('canvas'); st.texCv.width = st.texCv.height = 512;
      st.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, st.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      paintDecals(100);
      st.ready = true;
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.ready = false; });
      // 글꼴이 늦게 도착하면 명판을 다시 그린다
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.ready){ const p = st.gauge; st.gauge = -1; paintDecals(p); } });
    } catch(e){
      st.failed = true;
      console.warn('[Titan3D] 3D 망치를 준비하지 못해 2D 망치를 씁니다:', e && e.message);
    }
  }

  // ── 그리기 공통 ─────────────────────────────────────────────
  function proj(W, H){
    const fy = 1/Math.tan(FOV/2), fx = fy*H/W;
    return [fx, fy, (FAR+NEAR)/(NEAR-FAR), 2*FAR*NEAR/(NEAR-FAR)];
  }
  const toScreen = (p, pr, W, H) => p[2] > -NEAR ? null : [(p[0]*pr[0]/-p[2]*0.5+0.5)*W, (0.5-p[1]*pr[1]/-p[2]*0.5)*H];
  function begin(ctx){
    const gl = st.gl, cv = st.cv, W = ctx.canvas.width, H = ctx.canvas.height;
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
    return [gl, W, H, proj(W, H)];
  }

  // 자세 만들기: p = 두 손 사이 자루 위 기준점의 위치, d = 자루 방향(폼멜 → 머리), f = 타격면이 향하는 방향
  function pose(p, d, f){
    const Y = norm(d), Z = mul(orth(f, Y), -1), X = cross(Y, Z);
    return { p: p.slice(), q: quatFromMat([X, Y, Z]) };
  }
  const mix = (A, B, u) => ({ p: [A.p[0]+(B.p[0]-A.p[0])*u, A.p[1]+(B.p[1]-A.p[1])*u, A.p[2]+(B.p[2]-A.p[2])*u], q: slerp(A.q, B.q, u) });

  // 2관절 팔: 어깨 S에서 손목 Wp까지. 닿지 않으면 어깨가 따라 나감(몸을 기울임)
  function solveArm(S, Wp, hint){
    let v = sub(Wp, S), d = len(v); const max = (UPPER+FORE)*0.985;
    if (d > max){ S = add(S, mul(v, (d-max)/d)); v = sub(Wp, S); d = max; }
    const dir = mul(v, 1/d), a = (UPPER*UPPER - FORE*FORE + d*d)/(2*d), h = Math.sqrt(Math.max(0, UPPER*UPPER - a*a));
    return { S, E: add(add(S, mul(dir, a)), mul(orth(hint, dir), h)) };
  }

  // 망치 + 두 팔 그리기 (1인칭 원근)
  //  P: pose()/mix()로 만든 자세.  o.cells: 에너지 셀 3개의 밝기, o.hot: 타격면 열기, o.glow: 푸른 선 밝기, o.shield: 방어막 빛(0~1), o.charge: 계기판 충전(0~100)
  //  돌려주는 값: 화면 좌표(캔버스 픽셀) {face, head, rear, top, bottom, cells, ring, scale} — 궤적·빛 번짐 효과용
  function drawRig(ctx, P, o = {}){
    if (!st.ready) return null;
    const [gl, W, H, pr] = begin(ctx);
    if (o.charge != null){ const c = Math.max(0, Math.min(100, Math.round(o.charge))); if (c !== st.gauge) paintDecals(c); }
    // 화면이 좁으면 무기가 잘리지 않게 안쪽으로 당김
    const narrow = Math.max(0, 1.6 - W/H) * 0.16;
    const R = matFromQuat(P.q), Yh = R[1];
    const T = sub([P.p[0]-narrow, P.p[1], P.p[2]], mv(R, [0, GRIP_Y, 0]));
    const at = q => add(mv(R, q), T);
    const items = [{ m: st.parts.hammer, R, T }];
    for (const s of [1, -1]){                                  // s = 1 오른팔, -1 왼팔
      const hp = at([0, s > 0 ? HAND_R : HAND_L, 0]);
      const hint = [s*0.75, -0.62, 0.25];
      let S = [s*0.21 - narrow*0.5, -0.235, 0.13], X = orth(sub(S, hp), Yh), Zh, wp, arm;
      for (let it=0; it<3; it++){                              // 손목 방향 ↔ 팔꿈치 자리를 몇 번 주고받아 맞춤
        Zh = cross(X, Yh);
        wp = add(hp, add(mul(X, WRIST[0]), mul(Zh, -s*WRIST[2])));
        arm = solveArm(S, wp, hint);
        X = orth(sub(arm.E, hp), Yh);
      }
      Zh = cross(X, Yh); wp = add(hp, add(mul(X, WRIST[0]), mul(Zh, -s*WRIST[2])));
      arm = solveArm(S, wp, hint);
      const back = mul(Zh, -s);                                // 손등이 향하는 쪽
      const Zf = norm(sub(arm.E, wp)), Yf = orth(back, Zf), Xf = cross(Yf, Zf);
      const Zu = norm(sub(arm.S, arm.E)), Yu = orth(Yf, Zu), Xu = cross(Yu, Zu);
      items.push({ m: s > 0 ? st.parts.handR : st.parts.handL, R: [X, Yh, Zh], T: hp });
      items.push({ m: s > 0 ? st.parts.foreR : st.parts.foreL, R: [Xf, Yf, Zf], T: wp });
      items.push({ m: st.parts.upper, R: [Xu, Yu, Zu], T: arm.E });
    }
    // 차지하는 화면 영역만 지우고 옮긴다
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, full = false;
    for (const it of items){ const m = it.m;
      for (const ax of [m.mn[0], m.mx[0]]) for (const ay of [m.mn[1], m.mx[1]]) for (const az of [m.mn[2], m.mx[2]]){
        const q = toScreen(add(mv(it.R, [ax,ay,az]), it.T), pr, W, H);
        if (!q){ full = true; continue; }
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      } }
    if (full){ x0 = 0; y0 = 0; x1 = W; y1 = H; }
    x0 = Math.max(0, Math.floor(x0)-2); y0 = Math.max(0, Math.floor(y0)-2); x1 = Math.min(W, Math.ceil(x1)+2); y1 = Math.min(H, Math.ceil(y1)+2);
    if (x1 > x0 && y1 > y0){
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H-y1, x1-x0, y1-y0);
      gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(st.prog);
      gl.uniform4fv(st.u.uProj, pr);
      const c = o.cells || [1,1,1];
      gl.uniform3f(st.u.uCells, c[0], c[1], c[2]);
      gl.uniform1f(st.u.uHot, o.hot ?? 0); gl.uniform1f(st.u.uGlow, o.glow ?? 1); gl.uniform1f(st.u.uShield, o.shield ?? 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex); gl.uniform1i(st.u.uTex, 0);
      for (const it of items){
        gl.bindVertexArray(it.m.vao);
        gl.uniformMatrix3fv(st.u.uM, false, [...it.R[0], ...it.R[1], ...it.R[2]]);
        gl.uniform3fv(st.u.uT, it.T);
        gl.drawArrays(gl.TRIANGLES, 0, it.m.count);
      }
      gl.bindVertexArray(null); gl.disable(gl.SCISSOR_TEST);
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      ctx.drawImage(st.cv, x0, y0, x1-x0, y1-y0, x0, y0, x1-x0, y1-y0);
      ctx.restore();
    }
    return marks(at, pr, W, H);
  }
  // 효과용 표식 자리 (화면 좌표, 캔버스 픽셀. 눈 뒤로 넘어간 점은 null)
  function marks(at, pr, W, H){
    const S2 = q => toScreen(at(q), pr, W, H);
    const face = at([0, HY, -0.27]);
    return { face: S2([0,HY,-0.27]), head: S2([0,HY,0]), rear: S2([0,HY-0.066,0.25]), ring: S2([0,0.512,0]),
             top: S2([0,HY+0.125,-0.2]), bottom: S2([0,HY-0.125,-0.2]),
             cells: [-0.062,0,0.062].map(x => S2([x,HY-0.066,0.2])),
             scale: face[2] < -NEAR ? pr[1]*H/2/-face[2] : 0 };     // 1미터가 타격면 자리에서 몇 픽셀인지
  }
  // 그리지 않고 표식 자리만 계산 (휘두르는 궤적을 지난 자세들로 그릴 때 씀)
  function points(ctx, P){
    const W = ctx.canvas.width, H = ctx.canvas.height, pr = proj(W, H);
    const narrow = Math.max(0, 1.6 - W/H) * 0.16;
    const R = matFromQuat(P.q), T = sub([P.p[0]-narrow, P.p[1], P.p[2]], mv(R, [0, GRIP_Y, 0]));
    return marks(q => add(mv(R, q), T), pr, W, H);
  }

  // 방어막 그리기. o.k: 펼쳐진 정도(0~1), o.fade: 남은 정도(1→0 꺼짐), o.time: 초, o.low: 곧 꺼짐 경고(0~1)
  //  o.hits: [{x: 화면 가로 위치(-1~1), y: 세로(-1~1), age: 초}] 최대 4개,  o.ox/oy: 살짝 밀리는 양(미터)
  const SH = { hw: 0.74, hh: 0.60, dist: 1.62, bend: 0.17, y: 0.02, x: -0.10 };
  function drawShield(ctx, o){
    if (!st.ready) return false;
    const [gl, W, H, pr] = begin(ctx);
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
    ctx.drawImage(st.cv, 0, 0);
    return true;
  }

  // 부품 하나만 보기 (모양 확인용)
  function view(ctx, name, R, T){
    if (!st.ready) return;
    const [gl, W, H, pr] = begin(ctx);
    gl.disable(gl.SCISSOR_TEST); gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.useProgram(st.prog);
    gl.uniform4fv(st.u.uProj, pr); gl.uniform3f(st.u.uCells, 1,1,1); gl.uniform1f(st.u.uHot, 0); gl.uniform1f(st.u.uGlow, 1); gl.uniform1f(st.u.uShield, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex); gl.uniform1i(st.u.uTex, 0);
    const m = st.parts[name]; gl.bindVertexArray(m.vao);
    gl.uniformMatrix3fv(st.u.uM, false, [...R[0], ...R[1], ...R[2]]); gl.uniform3fv(st.u.uT, T);
    gl.drawArrays(gl.TRIANGLES, 0, m.count); gl.bindVertexArray(null);
    ctx.drawImage(st.cv, 0, 0);
  }

  return { load, pose, mix, drawRig, drawShield, points, view, rotX, rotY, rotZ, mm: (A,B) => B.map(c => mv(A,c)),
           get ready(){ return st.ready; }, get failed(){ return st.failed; } };
})();

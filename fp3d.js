// ═══════════════════════════════════════════════════════════════
//  fp3d.js — 1인칭 3D 장비 공용 엔진 (타이탄 망치, 스파크 소총, 메디카 저격총, 3D 맵의 적이 같이 씀)
//  · 외부 라이브러리·모델 파일 없음: 모든 형태를 코드로 직접 빚는다 (깎인 모서리 상자, 회전체, 가시 …)
//  · 장갑 낀 손은 쥔 물건 굵기에 맞춰 손가락이 감기고, 팔뚝·위팔은 어깨에서 손목까지 관절 계산(2관절 IK)으로 따라온다
//  · 금속 PBR(GGX) 조명 + 가짜 환경 반사 + 스스로 빛나는 부분(묶음별 밝기 조절)
//  · WebGL2가 없으면 ready=false → 게임은 2D 그림을 그대로 쓴다
//  좌표: 보기 공간 — 눈이 원점, x 오른쪽, y 위, -z 앞. 단위는 대략 미터
// ═══════════════════════════════════════════════════════════════
const FP3D = (() => {
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


  // ── 장갑 손·팔 (영웅마다 색만 바꿔 씀) ───────────────────────
  //  색 묶음: glove 속 장갑, arm 장갑판, arm2 밝은 장갑판, trim 강조색, steel 관절, glow 빛줄 색
  const STEEL = ['#7b838e', 1, 0.36], DARK = ['#2a2e35', 0.9, 0.52];
  const PAL_TITAN = { glove:['#13161b',0,0.78], arm:['#1b4c9c',0.75,0.34], arm2:['#2a66c4',0.75,0.30], trim:['#ee7d18',0.35,0.42], steel:STEEL, glow:'#3d9bff' };
  // 쥔 손. 손 좌표: x = 손목 쪽, y = 쥔 물건의 축(엄지·검지 쪽이 +), z = 손등 쪽. s = -1이면 오른손(z를 뒤집음)
  //  손가락은 마디마다 둥근 토막(캡슐)을 물건 둘레로 말아 붙이고, 바깥쪽에 장갑판을 얹는다
  //  o.R: 쥔 물건의 반지름 (굵을수록 손가락이 덜 감김), o.trigger: 검지를 방아쇠에 걸침
  function buildHand(s, pal = PAL_TITAN, o = {}){
    const b = Builder(), R = o.R ?? 0.0245, dR = R - 0.0245, rho = R + 0.0255;
    const seg = (p0, p1, y0, y1, r, plate, tip) => {
      const a = [p0[0], y0, p0[1]], c = [p1[0], y1, p1[1]], d = sub(c, a), L = len(d), Z = norm(d);
      const Yl = orth([0,1,0], Z), X = cross(Yl, Z);
      const mid = mul(add(a, c), 0.5), out = dot(X, [mid[0], 0, mid[2]]) > 0 ? 1 : -1;
      b.at([X, Yl, Z], a, () => {
        b.mat(...pal.glove);
        b.lathe([0,0,0], [0,0,1], [0,1,0], [[-r*0.55,r*0.55],[-r*0.1,r*0.96,r],[L+r*0.1,r*0.96,r],[L+r*(tip?0.75:0.55),r*(tip?0.5:0.55)]], 10, {smooth:true});
        if (plate){ b.mat(...plate); b.box([out*(r*0.93), 0, L*0.5], [r*0.5, r*1.55, L*0.74], r*0.2); }
      });
    };
    const at = (a, rr) => [-rr*Math.sin(a), rr*Math.cos(a)];           // 물건 둘레의 한 점 (손등 쪽에서 손가락 쪽으로 돌아감)
    const step = c => 2*Math.asin(Math.min(0.99, c/(2*rho)));
    b.at([[1,0,0],[0,1,0],[0,0,s]], [0,0,0], () => {
      // 손등: 속 장갑 → 장갑판 → 가운데 돋은 판 + 빛줄 + 손목 쪽 강조 띠
      b.mat(...pal.glove); b.box([0.012+dR*0.5,0,0.040+dR], [0.092+dR,0.098,0.026], 0.009);
      b.mat(...pal.arm);   b.box([0.014+dR*0.5,0,0.0545+dR], [0.070+dR,0.090,0.012], 0.0045);
      b.mat(...pal.arm2);  b.box([0.020+dR*0.5,0,0.0615+dR], [0.040,0.056,0.006], 0.0025);
      b.mat(pal.glow, 0, 0.3, 2.0, 5); b.box([0.020+dR*0.5,0,0.0648+dR], [0.020,0.007,0.002]);
      b.mat(...pal.trim);  b.box([0.048+dR,0,0.0585+dR], [0.008,0.082,0.009], 0.0025);
      const ys = [-0.0358,-0.0120,0.0120,0.0358];
      ys.forEach((y, i) => {
        const r = i === 0 ? 0.0100 : 0.0112, k = i === 0 ? 0.94 : 1;      // 새끼손가락은 조금 가늘고 짧게
        const a0 = 0.63*0.05/rho;
        let MCP = at(a0, rho), PIP, DIP, TIP;
        if (o.trigger && i === 3){                                         // 검지: 덜 구부려 방아쇠에 걸침
          PIP = [MCP[0]-0.040, MCP[1]-0.018]; DIP = [PIP[0]-0.016, PIP[1]-0.036]; TIP = [DIP[0]+0.012, DIP[1]-0.030];
        } else {
          const a1 = a0+step(0.054*k), a2 = a1+step(0.046*k), a3 = a2+step(0.039*k);
          PIP = at(a1, rho); DIP = at(a2, rho); TIP = at(a3, rho-0.006);
        }
        seg(MCP, PIP, y, y, r, pal.arm);
        seg(PIP, DIP, y, y, r, pal.arm);
        seg(DIP, TIP, y, y, r*0.94, pal.trim, true);
        b.at(rotY(-0.72), [MCP[0]-0.004, y, MCP[1]+0.004], () => { b.mat(...pal.trim); b.box([0,0,0], [0.030,r*1.86,0.022], 0.007); });   // 주먹 관절 덮개
        b.at(rotY(0.80), [PIP[0]-0.003, y, PIP[1]-0.004], () => { b.mat(...pal.steel); b.box([0,0,0], [0.016,r*1.7,0.018], 0.005); });    // 가운데 관절 덮개
      });
      // 손바닥 두덩
      b.mat(...pal.glove); b.box([0.047+dR,0.0,0.004], [0.032,0.094,0.060], 0.011);
      // 엄지: 두덩에서 나와 검지 위에서 물건을 반대쪽으로 감쌈
      b.box([0.044+dR,0.046,-0.004], [0.036,0.036,0.044], 0.012);
      seg([0.046+dR,-0.022], [0.006+dR*0.3,-0.049-dR], 0.056, 0.060, 0.0128, pal.arm);
      seg([0.006+dR*0.3,-0.049-dR], [-0.034-dR*0.4,-0.036-dR], 0.060, 0.057, 0.0120, pal.trim, true);
      // 손목 (팔뚝과 이어지는 관절)
      b.mat(...pal.glove); b.box([0.078+dR,0,0.012], [0.046,0.076,0.058], 0.017);
    });
    const d = b.data(); d.wrist = [0.088+dR, 0, 0.012];
    return d;
  }
  // 팔뚝. 좌표: 손목 = 원점, +z = 팔꿈치 쪽, +y = 손등 쪽.  extra(b): 계기판·글자 같은 덧붙임
  const FORE = 0.31, UPPER = 0.36;
  function buildForearm(pal = PAL_TITAN, extra, thick = 1){
    const b = Builder(), Z = [0,0,1], Y = [0,1,0];
    const L = (secs, o) => b.lathe([0,0,0], Z, Y, secs, 8, o);
    b.at([[thick,0,0],[0,thick,0],[0,0,1]], [0,0,0], () => {
    b.mat(...pal.glove); L([[-0.012,0.030,0.026],[0.0,0.036,0.030],[0.034,0.038,0.032]], {cap0:true});
    b.mat(...pal.trim);  L([[0.030,0.045,0.039],[0.036,0.048,0.042],[0.047,0.048,0.042],[0.052,0.045,0.039]]);
    b.mat(...pal.arm);   L([[0.052,0.045,0.039],[0.185,0.058,0.050],[0.192,0.054,0.046]]);
    b.mat(...DARK);      L([[0.192,0.051,0.044],[0.212,0.052,0.045]]);
    b.mat(...pal.arm);   L([[0.212,0.056,0.048],[0.218,0.060,0.052],[0.30,0.058,0.052],[FORE+0.02,0.050,0.046]]);
    b.mat(...pal.arm2);  b.box([0,0.044,0.118], [0.058,0.014,0.118], 0.005);                    // 손등 쪽 장갑판
    b.mat(...pal.trim);  b.box([0,0.0515,0.070], [0.05,0.004,0.010]); b.box([0,0.0515,0.166], [0.05,0.004,0.010]);
    for (const sx of [-1,1]){
      b.mat(...pal.arm2); b.box([sx*0.050,0.0,0.125], [0.012,0.046,0.11], 0.004);
      b.mat(pal.glow, 0, 0.3, 1.8, 5); b.box([sx*0.0565,0.0,0.125], [0.003,0.008,0.08]);
    }
    if (extra) extra(b);
    b.mat(...pal.glove); b.lathe([0,0,FORE], Z, Y, [[-0.02,0.046],[0.0,0.052],[0.02,0.046]], 8);   // 팔꿈치 관절
    });
    return b.data();
  }
  // 위팔. 좌표: 팔꿈치 = 원점, +z = 어깨 쪽
  function buildUpper(pal = PAL_TITAN, thick = 1){
    const b = Builder(), Z = [0,0,1], Y = [0,1,0];
    b.at([[thick,0,0],[0,thick,0],[0,0,1]], [0,0,0], () => {
    b.mat(...pal.glove); b.lathe([0,0,0], Z, Y, [[0.0,0.048],[0.05,0.052]], 8);
    b.mat(...pal.trim);  b.lathe([0,0,0], Z, Y, [[0.05,0.060],[0.064,0.060]], 8);
    b.mat(...pal.arm);   b.lathe([0,0,0], Z, Y, [[0.064,0.060],[0.09,0.068],[0.60,0.078]], 8);
    b.mat(...pal.arm2);  b.box([0,0.062,0.26], [0.07,0.016,0.30], 0.006);
    });
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
uniform float uE[8];        // 발광 묶음별 밝기 (묶음 0 = 늘 1)
uniform vec3 uFront;        // 앞쪽에서 비치는 빛 (방어막의 푸른 빛, 총구 화염의 주황빛)
uniform vec3 uTint; uniform float uFlash;   // 전체 색조·맞았을 때 번쩍임 (적 모델용)
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
  col += uFront*0.42*smoothstep(0.2,-0.9,r.z);                           // 앞쪽 빛이 금속에 비침
  return col;
}
void main(){
  vec3 N = normalize(vN), V = normalize(-vP);
  if (dot(N,V) < 0.0) N = -N;
  vec3 base = vCol*uTint; float metal = vMat.x, rough = vMat.y, em = vMat.z, grp = vMat.w;
  vec3 emis = vec3(0.0);
  if (vUv.x >= 0.0){                                // 글자·계기판 그림
    vec3 tx = pow(texture(uTex, vUv).rgb, vec3(2.2));
    base *= tx;
    emis = tx * smoothstep(0.25,0.7,max(tx.r,max(tx.g,tx.b))) * em;
    rough = mix(rough, 0.7, 1.0 - min(1.0, tx.g*3.0));
  } else if (em > 0.0){
    emis = vCol * em * uE[int(grp+0.5)];
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
  Ls[3] = normalize(vec3(-0.25, 0.05,-0.97)); Lc[3] = uFront;   // 앞쪽 빛
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
  col = mix(col, vec3(1.0,0.95,0.9)*1.6, uFlash);
  col = col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);   // ACES 톤매핑
  o = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;

  // ── WebGL 준비 (모든 3D 장비가 캔버스 하나를 같이 씀) ─────────
  const st = { ready:false, failed:false, gl:null, cv:null, prog:null, u:{}, white:null };
  const FOV = 56 * Math.PI/180, NEAR = 0.03, FAR = 30;
  const U_NAMES = ['uM','uT','uProj','uTex','uE','uFront','uTint','uFlash'];
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
  function uploadRaw(gl, prog, d){
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

  function init(){
    if (st.ready || st.failed) return st.ready;
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', { alpha:true, premultipliedAlpha:true, antialias:true });
      if (!gl) throw new Error('WebGL2 없음');
      st.gl = gl; st.cv = cv;
      [st.prog, st.u] = program(gl, VS, FS, U_NAMES);
      st.white = texture(null);
      st.ready = true;
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.ready = false; });
    } catch(e){
      st.failed = true;
      console.warn('[FP3D] 3D 장비를 준비하지 못해 2D 그림을 씁니다:', e && e.message);
    }
    return st.ready;
  }
  const mesh = d => { const m = uploadRaw(st.gl, st.prog, d); if (d.wrist) m.wrist = d.wrist; return m; };
  // 텍스처 만들기/다시 올리기 (글자·계기판을 그린 2D 캔버스)
  function texture(canvas, tex){
    const gl = st.gl; tex = tex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (canvas) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
    if (canvas) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, canvas ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
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
  // 무기 자세를 방향으로 만들기: p 위치, fwd 무기 앞(-z)이 향할 방향, up 무기 위(+y)가 향할 방향
  function aim(p, fwd, up){
    const Z = mul(norm(fwd), -1), Y = orth(up, Z), X = cross(Y, Z);
    return { p: p.slice(), R: [X, Y, Z] };
  }

  // 한 팔 붙이기: 손이 쥔 자리 hp와 쥔 물건의 축 Yh에서 손·팔뚝·위팔의 그릴 목록을 만든다
  //  s = 1 오른팔, -1 왼팔.  a.hand/fore/upper: 부품, a.fixedX: 손목이 향할 방향을 고정(없으면 팔꿈치 쪽으로 자연히 돌아감)
  //  a.shoulder: 어깨 자리, a.hint: 팔꿈치가 벌어지는 방향
  function arm(items, s, hp, Yh, a){
    const S = a.shoulder || [s*0.21, -0.235, 0.13], hint = a.hint || [s*0.75, -0.62, 0.25], W = a.hand.wrist;
    let X = a.fixedX ? orth(a.fixedX, Yh) : orth(sub(S, hp), Yh), Zh, wp, r;
    for (let it=0; it<3; it++){                                // 손목 방향 ↔ 팔꿈치 자리를 몇 번 주고받아 맞춤
      Zh = cross(X, Yh);
      wp = add(hp, add(mul(X, W[0]), mul(Zh, -s*W[2])));
      r = solveArm(S, wp, hint);
      if (a.fixedX) break;
      X = orth(sub(r.E, hp), Yh);
    }
    if (!a.fixedX){ Zh = cross(X, Yh); wp = add(hp, add(mul(X, W[0]), mul(Zh, -s*W[2]))); r = solveArm(S, wp, hint); }
    const back = mul(Zh, -s);                                  // 손등이 향하는 쪽
    const Zf = norm(sub(r.E, wp)), Yf = orth(back, Zf), Xf = cross(Yf, Zf);
    const Zu = norm(sub(r.S, r.E)), Yu = orth(Yf, Zu), Xu = cross(Yu, Zu);
    items.push({ m: a.hand, R: [X, Yh, Zh], T: hp }, { m: a.fore, R: [Xf, Yf, Zf], T: wp }, { m: a.upper, R: [Xu, Yu, Zu], T: r.E });
  }

  // 그릴 목록을 한 번에 그려(서로 깊이로 가려짐) 2D 화면에 옮겨 붙인다. 차지한 영역만 지우고 옮김
  //  items: [{ m 부품, R 회전(열 3개), T 위치, tex?, tint?, flash? }],  o.E: 발광 묶음 밝기 8개, o.front: 앞쪽 빛 [r,g,b], o.full: 화면 전체
  function draw(ctx, items, o = {}){
    if (!st.ready || !items.length) return;
    const [gl, W, H, pr] = begin(ctx);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, full = !!o.full;
    if (!full) for (const it of items){ const m = it.m;
      for (const ax of [m.mn[0], m.mx[0]]) for (const ay of [m.mn[1], m.mx[1]]) for (const az of [m.mn[2], m.mx[2]]){
        const q = toScreen(add(mv(it.R, [ax,ay,az]), it.T), pr, W, H);
        if (!q){ full = true; continue; }
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      } }
    if (full){ x0 = 0; y0 = 0; x1 = W; y1 = H; }
    x0 = Math.max(0, Math.floor(x0)-2); y0 = Math.max(0, Math.floor(y0)-2); x1 = Math.min(W, Math.ceil(x1)+2); y1 = Math.min(H, Math.ceil(y1)+2);
    if (x1 <= x0 || y1 <= y0) return;
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H-y1, x1-x0, y1-y0);
    gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(st.prog);
    gl.uniform4fv(st.u.uProj, pr);
    const E = new Float32Array(8).fill(1); if (o.E) for (let i=0;i<8;i++) if (o.E[i] != null) E[i] = o.E[i];
    gl.uniform1fv(st.u.uE, E);
    gl.uniform3fv(st.u.uFront, o.front || [0,0,0]);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(st.u.uTex, 0);
    for (const it of items){
      gl.bindTexture(gl.TEXTURE_2D, it.tex || o.tex || st.white);
      gl.uniform3fv(st.u.uTint, it.tint || [1,1,1]); gl.uniform1f(st.u.uFlash, it.flash || 0);
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
  // 보기 공간의 점 → 화면 좌표 (캔버스 픽셀). 눈 뒤면 null
  function screen(ctx, p){ const W = ctx.canvas.width, H = ctx.canvas.height; return toScreen(p, proj(W, H), W, H); }
  // 1미터가 깊이 z에서 몇 픽셀인지
  function pxPerM(ctx, z){ return z < -NEAR ? proj(1, 1)[1]*ctx.canvas.height/2/-z : 0; }
  // 화면이 좁으면 무기가 잘리지 않게 안쪽으로 당기는 양
  const narrow = ctx => Math.max(0, 1.6 - ctx.canvas.width/ctx.canvas.height) * 0.16;

  return { init, get ready(){ return st.ready; }, get failed(){ return st.failed; }, st,
           V: { add, sub, mul, dot, cross, len, norm, orth, mv, I3, rotX, rotY, rotZ, quatFromMat, matFromQuat, slerp },
           Builder, hex, mesh, texture, program, begin, proj, toScreen, screen, pxPerM, narrow,
           pose, mix, aim, solveArm, arm, draw,
           buildHand, buildForearm, buildUpper, PAL_TITAN, STEEL, DARK, FORE, UPPER, NEAR };
})();

// ═══════════════════════════════════════════════════════════════
//  world3d.js — 3D 맵 표시기 (시안: NEO BUSAN 네온 거리)
//  · 격자 맵 한 장에서 입체 도시를 만든다: 높이가 다른 건물, 낮은 엄폐물(상자·방호벽), 기둥, 가로등, 네온 간판
//  · 조명: 노을빛 방향광 + 하늘빛 + 간판·가로등의 점광원 16개 + 젖은 노면 반사 + 거리 안개
//  · 하늘: 노을 그러데이션, 별, 멀리 보이는 도시 윤곽 (셰이더 한 장)
//  · 적도 3D 로봇으로 그려 건물·엄폐물과 깊이로 서로 가려진다 (fp3d.js의 형태 빚기·금속 셰이더를 같이 씀)
//  · 게임 규칙(이동·충돌·사격 판정)은 2D 격자 그대로 — 이 파일은 '보이는 것'만 담당한다
//  좌표: 맵 (x, y) → 세계 (x, 높이, z=y). 눈높이 0.5, 맵 한 칸 = 1
// ═══════════════════════════════════════════════════════════════
const World3D = (() => {
  'use strict';
  const st = { ready:false, failed:false, prog:null, u:{}, sky:null, su:{}, tri:null, mesh:null, lights:[], atlas:null, bot:null, built:null, W:0, H:0 };
  const VFOV = 62*Math.PI/180, NEAR = 0.04, FAR = 90, EYE = 0.5;
  const hash = (x, y, k=0) => { const s = Math.sin(x*127.1 + y*311.7 + k*74.7)*43758.5453; return s - Math.floor(s); };

  // ── 간판 그림판 (1024×1024): 가로 간판 8개 + 세로 간판 4개 ──
  const SIGNS_H = [['부산 BUSAN','#ff3d81'],['OVERSHOT','#39d3e0'],['라면 · 24H','#ffb52e'],['TANKER ZONE','#ff5a3c'],
                   ['방어막 활성','#4aa8ff'],['NEON 네온','#b46bff'],['MEDI +','#58f0a0'],['KAGE 影','#e8c56e']];
  const SIGNS_V = [['해운대','#ff3d81'],['광안리','#39d3e0'],['자갈치','#ffb52e'],['남포동','#b46bff']];
  const rgb = h => { const n = parseInt(h.slice(1),16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; };
  function paintAtlas(){
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#05060a'; x.fillRect(0,0,1024,1024);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const F = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Orbitron,Arial,sans-serif';
    SIGNS_H.forEach(([t, col], i) => {
      const ox = (i%2)*512, oy = Math.floor(i/2)*128;
      x.fillStyle = '#0a0c14'; x.fillRect(ox+6, oy+6, 500, 116);
      x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18; x.strokeRect(ox+14, oy+14, 484, 100);
      x.fillStyle = '#ffffff'; x.font = '900 62px '+F; x.shadowBlur = 26; x.fillText(t, ox+256, oy+66, 450);
      x.fillStyle = col; x.globalAlpha = 0.55; x.fillText(t, ox+256, oy+66, 450); x.globalAlpha = 1; x.shadowBlur = 0;
    });
    SIGNS_V.forEach(([t, col], i) => {
      const ox = i*256, oy = 512;
      x.fillStyle = '#0a0c14'; x.fillRect(ox+38, oy+6, 180, 500);
      x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18; x.strokeRect(ox+46, oy+14, 164, 484);
      x.font = '900 118px '+F; x.shadowBlur = 26;
      [...t].forEach((ch, k) => { x.fillStyle = '#ffffff'; x.fillText(ch, ox+128, oy+100+k*150); x.fillStyle = col; x.globalAlpha = 0.55; x.fillText(ch, ox+128, oy+100+k*150); x.globalAlpha = 1; });
      x.shadowBlur = 0;
    });
    return c;
  }

  // ── 셰이더 ────────────────────────────────────────────────
  const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec3 aCol; in vec4 aMat;
uniform mat3 uV; uniform vec3 uEye; uniform vec4 uProj;
out vec3 vW; out vec3 vN; out vec3 vCol; out vec4 vMat; out vec3 vV;
void main(){
  vec3 p = uV*(aPos - uEye);
  vW = aPos; vN = aNor; vCol = aCol; vMat = aMat; vV = p;
  gl_Position = vec4(p.x*uProj.x, p.y*uProj.y, p.z*uProj.z + uProj.w, -p.z);
}`;
  const SKYFN = `
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
const vec3 SUN = vec3(-0.62, 0.16, -0.77);
vec3 skyColor(vec3 d){
  float y = d.y;
  vec3 top = vec3(0.035,0.05,0.16), mid = vec3(0.30,0.12,0.36), hor = vec3(1.0,0.46,0.26);
  vec3 c = mix(hor, mid, smoothstep(0.0,0.22,y)); c = mix(c, top, smoothstep(0.14,0.62,y));
  float sd = max(dot(normalize(d), normalize(SUN)), 0.0);
  c += vec3(1.0,0.55,0.25)*pow(sd, 24.0)*0.9 + vec3(1.0,0.75,0.5)*pow(sd, 400.0)*2.0;
  return c;
}
vec3 fogColor(vec3 d){ return mix(vec3(0.16,0.10,0.24), vec3(0.50,0.24,0.24), max(dot(normalize(vec3(d.x,0.0,d.z)), normalize(vec3(SUN.x,0.0,SUN.z))), 0.0)); }`;
  const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vCol; in vec4 vMat; in vec3 vV;
uniform sampler2D uTex; uniform float uTime;
uniform vec4 uL[16]; uniform vec3 uLc[16]; uniform vec3 uEye;
out vec4 o;
${SKYFN}
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 N = normalize(vN), V = normalize(uEye - vW);
  float kind = vMat.x, seed = vMat.w; vec2 uv = vMat.yz;
  vec3 base = vCol, emis = vec3(0.0); float gloss = 0.0, spec = 0.04;
  if (kind < 0.5){                                   // 바닥: 젖은 아스팔트 + 이음매 + 물웅덩이
    float n = noise(uv*9.0)*0.6 + noise(uv*31.0)*0.4;
    base = vec3(0.060,0.064,0.074)*(0.75+0.5*n);
    vec2 g = abs(fract(uv*0.5)-0.5); float seam = smoothstep(0.012,0.0,min(g.x,g.y));
    base *= 1.0 - 0.45*seam;
    float pud = smoothstep(0.52,0.70, noise(uv*0.9+3.7)*0.7 + noise(uv*2.7)*0.3);
    gloss = mix(0.30, 0.96, pud); spec = mix(0.03, 0.45, pud); base *= mix(1.0, 0.55, pud);
  } else if (kind < 1.5){                            // 건물 벽: 아래층 상가 + 위층 창문 격자
    float h = uv.y; vec3 tone = vCol;
    if (h < 1.12){
      float rib = smoothstep(0.42,0.5,abs(fract(uv.x*7.0)-0.5));
      base = tone*0.42*(0.85+0.3*rib);
      float strip = smoothstep(0.035,0.0,abs(h-1.07));
      vec3 nc = 0.5+0.5*cos(6.2831*(seed+vec3(0.0,0.33,0.67)));
      emis += nc*strip*2.6;
      float door = step(0.7, h21(vec2(floor(uv.x), seed*91.0)))*step(abs(fract(uv.x)-0.5),0.2)*step(h,0.78);
      base = mix(base, vec3(0.03,0.035,0.05), door); gloss = mix(0.2,0.85,door); spec = mix(0.04,0.3,door);
    } else {
      vec2 wc = vec2(uv.x*2.6, (h-1.12)*2.3), wi = floor(wc), wf = fract(wc);
      float win = step(0.16,wf.x)*step(wf.x,0.84)*step(0.18,wf.y)*step(wf.y,0.80);
      float r = h21(wi + seed*57.0);
      float lit = step(0.56, r);
      vec3 wcol = mix(vec3(1.0,0.78,0.45), vec3(0.45,0.85,1.0), step(0.86, r));
      float flick = 0.85 + 0.15*sin(uTime*(1.0+r*3.0) + r*40.0);
      base = mix(tone*(0.55+0.25*noise(uv*vec2(3.0,9.0))), vec3(0.025,0.035,0.06), win);
      emis += wcol*win*lit*1.5*flick*(0.6+0.4*wf.y);
      gloss = mix(0.15, 0.9, win); spec = mix(0.04, 0.4, win);
    }
  } else if (kind < 2.5){                            // 지붕
    base = vCol*0.35*(0.8+0.4*noise(uv*5.0));
  } else if (kind < 3.5){                            // 상자: 테두리 틀 + 가운데 판
    vec2 e = abs(uv-0.5); float fr = step(0.40, max(e.x,e.y));
    float brace = smoothstep(0.05,0.03,abs(uv.x-uv.y))*(1.0-fr);
    base = mix(vCol*(0.8+0.3*noise(uv*vec2(4.0,22.0))), vCol*0.45, max(fr, brace*0.6));
    gloss = 0.3;
  } else if (kind < 4.5){                            // 방호벽: 콘크리트 + 노랑·검정 경고 띠
    base = vec3(0.50,0.50,0.52)*(0.8+0.3*noise(uv*14.0));
    float band = step(0.62,uv.y)*step(uv.y,0.88);
    float stripe = step(0.5, fract((uv.x*3.0+uv.y*1.5)));
    base = mix(base, mix(vec3(0.95,0.72,0.10), vec3(0.05,0.05,0.06), stripe), band);
  } else if (kind < 5.5){                            // 금속 (기둥·가로등 대)
    base = vCol*(0.8+0.3*noise(uv*vec2(6.0,30.0))); base *= 1.0 - 0.5*smoothstep(0.03,0.0,abs(fract(uv.y*5.0)-0.5)); gloss = 0.45; spec = 0.10;
  } else if (kind < 6.5){                            // 스스로 빛나는 것 (가로등 머리·네온 띠)
    emis = vCol*(2.2 + 0.4*sin(uTime*3.0+seed*30.0)); base = vCol*0.2;
  } else {                                           // 간판 (그림판)
    vec3 t = pow(texture(uTex, uv).rgb, vec3(2.2));
    float fl = 0.88 + 0.12*sin(uTime*(5.0+seed*9.0)+seed*50.0); fl *= step(0.04, fract(uTime*0.37+seed*7.3))*0.25+0.75;
    emis = t*3.0*fl; base = t*0.3;
  }
  // 빛: 하늘빛 + 노을 방향광 + 점광원
  vec3 col = base*mix(vec3(0.10,0.07,0.12), vec3(0.14,0.17,0.32), N.y*0.5+0.5);
  vec3 Ls = normalize(SUN); float nl = max(dot(N,Ls),0.0);
  col += base*vec3(1.05,0.50,0.30)*nl;
  vec3 R = reflect(-V, N); vec3 sp = vec3(0.0);
  for (int i=0;i<16;i++){
    vec3 d = uL[i].xyz - vW; float dist = length(d); float a = max(0.0, 1.0-dist/uL[i].w); a *= a;
    if (a <= 0.0) continue;
    vec3 L = d/dist;
    col += base*uLc[i]*a*max(dot(N,L)*0.8+0.2, 0.0)*2.2;
    sp += uLc[i]*a*pow(max(dot(R,L),0.0), mix(6.0,90.0,gloss))*mix(0.5,3.5,gloss);
  }
  // 반사: 하늘과 불빛이 젖은 면·유리에 비침
  float fr = spec + (1.0-spec)*pow(1.0-max(dot(N,V),0.0), 5.0);
  col += (skyColor(R)*0.30*gloss + sp)*fr;
  col += emis;
  float fog = 1.0 - exp(-length(vV)*0.030);
  col = mix(col, fogColor(-V)*0.5, fog);
  col = col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);
  o = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;
  const SKY_VS = `#version 300 es
in vec2 aPos; out vec2 vQ;
void main(){ vQ = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;
  const SKY_FS = `#version 300 es
precision highp float;
in vec2 vQ; uniform vec3 uF, uR; uniform vec2 uTan; uniform float uTime;
out vec4 o;
${SKYFN}
void main(){
  vec3 d = normalize(uF + uR*vQ.x*uTan.x + vec3(0,1,0)*vQ.y*uTan.y);
  vec3 c = skyColor(d);
  // 별
  vec2 sp = vec2(atan(d.z,d.x)*40.0, d.y*60.0); vec2 si = floor(sp);
  float star = step(0.985, h21(si))*smoothstep(0.35,0.0,length(fract(sp)-0.5))*smoothstep(0.2,0.5,d.y);
  c += vec3(0.9,0.95,1.0)*star*(0.6+0.4*sin(uTime*2.0+h21(si)*30.0));
  // 멀리 보이는 도시 윤곽 2겹 (창문 불빛)
  float az = atan(d.z,d.x);
  for (int k=0;k<2;k++){
    float n = k==0 ? 90.0 : 46.0, hh = k==0 ? 0.075 : 0.15;
    float id = floor(az*n/6.2831*6.2831), bh = (0.25+0.75*h11(id+float(k)*77.0))*hh + 0.012;
    if (d.y < bh){
      vec3 b = mix(vec3(0.20,0.10,0.20), vec3(0.085,0.06,0.13), float(k));
      vec2 w = vec2(fract(az*n)*5.0, d.y*(k==0?260.0:170.0)); vec2 wi = floor(w);
      float lit = step(0.72, h21(wi+id*3.1+float(k)*9.0))*step(0.25,fract(w.x))*step(0.3,fract(w.y));
      b += mix(vec3(1.0,0.7,0.4), vec3(0.4,0.8,1.0), step(0.8,h21(wi+id)))*lit*0.55;
      c = b;
    }
  }
  if (d.y < 0.0) c = fogColor(d)*0.5;
  c = c*(2.51*c+0.03)/(c*(2.43*c+0.59)+0.14);
  o = vec4(pow(clamp(c,0.0,1.0), vec3(1.0/2.2)), 1.0);
}`;

  // ── 도시 만들기 ────────────────────────────────────────────
  //  rows: 글자 격자.  '.' 길, '#' 건물, 'B' 낮은 구조물, 'p' 기둥, 'c' 상자 더미(낮은 엄폐물), 'b' 방호벽(낮은 엄폐물)
  const PALETTE = [[0.30,0.33,0.40],[0.20,0.30,0.33],[0.36,0.27,0.24],[0.26,0.26,0.34],[0.32,0.24,0.34]].map(c => c.map(v => v*v));
  function heightOf(rows, x, y){
    const H = rows.length, W = rows[0].length;
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    const ch = rows[y][x];
    if (ch === 'B') return 2.1;
    if (ch !== '#') return 0;
    const edge = x === 0 || y === 0 || x === W-1 || y === H-1;
    const r = hash(Math.floor(x/2), Math.floor(y/2), 3);
    return edge ? 3.2 + Math.floor(r*5)*0.75 : 1.7 + Math.floor(r*3)*0.55;
  }
  function build(rows){
    const H = rows.length, W = rows[0].length;
    const pos=[], nor=[], col=[], mat=[], lights=[];
    const v = (p, n, c, m) => { pos.push(p[0],p[1],p[2]); nor.push(n[0],n[1],n[2]); col.push(c[0],c[1],c[2]); mat.push(m[0],m[1],m[2],m[3]); };
    // 사각형 한 장: 꼭짓점 4개(차례로), 법선, 색, 종류, 무늬 좌표 4개, 씨앗
    const quad = (P, n, c, kind, UV, seed=0) => { for (const i of [0,1,2,0,2,3]) v(P[i], n, c, [kind, UV[i][0], UV[i][1], seed]); };
    // 축에 나란한 상자 (윗면 + 옆면 4개). uvMode: 'cell' 면마다 0~1, 'world' 세계 좌표
    const box = (x0, y0, z0, x1, y1, z1, c, kind, seed=0, topKind=kind) => {
      const U = [[0,0],[1,0],[1,1],[0,1]];
      quad([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], [0,1,0], c, topKind, U, seed);
      quad([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], [0,0,-1], c, kind, U, seed);
      quad([[x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1]], [0,0,1], c, kind, U, seed);
      quad([[x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1]], [-1,0,0], c, kind, U, seed);
      quad([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]], [1,0,0], c, kind, U, seed);
    };
    // 바닥
    quad([[0,0,0],[W,0,0],[W,0,H],[0,0,H]], [0,1,0], [0.06,0.06,0.07], 0, [[0,0],[W,0],[W,H],[0,H]]);
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && rows[y][x] !== '#' && rows[y][x] !== 'B';
    let signN = 0;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      const ch = rows[y][x], h = heightOf(rows, x, y);
      if (h > 0){
        const bid = hash(Math.floor(x/2), Math.floor(y/2), 9), c = ch === 'B' ? [0.10,0.11,0.14] : PALETTE[Math.floor(bid*PALETTE.length)];
        quad([[x,h,y],[x+1,h,y],[x+1,h,y+1],[x,h,y+1]], [0,1,0], c, 2, [[x,y],[x+1,y],[x+1,y+1],[x,y+1]], bid);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const hn = heightOf(rows, x+dx, y+dy); if (hn >= h) continue;
          // 이 면의 양 끝 (바깥에서 봤을 때 왼쪽 → 오른쪽)
          const a = dx ? [x+(dx>0?1:0), y+(dx>0?1:0)] : [x+(dy>0?0:1), y+(dy>0?1:0)];
          const b = dx ? [x+(dx>0?1:0), y+(dx>0?0:1)] : [x+(dy>0?1:0), y+(dy>0?1:0)];
          const ua = dx ? a[1] : a[0], ub = dx ? b[1] : b[0];
          quad([[a[0],hn,a[1]],[b[0],hn,b[1]],[b[0],h,b[1]],[a[0],h,a[1]]], [dx,0,dy], c, 1, [[ua,hn],[ub,hn],[ub,h],[ua,h]], bid);
          if (ch === 'B'){                            // 낮은 구조물: 지붕 둘레 네온 띠
            const nc = rgb(['#39d3e0','#ff3d81'][(x+y)%2]), o2 = 0.012;
            quad([[a[0]+dx*o2,h-0.10,a[1]+dy*o2],[b[0]+dx*o2,h-0.10,b[1]+dy*o2],[b[0]+dx*o2,h-0.04,b[1]+dy*o2],[a[0]+dx*o2,h-0.04,a[1]+dy*o2]], [dx,0,dy], nc, 6, [[0,0],[1,0],[1,1],[0,1]], bid);
          }
          if (!isFloor(x+dx, y+dy) || hn > 0) continue;
          // 간판: 길에 닿은 벽면 일부에 가로 간판, 높은 건물엔 세로 간판
          const r = hash(x*3+dx, y*3+dy, 5), mx = (a[0]+b[0])/2, mz = (a[1]+b[1])/2, o3 = 0.035;
          const tx = (b[0]-a[0]), tz = (b[1]-a[1]);                    // 면을 따라가는 방향 (길이 1)
          if (ch === '#' && r < 0.20 && h >= 1.7){
            const k = signN++ % SIGNS_H.length, w2 = 0.44, y0 = 1.20, y1 = 1.56, u0 = (k%2)*0.5, v0 = Math.floor(k/2)*0.125;
            const P = [[mx-tx*w2+dx*o3,y0,mz-tz*w2+dy*o3],[mx+tx*w2+dx*o3,y0,mz+tz*w2+dy*o3],[mx+tx*w2+dx*o3,y1,mz+tz*w2+dy*o3],[mx-tx*w2+dx*o3,y1,mz-tz*w2+dy*o3]];
            quad(P, [dx,0,dy], [1,1,1], 7, [[u0,v0+0.125],[u0+0.5,v0+0.125],[u0+0.5,v0],[u0,v0]], r);
            lights.push({ p:[mx+dx*0.55, 1.35, mz+dy*0.55], r:4.2, c: rgb(SIGNS_H[k][1]) });
          } else if (ch === '#' && r > 0.80 && h >= 3.2){
            const k = Math.floor(r*97) % SIGNS_V.length, w2 = 0.17, y0 = 1.75, y1 = Math.min(h-0.2, 3.05);
            const u0 = (k*256+38)/1024, u1 = (k*256+218)/1024, vt = 518/1024, vb = 1018/1024;
            const P = [[mx-tx*w2+dx*o3,y0,mz-tz*w2+dy*o3],[mx+tx*w2+dx*o3,y0,mz+tz*w2+dy*o3],[mx+tx*w2+dx*o3,y1,mz+tz*w2+dy*o3],[mx-tx*w2+dx*o3,y1,mz-tz*w2+dy*o3]];
            quad(P, [dx,0,dy], [1,1,1], 7, [[u0,vb],[u1,vb],[u1,vt],[u0,vt]], r);
            lights.push({ p:[mx+dx*0.6, 2.3, mz+dy*0.6], r:4.6, c: rgb(SIGNS_V[k][1]) });
          }
        }
      } else if (ch === 'c'){                          // 상자 더미
        const r = hash(x, y, 1), c = r < 0.5 ? [0.20,0.13,0.07] : [0.07,0.16,0.20];
        box(x+0.06, 0, y+0.06, x+0.94, 0.40, y+0.94, c, 3, r);
        if (r > 0.3) box(x+0.22, 0.40, y+0.26, x+0.72, 0.70, y+0.76, r < 0.5 ? [0.07,0.16,0.20] : [0.24,0.10,0.08], 3, r);
      } else if (ch === 'b'){                          // 방호벽 (옆 칸과 이어지는 방향으로 놓음)
        const along = (rows[y][x-1] === 'b' || rows[y][x+1] === 'b');
        if (along) box(x, 0, y+0.34, x+1, 0.32, y+0.66, [0.5,0.5,0.5], 4);
        else box(x+0.34, 0, y, x+0.66, 0.32, y+1, [0.5,0.5,0.5], 4);
      } else if (ch === 'p'){                          // 기둥 + 빛 고리
        box(x+0.24, 0, y+0.24, x+0.76, 2.5, y+0.76, [0.035,0.04,0.055], 5, hash(x,y,2), 2);
        box(x+0.215, 1.18, y+0.215, x+0.785, 1.26, y+0.785, rgb('#39d3e0'), 6, hash(x,y,4), 6);
        box(x+0.14, 2.5, y+0.14, x+0.86, 2.62, y+0.86, [0.08,0.09,0.11], 5, 0, 2);
        lights.push({ p:[x+0.5, 1.25, y+0.5], r:2.6, c: rgb('#39d3e0').map(q => q*0.6), low:true });
      } else if (rows[y-1] && rows[y-1][x] === '#' && (x*7+y*13)%9 === 0){   // 가로등 (북쪽 벽에 붙여 세움)
        const lx = x+0.5, lz = y+0.10;
        box(lx-0.022, 0, lz-0.022, lx+0.022, 1.42, lz+0.022, [0.07,0.08,0.09], 5);
        box(lx-0.022, 1.38, lz-0.022, lx+0.022, 1.42, lz+0.34, [0.07,0.08,0.09], 5);
        box(lx-0.06, 1.345, lz+0.20, lx+0.06, 1.38, lz+0.36, [1.0,0.78,0.45], 6, hash(x,y,6), 6);
        lights.push({ p:[lx, 1.25, lz+0.3], r:4.4, c:[1.0,0.72,0.40] });
      }
    }
    // 점광원은 16개까지: 간판·가로등을 먼저, 기둥 빛은 남는 자리에
    //  (많으면 맵 전체에 고르게 퍼지도록 건너뛰며 고름)
    const main = lights.filter(l => !l.low), low = lights.filter(l => l.low), pick = [];
    const nMain = Math.min(main.length, 13);
    for (let i=0;i<nMain;i++) pick.push(main[Math.floor(i*main.length/nMain)]);
    for (let i=0;i<low.length && pick.length<16;i++) pick.push(low[Math.floor(i*low.length/Math.min(low.length,16-nMain))] || low[i]);
    return { pos:new Float32Array(pos), nor:new Float32Array(nor), col:new Float32Array(col), mat:new Float32Array(mat), lights: pick.slice(0,16), W, H };
  }

  // ── 적 로봇 (3D) ───────────────────────────────────────────
  //  로봇 좌표: 발밑 = 원점, +y 위, -z 앞(보는 쪽). 키 약 0.62
  function buildBot(){
    const b = FP3D.Builder(), Y = [0,1,0], ZF = [0,0,-1];
    const ARM = ['#7a1f1a',0.6,0.42], DK = ['#1c1e24',0.8,0.5], MET = ['#565c66',1,0.4], RED = '#ff3b2e';
    for (const sx of [-1,1]){                                                  // 다리
      b.mat(...DK);  b.box([sx*0.055,0.09,0.0], [0.05,0.18,0.06], 0.012);
      b.mat(...ARM); b.box([sx*0.055,0.025,-0.015], [0.065,0.05,0.11], 0.012); b.box([sx*0.058,0.20,-0.005], [0.066,0.09,0.075], 0.014);
    }
    b.mat(...DK);  b.box([0,0.25,0], [0.15,0.06,0.09], 0.014);                 // 골반
    b.mat(...ARM); b.box([0,0.37,0.0], [0.21,0.19,0.13], 0.03);                // 몸통
    b.mat(...DK);  b.box([0,0.37,0.065], [0.13,0.15,0.05], 0.012);             // 등 배낭
    b.mat(RED,0,0.3,2.6,1); b.box([0,0.385,-0.066], [0.07,0.035,0.006]);       // 가슴 빛
    b.mat(...MET); b.box([0,0.335,-0.066], [0.10,0.02,0.006]);
    b.mat(...DK);  b.lathe([0,0.465,0], Y, ZF, [[0,0.03],[0.02,0.03]], 8);     // 목
    b.mat(...ARM); b.box([0,0.535,0.0], [0.125,0.10,0.12], 0.026);             // 머리
    b.mat('#0c0d10',0.5,0.25); b.box([0,0.538,-0.058], [0.105,0.042,0.012], 0.004);
    b.mat(RED,0,0.3,3.0,1); b.box([-0.026,0.538,-0.066], [0.026,0.016,0.004]); b.box([0.026,0.538,-0.066], [0.026,0.016,0.004]);   // 눈
    b.mat(...MET); b.box([0.045,0.61,0.02], [0.008,0.06,0.008]);               // 안테나
    for (const sx of [-1,1]){                                                  // 어깨 + 팔
      b.mat(...ARM); b.box([sx*0.135,0.435,0.0], [0.075,0.075,0.10], 0.02);
      b.mat(...DK);  b.box([sx*0.14,0.345,-0.005], [0.045,0.12,0.05], 0.012);
    }
    b.mat(...DK);  b.box([0.14,0.30,-0.07], [0.05,0.05,0.13], 0.012);          // 오른팔: 앞으로 겨눈 총
    b.mat(...MET); b.lathe([0.14,0.30,-0.13], ZF, Y, [[0,0.013],[0.12,0.013]], 8);
    b.mat(RED,0,0.3,2.0,1); b.box([0.14,0.33,-0.09], [0.012,0.006,0.05]);
    b.mat(...DK);  b.box([-0.14,0.27,-0.03], [0.045,0.05,0.09], 0.012);
    return b.data();
  }

  function load(){
    if (st.ready || st.failed) return;
    try {
      if (!FP3D.init()) throw new Error('WebGL2 없음');
      const gl = FP3D.st.gl;
      [st.prog, st.u] = FP3D.program(gl, VS, FS, ['uV','uEye','uProj','uTex','uTime','uL','uLc']);
      [st.sky, st.su] = FP3D.program(gl, SKY_VS, SKY_FS, ['uF','uR','uTan','uTime']);
      st.tri = gl.createVertexArray(); gl.bindVertexArray(st.tri);
      const tb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const tl = gl.getAttribLocation(st.sky, 'aPos'); gl.enableVertexAttribArray(tl); gl.vertexAttribPointer(tl, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      st.atlasCv = paintAtlas(); st.atlas = FP3D.texture(st.atlasCv);
      st.bot = FP3D.mesh(buildBot());
      st.ready = true;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.ready){ st.atlasCv = paintAtlas(); st.atlas = FP3D.texture(st.atlasCv, st.atlas); } });
    } catch(e){
      st.failed = true;
      console.warn('[World3D] 3D 맵을 준비하지 못했습니다:', e && e.message);
    }
  }
  // 맵 올리기 (맵을 고를 때 한 번)
  function setMap(id, rows){
    if (!st.ready || st.built === id) return;
    const gl = FP3D.st.gl, d = build(rows);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const attr = (name, data, n) => { const loc = gl.getAttribLocation(st.prog, name); if (loc < 0) return;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    attr('aPos', d.pos, 3); attr('aNor', d.nor, 3); attr('aCol', d.col, 3); attr('aMat', d.mat, 4);
    gl.bindVertexArray(null);
    st.mesh = { vao, count: d.pos.length/3 }; st.lights = d.lights; st.built = id;
  }

  const proj = (W, H) => { const fy = 1/Math.tan(VFOV/2), fx = fy*H/W; return [fx, fy, (FAR+NEAR)/(NEAR-FAR), 2*FAR*NEAR/(NEAR-FAR)]; };
  // 세계 → 보기 공간 회전 (열 3개). ang = 0이면 +x를 봄, 커지면 오른쪽으로 돎
  const viewRot = a => { const c = Math.cos(a), s = Math.sin(a); return [[-s,0,-c],[0,1,0],[c,0,-s]]; };
  const mv = FP3D.V.mv;

  // 한 화면 그리기: 하늘 → 도시 → 적 로봇.  cam = {x, y, ang},  bots = [{x, y, flash(0~1), fall(0~1), dir}]
  function render(ctx, cam, time, bots){
    if (!st.ready || !st.mesh) return false;
    const [gl, W, H] = FP3D.begin(ctx), pr = proj(W, H); st.W = W; st.H = H;
    const V = viewRot(cam.ang), eye = [cam.x, EYE, cam.y], f = [Math.cos(cam.ang), 0, Math.sin(cam.ang)], r = [-Math.sin(cam.ang), 0, Math.cos(cam.ang)];
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.clearColor(0,0,0,1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 하늘
    gl.disable(gl.DEPTH_TEST); gl.useProgram(st.sky);
    gl.uniform3fv(st.su.uF, f); gl.uniform3fv(st.su.uR, r); gl.uniform2f(st.su.uTan, 1/pr[0], 1/pr[1]); gl.uniform1f(st.su.uTime, time);
    gl.bindVertexArray(st.tri); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 도시
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.useProgram(st.prog);
    gl.uniformMatrix3fv(st.u.uV, false, [...V[0], ...V[1], ...V[2]]); gl.uniform3fv(st.u.uEye, eye); gl.uniform4fv(st.u.uProj, pr); gl.uniform1f(st.u.uTime, time);
    const L = new Float32Array(64), Lc = new Float32Array(48);
    st.lights.forEach((l, i) => { L.set([l.p[0], l.p[1], l.p[2], l.r], i*4); Lc.set(l.c, i*3); });
    gl.uniform4fv(st.u.uL, L); gl.uniform3fv(st.u.uLc, Lc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.atlas); gl.uniform1i(st.u.uTex, 0);
    gl.bindVertexArray(st.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, st.mesh.count);
    // 적 로봇 (공용 금속 셰이더, 같은 깊이 버퍼)
    if (bots && bots.length){
      const P = FP3D.st, u = P.u;
      gl.useProgram(P.prog); gl.uniform4fv(u.uProj, pr);
      gl.uniform1fv(u.uE, new Float32Array([1, 0.9+0.3*Math.sin(time*6), 1,1,1,1,1,1]));
      gl.uniform3f(u.uFront, 0.5, 0.25, 0.45);
      gl.bindTexture(gl.TEXTURE_2D, P.white); gl.uniform1i(u.uTex, 0);
      gl.bindVertexArray(st.bot.vao);
      for (const b of bots){
        const dx = cam.x-b.x, dz = cam.y-b.y, dl = Math.hypot(dx, dz) || 1, fx = dx/dl, fz = dz/dl;   // 로봇은 늘 플레이어를 봄
        let Rm = [[-fz,0,fx],[0,1,0],[-fx,0,-fz]];                              // 열: 오른쪽, 위, 뒤(+z)
        const bob = b.fall ? 0 : Math.sin(time*5 + b.x*3.1 + b.y*1.7)*0.008;
        let T = [b.x, bob, b.y];
        if (b.fall){                                                            // 쓰러짐: 뒤로 넘어가며 가라앉음
          const a = b.fall*b.fall*1.5*(b.dir||1), c = Math.cos(a), s = Math.sin(a);
          const tilt = [[1,0,0],[0,c,s],[0,-s,c]];
          Rm = tilt.map(col => mv(Rm, col)); T = [b.x, -0.12*b.fall*b.fall, b.y];
        }
        const M = Rm.map(col => mv(V, col)), Tv = mv(V, [T[0]-eye[0], T[1]-eye[1], T[2]-eye[2]]);
        const fog = 1 - Math.exp(-dl*0.03), k = (1-fog*0.75)*(b.fall ? 1-0.6*b.fall : 1);
        gl.uniform3f(u.uTint, k, k, k); gl.uniform1f(u.uFlash, b.flash || 0);
        gl.uniformMatrix3fv(u.uM, false, [...M[0], ...M[1], ...M[2]]); gl.uniform3fv(u.uT, Tv);
        gl.drawArrays(gl.TRIANGLES, 0, st.bot.count);
      }
    }
    gl.bindVertexArray(null);
    ctx.drawImage(FP3D.st.cv, 0, 0);
    return true;
  }
  // 세계의 점 → 화면 좌표 {x, y, depth}. 눈 뒤면 null  (맵 x, 맵 y, 높이)
  function project(cam, wx, wy, h){
    const W = st.W || 1, H = st.H || 1, pr = proj(W, H);
    const p = mv(viewRot(cam.ang), [wx-cam.x, h-EYE, wy-cam.y]);
    if (p[2] > -NEAR) return null;
    return { x: (p[0]*pr[0]/-p[2]*0.5+0.5)*W, y: (0.5-p[1]*pr[1]/-p[2]*0.5)*H, depth: -p[2] };
  }
  // 정면에서 각도 ang만큼 벗어난 방향의 화면 가로 위치 (원근 투영)
  const screenX = (ang, W, H) => W/2 + Math.tan(ang)*proj(W, H)[0]*W/2;

  return { load, setMap, render, project, screenX, EYE, get ready(){ return st.ready; }, get failed(){ return st.failed; } };
})();

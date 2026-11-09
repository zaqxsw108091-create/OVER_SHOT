/* =========================================================
   OVERSHOT — 순수 JS 레이캐스팅 1인칭 슈터
   ========================================================= */

// ---------- 영웅 데이터 ----------
const HEROES = [
  { id:'titan', name:'타이탄', emoji:'🛡️', role:'탱커', roleClass:'r-tank',
    desc:'거대한 망치를 휘두르는 근접 탱커. 압도적인 체력으로 버틴다. 스킬: 방벽(전방 보호막 + 피해 감소).',
    hp:380, speed:0.050, fireRate:560, dmg:38, spread:0, pellets:1, ammo:0,
    fireMode:'melee', meleeRange:1.9, meleeArc:0.7, weapon:'hammer',
    color:'#39d3e0', ability:'방벽', abilType:'barrier', abilDur:3500, abilCd:9000, _bars:{'체력':1,'속도':.25,'화력':.55} },
  { id:'spark', name:'스파크', emoji:'⚡', role:'딜러', roleClass:'r-dps',
    desc:'자동소총을 든 고기동 딜러. 꾹 누르면 연사, 톡톡 누르면 점사. 스킬: 미사일 발사(폭발 범위 피해).',
    hp:155, speed:0.076, fireRate:105, dmg:12, spread:0.03, pellets:1, ammo:30,
    fireMode:'auto', weapon:'rifle',
    color:'#ff9a5a', ability:'미사일', abilType:'missile', abilDur:0, abilCd:6500, _bars:{'체력':.4,'속도':.95,'화력':.9} },
  { id:'medi', name:'메디카', emoji:'➕', role:'지원', roleClass:'r-sup',
    desc:'저격소총을 쓰는 지원가. 우클릭으로 스코프 조준. 점사 전용. 스킬: 회복(체력 회복).',
    hp:155, speed:0.060, fireRate:850, dmg:78, spread:0.004, pellets:1, ammo:6,
    fireMode:'semi', weapon:'sniper',
    color:'#86e89a', ability:'회복', abilType:'heal', abilDur:3000, abilCd:7000, _bars:{'체력':.5,'속도':.55,'화력':.75} },
  { id:'kage', name:'카게', emoji:'⚔️', role:'검사', roleClass:'r-blade',
    desc:'일본도를 쓰는 사무라이. 빠른 사선 베기로 근접 적을 제압한다. 스킬: 거합(전방 돌진+광역 베기).',
    hp:225, speed:0.070, fireRate:480, dmg:55, spread:0, pellets:1, ammo:0,
    fireMode:'melee', meleeRange:2.1, meleeArc:0.88, weapon:'katana',
    color:'#e8c56e', ability:'거합', abilType:'iai', abilDur:0, abilCd:7000, _bars:{'체력':.6,'속도':.82,'화력':.78} },
];

// ---------- 맵 (1=벽, 0=빈칸) ----------
const MAP = [
  "1111111111111111",
  "1000000001000001",
  "1011110001011101",
  "1010000000000101",
  "1010111101110101",
  "1000100000010001",
  "1110100110010111",
  "1000000000000001",
  "1011001111001101",
  "1010000000000101",
  "1010110001101101",
  "1000010000100001",
  "1111010101011111",
  "1000000000000001",
  "1011111011111101",
  "1111111111111111",
].map(r=>r.split('').map(Number));
const MAP_H = MAP.length, MAP_W = MAP[0].length;
function isWall(x,y){ const mx=Math.floor(x),my=Math.floor(y);
  if(mx<0||my<0||mx>=MAP_W||my>=MAP_H) return true; return MAP[my][mx]===1; }

// ---------- 상태 ----------
const screens = { login:el('login'), pick:el('pick'), game:el('game'), over:el('over') };
function show(name){ Object.values(screens).forEach(s=>s.classList.remove('active'));
  screens[name].classList.add('active'); }
function el(id){ return document.getElementById(id); }

let playerName = "PLAYER";
let hero = null;

// 로그인
el('idInput').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
el('loginBtn').onclick = doLogin;
function doLogin(){
  const v = el('idInput').value.trim();
  if(!v){ el('idInput').focus(); el('idInput').placeholder="아이디를 먼저 입력하세요!"; return; }
  playerName = v;
  buildHeroes();
  el('greet').textContent = `${playerName} 님, 영웅을 선택하세요`;
  show('pick');
}

// 영웅 선택 UI
let selHero = null;

// ---------- 기록 저장 (브라우저에 영웅별 최고기록) ----------
const REC_KEY='overshot_records_v1';
function getRecords(){ try{ return JSON.parse(localStorage.getItem(REC_KEY))||{}; }catch(e){ return {}; } }
function saveRecords(r){ try{ localStorage.setItem(REC_KEY, JSON.stringify(r)); }catch(e){} }
function recordFor(id){ const r=getRecords(); return r[id]||{kills:0,time:0}; }

function buildHeroes(){
  const list = el('heroList'); list.innerHTML='';
  HEROES.forEach(h=>{
    const bars = Object.entries(h._bars).map(([k,v])=>
      `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${Math.round(v*100)}%"></i></div></div>`).join('');
    const rec = recordFor(h.id);
    const recLine = `<div class="rec">최고 · 처치 ${rec.kills} · 생존 ${rec.time?rec.time.toFixed(1)+'s':'-'}</div>`;
    const div = document.createElement('div');
    div.className='hero'; div.dataset.id=h.id;
    div.innerHTML = `<div class="emoji">${h.emoji}</div>
      <span class="role ${h.roleClass}">${h.role}</span>
      <h3>${h.name}</h3><p>${h.desc}</p>${bars}${recLine}`;
    div.onclick = ()=>{ selHero=h;
      document.querySelectorAll('.hero').forEach(e=>e.classList.remove('sel'));
      div.classList.add('sel');
      const sb=el('startBtn'); sb.style.opacity=1; sb.style.pointerEvents='auto'; };
    list.appendChild(div);
  });
}
el('startBtn').onclick = ()=>{ if(selHero){ hero=selHero; show('game'); startGame(); } };
el('againBtn').onclick = ()=>{ if(hero){ show('game'); startGame(); } };
el('menuBtn').onclick = ()=>{ buildHeroes(); show('pick'); };
el('quitBtn').onclick = ()=> quitToMenu();

// =========================================================
//  게임 엔진
// =========================================================
const cv = el('cv'), ctx = cv.getContext('2d');
let W,H;
function resize(){ W=cv.width=window.innerWidth; H=cv.height=window.innerHeight; }
window.addEventListener('resize',resize); resize();

const player = { x:1.5, y:1.5, ang:0, hp:100, maxhp:100 };
let ammo=0, maxammo=0, reloading=false, lastShot=0;
let kills=0, startTime=0, running=false, paused=true, gameTime=0;
let enemies=[], bullets=[];
let abilActive=false, abilReady=true, abilEnd=0, abilCdEnd=0;
let firing=false, muzzle=0, swingT=0, swingHitDone=true;
let recoilAmt=0, shake=0, sway=0;
let adsActive=false, iaiFlash=0;
let missiles=[], blasts=[];
const keys={};

function startGame(){
  player.hp = hero.hp; player.maxhp = hero.hp;
  player.x=1.5; player.y=1.5; player.ang=0;
  maxammo = hero.ammo; ammo = maxammo; reloading=false; firing=false;
  kills=0; enemies=[]; bullets=[]; missiles=[]; blasts=[]; running=true; paused=true; gameTime=0;
  recoilAmt=0; shake=0; swingHitDone=true;
  abilActive=false; abilReady=true; abilCdEnd=0;
  adsActive=false; iaiFlash=0;
  fxCasings=[]; fxSmoke=[]; fxImpacts=[]; fxTracers=[]; fxDead=[]; recoilJit=0; missileFireT=-1e9; sniperEjected=true; aimBlend=0;
  el('abilName').textContent = hero.ability + ' [E]';
  el('ammoVal').textContent = hero.fireMode==='melee' ? '∞' : ammo;
  spawnWave(6);
  startTime = performance.now();
  el('lockmsg').classList.remove('hide');
  el('quitBtn').classList.remove('hide');
  requestAnimationFrame(loop);
}

// 적 스폰 (벽 아닌 곳, 플레이어와 거리)
function freeCell(){
  for(let t=0;t<200;t++){
    const x=Math.random()*(MAP_W-2)+1, y=Math.random()*(MAP_H-2)+1;
    if(!isWall(x,y) && Math.hypot(x-player.x,y-player.y)>5) return {x,y};
  }
  return {x:MAP_W-2.5,y:MAP_H-2.5};
}
function spawnWave(n){
  for(let i=0;i<n;i++){ const c=freeCell();
    enemies.push({ x:c.x, y:c.y, hp:60, maxhp:60, lastShot:0, hue:Math.random()*30 }); }
}

// ---------- 입력 ----------
document.addEventListener('keydown',e=>{ keys[e.code]=true;
  if(e.code==='KeyR') reload();
  if(e.code==='KeyE') useAbility();
  if(e.code==='KeyQ' && running && paused) quitToMenu();
  // 커서 모드에서는 브라우저가 Esc를 처리해 주지 않으므로 직접 일시정지
  if(e.code==='Escape' && lockless && running && !paused) setPaused(true);
});
document.addEventListener('keyup',e=>{ keys[e.code]=false; });

// 포인터 락 (마우스 시점)
// 마우스를 화면에 가두는 포인터 락이 안 되는 환경(일부 내장 브라우저, iframe으로 넣은 페이지 등)에서는
// 커서가 보이는 "커서 모드"로 자동 전환해 게임이 일시정지 화면에 멈추지 않게 한다.
let lockless=false;
function setPaused(p){
  paused=p;
  if(p){ firing=false; adsActive=false; }
  el('lockmsg').classList.toggle('hide', !p);
  el('quitBtn').classList.toggle('hide', !p || !running);
}
function controlling(){ return document.pointerLockElement===cv || (lockless && running && !paused); }
function enterLockless(){ if(!running || document.pointerLockElement===cv) return; lockless=true; setPaused(false); }
cv.addEventListener('click',()=>{
  if(!running || controlling()) return;
  if(lockless || !cv.requestPointerLock){ enterLockless(); return; }
  let req;
  try{ req=cv.requestPointerLock(); }catch(err){ enterLockless(); return; }
  if(req && req.catch) req.catch(()=>enterLockless());
  // 거절 신호 없이 조용히 무시되는 환경 대비: 잠시 뒤에도 잠기지 않았으면 커서 모드
  setTimeout(()=>{ if(running && paused && document.pointerLockElement!==cv) enterLockless(); },400);
});
document.addEventListener('pointerlockerror',()=>enterLockless());
document.addEventListener('pointerlockchange',()=>{
  const locked = document.pointerLockElement===cv;
  if(locked){ lockless=false; setPaused(false); }
  else if(!lockless) setPaused(true);
});
document.addEventListener('mousemove',e=>{
  if(!controlling()) return;
  // 커서 모드에서는 커서가 창 밖에서 다시 들어올 때 움직임 값이 크게 튀므로 한 번에 도는 양을 제한
  const lim = lockless ? 40 : 250;
  player.ang += Math.max(-lim, Math.min(lim, e.movementX))*0.0024;
});
// 창이 포커스를 잃으면(다른 창 클릭 등) 눌린 키가 떼어진 것으로 처리 — 키가 눌린 채로 남아 계속 움직이던 문제 방지
function releaseAllInput(){ for(const k in keys) keys[k]=false; firing=false; adsActive=false; }
window.addEventListener('blur',()=>{ releaseAllInput(); if(lockless && running && !paused) setPaused(true); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ releaseAllInput(); if(running && !paused && lockless) setPaused(true); } });
document.addEventListener('mousedown',e=>{
  if(!controlling()) return;
  if(e.button===0){ firing=true; attack(); }
  if(e.button===2 && hero && (hero.weapon==='sniper' || hero.weapon==='rifle')) adsActive=true;   // 오른쪽 클릭: 조준경으로 겨눔
});
document.addEventListener('mouseup',e=>{
  if(e.button===0) firing=false;
  if(e.button===2) adsActive=false;
});
document.addEventListener('contextmenu',e=>e.preventDefault());

function quitToMenu(){
  running=false; paused=true; firing=false;
  if(document.pointerLockElement===cv) document.exitPointerLock();
  el('quitBtn').classList.add('hide');
  show('pick');
}

// ---------- 사격 연출 (탄피·총구 연기·총알 궤적·탄착·쓰러지는 적) ----------
const gunFx={ muzzle:null, eject:null, pod:null };   // 무기를 그릴 때 화면 좌표를 기록
let fxCasings=[], fxSmoke=[], fxImpacts=[], fxTracers=[], fxDead=[];
let recoilJit=0, reloadT=0, missileFireT=-1e9, sniperEjected=true;
// 총 자세: 0 = 로우 레디(평소, 총구를 아래로 내려 든 자세), 1 = 견착 조준(쏠 때, 어깨에 붙여 수평으로 겨눔)
let aimBlend=0;
const _smooth=u=>u*u*(3-2*u);
function gunPose(low,aim){
  const A=_smooth(Math.max(0,Math.min(1,aimBlend))), mid=Math.sin(A*Math.PI);
  return { A,
    x:_lerp(low[0],aim[0],A),
    y:_lerp(low[1],aim[1],A) - mid*12,          // 올리는 도중 살짝 위로 휘어 올라감
    r:_lerp(low[2],aim[2],A) + mid*0.05 };      // 전환 도중 총이 살짝 기울었다가 바로 섬
}
const RELOAD_MS=900;
function spawnCasing(big){
  const p=gunFx.eject; if(!p) return;
  const s=weaponScale();
  fxCasings.push({ x:p.x, y:p.y, vx:((big?150:220)+Math.random()*120)*s, vy:-((big?240:320)+Math.random()*140)*s,
    r:Math.random()*6, vr:(Math.random()<0.5?-1:1)*(14+Math.random()*10), life:900, big, s });
}
function spawnSmoke(pt,n,big){
  if(!pt) return;
  for(let i=0;i<n;i++) fxSmoke.push({ x:pt.x+(Math.random()-0.5)*8, y:pt.y+(Math.random()-0.5)*8,
    vx:(Math.random()-0.5)*30, vy:-25-Math.random()*30, r:(big?10:6)+Math.random()*4, life:700, max:700 });
}
function addImpact(off,dist,kind){
  fxImpacts.push({ x:W/2+off+(Math.random()-0.5)*6, y:H/2+(Math.random()-0.5)*6, dist:Math.max(0.6,dist||8),
    kind, t:performance.now(), seed:Math.random() });
}
function addTracer(off,sn){
  fxTracers.push({ x1:W/2+off, y1:H/2, t:performance.now(), sn });
}
function updateFx(dt){
  const s=dt/1000, now=performance.now();
  for(const c of fxCasings){ c.vy+=1400*c.s*s; c.x+=c.vx*s; c.y+=c.vy*s; c.r+=c.vr*s; c.life-=dt; }
  fxCasings=fxCasings.filter(c=>c.life>0 && c.y<H+40);
  for(const m of fxSmoke){ m.x+=m.vx*s; m.y+=m.vy*s; m.r+=18*s; m.life-=dt; }
  fxSmoke=fxSmoke.filter(m=>m.life>0);
  fxImpacts=fxImpacts.filter(i=>now-i.t<260);
  fxTracers=fxTracers.filter(tr=>now-tr.t<(tr.sn?140:60));
  fxDead=fxDead.filter(d=>now-d.t<520);
}
// 탄착 불꽃·먼지 (월드 레이어: 화면 흔들림이 같이 적용됨)
function drawWorldFx(now){
  for(const i of fxImpacts){
    const f=(now-i.t)/260; if(f<0||f>=1) continue;
    const sz=Math.min(90,(H/i.dist)*0.06);
    ctx.save(); ctx.translate(i.x,i.y);
    if(i.kind==='enemy'){
      glowDot(0,0,sz*0.35*(1-f)+2,'#ff7a3a',1-f);
      ctx.strokeStyle=`rgba(255,210,140,${1-f})`; ctx.lineWidth=2; ctx.lineCap='round';
      for(let k=0;k<6;k++){
        const a=i.seed*6+k*1.05, r0=sz*0.2, r1=sz*(0.5+f*0.9);
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); ctx.stroke();
      }
    } else {
      ctx.fillStyle=`rgba(170,150,130,${0.5*(1-f)})`;
      ctx.beginPath(); ctx.arc(0,0,sz*(0.3+f*0.8),0,7); ctx.fill();
      glowDot(0,0,sz*0.15*(1-f)+1,'#ffd27a',1-f);
    }
    ctx.restore();
  }
}
// 총구에서 조준점까지 순간적으로 보이는 총알 빛줄기
function drawTracers(now){
  for(const tr of fxTracers){
    const life=tr.sn?140:60, f=(now-tr.t)/life; if(f<0||f>=1) continue;
    // 시작점은 지금 총구 위치 (총을 들어 올리는 중이어도 총구에서 나가 보이게)
    const m=(adsActive && tr.sn) ? {x:W/2, y:H*0.95} : (gunFx.muzzle || {x:W/2, y:H});
    tr.x0=m.x; tr.y0=m.y;
    const a0=Math.min(1,f*1.2)*0.6, a1=Math.min(1,0.35+f*1.2);
    const x0=_lerp(tr.x0,tr.x1,a0), y0=_lerp(tr.y0,tr.y1,a0), x1=_lerp(tr.x0,tr.x1,a1), y1=_lerp(tr.y0,tr.y1,a1);
    ctx.save(); ctx.globalAlpha=Math.max(0,1-f);
    glowPath(tr.sn?'#7ff4ff':'#ffb35a', tr.sn?3:2, ()=>{ ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); });
    ctx.restore();
  }
}
// 총구 연기·튀어나가는 탄피 (무기 위에 그림)
function drawOverlayFx(){
  for(const m of fxSmoke){ const f=m.life/m.max;
    ctx.fillStyle=`rgba(200,200,205,${0.22*f})`; ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,7); ctx.fill(); }
  for(const c of fxCasings){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.r);
    const w=(c.big?16:11)*c.s, h=(c.big?6:4.5)*c.s;
    ctx.fillStyle=c.big?'#9fe9ff':'#d9a441'; ctx.fillRect(-w/2,-h/2,w,h);
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(-w/2,-h/2,w,1.4*c.s);
    ctx.restore();
  }
}
// 쓰러지는 적 (처치 직후 0.5초)
function drawDeadEnemy(d,dist){
  if(dist<0.3) return;
  const pr=projectPoint(d.x,d.y); if(!pr.vis) return;
  if(blockedByWall(player.x,player.y,d.x,d.y)) return;
  const f=Math.max(0,Math.min(1,(performance.now()-d.t)/520));
  const size=Math.min(H*1.1,(H/dist)*0.75), top=H/2-size*0.42;
  ctx.save(); ctx.globalAlpha=1-f*f;
  ctx.translate(pr.sx, top+size*0.68); ctx.rotate(d.dir*_easeIn(f)*1.35); ctx.translate(0,-size*0.68+size*0.2*f);
  ctx.fillStyle='#7a2a1c';
  roundRect(-size*0.18,size*0.18,size*0.36,size*0.5,size*0.06); ctx.fill();
  ctx.beginPath(); ctx.arc(0,size*0.1,size*0.16,0,7); ctx.fill();
  ctx.restore();
}
// 재장전 동작: 진행도에 따라 총 기울기·탄창 위치·왼손 위치·장전 손잡이를 계산
function reloadAnim(now){
  const r={rp:-1,tilt:0,magDy:0,magA:1,hand:0,ch:0};
  if(!reloading) return r;
  const pr=Math.min(1,(now-reloadT)/RELOAD_MS); r.rp=pr;
  r.tilt=Math.sin(Math.min(1,pr/0.92)*Math.PI);
  if(pr>=0.12 && pr<0.40){ const u=(pr-0.12)/0.28; r.magDy=_easeIn(u)*170; r.magA=1-Math.max(0,(u-0.6)/0.4); } // 빈 탄창이 빠짐
  else if(pr>=0.40 && pr<0.62){ r.magA=0; }                                                                 // 새 탄창 꺼내는 중
  else if(pr>=0.62 && pr<0.82){ r.magDy=(1-_easeOut((pr-0.62)/0.20))*90; }                                  // 새 탄창 끼움
  if(pr>=0.82) r.ch=Math.sin((pr-0.82)/0.18*Math.PI);                                                        // 장전
  r.hand = pr<0.2?0 : pr<0.32?(pr-0.2)/0.12 : pr<0.78?1 : pr<0.9?1-(pr-0.78)/0.12 : 0;
  return r;
}

// ---------- 사격 ----------
function attack(){
  const now=performance.now();
  if(reloading || now-lastShot < currentFireRate()) return;
  if(hero.fireMode==='melee'){ startSwing(now); return; }
  if(ammo<=0){ reload(); return; }
  lastShot=now; ammo--; el('ammoVal').textContent=ammo; muzzle=now;
  const sn = hero.weapon==='sniper';
  // 반동: 연사하면 조금씩 쌓이고, 쏠 때마다 좌우로 살짝 흔들림
  recoilAmt=Math.min(1.6, recoilAmt+(sn?1.4:0.55)); recoilJit=(Math.random()-0.5)*(sn?0.04:0.10);
  shake=Math.max(shake, sn?7:4);
  if(sn) sniperEjected=false; else spawnCasing(false);
  spawnSmoke(gunFx.muzzle, sn?4:2, sn);
  let hitAny=false;
  for(let p=0;p<hero.pellets;p++){
    const spread = (Math.random()-0.5)*hero.spread;
    const a = player.ang + spread;
    const off = (spread/FOV)*W;                    // 퍼진 각도만큼 화면에서 옆으로
    const hit = rayHitEnemy(player.x,player.y,a);
    if(hit){ hitAny=true;
      hit.e.hp -= hero.dmg; hit.e.hitT=now;
      // 맞은 적이 뒤로 살짝 밀림
      const kb=sn?0.18:0.05, nx=hit.e.x+Math.cos(a)*kb, ny=hit.e.y+Math.sin(a)*kb;
      if(!isWall(nx,hit.e.y)) hit.e.x=nx; if(!isWall(hit.e.x,ny)) hit.e.y=ny;
      addImpact(off, hit.dist, 'enemy');
      if(hit.e.hp<=0){ killEnemy(hit.e); }
    } else {
      const ci=Math.max(0,Math.min(depth.length-1,Math.floor(depth.length/2+(spread/FOV)*depth.length)));
      addImpact(off, depth[ci], 'wall');
    }
    addTracer(off, sn);
  }
  if(hitAny) hitMarker();
  if(ammo<=0) reload();
}
// 근접: 스윙만 시작, 데미지는 임팩트 순간(loop)에서 적용
const SWING_MS=420, SWING_IMPACT=210;
function startSwing(now){ lastShot=now; swingT=now; swingHitDone=false; }
function applyMelee(){
  let hitAny=false;
  for(const e of [...enemies]){
    const dx=e.x-player.x, dy=e.y-player.y;
    const dist=Math.hypot(dx,dy);
    if(dist>hero.meleeRange) continue;
    let ang=Math.atan2(dy,dx)-player.ang;
    while(ang<-Math.PI)ang+=2*Math.PI; while(ang>Math.PI)ang-=2*Math.PI;
    if(Math.abs(ang)>hero.meleeArc) continue;
    if(blockedByWall(player.x,player.y,e.x,e.y)) continue;
    e.hp -= hero.dmg; hitAny=true;
    if(e.hp<=0) killEnemy(e);
  }
  if(hitAny){ hitMarker(); shake=Math.max(shake,9); }
  else shake=Math.max(shake,3); // 헛스윙도 약한 진동
}
function currentFireRate(){ return hero.fireRate; }

// 광선 vs 적 (가장 가까운 적, 벽에 막히면 X)
function rayHitEnemy(ox,oy,ang){
  const dx=Math.cos(ang), dy=Math.sin(ang);
  let best=null, bestDist=1e9;
  for(const e of enemies){
    const ex=e.x-ox, ey=e.y-oy;
    const proj = ex*dx+ey*dy;            // 광선상 거리
    if(proj<=0||proj>22) continue;
    const perp = Math.abs(ex*dy - ey*dx); // 광선과의 수직거리
    const radius = 0.34;                  // 적 히트 반경
    if(perp < radius && proj<bestDist){
      // 벽 가림 체크
      if(!blockedByWall(ox,oy,e.x,e.y)){ best=e; bestDist=proj; }
    }
  }
  return best ? {e:best,dist:bestDist} : null;
}
function blockedByWall(x0,y0,x1,y1){
  const steps=Math.ceil(Math.hypot(x1-x0,y1-y0)*8);
  for(let i=1;i<steps;i++){ const t=i/steps;
    if(isWall(x0+(x1-x0)*t, y0+(y1-y0)*t)) return true; }
  return false;
}

function killEnemy(e){
  enemies.splice(enemies.indexOf(e),1);
  fxDead.push({ x:e.x, y:e.y, t:performance.now(), dir:Math.random()<0.5?-1:1 });
  kills++; el('killVal').textContent=kills;
  toast('처치!', hero.color);
  if(enemies.length<=2) spawnWave(3+Math.floor(kills/6)); // 계속 보충
}

function reload(){
  if(reloading||ammo===maxammo) return;
  reloading=true; reloadT=performance.now(); el('ammoVal').textContent='...';
  setTimeout(()=>{ ammo=maxammo; reloading=false; el('ammoVal').textContent=ammo; }, RELOAD_MS);
}

// ---------- 스킬 ----------
function useAbility(){
  const now=performance.now();
  if(!abilReady||abilActive) return;
  if(hero.abilType==='missile'){
    launchMissile();
    abilReady=false; abilCdEnd=now+hero.abilCd;
    toast('미사일 발사!', hero.color);
    return;
  }
  if(hero.abilType==='iai'){
    iaiSlash();
    abilReady=false; abilCdEnd=now+hero.abilCd;
    return;
  }
  abilActive=true; abilReady=false;
  abilEnd=now+hero.abilDur;
  toast(hero.ability+' 발동!', hero.color);
}
function launchMissile(){
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  missiles.push({ x:player.x+ca*0.4, y:player.y+sa*0.4, dx:ca, dy:sa,
    spd:0.10, alive:true });
  recoilAmt=Math.min(1.6,recoilAmt+0.9); shake=Math.max(shake,6);
  missileFireT=performance.now(); spawnSmoke(gunFx.pod,6,true);
}
function updateMissiles(dt){
  const stepN=Math.max(1,Math.round(dt/8));
  for(const m of missiles){
    if(!m.alive) continue;
    for(let s=0;s<stepN && m.alive;s++){
      m.x+=m.dx*m.spd; m.y+=m.dy*m.spd;
      if(isWall(m.x,m.y)){ explode(m.x,m.y); m.alive=false; break; }
      for(const e of enemies){
        if(Math.hypot(e.x-m.x,e.y-m.y)<0.45){ explode(m.x,m.y); m.alive=false; break; }
      }
      if(Math.hypot(m.x-player.x,m.y-player.y)>26){ m.alive=false; }
    }
  }
  missiles=missiles.filter(m=>m.alive);
  // 폭발 잔상 수명
  for(const b of blasts) b.life-=dt;
  blasts=blasts.filter(b=>b.life>0);
}
function explode(x,y){
  blasts.push({ x, y, life:420, max:420 });
  shake=Math.max(shake,11);
  const R=2.2, DMG=85;
  for(const e of [...enemies]){
    const d=Math.hypot(e.x-x,e.y-y);
    if(d<R){ e.hp -= DMG*(1-d/R); if(e.hp<=0) killEnemy(e); }
  }
}
const HEAL_PER_SEC = 10.8; // 회복 스킬: 초당 회복량 (모니터 주사율과 무관)
function updateAbility(now, dt){
  if(abilActive){
    if(hero.abilType==='heal'){ player.hp=Math.min(player.maxhp,player.hp+HEAL_PER_SEC*dt/1000); }
    if(now>=abilEnd){ abilActive=false; abilCdEnd=now+hero.abilCd; }
  }
  if(!abilActive && !abilReady && now>=abilCdEnd){ abilReady=true; }
  let pct;
  if(abilActive) pct = (abilEnd-now)/hero.abilDur;
  else if(abilReady) pct = 1;
  else pct = 1-(abilCdEnd-now)/hero.abilCd;
  el('abilBar').firstElementChild.style.width = Math.max(0,Math.min(1,pct))*100+'%';
  el('abilName').textContent = abilActive ? hero.ability+' 가동중!'
    : abilReady ? hero.ability+' [E] 준비' : hero.ability+' 충전중';
}

// ---------- 적 AI ----------
function updateEnemies(dt,now){
  for(const e of enemies){
    const dx=player.x-e.x, dy=player.y-e.y;
    const dist=Math.hypot(dx,dy);
    const see = !blockedByWall(e.x,e.y,player.x,player.y);
    if(see && dist>1.4){
      const sp=0.026*dt*0.06;
      const nx=e.x+dx/dist*sp, ny=e.y+dy/dist*sp;
      if(!isWall(nx,e.y)) e.x=nx;
      if(!isWall(e.x,ny)) e.y=ny;
    }
    // 사격
    if(see && dist<8 && now-e.lastShot>1100){
      e.lastShot=now;
      if(Math.random()<0.55){ // 명중 확률
        let dmg = 8 + Math.random()*6;
        if(abilActive && hero.id==='titan') dmg*=0.3; // 방벽
        player.hp -= dmg; hitFlash();
        if(player.hp<=0){ player.hp=0; endGame(); }
      }
    }
  }
  el('enemyVal').textContent=enemies.length;
}

// ---------- 이동 ----------
function updatePlayer(dt){
  let sp = hero.speed*(dt*0.06);
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  let mx=0,my=0;
  if(keys['KeyW']){ mx+=ca; my+=sa; }
  if(keys['KeyS']){ mx-=ca; my-=sa; }
  if(keys['KeyA']){ mx+=sa; my-=ca; }
  if(keys['KeyD']){ mx-=sa; my+=ca; }
  const len=Math.hypot(mx,my)||1; mx/=len; my/=len;
  const nx=player.x+mx*sp, ny=player.y+my*sp;
  if(!isWall(nx,player.y)) player.x=nx;
  if(!isWall(player.x,ny)) player.y=ny;
  // 키보드 회전 (마우스 못쓸 때)
  if(keys['ArrowLeft']) player.ang-=0.045*dt*0.06;
  if(keys['ArrowRight']) player.ang+=0.045*dt*0.06;

}

// =========================================================
//  렌더링 (레이캐스팅)
// =========================================================
const FOV = Math.PI/3;
let depth=[];
function render(){
  const numRays = Math.min(W, 900);          // 성능 위해 광선 수 제한
  const colW = W/numRays;
  depth = new Array(numRays);

  // 화면 흔들림(월드 레이어에만 적용)
  const sx = shake? (Math.random()-0.5)*shake : 0;
  const sy = shake? (Math.random()-0.5)*shake : 0;
  // 쏠 때 시야가 살짝 위로 튐 (총구가 들리는 만큼 세상이 아래로)
  const kick = (hero && hero.fireMode!=='melee') ? recoilAmt*(hero.weapon==='sniper'?14:5) : 0;
  ctx.save();
  ctx.translate(sx, sy+kick);

  // 하늘 / 바닥 (흔들림 대비 여유있게 큰 영역)
  const skyG = ctx.createLinearGradient(0,0,0,H/2);
  skyG.addColorStop(0,'#16213b'); skyG.addColorStop(1,'#2a3a5c');
  ctx.fillStyle=skyG; ctx.fillRect(-14,-14,W+28,H/2+14);
  const flG = ctx.createLinearGradient(0,H/2,0,H);
  flG.addColorStop(0,'#1a1410'); flG.addColorStop(1,'#0a0806');
  ctx.fillStyle=flG; ctx.fillRect(-14,H/2,W+28,H/2+14);

  // 벽
  for(let r=0;r<numRays;r++){
    const rayAng = player.ang - FOV/2 + (r/numRays)*FOV;
    const ca=Math.cos(rayAng), sa=Math.sin(rayAng);
    let dist=0, hit=false, side=0;
    let x=player.x, y=player.y;
    const step=0.012;
    while(dist<22 && !hit){
      dist+=step; x=player.x+ca*dist; y=player.y+sa*dist;
      if(isWall(x,y)){ hit=true;
        const fx=x-Math.floor(x), fy=y-Math.floor(y);
        side = (Math.min(fx,1-fx) < Math.min(fy,1-fy))?0:1;
      }
    }
    const corr = dist*Math.cos(rayAng-player.ang); // 어안 보정
    depth[r]=corr;
    const wallH = Math.min(H, (H/corr)*0.9);
    const y0=(H-wallH)/2;
    // 거리/면에 따른 음영
    let shade = Math.max(0, 1 - corr/16);
    const base = side? 90:120;
    const cR=Math.round(base*shade*1.0+12);
    const cG=Math.round(base*shade*0.55+8);
    const cB=Math.round(base*shade*0.35+6);
    ctx.fillStyle=`rgb(${cR},${cG},${cB})`;
    ctx.fillRect(r*colW, y0, colW+1, wallH);
  }

  // 적 + 미사일 깊이 정렬해서 함께 그림
  const things=[];
  for(const e of enemies) things.push({t:'e',o:e,d:Math.hypot(e.x-player.x,e.y-player.y)});
  for(const m of missiles) things.push({t:'m',o:m,d:Math.hypot(m.x-player.x,m.y-player.y)});
  for(const b of blasts) things.push({t:'b',o:b,d:Math.hypot(b.x-player.x,b.y-player.y)});
  for(const dd of fxDead) things.push({t:'d',o:dd,d:Math.hypot(dd.x-player.x,dd.y-player.y)});
  things.sort((a,b)=>b.d-a.d);
  for(const it of things){
    if(it.t==='e') drawEnemy(it.o,it.d,numRays,colW);
    else if(it.t==='d') drawDeadEnemy(it.o,it.d);
    else if(it.t==='m') drawSprite(it.o,it.d,'missile');
    else drawSprite(it.o,it.d,'blast');
  }

  // 방벽 (탱커 스킬) — 반투명이라 너머의 적도 보임
  if(abilActive && hero.id==='titan') drawBarrier();

  drawWorldFx(performance.now());   // 탄착 불꽃·먼지

  ctx.restore(); // 흔들림 레이어 끝

  drawTracers(performance.now());   // 총알 빛줄기 (무기 뒤)

  // 무기 (화면 하단) — ADS 중이면 숨김
  if(!(adsActive && hero && hero.weapon==='sniper')) drawWeapon();
  drawOverlayFx();                  // 총구 연기·탄피 (무기 위)

  // 스코프 오버레이 (힐러 우클릭 조준)
  if(adsActive && hero && hero.weapon==='sniper' && !paused) drawScopeOverlay();

  // 거합베기 화면 이펙트
  if(iaiFlash && performance.now()-iaiFlash<420) drawIaiEffect(performance.now());

  // 미니맵 (좌상단)
  drawMinimap();
}

// 월드 공간 점(미사일/폭발)을 화면에 투영
function projectPoint(wx,wy){
  const dx=wx-player.x, dy=wy-player.y;
  let ang=Math.atan2(dy,dx)-player.ang;
  while(ang<-Math.PI)ang+=2*Math.PI; while(ang>Math.PI)ang-=2*Math.PI;
  const dist=Math.hypot(dx,dy);
  return { ang, dist, sx:(0.5+ang/FOV)*W, vis:Math.abs(ang)<FOV/2+0.4 };
}
function drawSprite(o,dist,kind){
  if(dist<0.25) return;
  const p=projectPoint(o.x,o.y);
  if(!p.vis) return;
  if(blockedByWall(player.x,player.y,o.x,o.y) && kind==='missile') return;
  if(kind==='missile'){
    const sz=Math.min(120,(H/dist)*0.16);
    ctx.save(); ctx.translate(p.sx,H/2);
    ctx.fillStyle='#ffcaa0'; ctx.beginPath(); ctx.arc(0,0,sz*0.5,0,7); ctx.fill();
    ctx.fillStyle=hero?hero.color:'#ff9a5a'; ctx.beginPath(); ctx.arc(0,0,sz*0.32,0,7); ctx.fill();
    // 화염 꼬리
    ctx.fillStyle='rgba(255,170,60,.6)'; ctx.beginPath(); ctx.arc(0,sz*0.5,sz*0.35,0,7); ctx.fill();
    ctx.restore();
  } else { // blast
    const k=1-o.life/o.max; // 0→1 확장
    const sz=Math.min(H*1.2,(H/dist)*1.0)*(0.3+k*0.9);
    ctx.save(); ctx.translate(p.sx,H/2); ctx.globalAlpha=Math.max(0,1-k);
    const g=ctx.createRadialGradient(0,0,sz*0.1,0,0,sz);
    g.addColorStop(0,'rgba(255,240,180,1)'); g.addColorStop(0.4,'rgba(255,140,40,0.9)');
    g.addColorStop(1,'rgba(255,60,20,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,sz,0,7); ctx.fill();
    ctx.restore();
  }
}

function drawBarrier(){
  // 육각 벌집 에너지 방벽 (SENTINEL MAUL 디자인과 같은 파란 육각 보호막)
  const cx=W/2, cy=H/2, bw=Math.min(W*0.62,720), bh=H*0.62;
  const x0=cx-bw/2, y0=cy-bh/2, t=performance.now();
  ctx.save();
  roundRect(x0,y0,bw,bh,26);
  const g=ctx.createLinearGradient(0,y0,0,y0+bh);
  g.addColorStop(0,'rgba(74,168,255,0.10)');
  g.addColorStop(0.5,'rgba(74,168,255,0.20)');
  g.addColorStop(1,'rgba(74,168,255,0.10)');
  ctx.fillStyle=g; ctx.fill();
  ctx.save(); ctx.clip();
  // 육각 패턴 (뾰족한 꼭짓점이 위아래인 벌집 배열)
  const R=24, hw=Math.sqrt(3)*R;
  ctx.beginPath();
  for(let row=0, y=y0; y<y0+bh+R; row++, y+=R*1.5){
    for(let x=x0+(row%2?hw/2:0); x<x0+bw+hw; x+=hw){
      for(let i=0;i<6;i++){
        const an=Math.PI/6+i*Math.PI/3;
        const vx=x+Math.cos(an)*R, vy=y+Math.sin(an)*R;
        if(i===0) ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy);
      }
      ctx.closePath();
    }
  }
  ctx.strokeStyle='rgba(140,200,255,0.35)'; ctx.lineWidth=1.4; ctx.stroke();
  // 위에서 아래로 훑고 지나가는 빛 띠
  const sweep=y0+((t*0.25)%(bh+200))-100;
  const sg=ctx.createLinearGradient(0,sweep-60,0,sweep+60);
  sg.addColorStop(0,'rgba(140,210,255,0)');
  sg.addColorStop(0.5,'rgba(160,220,255,0.18)');
  sg.addColorStop(1,'rgba(140,210,255,0)');
  ctx.fillStyle=sg; ctx.fillRect(x0,sweep-60,bw,120);
  ctx.restore();
  // 테두리 + 은은한 깜빡임
  ctx.strokeStyle='rgba(150,210,255,0.75)'; ctx.lineWidth=3;
  roundRect(x0,y0,bw,bh,26); ctx.stroke();
  ctx.fillStyle=`rgba(74,168,255,${0.04+0.03*Math.sin(t*0.008)})`;
  roundRect(x0,y0,bw,bh,26); ctx.fill();
  ctx.restore();
}

function drawMinimap(){
  const cell=8, mw=MAP_W*cell, mh=MAP_H*cell, ox=18, oy=80;
  ctx.save();
  ctx.globalAlpha=0.82;
  ctx.fillStyle='#0a0f1a'; roundRect(ox-4,oy-4,mw+8,mh+8,6); ctx.fill();
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    if(MAP[y][x]===1){ ctx.fillStyle='#2a3650'; ctx.fillRect(ox+x*cell,oy+y*cell,cell-1,cell-1); }
  }
  // 적
  ctx.fillStyle='#ff4d4d';
  for(const e of enemies){ ctx.beginPath();
    ctx.arc(ox+e.x*cell, oy+e.y*cell, 2.6, 0, 7); ctx.fill(); }
  // 플레이어 + 시야
  const px=ox+player.x*cell, py=oy+player.y*cell;
  ctx.strokeStyle='rgba(57,211,224,.6)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(px,py);
  ctx.lineTo(px+Math.cos(player.ang)*14, py+Math.sin(player.ang)*14); ctx.stroke();
  ctx.fillStyle='#39d3e0'; ctx.beginPath(); ctx.arc(px,py,3.2,0,7); ctx.fill();
  ctx.restore();
}

function drawEnemy(e,dist,numRays,colW){
  if(dist<0.3) return;
  const dx=e.x-player.x, dy=e.y-player.y;
  let ang=Math.atan2(dy,dx)-player.ang;
  while(ang<-Math.PI) ang+=2*Math.PI; while(ang>Math.PI) ang-=2*Math.PI;
  if(Math.abs(ang)>FOV/2+0.3) return;
  if(blockedByWall(player.x,player.y,e.x,e.y)) return;

  const size = Math.min(H*1.1, (H/dist)*0.75);
  const screenX = (0.5 + ang/FOV)*W;
  const top = H/2 - size*0.42;
  // 깊이 가림 (벽 뒤면 안 그림)
  const rayIdx = Math.floor((screenX/W)*numRays);
  if(rayIdx>=0 && rayIdx<numRays && depth[rayIdx] < dist-0.3) {
    // 부분 가림은 무시, 중앙이 가려지면 스킵
  }
  const shade=Math.max(0.35,1-dist/16);
  const hf = e.hitT ? Math.max(0,1-(performance.now()-e.hitT)/120) : 0;   // 맞은 직후 하얗게 번쩍
  ctx.save();
  ctx.translate(screenX + hf*size*0.04, top);
  // 몸통
  ctx.fillStyle=`rgba(${Math.round(200*shade)},${Math.round(60*shade)},${Math.round(40*shade)},1)`;
  roundRect(-size*0.18,size*0.18,size*0.36,size*0.5,size*0.06); ctx.fill();
  // 머리
  ctx.beginPath(); ctx.arc(0,size*0.1,size*0.16,0,7); ctx.fill();
  // 눈 (빨강)
  ctx.fillStyle=`rgba(255,${abilReady?60:90},60,${shade})`;
  ctx.beginPath(); ctx.arc(-size*0.06,size*0.08,size*0.028,0,7);
  ctx.arc(size*0.06,size*0.08,size*0.028,0,7); ctx.fill();
  if(hf>0){
    ctx.fillStyle=`rgba(255,240,220,${0.75*hf})`;
    roundRect(-size*0.18,size*0.18,size*0.36,size*0.5,size*0.06); ctx.fill();
    ctx.beginPath(); ctx.arc(0,size*0.1,size*0.16,0,7); ctx.fill();
  }
  // 체력바
  if(e.hp<e.maxhp){
    const bw=size*0.4;
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(-bw/2,-size*0.06,bw,6);
    ctx.fillStyle='#3cf06e'; ctx.fillRect(-bw/2,-size*0.06,bw*(e.hp/e.maxhp),6);
  }
  ctx.restore();
}
function roundRect(x,y,w,h,r){ ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// 애니메이션 헬퍼
const _easeOut=u=>1-(1-u)*(1-u);
const _easeIn=u=>u*u;
const _lerp=(a,b,u)=>a+(b-a)*u;

// ---- 무기 그리기 공통 도우미 ----
function rgba(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
// 빛나는 선: 같은 경로를 굵기·투명도를 달리해 여러 번 그려 빛이 번지는 느낌을 낸다
function glowPath(color,w,build){
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const base=ctx.globalAlpha;
  for(const [m,al] of [[4,0.12],[2.2,0.28],[1,1]]){
    ctx.globalAlpha=al*base; ctx.strokeStyle=color; ctx.lineWidth=w*m;
    ctx.beginPath(); build(); ctx.stroke();
  }
  ctx.globalAlpha=0.85*base; ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(0.8,w*0.35);
  ctx.beginPath(); build(); ctx.stroke();
  ctx.restore();
}
// 빛나는 점(LED·렌즈)
function glowDot(x,y,r,color,a=1){
  r=Math.max(0.01,r); a=Math.max(0,Math.min(1,a));   // 크기·투명도가 범위를 벗어나면 그리기 오류가 나므로 보정
  const g=ctx.createRadialGradient(x,y,0,x,y,r*3);
  g.addColorStop(0,`rgba(255,255,255,${a})`); g.addColorStop(0.3,rgba(color,0.8*a)); g.addColorStop(1,rgba(color,0));
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*3,0,7); ctx.fill();
}
// 왼쪽→오른쪽 원통 음영 (금속·플라스틱 공용)
function shade3(x,w,c0,c1,c2){
  const g=ctx.createLinearGradient(x,0,x+w,0);
  g.addColorStop(0,c0); g.addColorStop(0.42,c1); g.addColorStop(1,c2); return g;
}
// 스킬 충전 정도 0~1 (무기 장식 표시용)
function abilCharge(now){
  if(abilActive||abilReady) return 1;
  return Math.max(0,Math.min(1,1-(abilCdEnd-now)/hero.abilCd));
}

// 팔(소매)+손(장갑) 그리기 헬퍼 — 색을 넘기면 영웅별 장갑 디자인
function drawArm(ax,ay, hx,hy, w, sleeve='#2a3142', band){
  ctx.save();
  ctx.strokeStyle=sleeve; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(hx,hy); ctx.stroke();
  // 손목 밴드
  ctx.strokeStyle=band||hero.color; ctx.lineWidth=w*0.4;
  const mx=ax+(hx-ax)*0.62, my=ay+(hy-ay)*0.62;
  ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+(hx-mx)*0.4,my+(hy-my)*0.4); ctx.stroke();
  ctx.restore();
}
// 장갑 낀 손: 손바닥 + 손가락 4개(손잡이·포드를 감쌈) + 손목 띠 + 소매 커프. rot: 소매가 향하는 방향(손가락은 반대쪽)
function drawGlove(x,y,r,rot,base='#24272d',finger='#2e323a',accent='#3a8be0',cuff='#1a1c21'){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  ctx.fillStyle=cuff; roundRect(r*0.6,-r*0.8,r*1.0,r*1.6,r*0.25); ctx.fill();                 // 소매 커프
  ctx.fillStyle=accent; roundRect(r*0.48,-r*0.74,r*0.2,r*1.48,r*0.08); ctx.fill();             // 손목 띠
  ctx.fillStyle=base; roundRect(-r*0.75,-r*0.72,r*1.3,r*1.44,r*0.45); ctx.fill();             // 손등
  for(let i=0;i<4;i++){                                                                       // 손가락
    ctx.fillStyle=finger; roundRect(-r*1.25,-r*0.66+i*r*0.34,r*0.85,r*0.3,r*0.15); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.fillRect(-r*0.62,-r*0.6+i*r*0.34,r*0.14,r*0.18); // 마디
  }
  ctx.fillStyle='rgba(255,255,255,0.08)'; roundRect(-r*0.5,-r*0.62,r*0.9,r*0.3,r*0.12); ctx.fill(); // 손등 하이라이트
  ctx.restore();
}
function drawHand(hx,hy,r, glove='#11151f', top='#1c2333', ring){
  ctx.fillStyle=glove; ctx.beginPath(); ctx.arc(hx,hy,r,0,7); ctx.fill();
  ctx.fillStyle=top; ctx.beginPath(); ctx.arc(hx-r*0.2,hy-r*0.2,r*0.6,0,7); ctx.fill();
  if(ring){ // 장갑 테두리 장식
    ctx.strokeStyle=ring; ctx.lineWidth=Math.max(2,r*0.16);
    ctx.beginPath(); ctx.arc(hx,hy,r*0.86,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
  }
}

function drawWeapon(){
  const now=performance.now();
  const moving = keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
  const gun = hero.weapon==='rifle' || hero.weapon==='sniper';
  const amp = (moving?1:0.4) * (gun ? 1-0.65*_smooth(aimBlend) : 1);   // 겨누는 중엔 흔들림이 줄어듦
  // 항상 살아있는 손맛 흔들림
  const swayX = Math.sin(now*0.0042)*9*amp;
  const swayY = (moving ? Math.abs(Math.sin(now*0.0084))*16 : Math.sin(now*0.0018)*6);
  const swayR = Math.sin(now*0.0033)*0.02*amp;
  ctx.save();
  ctx.translate(W*0.5 + swayX, H + swayY);
  ctx.rotate(swayR);
  if(hero.weapon==='hammer') drawHammer(now);
  else if(hero.weapon==='katana') drawKatana(now);
  else if(hero.weapon==='sniper') drawSniper(now);
  else drawRifle(now);
  ctx.restore();
}

// 무기 크기: 화면 크기에 맞춰 조금씩 커지거나 작아진다
function weaponScale(){ return Math.max(0.75, Math.min(1.35, W/1280)); }

// 자동소총 RAZOR-FX (딜러) — 오른쪽 아래에서 옆모습이 보이게 견착, 총구는 화면 중앙 쪽
// 디자인: 건메탈 몸체 + 주황 발광 라인·케이블, 홀로그램 조준경, 총열 아래 미사일 포드(스킬)
// 동작: 발사 반동(뒤로 밀림·총구 들림·좌우 흔들림), 노리쇠 왕복, 탄피 배출, 재장전(탄창 교체·장전), 미사일 발사
function drawRifleSide(now){
  const k=recoilAmt, s=weaponScale(), GA=ctx.globalAlpha;
  const OR='#ff8a2a', BLUE='#3aa8ff';
  const charge=abilCharge(now);
  const mt=now-muzzle, lt=now-missileFireT;
  const R=reloadAnim(now);
  // 평소 자세: 두 손으로 총을 수평으로 들어 화면 아래쪽을 가로지름 (쏘면 가운데 조준으로 넘어감)
  const P=gunPose([40,-H*0.30/s,0.02],[30,-H*0.36/s,0.0]);
  ctx.save();
  ctx.translate(P.x*s,(P.y+R.tilt*40)*s);
  ctx.rotate(P.r + k*0.10 + recoilJit*k - R.tilt*0.20);
  ctx.scale(s*1.6,s*1.6);
  ctx.translate(k*34, k*5);
  // 화면 좌표 기록 (탄피·연기·총알 궤적이 여기서 나감)
  const M=ctx.getTransform(), tp=(x,y)=>{ const q=M.transformPoint(new DOMPoint(x,y)); return {x:q.x,y:q.y}; };
  gunFx.muzzle=tp(-358,0); gunFx.eject=tp(96,-18); gunFx.pod=tp(-190,48);
  // 왼손: 평소엔 핸드가드 뒤쪽 아래, 재장전 중엔 탄창으로
  const LHX=_lerp(-96,70,R.hand), LHY=_lerp(84,150+Math.min(R.magDy,90),R.hand);   // 왼손: 미사일 포드를 아래에서 쥠
  // 팔 (총 뒤쪽)
  drawArm(-190,400,LHX+10,LHY+18,64,'#23262c','#3a8be0');   // 왼팔 (아래 왼쪽에서)
  drawArm(340,400,166,100,68,'#23262c','#3a8be0');           // 오른팔 → 손잡이

  // 개머리판 (조절식) + 버퍼 튜브
  ctx.fillStyle='#24272d'; roundRect(136,-14,60,24,6); ctx.fill();
  const sg=ctx.createLinearGradient(0,-30,0,76); sg.addColorStop(0,'#3a3f47'); sg.addColorStop(1,'#16181c');
  ctx.fillStyle=sg; ctx.beginPath();
  ctx.moveTo(186,-28); ctx.lineTo(292,-24); ctx.quadraticCurveTo(304,-22,304,-10);
  ctx.lineTo(306,66); ctx.quadraticCurveTo(306,76,296,76); ctx.lineTo(282,76);
  ctx.lineTo(236,20); ctx.lineTo(190,18); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#0b0c0e'; ctx.beginPath(); ctx.moveTo(246,10); ctx.lineTo(286,10); ctx.lineTo(288,52); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#2a2e35'; roundRect(294,-22,14,98,5); ctx.fill();                  // 개머리 패드
  ctx.fillStyle='rgba(200,206,214,0.5)'; ctx.font='bold 10px Orbitron,monospace'; ctx.fillText('VOLTA R&D',198,-8);

  // 리시버 (위·아래)
  const rg=ctx.createLinearGradient(0,-32,0,44); rg.addColorStop(0,'#41464f'); rg.addColorStop(0.5,'#2a2e35'); rg.addColorStop(1,'#1a1c20');
  ctx.fillStyle=rg; roundRect(-2,-32,146,46,6); ctx.fill();          // 윗 리시버
  ctx.fillStyle='#202328'; roundRect(18,12,118,30,6); ctx.fill();    // 아래 리시버
  // 탄피 배출구 + 노리쇠 (쏠 때마다 뒤로 갔다가 돌아옴)
  ctx.fillStyle='#0b0c0e'; roundRect(70,-24,40,14,3); ctx.fill();
  const boltOff=(mt<70?(1-mt/70)*16:0)+R.ch*14;
  ctx.fillStyle='#565b64'; roundRect(72+boltOff,-22,24,10,2); ctx.fill();
  ctx.fillStyle='#2e3239'; ctx.beginPath(); ctx.arc(128,-16,7,0,7); ctx.fill(); // 노리쇠 전진기
  // 장전 손잡이 (재장전 마지막에 당김)
  ctx.fillStyle='#2b2f36'; roundRect(126+R.ch*26,-40,20,8,3); ctx.fill();
  glowPath(OR,2,()=>{ ctx.moveTo(6,-2); ctx.lineTo(60,-2); ctx.lineTo(70,6); ctx.lineTo(138,6); });
  ctx.fillStyle='rgba(205,212,222,0.78)'; ctx.font='bold 13px Orbitron,monospace'; ctx.fillText('RAZOR-FX',26,30);
  ctx.fillStyle='rgba(205,212,222,0.5)'; ctx.font='6px Orbitron,monospace'; ctx.fillText('ASSAULT RIFLE',28,38);

  // 총열 + 소염기
  ctx.fillStyle='#16181c'; roundRect(-322,-6,150,12,3); ctx.fill();
  ctx.fillStyle='#3a3f47'; ctx.fillRect(-322,-4,150,2);
  ctx.fillStyle='#0f1013'; roundRect(-350,-10,32,20,4); ctx.fill();
  ctx.fillStyle='#2e3239'; for(let i=0;i<3;i++) ctx.fillRect(-346+i*9,-10,4,20);
  // 가늠쇠 (A자 기둥)
  ctx.fillStyle='#1a1c20'; ctx.beginPath();
  ctx.moveTo(-198,-6); ctx.lineTo(-190,-46); ctx.lineTo(-178,-46); ctx.lineTo(-170,-6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#08090b'; roundRect(-188,-38,8,14,2); ctx.fill();
  // 핸드가드 (M-LOK 타원 구멍)
  const hg=ctx.createLinearGradient(0,-28,0,22); hg.addColorStop(0,'#3a3f47'); hg.addColorStop(1,'#17191d');
  ctx.fillStyle=hg; roundRect(-176,-28,180,50,8); ctx.fill();
  ctx.fillStyle='#08090b'; for(let i=0;i<6;i++){ roundRect(-164+i*26,-14,16,9,4.5); ctx.fill(); }
  // 상단 레일 (피카티니 홈)
  ctx.fillStyle='#202328'; ctx.fillRect(-176,-38,300,8);
  ctx.fillStyle='#0f1114'; for(let x=-172;x<120;x+=10) ctx.fillRect(x,-38,5,4);
  // 주황·파랑 케이블 + LED
  glowPath(OR,1.8,()=>{ ctx.moveTo(4,-20); ctx.bezierCurveTo(-30,-26,-60,6,-112,2); });
  glowPath(BLUE,1.3,()=>{ ctx.moveTo(4,-10); ctx.bezierCurveTo(-24,-8,-40,12,-72,10); });
  ctx.fillStyle='#101216'; roundRect(-42,-26,22,14,3); ctx.fill(); glowDot(-31,-19,2.4,BLUE,0.9);

  // 홀로그램 조준경 + 측면 초록 화면 (쏘면 화면이 깜빡임)
  ctx.fillStyle='#16181c'; roundRect(46,-52,78,16,3); ctx.fill();
  ctx.fillStyle='#1d2025'; ctx.beginPath();
  ctx.moveTo(52,-50); ctx.lineTo(52,-98); ctx.lineTo(118,-98); ctx.lineTo(126,-88); ctx.lineTo(126,-50); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#2b2f36'; roundRect(56,-94,40,38,4); ctx.fill();
  ctx.fillStyle='rgba(30,50,40,0.92)'; roundRect(60,-90,32,30,3); ctx.fill();
  ctx.fillStyle=mt<60?'#f4ffb0':'#c8ff3a'; roundRect(100,-80,20,10,2); ctx.fill(); glowDot(110,-75,3,'#c8ff3a',0.55);
  ctx.fillStyle='#0b0c0e'; roundRect(102,-64,14,6,2); ctx.fill();
  // 떠 있는 홀로그램 표시: 미사일 준비 상태 (위아래로 둥실, 가끔 지직거림, 발사 순간 LAUNCH)
  const bob=Math.sin(now*0.004)*3, glitch=(Math.sin(now*0.031)*Math.sin(now*0.017)>0.92)?0.45:1;
  const launching=lt<600;
  ctx.save(); ctx.translate(-8+(launching&&lt<150?(Math.random()-0.5)*4:0),-156+bob);
  ctx.globalAlpha=GA*glitch;
  ctx.fillStyle=launching?'rgba(255,140,60,0.16)':'rgba(120,200,255,0.12)'; roundRect(0,0,84,36,5); ctx.fill();
  ctx.strokeStyle=launching?'rgba(255,170,90,0.8)':'rgba(150,215,255,0.65)'; ctx.lineWidth=1.2; roundRect(0,0,84,36,5); ctx.stroke();
  ctx.fillStyle='rgba(150,215,255,0.10)'; for(let y=3;y<36;y+=4) ctx.fillRect(2,y,80,1);   // 홀로그램 주사선
  ctx.strokeStyle='rgba(150,215,255,0.35)'; ctx.beginPath(); ctx.moveTo(60,36); ctx.lineTo(74,58-bob); ctx.stroke();
  ctx.font='bold 14px Orbitron,monospace'; ctx.textAlign='center';
  if(launching){ ctx.fillStyle=(Math.floor(lt/90)%2)?'#ffffff':OR; ctx.fillText('LAUNCH',42,23); }
  else { ctx.fillStyle=charge>=1?OR:'rgba(150,215,255,0.9)'; ctx.fillText(charge>=1?'READY':Math.floor(charge*100)+'%',42,23); }
  ctx.textAlign='left';
  ctx.restore();

  // 미사일 3발 + 미사일 포드 — 발사하면 포드가 뒤로 튀고 앞쪽이 번쩍임, 충전될수록 미사일이 다시 밀려 나옴
  const podKick=lt<260?(1-lt/260)*12:0;
  ctx.save(); ctx.translate(podKick,0);
  for(let i=0;i<3;i++){
    const my=30+i*17, out=charge*20;
    ctx.globalAlpha=GA*(0.35+0.65*charge);
    ctx.fillStyle='#3a3f47'; roundRect(-168-out,my,90,13,4); ctx.fill();
    ctx.fillStyle=OR; ctx.beginPath(); ctx.moveTo(-166-out,my);
    ctx.quadraticCurveTo(-198-out,my+6.5,-166-out,my+13); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(-180-out,my+2,8,2);
    ctx.globalAlpha=GA;
  }
  ctx.fillStyle='#1a1c20'; roundRect(-122,18,40,14,3); ctx.fill();            // 마운트
  const pg=ctx.createLinearGradient(0,24,0,92); pg.addColorStop(0,'#3f444d'); pg.addColorStop(1,'#16181c');
  ctx.fillStyle=pg; roundRect(-152,24,118,68,10); ctx.fill();
  ctx.fillStyle='#0b0c0e'; for(let i=0;i<3;i++) ctx.fillRect(-150,34+i*17,6,8);
  ctx.fillStyle='rgba(205,212,222,0.75)'; ctx.font='bold 10px Orbitron,monospace';
  ctx.fillText('MISSILE',-138,52); ctx.fillText('POD',-138,64);
  ctx.fillStyle='#14161a'; ctx.beginPath(); ctx.arc(-54,58,20,0,7); ctx.fill();
  ctx.strokeStyle=rgba(OR,0.35+0.65*charge); ctx.lineWidth=4; ctx.beginPath(); ctx.arc(-54,58,14,0,7); ctx.stroke();
  glowDot(-54,58,3+charge*2,OR,0.4+0.6*charge);
  ctx.fillStyle='rgba(255,170,90,0.85)'; ctx.font='bold 6px Orbitron,monospace'; ctx.fillText('LAUNCH',-66,86);
  glowDot(-80,44,1.6,BLUE,0.9);
  if(lt<160){ const f=1-lt/160; glowDot(-176,48,14*f+4,OR,f); }               // 발사 화염
  ctx.restore();

  // 탄창 (주황 잔탄 창) — 재장전 때 빠졌다가 새 탄창이 끼워짐
  if(R.magA>0){
    ctx.save(); ctx.globalAlpha=GA*R.magA; ctx.translate(46,40+R.magDy); ctx.rotate(0.18+R.magDy*0.002);
    const mg=ctx.createLinearGradient(0,0,46,0); mg.addColorStop(0,'#2e3239'); mg.addColorStop(1,'#15171b');
    ctx.fillStyle=mg; roundRect(0,0,46,104,7); ctx.fill();
    ctx.fillStyle='#08090b'; roundRect(30,10,9,70,3); ctx.fill();
    const full = R.rp>=0.62;                                // 새 탄창은 가득
    const lit=full?10:Math.ceil((maxammo?ammo/maxammo:0)*10);
    for(let i=0;i<10;i++){ ctx.fillStyle=i<lit?OR:'#2a1a10'; ctx.fillRect(32,72-i*6.6,5,4.4); }
    ctx.fillStyle='#0c0d10'; roundRect(-2,96,50,12,4); ctx.fill();
    ctx.fillStyle='#7fc4ff'; ctx.font='bold 9px Orbitron,monospace'; ctx.fillText(`${full?maxammo:ammo}/${maxammo}`,4,90);
    ctx.restore();
  }
  // 방아쇠울 + 방아쇠 (쏘는 순간 당겨짐)
  ctx.strokeStyle='#1a1c20'; ctx.lineWidth=5; ctx.beginPath();
  ctx.moveTo(96,42); ctx.quadraticCurveTo(100,66,126,62); ctx.lineTo(132,42); ctx.stroke();
  ctx.fillStyle='#2e3239'; roundRect(108+(mt<60?4:0),42,5,14,2); ctx.fill();
  // 권총 손잡이 (미끄럼 방지 홈)
  ctx.fillStyle='#17191d'; ctx.beginPath();
  ctx.moveTo(124,38); ctx.lineTo(156,38); ctx.lineTo(176,118); ctx.quadraticCurveTo(176,126,166,126);
  ctx.lineTo(146,126); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#0c0d10'; for(let i=0;i<7;i++) ctx.fillRect(140+i*2.6,52+i*10,22,2);
  // 손
  drawGlove(LHX,LHY,34,2.0);     // 왼손 장갑 (포드를 감쌈, 재장전 중엔 탄창을 잡음)
  drawGlove(156,86,36,0.85);     // 오른손 장갑 (손잡이를 감쌈)
  // 머즐 플래시 — 앞으로 길게 뻗는 불꽃 + 주변을 밝히는 빛
  if(mt<70){
    const f=1-mt/70, v=Math.floor(muzzle)%3;
    ctx.save(); ctx.translate(-358,0);
    const lg=ctx.createRadialGradient(0,0,0,0,0,150);
    lg.addColorStop(0,`rgba(255,200,110,${0.5*f})`); lg.addColorStop(1,'rgba(255,140,40,0)');
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,0,150,0,7); ctx.fill();
    ctx.rotate((v-1)*0.12); ctx.scale(1.8,1);
    const r=(13+v*4)*(0.6+0.4*f);
    ctx.fillStyle=`rgba(255,185,80,${0.95*f})`;
    ctx.beginPath();
    for(let i=0;i<10;i++){ const an=i/10*Math.PI*2+v*0.3, rr=(i%2?r:r*2.3);
      ctx[i?'lineTo':'moveTo'](Math.cos(an)*rr,Math.sin(an)*rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(255,250,225,${f})`; ctx.beginPath(); ctx.arc(-4,0,r*0.8,0,7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// 저격소총 LUX-VALOR (힐러) — 볼트액션, 오른쪽 아래에서 옆모습이 보이게 견착. 우클릭 ADS
// 디자인: 흰·파랑 몸체, 하늘색 회복약이 흐르는 유리관, 금장 총구와 하늘색 결정
// 동작: 큰 반동 → 오른손으로 노리쇠를 들어 당겼다 밀어 넣음(탄피 배출) → 다시 손잡이로, 재장전(탄창 교체)
function drawSniperSide(now){
  const k=recoilAmt, s=weaponScale(), mt=now-muzzle, GA=ctx.globalAlpha;
  const CY='#4ff0ff', BL='#2f6fd6', GOLD='#d9b45a';
  const R=reloadAnim(now);
  const wgrad=(y0,y1)=>{ const g=ctx.createLinearGradient(0,y0,0,y1);
    g.addColorStop(0,'#f4f8fc'); g.addColorStop(0.6,'#dfe6ef'); g.addColorStop(1,'#b9c5d4'); return g; };
  // 볼트 조작: 쏜 뒤 0.2초부터 0.6초 동안 — 들기 → 당기기(탄피 배출) → 밀기 → 내리기
  const bu=(mt>200 && mt<800)?(mt-200)/600:-1;
  let back=0, lift=0;
  if(bu>=0){
    lift = bu<0.15?bu/0.15 : bu>0.85?(1-bu)/0.15 : 1;
    back = bu<0.15?0 : bu<0.5?_easeOut((bu-0.15)/0.35) : bu<0.85?1-_easeIn((bu-0.5)/0.35) : 0;
    if(bu>=0.45 && !sniperEjected){ sniperEjected=true; spawnCasing(true); }
  }
  if(R.ch>0){ back=Math.max(back,R.ch); lift=Math.max(lift,Math.min(1,R.ch*2)); }   // 재장전 마지막에도 노리쇠 조작
  const bx=118+back*36, by=14-lift*16;                 // 노리쇠 손잡이(금장 노브) 위치
  const hb = bu<0?0 : bu<0.12?bu/0.12 : bu>0.88?(1-bu)/0.12 : 1;   // 오른손이 노브로 가는 정도
  const handB=Math.max(hb, R.ch>0?1:0);
  const RHX=_lerp(144,bx+4,handB), RHY=_lerp(66,by+2,handB);
  const LHX=_lerp(-120,52,R.hand), LHY=_lerp(22,120+Math.min(R.magDy,90),R.hand);

  // 평소 자세: 두 손으로 총을 수평으로 들어 화면 아래쪽을 가로지름 (쏘면 가운데 조준으로 넘어감)
  const P=gunPose([80,-H*0.30/s,0.02],[60,-H*0.36/s,0.0]);
  ctx.save();
  ctx.translate(P.x*s,(P.y+R.tilt*40)*s);
  ctx.rotate(P.r + k*0.08 + recoilJit*k - R.tilt*0.20);
  ctx.scale(s*1.45,s*1.45);
  ctx.translate(k*30, k*6);
  const M=ctx.getTransform(), tp=(x,y)=>{ const q=M.transformPoint(new DOMPoint(x,y)); return {x:q.x,y:q.y}; };
  gunFx.muzzle=tp(-414,0); gunFx.eject=tp(112,-20); gunFx.pod=null;
  // 흰 장갑 팔 + 하늘색 발광선
  drawArm(-200,400,LHX+10,LHY+18,60,'#d9e1ec',BL);
  drawArm(340,400,RHX+10,RHY+18,64,'#d9e1ec',BL);
  glowPath(CY,1.5,()=>{ ctx.moveTo(-190,350); ctx.lineTo(_lerp(-200,LHX,0.65),_lerp(380,LHY,0.65)); });
  glowPath(CY,1.5,()=>{ ctx.moveTo(316,352); ctx.lineTo(_lerp(330,RHX,0.62),_lerp(380,RHY,0.62)); });

  // 개머리판 (흰 쉘) + 하늘색 회복약 캡슐
  ctx.fillStyle=wgrad(-34,70); ctx.beginPath();
  ctx.moveTo(128,-30); ctx.lineTo(292,-30); ctx.quadraticCurveTo(306,-30,306,-16); ctx.lineTo(306,58);
  ctx.quadraticCurveTo(306,70,294,70); ctx.lineTo(250,70); ctx.lineTo(210,24); ctx.lineTo(128,24); ctx.closePath(); ctx.fill();
  ctx.fillStyle=BL; roundRect(296,-30,12,100,5); ctx.fill();
  const cap=ctx.createLinearGradient(0,-22,0,14);
  cap.addColorStop(0,'rgba(30,140,200,0.95)'); cap.addColorStop(0.5,'rgba(150,250,255,0.95)'); cap.addColorStop(1,'rgba(30,140,200,0.95)');
  ctx.fillStyle=cap; roundRect(176,-22,100,36,16); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.6)';
  for(let i=0;i<5;i++){ const bb=272-((now*0.04+i*22)%96); ctx.beginPath(); ctx.arc(bb,-12+(i%3)*10,2.2,0,7); ctx.fill(); }
  ctx.fillStyle='#9fb0c6'; roundRect(170,-24,10,40,3); ctx.fill(); roundRect(272,-24,10,40,3); ctx.fill();
  ctx.fillStyle='rgba(40,70,120,0.7)'; ctx.font='bold 7px Orbitron,monospace'; ctx.fillText('RESTORATIVE AGENT',186,22);

  // 리시버 (흰 몸체) + 회복약 유리관 (소용돌이가 흐름, 쏘면 잠깐 밝아짐)
  ctx.fillStyle=wgrad(-36,28); roundRect(-30,-36,164,62,10); ctx.fill();
  ctx.fillStyle=BL; roundRect(-30,16,164,10,4); ctx.fill();
  const tube=ctx.createLinearGradient(0,-26,0,10);
  tube.addColorStop(0,'rgba(20,110,180,0.95)'); tube.addColorStop(0.5,mt<200?'rgba(220,255,255,0.98)':'rgba(130,240,255,0.95)'); tube.addColorStop(1,'rgba(20,110,180,0.95)');
  ctx.fillStyle=tube; roundRect(-10,-26,118,36,16); ctx.fill();
  ctx.save(); roundRect(-10,-26,118,36,16); ctx.clip();
  ctx.strokeStyle='rgba(230,255,255,0.75)'; ctx.lineWidth=2;
  for(let n=0;n<2;n++){
    ctx.beginPath();
    for(let x=-10;x<=108;x+=4){
      const y=-8+Math.sin(x*0.08+now*0.006+n*Math.PI)*10;
      if(x===-10) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=2; roundRect(-10,-26,118,36,16); ctx.stroke();
  ctx.fillStyle=GOLD; ctx.fillRect(-14,-28,4,40); ctx.fillRect(108,-28,4,40);
  // 노리쇠가 열리면 보이는 약실
  if(back>0.05){ ctx.fillStyle='#0d1626'; roundRect(108,-24,back*34,12,3); ctx.fill(); }

  // 핸드가드 (흰 몸체 + 하늘색 발광 통풍구)
  ctx.fillStyle=wgrad(-26,18); roundRect(-190,-26,166,44,9); ctx.fill();
  ctx.fillStyle=BL; roundRect(-190,8,166,10,4); ctx.fill();
  for(let i=0;i<5;i++){
    const pl=0.55+0.45*Math.sin(now*0.005+i*0.8);
    ctx.fillStyle=rgba(CY,0.5+0.5*pl); roundRect(-176+i*30,-18,20,10,3); ctx.fill();
  }
  ctx.fillStyle='rgba(40,70,120,0.75)'; ctx.font='bold 8px Orbitron,monospace'; ctx.fillText('LUX-VALOR',-82,4);
  // 총열 + 금장 링
  ctx.fillStyle='#1b2333'; roundRect(-372,-6,186,12,3); ctx.fill();
  ctx.fillStyle='#46546e'; ctx.fillRect(-372,-4,186,2);
  ctx.fillStyle=GOLD; roundRect(-224,-9,8,18,2); ctx.fill();
  // 금장 총구 + 하늘색 결정
  ctx.fillStyle='#e8eef6'; roundRect(-396,-11,28,22,6); ctx.fill();
  ctx.fillStyle=GOLD; roundRect(-372,-12,6,24,2); ctx.fill(); roundRect(-398,-12,6,24,2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-398,-10); ctx.lineTo(-418,-18); ctx.lineTo(-402,-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-398,10); ctx.lineTo(-418,18); ctx.lineTo(-402,4); ctx.closePath(); ctx.fill();
  glowDot(-410,0,4.5,CY,0.75+0.25*Math.sin(now*0.007));

  // 스코프 (흰 몸체, 하늘색 렌즈)
  ctx.fillStyle='#93a3b8'; roundRect(-6,-54,14,20,3); ctx.fill(); roundRect(84,-54,14,20,3); ctx.fill();
  ctx.fillStyle=wgrad(-84,-48); roundRect(-44,-84,172,32,14); ctx.fill();
  ctx.fillStyle=BL; roundRect(20,-86,26,36,6); ctx.fill();
  ctx.fillStyle='#e8eef6'; roundRect(26,-98,14,14,4); ctx.fill();
  ctx.fillStyle=BL; roundRect(-52,-88,14,40,6); ctx.fill();
  const fl=ctx.createRadialGradient(-54,-68,1,-54,-68,16);
  fl.addColorStop(0,'rgba(220,255,255,0.95)'); fl.addColorStop(0.5,'rgba(80,220,255,0.85)'); fl.addColorStop(1,'rgba(20,90,160,0.95)');
  ctx.fillStyle=fl; ctx.beginPath(); ctx.ellipse(-56,-68,7,17,0,0,Math.PI*2); ctx.fill();
  glowDot(130,-68,3,CY,0.9);
  // 스코프 위 홀로그램 표시창: 초록 십자 + 회복 스킬 충전 막대 (둥실거림, 회복 중엔 십자가 깜빡임)
  const bob=Math.sin(now*0.004+1)*3;
  ctx.save(); ctx.translate(38,-152+bob);
  ctx.fillStyle='rgba(80,230,255,0.14)'; roundRect(0,0,76,40,5); ctx.fill();
  ctx.strokeStyle='rgba(120,240,255,0.65)'; ctx.lineWidth=1.2; roundRect(0,0,76,40,5); ctx.stroke();
  ctx.fillStyle='rgba(120,240,255,0.08)'; for(let y=3;y<40;y+=4) ctx.fillRect(2,y,72,1);
  ctx.fillStyle=(abilActive && Math.floor(now/150)%2)?'#e8fff0':'#7dff9a'; ctx.fillRect(10,17,16,6); ctx.fillRect(15,12,6,16);
  ctx.fillStyle='rgba(120,240,255,0.85)'; ctx.fillRect(34,24,34*abilCharge(now),5);
  ctx.strokeStyle='rgba(120,240,255,0.5)'; ctx.strokeRect(34,24,34,5);
  ctx.fillStyle='rgba(150,240,255,0.9)'; ctx.font='bold 7px Orbitron,monospace'; ctx.fillText(abilActive?'HEALING':'HEAL',36,17);
  ctx.restore();

  // 노리쇠 손잡이 (은색 + 금장 노브) — 쏜 뒤 오른손이 들어 당겼다 밀어 넣음
  ctx.strokeStyle='#cfd8e4'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(112+back*36,-6); ctx.lineTo(bx,by); ctx.stroke();
  ctx.fillStyle=GOLD; ctx.beginPath(); ctx.arc(bx,by,8,0,7); ctx.fill();
  ctx.fillStyle='#fff3c8'; ctx.beginPath(); ctx.arc(bx-2,by-2,3,0,7); ctx.fill();
  // 탄창 (회복탄 칸) — 재장전 때 빠졌다가 새 탄창이 끼워짐
  if(R.magA>0){
    ctx.save(); ctx.globalAlpha=GA*R.magA; ctx.translate(30,24+R.magDy); ctx.rotate(0.06+R.magDy*0.002);
    ctx.fillStyle=wgrad(0,80); roundRect(0,0,46,76,7); ctx.fill();
    ctx.fillStyle=BL; roundRect(0,66,46,12,4); ctx.fill();
    const shown = R.rp>=0.62 ? maxammo : ammo;
    for(let i=0;i<maxammo;i++){ ctx.fillStyle=i<shown?CY:'rgba(40,80,110,0.6)'; roundRect(30,56-i*9,10,6,2); ctx.fill(); }
    ctx.fillStyle='rgba(40,70,120,0.8)'; ctx.font='bold 6px Orbitron,monospace'; ctx.fillText('HEAL',4,30); ctx.fillText('AMMO',4,38);
    ctx.fillStyle=BL; ctx.fillRect(8,45,10,3); ctx.fillRect(11.5,41.5,3,10);
    ctx.restore();
  }
  // 방아쇠울 + 손잡이
  ctx.strokeStyle='#9fb0c6'; ctx.lineWidth=5; ctx.beginPath();
  ctx.moveTo(84,26); ctx.quadraticCurveTo(90,52,114,48); ctx.lineTo(120,26); ctx.stroke();
  ctx.fillStyle=wgrad(24,120); ctx.beginPath();
  ctx.moveTo(118,24); ctx.lineTo(150,24); ctx.lineTo(168,108); ctx.quadraticCurveTo(168,118,156,118);
  ctx.lineTo(138,118); ctx.closePath(); ctx.fill();
  ctx.fillStyle=BL; ctx.beginPath(); ctx.moveTo(118,24); ctx.lineTo(128,24); ctx.lineTo(146,118); ctx.lineTo(138,118); ctx.closePath(); ctx.fill();
  // 흰 장갑 손 (금색 테두리)
  drawGlove(LHX,LHY,32,2.0,'#e9eef5','#d5dde8',GOLD,'#c4cfdd');
  drawGlove(RHX,RHY,34,0.85,'#e9eef5','#d5dde8',GOLD,'#c4cfdd');
  // 머즐 플래시 (하늘색 회복탄) + 빛 번짐
  if(mt<160){
    const f=1-mt/160,r=18+Math.random()*10;
    ctx.save(); ctx.translate(-414,0);
    const lg=ctx.createRadialGradient(0,0,0,0,0,170);
    lg.addColorStop(0,`rgba(170,250,255,${0.5*f})`); lg.addColorStop(1,'rgba(80,220,255,0)');
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,0,170,0,7); ctx.fill();
    ctx.fillStyle=`rgba(190,250,255,${0.88*f})`;
    ctx.beginPath(); ctx.ellipse(-r*2.2,0,r*2.6,r*0.35,0,0,Math.PI*2); ctx.fill();
    ctx.rotate(Math.random()*0.4-0.2);
    ctx.fillStyle=`rgba(90,230,255,${0.7*f})`;
    ctx.beginPath();
    for(let i=0;i<8;i++){const an=i/8*Math.PI*2,rr=(i%2?r*0.6:r*1.8);
      ctx[i?'lineTo':'moveTo'](Math.cos(an)*rr,Math.sin(an)*rr);}
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(240,255,255,${f})`; ctx.beginPath(); ctx.arc(0,0,r*0.55,0,7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ── 총 그리기 진입점: 평소엔 옆모습(로우 레디), 쏘면 총을 화면 가운데로 가져와 조준경을 들여다보는 자세 ──
let aimOnTarget=false;
function adsMix(){
  const A=_smooth(Math.max(0,Math.min(1,aimBlend)));
  return { A,
    side: 1-_smooth(Math.max(0,Math.min(1,(A-0.35)/0.2))),     // 옆모습은 0.35~0.55 사이에 사라짐
    ads:  _smooth(Math.max(0,Math.min(1,(A-0.40)/0.2))),        // 가운데 조준은 0.40~0.60 사이에 나타남
    rise: Math.max(0,Math.min(1,(A-0.40)/0.60)) };              // 아래에서 올라오는 정도
}
function drawRifle(now){
  const m=adsMix();
  if(m.side>0.01){ ctx.save(); ctx.globalAlpha*=m.side; drawRifleSide(now); ctx.restore(); }
  if(m.ads>0.01){ ctx.save(); ctx.globalAlpha*=m.ads; drawRifleADS(now,m.rise); ctx.restore(); }
}
function drawSniper(now){
  const m=adsMix();
  if(m.side>0.01){ ctx.save(); ctx.globalAlpha*=m.side; drawSniperSide(now); ctx.restore(); }
  if(m.ads>0.01){ ctx.save(); ctx.globalAlpha*=m.ads; drawSniperADS(now,m.rise); ctx.restore(); }
}
// 떠 있는 홀로그램 표시창 (READY / LAUNCH / 충전 %)
function drawHoloTag(x,y,now,charge,lt,OR){
  const GA=ctx.globalAlpha, bob=Math.sin(now*0.004)*3;
  const glitch=(Math.sin(now*0.031)*Math.sin(now*0.017)>0.92)?0.45:1, launching=lt<600;
  ctx.save(); ctx.translate(x,y+bob); ctx.globalAlpha=GA*glitch;
  ctx.fillStyle=launching?'rgba(255,140,60,0.16)':'rgba(120,200,255,0.12)'; roundRect(0,0,84,34,5); ctx.fill();
  ctx.strokeStyle=launching?'rgba(255,170,90,0.8)':'rgba(150,215,255,0.65)'; ctx.lineWidth=1.2; roundRect(0,0,84,34,5); ctx.stroke();
  ctx.fillStyle='rgba(150,215,255,0.10)'; for(let yy=3;yy<34;yy+=4) ctx.fillRect(2,yy,80,1);
  ctx.font='bold 14px Orbitron,monospace'; ctx.textAlign='center';
  if(launching){ ctx.fillStyle=(Math.floor(lt/90)%2)?'#ffffff':OR; ctx.fillText('LAUNCH',42,22); }
  else { ctx.fillStyle=charge>=1?OR:'rgba(150,215,255,0.9)'; ctx.fillText(charge>=1?'READY':Math.floor(charge*100)+'%',42,22); }
  ctx.textAlign='left'; ctx.restore();
}
// 조준경 창이 뚫린 하우징 (창 안으로 바깥 세상이 보이도록 evenodd로 구멍)
function sightHousing(ox,oy,ow,oh,ix,iy,iw,ih,col0,col1){
  const g=ctx.createLinearGradient(0,oy,0,oy+oh); g.addColorStop(0,col0); g.addColorStop(1,col1);
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(ox+14,oy); ctx.arcTo(ox+ow,oy,ox+ow,oy+oh,14); ctx.arcTo(ox+ow,oy+oh,ox,oy+oh,14);
  ctx.arcTo(ox,oy+oh,ox,oy,14); ctx.arcTo(ox,oy,ox+ow,oy,14); ctx.closePath();
  ctx.moveTo(ix+8,iy); ctx.arcTo(ix+iw,iy,ix+iw,iy+ih,8); ctx.arcTo(ix+iw,iy+ih,ix,iy+ih,8);
  ctx.arcTo(ix,iy+ih,ix,iy,8); ctx.arcTo(ix,iy,ix+iw,iy,8); ctx.closePath();
  ctx.fill('evenodd');
}

// 자동소총 RAZOR-FX — 가운데 조준: 뒤에서 홀로그램 조준경 창을 들여다봄. 창 안의 점이 조준점
function drawRifleADS(now,u){
  const s=weaponScale(), k=recoilAmt, OR='#ff8a2a', BLUE='#3aa8ff';
  const charge=abilCharge(now), mt=now-muzzle, lt=now-missileFireT;
  const rise=(1-_smooth(u))*H*0.6;
  ctx.save();
  ctx.translate(recoilJit*k*260, -H/2 + rise - k*26*s);   // (0,0) = 조준경 창 가운데 = 화면 조준점. 쏘면 위로 튀었다 돌아옴
  ctx.rotate(recoilJit*k*0.6);
  ctx.scale(s*1.15,s*1.15);
  const M=ctx.getTransform(), tp=(x,y)=>{ const q=M.transformPoint(new DOMPoint(x,y)); return {x:q.x,y:q.y}; };
  gunFx.muzzle=tp(0,22); gunFx.eject=tp(60,110); gunFx.pod=tp(-75,69);

  // 1) 총구 불꽃 — 조준경 뒤쪽에서 터져 하우징 둘레로 퍼짐
  if(mt<70){
    const f=1-mt/70, v=Math.floor(muzzle)%3;
    const lg=ctx.createRadialGradient(0,20,0,0,20,240);
    lg.addColorStop(0,`rgba(255,200,110,${0.55*f})`); lg.addColorStop(1,'rgba(255,140,40,0)');
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,20,240,0,7); ctx.fill();
    ctx.save(); ctx.translate(0,20); ctx.rotate(v*0.4);
    ctx.fillStyle=`rgba(255,185,80,${0.9*f})`; ctx.beginPath();
    for(let i=0;i<12;i++){ const an=i/12*Math.PI*2, rr=(i%2?60:150)*(0.7+0.3*f); ctx[i?'lineTo':'moveTo'](Math.cos(an)*rr,Math.sin(an)*rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 2) 미사일 포드 (총열 아래) — 뒤쪽 발사 링이 충전될수록 밝아짐
  const podKick=lt<260?(1-lt/260)*8:0;
  ctx.save(); ctx.translate(0,podKick);
  const pg=ctx.createLinearGradient(0,40,0,100); pg.addColorStop(0,'#3f444d'); pg.addColorStop(1,'#16181c');
  ctx.fillStyle=pg; roundRect(-114,40,78,60,12); ctx.fill();
  ctx.fillStyle='#14161a'; ctx.beginPath(); ctx.arc(-75,69,22,0,7); ctx.fill();
  ctx.strokeStyle=rgba(OR,0.35+0.65*charge); ctx.lineWidth=4; ctx.beginPath(); ctx.arc(-75,69,15,0,7); ctx.stroke();
  glowDot(-75,69,3+charge*2,OR,0.4+0.6*charge);
  glowDot(-104,52,1.6,BLUE,0.9);
  if(lt<160){ const f=1-lt/160; glowDot(-75,69,16*f+4,OR,f); }
  ctx.restore();
  // 3) 핸드가드 (조준경 아래로 보이는 앞부분)
  const hg=ctx.createLinearGradient(-44,0,44,0); hg.addColorStop(0,'#17191d'); hg.addColorStop(0.5,'#3a3f47'); hg.addColorStop(1,'#17191d');
  ctx.fillStyle=hg; ctx.beginPath(); ctx.moveTo(-30,44); ctx.lineTo(30,44); ctx.lineTo(44,100); ctx.lineTo(-44,100); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#08090b'; for(let i=0;i<2;i++){ roundRect(-34+i*4,54+i*22,8,13,4); ctx.fill(); roundRect(26-i*4,54+i*22,8,13,4); ctx.fill(); }
  glowPath(OR,1.6,()=>{ ctx.moveTo(-40,98); ctx.lineTo(-29,48); });
  // 4) 왼팔·왼손 — 핸드가드를 아래에서 받침
  drawArm(-430,760,-52,92,64);
  drawHand(-50,90,30);
  // 5) 탄창 (주황 잔탄 창)
  ctx.save(); ctx.translate(-70,176); ctx.rotate(0.14);
  ctx.fillStyle=shade3(0,50,'#2e3239','#3a3f47','#15171b'); roundRect(0,0,50,190,8); ctx.fill();
  ctx.fillStyle='#08090b'; roundRect(36,14,9,110,3); ctx.fill();
  const lit=Math.ceil((maxammo?ammo/maxammo:0)*12);
  for(let i=0;i<12;i++){ ctx.fillStyle=i<lit?OR:'#2a1a10'; ctx.fillRect(38,114-i*8.6,5,5.6); }
  ctx.restore();
  // 6) 조준경 받침 (레일 마운트)
  ctx.fillStyle='#202328'; roundRect(-24,50,48,46,4); ctx.fill();
  ctx.fillStyle='#0f1114'; for(let y=56;y<94;y+=8) ctx.fillRect(-24,y,48,3);
  // 7) 리시버 뒷면 + 장전 손잡이 + 주황 발광선 + 탄피 배출구(노리쇠 왕복)
  const rg=ctx.createLinearGradient(0,92,0,190); rg.addColorStop(0,'#41464f'); rg.addColorStop(1,'#1a1c20');
  ctx.fillStyle=rg; roundRect(-60,92,120,98,10); ctx.fill();
  ctx.fillStyle='#2b2f36'; roundRect(-38,86,76,12,4); ctx.fill();
  ctx.fillStyle='#0b0c0e'; roundRect(48,104,14,36,3); ctx.fill();
  ctx.fillStyle='#565b64'; roundRect(50,106+(mt<70?(1-mt/70)*10:0),10,16,2); ctx.fill();
  glowPath(OR,2,()=>{ ctx.moveTo(-55,104); ctx.lineTo(-55,182); });
  glowPath(OR,2,()=>{ ctx.moveTo(55,150); ctx.lineTo(55,182); });
  ctx.fillStyle='rgba(205,212,222,0.7)'; ctx.font='bold 11px Orbitron,monospace'; ctx.textAlign='center';
  ctx.fillText('RAZOR-FX',0,150); ctx.textAlign='left';
  // 8) 개머리판 (뺨에 붙인 윗면이 화면 아래로 이어짐)
  const sg=ctx.createLinearGradient(-120,0,140,0); sg.addColorStop(0,'#16181c'); sg.addColorStop(0.5,'#3a3f47'); sg.addColorStop(1,'#16181c');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(-48,188); ctx.lineTo(48,188); ctx.lineTo(150,900); ctx.lineTo(-120,900); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(200,206,214,0.45)'; ctx.font='bold 12px Orbitron,monospace'; ctx.textAlign='center';
  ctx.fillText('VOLTA R&D',8,280); ctx.textAlign='left';
  // 9) 오른팔·손잡이·오른손 (방아쇠 손)
  ctx.save(); ctx.translate(92,196); ctx.rotate(-0.25);
  ctx.fillStyle='#17191d'; roundRect(-18,0,40,96,10); ctx.fill();
  ctx.fillStyle='#0c0d10'; for(let i=0;i<6;i++) ctx.fillRect(-12,14+i*12,28,2);
  ctx.restore();
  drawArm(470,760,108,262,70);
  drawHand(104,256,36);
  // 10) 홀로그램 조준경 하우징 (창은 뚫려 있어 바깥이 보임)
  ctx.fillStyle='#1d2025'; roundRect(-86,-76,172,16,6); ctx.fill();                       // 후드
  sightHousing(-82,-64,164,122,-64,-48,128,90,'#2b2f36','#16181c');
  ctx.fillStyle='rgba(140,255,170,0.05)'; roundRect(-64,-48,128,90,8); ctx.fill();          // 유리 색
  ctx.strokeStyle='rgba(200,255,220,0.25)'; ctx.lineWidth=1.5; roundRect(-64,-48,128,90,8); ctx.stroke();
  ctx.fillStyle='#0b0c0e'; roundRect(82,-30,10,34,3); ctx.fill(); roundRect(-92,-30,10,34,3); ctx.fill();   // 버튼
  ctx.fillStyle=mt<60?'#f4ffb0':'#c8ff3a'; roundRect(60,-60,16,8,2); ctx.fill();            // 상태 화면
  // 조준점 (적을 겨누면 빨강)
  const rc=aimOnTarget?'#ff4a4a':'#d4ff4a';
  glowPath(rc,1.4,()=>{ ctx.arc(0,0,22,0,Math.PI*2); });
  glowPath(rc,1.2,()=>{ ctx.moveTo(0,-30); ctx.lineTo(0,-24); ctx.moveTo(0,24); ctx.lineTo(0,30); ctx.moveTo(-30,0); ctx.lineTo(-24,0); ctx.moveTo(24,0); ctx.lineTo(30,0); });
  glowDot(0,0,2.2,rc,1);
  // 11) 떠 있는 READY 표시
  drawHoloTag(90,-120,now,charge,lt,OR);
  ctx.restore();
}

// 저격소총 LUX-VALOR — 가운데 조준: 뒤에서 스코프 접안부를 들여다봄 (스코프 안으로 바깥이 보임)
function drawSniperADS(now,u){
  const s=weaponScale(), k=recoilAmt, mt=now-muzzle;
  const CY='#4ff0ff', BL='#2f6fd6', GOLD='#d9b45a';
  const rise=(1-_smooth(u))*H*0.6;
  // 볼트 조작 (옆모습과 같은 타이밍)
  const bu=(mt>200 && mt<800)?(mt-200)/600:-1;
  let back=0, lift=0;
  if(bu>=0){
    lift = bu<0.15?bu/0.15 : bu>0.85?(1-bu)/0.15 : 1;
    back = bu<0.15?0 : bu<0.5?_easeOut((bu-0.15)/0.35) : bu<0.85?1-_easeIn((bu-0.5)/0.35) : 0;
    if(bu>=0.45 && !sniperEjected){ sniperEjected=true; spawnCasing(true); }
  }
  const hb = bu<0?0 : bu<0.12?bu/0.12 : bu>0.88?(1-bu)/0.12 : 1;
  ctx.save();
  ctx.translate(recoilJit*k*200, -H/2 + rise - k*40*s);   // 저격총은 반동이 커서 더 크게 튐
  ctx.rotate(recoilJit*k*0.5);
  ctx.scale(s,s);
  const M=ctx.getTransform(), tp=(x,y)=>{ const q=M.transformPoint(new DOMPoint(x,y)); return {x:q.x,y:q.y}; };
  gunFx.muzzle=tp(0,40); gunFx.eject=tp(92,120); gunFx.pod=null;
  const wg=(y0,y1)=>{ const g=ctx.createLinearGradient(0,y0,0,y1); g.addColorStop(0,'#f4f8fc'); g.addColorStop(0.6,'#dfe6ef'); g.addColorStop(1,'#b9c5d4'); return g; };

  // 1) 총구 빛 (하늘색) — 스코프 둘레로 번짐
  if(mt<160){
    const f=1-mt/160;
    const lg=ctx.createRadialGradient(0,40,0,0,40,260);
    lg.addColorStop(0,`rgba(170,250,255,${0.55*f})`); lg.addColorStop(1,'rgba(80,220,255,0)');
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,40,260,0,7); ctx.fill();
  }
  // 2) 핸드가드 앞부분 + 하늘색 통풍구
  ctx.fillStyle=wg(70,120); ctx.beginPath(); ctx.moveTo(-30,72); ctx.lineTo(30,72); ctx.lineTo(42,118); ctx.lineTo(-42,118); ctx.closePath(); ctx.fill();
  for(let i=0;i<2;i++){ const pl=0.55+0.45*Math.sin(now*0.005+i); ctx.fillStyle=rgba(CY,0.5+0.5*pl); roundRect(-26+i*40,82,12,9,3); ctx.fill(); }
  // 3) 왼팔·왼손 (흰 장갑)
  drawArm(-430,760,-50,112,62,'#d9e1ec',BL);
  drawHand(-48,110,30,'#e9eef5','#c4cfdd',GOLD);
  // 4) 탄창 (회복탄 칸)
  ctx.save(); ctx.translate(-72,190); ctx.rotate(0.12);
  ctx.fillStyle=wg(0,150); roundRect(0,0,52,150,8); ctx.fill();
  ctx.fillStyle=BL; roundRect(0,136,52,14,5); ctx.fill();
  for(let i=0;i<maxammo;i++){ ctx.fillStyle=i<ammo?CY:'rgba(40,80,110,0.6)'; roundRect(34,116-i*17,12,10,3); ctx.fill(); }
  ctx.restore();
  // 5) 스코프 받침
  ctx.fillStyle='#93a3b8'; roundRect(-40,60,18,40,4); ctx.fill(); roundRect(22,60,18,40,4); ctx.fill();
  // 6) 리시버 뒷면 + 회복약 유리관 끝 (소용돌이가 돎)
  ctx.fillStyle=wg(96,210); roundRect(-64,96,128,112,12); ctx.fill();
  ctx.fillStyle=BL; roundRect(-64,192,128,16,6); ctx.fill();
  ctx.strokeStyle=GOLD; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,146,30,0,7); ctx.stroke();
  const tg=ctx.createRadialGradient(0,146,2,0,146,28); tg.addColorStop(0,'rgba(220,255,255,0.98)'); tg.addColorStop(1,'rgba(30,140,200,0.95)');
  ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(0,146,27,0,7); ctx.fill();
  ctx.strokeStyle='rgba(230,255,255,0.8)'; ctx.lineWidth=2;
  for(let n=0;n<3;n++){ const a0=now*0.004+n*2.1; ctx.beginPath(); ctx.arc(0,146,16-n*4,a0,a0+2.2); ctx.stroke(); }
  // 7) 개머리판 + 하늘색 캡슐
  ctx.fillStyle=wg(200,900); ctx.beginPath(); ctx.moveTo(-50,206); ctx.lineTo(50,206); ctx.lineTo(150,900); ctx.lineTo(-120,900); ctx.closePath(); ctx.fill();
  ctx.fillStyle=BL; ctx.beginPath(); ctx.moveTo(-10,206); ctx.lineTo(10,206); ctx.lineTo(24,900); ctx.lineTo(-4,900); ctx.closePath(); ctx.fill();
  glowDot(6,320,10,CY,0.8);
  // 8) 노리쇠 손잡이 (쏜 뒤 앞으로 당겨지며 커짐) + 오른손
  const bx=84+back*24, by=128+back*44-lift*22, br=12*(1+back*0.35);
  ctx.strokeStyle='#cfd8e4'; ctx.lineWidth=9; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(56,128); ctx.lineTo(bx,by); ctx.stroke();
  ctx.fillStyle=GOLD; ctx.beginPath(); ctx.arc(bx,by,br,0,7); ctx.fill();
  ctx.fillStyle='#fff3c8'; ctx.beginPath(); ctx.arc(bx-3,by-3,br*0.35,0,7); ctx.fill();
  ctx.save(); ctx.translate(92,210); ctx.rotate(-0.25);
  ctx.fillStyle=wg(0,96); roundRect(-18,0,40,96,10); ctx.fill();
  ctx.restore();
  const RHX=_lerp(104,bx+6,hb), RHY=_lerp(268,by+6,hb);
  drawArm(470,760,RHX,RHY,68,'#d9e1ec',BL);
  drawHand(RHX,RHY,34,'#e9eef5','#c4cfdd',GOLD);
  // 9) 스코프 접안부 — 둥근 렌즈 안으로 바깥이 보이고, 가는 십자선과 조준점
  ctx.fillStyle=wg(-80,80);
  ctx.beginPath(); ctx.arc(0,0,78,0,Math.PI*2); ctx.arc(0,0,54,0,Math.PI*2,true); ctx.fill('evenodd');
  ctx.strokeStyle=BL; ctx.lineWidth=10; ctx.beginPath(); ctx.arc(0,0,66,0,7); ctx.stroke();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,72,0,7); ctx.stroke();
  const vg=ctx.createRadialGradient(0,0,36,0,0,54); vg.addColorStop(0,'rgba(0,30,50,0)'); vg.addColorStop(1,'rgba(0,30,50,0.55)');
  ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(0,0,54,0,7); ctx.fill();
  ctx.fillStyle='rgba(120,240,255,0.05)'; ctx.beginPath(); ctx.arc(0,0,54,0,7); ctx.fill();
  const rc=aimOnTarget?'#ff4a4a':CY;
  ctx.strokeStyle=rgba(rc,0.85); ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(-52,0); ctx.lineTo(-8,0); ctx.moveTo(8,0); ctx.lineTo(52,0); ctx.moveTo(0,-52); ctx.lineTo(0,-8); ctx.moveTo(0,8); ctx.lineTo(0,52); ctx.stroke();
  glowDot(0,0,2,rc,1);
  // 10) 회복 스킬 표시창
  ctx.save(); ctx.translate(86,-128+Math.sin(now*0.004+1)*3);
  ctx.fillStyle='rgba(80,230,255,0.14)'; roundRect(0,0,76,40,5); ctx.fill();
  ctx.strokeStyle='rgba(120,240,255,0.65)'; ctx.lineWidth=1.2; roundRect(0,0,76,40,5); ctx.stroke();
  ctx.fillStyle=(abilActive && Math.floor(now/150)%2)?'#e8fff0':'#7dff9a'; ctx.fillRect(10,17,16,6); ctx.fillRect(15,12,6,16);
  ctx.fillStyle='rgba(120,240,255,0.85)'; ctx.fillRect(34,24,34*abilCharge(now),5);
  ctx.strokeStyle='rgba(120,240,255,0.5)'; ctx.strokeRect(34,24,34,5);
  ctx.fillStyle='rgba(150,240,255,0.9)'; ctx.font='bold 7px Orbitron,monospace'; ctx.fillText(abilActive?'HEALING':'HEAL',36,17);
  ctx.restore();
  ctx.restore();
}

// ── 거합베기 스킬 ─────────────────────────────────────────
// 전방 돌진 → 광역 베기 → 원래 위치로 복귀 (진짜 거합 동작)
function iaiSlash(){
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  const ox=player.x, oy=player.y; // 출발 위치 저장

  // 전방 돌진 (출발점 기준 최대 2.0칸, 벽 충돌 고려)
  for(let s=0.15;s<=2.0;s+=0.15){
    const nx=ox+ca*s, ny=oy+sa*s;
    if(!isWall(nx,ny)){ player.x=nx; player.y=ny; } else break;
  }

  // 베기 피해: ① 돌진 경로 위에서 스쳐 지나간 적 + ② 돌진한 위치 앞쪽 부채꼴 안의 적
  const dashLen=Math.hypot(player.x-ox, player.y-oy);
  let hitAny=false;
  for(const e of [...enemies]){
    // ① 돌진 경로: 출발점에서 앞쪽으로 dashLen 안, 경로에서 옆으로 0.9칸 안
    const ex=e.x-ox, ey=e.y-oy;
    const along=ex*ca+ey*sa, side=Math.abs(ex*sa-ey*ca);
    const onPath = along>0 && along<=dashLen && side<0.9;
    // ② 부채꼴: 돌진한 위치에서 2.8칸 안, 정면 ±1.15 rad
    const dx=e.x-player.x, dy=e.y-player.y;
    let ang=Math.atan2(dy,dx)-player.ang;
    while(ang<-Math.PI)ang+=2*Math.PI; while(ang>Math.PI)ang-=2*Math.PI;
    const inArc = Math.hypot(dx,dy)<=2.8 && Math.abs(ang)<=1.15;
    if(!onPath && !inArc) continue;
    if(blockedByWall(ox,oy,e.x,e.y) && blockedByWall(player.x,player.y,e.x,e.y)) continue; // 벽 너머 적은 베지 않음
    e.hp-=135; hitAny=true;
    if(e.hp<=0) killEnemy(e);
  }
  if(hitAny){ hitMarker(); shake=Math.max(shake,14); }
  else shake=Math.max(shake,6);

  // 원래 위치로 즉시 복귀 (거합의 핵심: 치고 제자리로)
  player.x=ox; player.y=oy;

  iaiFlash=performance.now();
  toast('거합!', hero.color);
}

// ── 일본도 RISING DRAGON (카게) ─────────────────────────────
// 중단 자세 대기, 袈裟斬り(케사기리) 사선 베기 모션
// 디자인: 은빛 날 + 하늘색 발광선, 금 테두리의 검은 쓰바(용 문양), 금색 마름모 자루 감기
function drawKatana(now){
  const KATANA_MS=500;
  const px=150, py=-120;          // 손 피벗 (화면 오른쪽 아래)
  const handleL=100, bladeL=430;  // 자루·날 길이
  const sc=weaponScale(); ctx.save(); ctx.scale(sc,sc);
  const CY='#3fe0ff', GOLD='#c9a24a';

  // a: 0=날 수직위, +오른쪽, -왼쪽
  // 대기(칼을 화면 가로로 겨눔) → 조단(오른쪽 위로 들기) → 케사기리(오른쪽 위→왼쪽 아래 사선 베기)
  let a=-1.45+Math.sin(now*0.0018)*0.03;
  let t=-1;
  if(swingT && now-swingT<KATANA_MS){
    t=(now-swingT)/KATANA_MS;
    if(t<0.20){      a=_lerp(-1.45, 0.50,_easeOut(t/0.20)); }          // 조단으로 들어올리기
    else if(t<0.52){ a=_lerp( 0.50,-2.30,_easeIn((t-0.20)/0.32)); }    // 오른쪽 위→왼쪽 아래 사선 강타
    else {           a=_lerp(-2.30,-1.45,_easeOut((t-0.52)/0.48)); }   // 겨눔 자세로 복원
  }

  const dx=Math.sin(a), dy=-Math.cos(a);
  const pommX=px-dx*handleL, pommY=py-dy*handleL;  // 자루 끝(봉미)
  const tsubX=px+dx*8,       tsubY=py+dy*8;         // 쓰바(가드)
  const tipX =px+dx*bladeL,  tipY =py+dy*bladeL;    // 칼끝(키사키)
  const perpX=dy, perpY=-dx;                         // 날에 수직 방향
  const rhx=px+dx*(-8), rhy=py+dy*(-8);              // 오른손 (가드 근처)
  const lhx=px-dx*60,   lhy=py-dy*60;                // 왼손 (봉미 근처)

  // 팔 (양손 잡기 — 사무라이 특유 두 손 자세)
  // 오른팔: 파란 장갑 + 금색 손목 링 / 왼팔: 검은 소매
  const LAX=40, LAY=320, RAX=360, RAY=280;           // 팔이 시작되는 화면 아래 지점
  ctx.lineCap='round';
  ctx.strokeStyle='#15171c'; ctx.lineWidth=44;
  ctx.beginPath(); ctx.moveTo(LAX,LAY); ctx.lineTo(lhx,lhy); ctx.stroke();
  ctx.strokeStyle='#262a33'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.moveTo(LAX,LAY); ctx.lineTo(_lerp(LAX,lhx,0.7),_lerp(LAY,lhy,0.7)); ctx.stroke();
  ctx.strokeStyle='#1d3c6e'; ctx.lineWidth=50;
  ctx.beginPath(); ctx.moveTo(RAX,RAY); ctx.lineTo(rhx,rhy); ctx.stroke();
  ctx.strokeStyle='#2f63b0'; ctx.lineWidth=14;
  ctx.beginPath(); ctx.moveTo(RAX,RAY); ctx.lineTo(_lerp(RAX,rhx,0.7),_lerp(RAY,rhy,0.7)); ctx.stroke();
  ctx.strokeStyle=GOLD; ctx.lineWidth=52; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(_lerp(RAX,rhx,0.80),_lerp(RAY,rhy,0.80)); ctx.lineTo(_lerp(RAX,rhx,0.85),_lerp(RAY,rhy,0.85)); ctx.stroke();

  // 쓰카(자루) 본체 — 검은 감기
  ctx.strokeStyle='#0b0c0f'; ctx.lineWidth=29; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(pommX,pommY); ctx.lineTo(tsubX,tsubY); ctx.stroke();
  ctx.strokeStyle='#2e323d'; ctx.lineWidth=23;
  ctx.beginPath(); ctx.moveTo(pommX,pommY); ctx.lineTo(tsubX,tsubY); ctx.stroke();
  // 쓰카이토(자루 감기 — 금색 마름모 패턴)
  ctx.strokeStyle='rgba(214,176,86,0.95)'; ctx.lineWidth=2.6; ctx.lineCap='butt';
  for(let i=0;i<6;i++){
    const t0=(i+0.15)/6, t1=(i+0.85)/6;
    const x0=pommX+(tsubX-pommX)*t0, y0=pommY+(tsubY-pommY)*t0;
    const x1=pommX+(tsubX-pommX)*t1, y1=pommY+(tsubY-pommY)*t1;
    ctx.beginPath();
    ctx.moveTo(x0-perpX*11,y0-perpY*11); ctx.lineTo(x1+perpX*11,y1+perpY*11);
    ctx.moveTo(x0+perpX*11,y0+perpY*11); ctx.lineTo(x1-perpX*11,y1-perpY*11);
    ctx.stroke();
  }
  // 메누키(자루 장식)
  ctx.fillStyle=GOLD; ctx.beginPath();
  ctx.ellipse((pommX+tsubX)/2,(pommY+tsubY)/2,5,10,a,0,Math.PI*2); ctx.fill();
  // 봉미(柄頭/폼멜) — 검정 + 금 링
  ctx.fillStyle='#0d0e12'; ctx.beginPath(); ctx.arc(pommX,pommY,14,0,7); ctx.fill();
  ctx.strokeStyle=GOLD; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(pommX,pommY,10,0,7); ctx.stroke();

  // 쓰바(鍔/가드) — 검은 판 + 금 테두리 + 용 문양
  ctx.save(); ctx.translate(tsubX,tsubY); ctx.rotate(a);
  ctx.fillStyle='#0e0f13'; ctx.beginPath(); ctx.ellipse(0,0,31,14,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=GOLD; ctx.lineWidth=3.2;
  ctx.beginPath(); ctx.ellipse(0,0,31,14,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(201,162,74,0.85)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.ellipse(-15,0,8,5,0,0.3,Math.PI*1.7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(15,0,8,5,0,Math.PI*1.3,Math.PI*2.7); ctx.stroke();
  ctx.fillStyle='#050507'; ctx.beginPath(); ctx.ellipse(0,0,8,4.5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // 칼날(刀身) — 약간 곡선인 일본도 날, 쓰바 바로 위에서 시작
  const B0=16, steps=22;
  const P=(tb,off)=>{ const L=B0+tb*(bladeL-B0), c=Math.sin(tb*Math.PI)*9+off;
    return [px+dx*L+dy*c, py+dy*L-dx*c]; };
  const bg=ctx.createLinearGradient(px+dx*B0,py+dy*B0,tipX,tipY);
  bg.addColorStop(0,'#8ea8c0'); bg.addColorStop(0.4,'#c8dae8'); bg.addColorStop(1,'#f0f6fc');
  ctx.fillStyle=bg; ctx.beginPath();
  for(let i=0;i<=steps;i++){ const tb=i/steps, [x,y]=P(tb,-(8.6-2.6*tb)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  for(let i=steps;i>=0;i--){ const tb=i/steps, [x,y]=P(tb, 8.6-2.6*tb); ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fill();
  // 날 엣지 하이라이트 (날카로운 빛)
  ctx.strokeStyle='rgba(240,248,255,0.9)'; ctx.lineWidth=2.2; ctx.lineCap='butt';
  ctx.beginPath();
  for(let i=0;i<=steps;i++){ const [x,y]=P(i/steps,7.0-2.2*i/steps); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke();
  // 하몬(刃文) — 날 특유의 물결 템퍼 라인
  ctx.strokeStyle='rgba(190,220,255,0.48)'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<=steps*2;i++){
    const tb=i/(steps*2), hamon=Math.sin(tb*Math.PI*9)*1.8;
    const [x,y]=P(tb,hamon+3.0); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  // 칼등(spine) — 어두운 선
  ctx.strokeStyle='rgba(55,75,100,0.72)'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){ const [x,y]=P(i/steps,-7.6+2.2*i/steps); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke();
  // 하늘색 발광선 (홈을 따라 흐르는 빛)
  glowPath(CY,2.2,()=>{
    for(let i=1;i<=steps-1;i++){ const [x,y]=P(i/steps,-3.2); if(i===1) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  });
  // 날 각인 "RISING DRAGON"
  ctx.save(); const [ix,iy]=P(0.08,0.6); ctx.translate(ix,iy);
  let ta=a-Math.PI/2; const flip=Math.cos(ta)<0; if(flip) ta+=Math.PI;
  ctx.rotate(ta); ctx.textAlign=flip?'right':'left';
  ctx.fillStyle='rgba(30,50,70,0.75)'; ctx.font='bold 9px Orbitron,monospace';
  ctx.fillText('RISING DRAGON',0,3.5); ctx.textAlign='left'; ctx.restore();
  // 하바키(날 밑 금장)
  ctx.save(); ctx.translate(px+dx*B0,py+dy*B0); ctx.rotate(a);
  ctx.fillStyle=GOLD; roundRect(-8,-14,16,16,2); ctx.fill(); ctx.restore();
  // 키사키(切先/칼끝) 삼각형
  ctx.save(); ctx.translate(tipX,tipY); ctx.rotate(a);
  ctx.fillStyle='#e8f2f8';
  ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(0,-30); ctx.lineTo(6,0); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 두 손 — 오른손 파란 장갑(금 테두리), 왼손 검은 반장갑(손가락 끝이 보임)
  drawHand(rhx,rhy,26,'#1d3c6e','#2f63b0',GOLD);
  drawHand(lhx,lhy,24,'#0f1013','#23262d');
  ctx.fillStyle='#c99a7a';
  for(let j=-1;j<=1;j++){ ctx.beginPath(); ctx.arc(lhx+perpX*j*8+dx*10,lhy+perpY*j*8+dy*10,3.8,0,7); ctx.fill(); }

  // ── 베기 이펙트: 하늘색 초승달 궤적 ──
  if(t>=0){
    if(t>0.20 && t<0.64){
      const f=Math.min(1,(t-0.20)/0.44), fade=1-f;
      const aNow=Math.max(-2.30,Math.min(0.50, t<0.52?a:-2.30));
      const th0=0.50-Math.PI/2, th1=aNow-Math.PI/2;
      if(th0-th1>0.01){
        ctx.save(); ctx.lineCap='round';
        ctx.globalAlpha=0.22*fade; ctx.strokeStyle=CY; ctx.lineWidth=70;
        ctx.beginPath(); ctx.arc(px,py,bladeL*0.78,th0,th1,true); ctx.stroke();
        ctx.globalAlpha=0.55*fade; ctx.lineWidth=14;
        ctx.beginPath(); ctx.arc(px,py,bladeL*0.95,th0,th1,true); ctx.stroke();
        ctx.globalAlpha=0.9*fade; ctx.strokeStyle='#eaffff'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(px,py,bladeL,th0,th1,true); ctx.stroke();
        ctx.restore();
        for(let i=0;i<5;i++){ // 불꽃 조각
          const th=th1+(th0-th1)*Math.random(), rr=bladeL*(0.8+Math.random()*0.25);
          glowDot(px+Math.cos(th)*rr,py+Math.sin(th)*rr,1.4,CY,fade);
        }
      }
    }
    if(t>0.38 && t<0.60){
      // 임팩트 빛 (칼끝)
      const f=(t-0.38)/0.22;
      ctx.save();
      ctx.globalAlpha=(1-f)*0.82;
      const ig=ctx.createRadialGradient(tipX,tipY,0,tipX,tipY,52*(1-f)+6);
      ig.addColorStop(0,'rgba(230,255,255,0.95)'); ig.addColorStop(1,'rgba(63,224,255,0)');
      ctx.fillStyle=ig; ctx.beginPath(); ctx.arc(tipX,tipY,52*(1-f)+6,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ── 저격 스코프 오버레이 (우클릭 ADS) ─────────────────────
function drawScopeOverlay(){
  const cx=W/2, cy=H/2, r=Math.min(W,H)*0.40;
  ctx.save();
  // 원형 스코프 외부를 어둡게 (evenodd)
  ctx.beginPath();
  ctx.rect(0,0,W,H);
  ctx.arc(cx,cy,r,0,Math.PI*2,true);
  ctx.fillStyle='rgba(0,0,0,0.97)';
  ctx.fill('evenodd');
  // 스코프 내부 비네팅
  const vig=ctx.createRadialGradient(cx,cy,r*0.80,cx,cy,r);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.65)');
  ctx.fillStyle=vig; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // 스코프 테두리
  ctx.strokeStyle='#080e1a'; ctx.lineWidth=22;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='#182840'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  // 조준선 (크로스헤어)
  const gap=r*0.18;
  ctx.strokeStyle='rgba(0,0,0,0.90)'; ctx.lineWidth=1.5; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(cx-r*0.96,cy); ctx.lineTo(cx-gap,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+gap,cy);    ctx.lineTo(cx+r*0.96,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-r*0.96); ctx.lineTo(cx,cy-gap); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy+gap);    ctx.lineTo(cx,cy+r*0.96); ctx.stroke();
  // 밀 도트 (거리 눈금)
  const mil=r*0.12;
  ctx.fillStyle='rgba(0,0,0,0.88)';
  for(let i=1;i<=4;i++){
    const sz=i===2?3.5:2.2;
    [[cx+i*mil,cy],[cx-i*mil,cy],[cx,cy+i*mil],[cx,cy-i*mil]].forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x,y,sz,0,7); ctx.fill();
    });
  }
  // 중앙 조준점 (영웅 컬러)
  ctx.fillStyle=hero.color; ctx.globalAlpha=0.95;
  ctx.beginPath(); ctx.arc(cx,cy,2.8,0,7); ctx.fill();
  ctx.globalAlpha=1;
  // 배율 표시
  ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.font='bold 12px Orbitron,monospace';
  ctx.textAlign='right';
  ctx.fillText('4×', cx+r*0.90, cy+r*0.84);
  ctx.textAlign='left';
  ctx.restore();
}

// ── 거합베기 화면 이펙트 ──────────────────────────────────
function drawIaiEffect(now){
  const t=now-iaiFlash;
  if(t>420) return;
  const f=1-t/420;
  ctx.save();
  // 대각선 베기 잔광
  ctx.globalAlpha=f*0.72;
  const g=ctx.createLinearGradient(0,H*0.40,W,H*0.62);
  g.addColorStop(0,'rgba(63,224,255,0)');
  g.addColorStop(0.40,'rgba(170,245,255,0.92)');
  g.addColorStop(0.60,'rgba(170,245,255,0.92)');
  g.addColorStop(1,'rgba(63,224,255,0)');
  ctx.fillStyle=g; ctx.fillRect(0,H*0.32,W,H*0.34);
  // 슬래시 라인
  ctx.globalAlpha=f*0.95;
  ctx.strokeStyle='rgba(235,255,255,0.95)';
  ctx.lineWidth=2.5*f+0.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-20,H*0.40); ctx.lineTo(W+20,H*0.60); ctx.stroke();
  ctx.lineWidth=1.2*f;
  ctx.beginPath(); ctx.moveTo(-20,H*0.43); ctx.lineTo(W+20,H*0.63); ctx.stroke();
  ctx.restore();
}

// 망치 SENTINEL MAUL (탱커) — 위에서 아래로 크게 내려치는 오버헤드 슬램
// 디자인: 모서리 깎인 짙은 강철 머리 + 윗면 가시, 파랗게 빛나는 에너지 셀 4개, 파랑·주황 장갑
function drawHammer(now){
  const px=20, py=-75;           // 피벗 = 손 위치 (화면 하단 중앙)
  const L=255;                   // 자루 길이
  const BL='#4aa8ff', OR='#ff8a2a';
  const sc=weaponScale(); ctx.save(); ctx.scale(sc,sc);
  // a=0: 머리 수직 위, a>0: 시계방향, a≈π: 머리 수직 아래
  // 대기: 오른쪽-아래(0.7) → 들어올림: 위-왼쪽(-1.3) → 내려침: 앞-아래(2.6)
  let a = 0.68 + Math.sin(now*0.002)*0.05;
  if(swingT && now-swingT<SWING_MS){
    const t=(now-swingT)/SWING_MS;
    if(t<0.24){ a=_lerp(0.68, -1.3, _easeOut(t/0.24)); }             // 위로 들어올림(뒤로 젖힘)
    else if(t<0.52){ a=_lerp(-1.3, 2.62, _easeIn((t-0.24)/0.28)); }  // 오버헤드로 수직 강타
    else { a=_lerp(2.62, 0.68, _easeOut((t-0.52)/0.48)); }           // 복원
  }
  const dx=Math.sin(a), dy=-Math.cos(a);
  const hx=px+dx*L, hy=py+dy*L;
  const qx=-dy, qy=dx;            // 자루에 수직 방향

  // 팔뚝 (파란 장갑 + 주황 줄무늬)
  ctx.lineCap='round';
  ctx.strokeStyle='#1c355f'; ctx.lineWidth=46;
  ctx.beginPath(); ctx.moveTo(260,220); ctx.lineTo(px+dx*78,py+dy*78); ctx.stroke();
  ctx.strokeStyle='#18304f'; ctx.lineWidth=40;
  ctx.beginPath(); ctx.moveTo(-220,210); ctx.lineTo(px+dx*38,py+dy*38); ctx.stroke();
  ctx.strokeStyle=OR; ctx.lineWidth=7;
  ctx.beginPath(); ctx.moveTo(_lerp(260,px+dx*78,0.45),_lerp(220,py+dy*78,0.45)); ctx.lineTo(_lerp(260,px+dx*78,0.7),_lerp(220,py+dy*78,0.7)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(_lerp(-220,px+dx*38,0.45),_lerp(210,py+dy*38,0.45)); ctx.lineTo(_lerp(-220,px+dx*38,0.7),_lerp(210,py+dy*38,0.7)); ctx.stroke();
  // 손목밴드
  ctx.strokeStyle='#2b5592'; ctx.lineWidth=12;
  ctx.beginPath(); ctx.moveTo(px+dx*18,py+dy*18); ctx.lineTo(px+dx*52,py+dy*52); ctx.stroke();

  // 자루 (어두운 금속)
  ctx.strokeStyle='#202328'; ctx.lineWidth=26;
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+dx*(L-40),py+dy*(L-40)); ctx.stroke();
  ctx.strokeStyle='#3c4048'; ctx.lineWidth=7;
  ctx.beginPath(); ctx.moveTo(px+dx*30,py+dy*30); ctx.lineTo(px+dx*(L-46),py+dy*(L-46)); ctx.stroke();
  // 그립 감기 (손 잡는 부분)
  ctx.strokeStyle='#111216'; ctx.lineWidth=4; ctx.lineCap='butt';
  for(let s=24;s<=100;s+=9){
    const cx=px+dx*s, cy=py+dy*s;
    ctx.beginPath(); ctx.moveTo(cx-qx*13,cy-qy*13); ctx.lineTo(cx+qx*13,cy+qy*13); ctx.stroke();
  }
  // 파란 발광 링 (머리 아래)
  const rcx=px+dx*(L-96), rcy=py+dy*(L-96);
  glowPath(BL,3,()=>{ ctx.moveTo(rcx-qx*14,rcy-qy*14); ctx.lineTo(rcx+qx*14,rcy+qy*14); });
  // 자루 끝 캡
  ctx.fillStyle='#2a2d33'; ctx.beginPath(); ctx.arc(px,py,15,0,7); ctx.fill();
  glowDot(px,py,1.8,OR,0.9);

  // 망치 머리
  ctx.save(); ctx.translate(hx,hy); ctx.rotate(a); ctx.scale(1.3,1.3);
  // 윗면 가시
  for(const sx of [-42,-14,14,42]){
    ctx.fillStyle='#6b727e';
    ctx.beginPath(); ctx.moveTo(sx-9,-54); ctx.lineTo(sx,-80); ctx.lineTo(sx+9,-54); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.moveTo(sx-6,-55); ctx.lineTo(sx,-76); ctx.lineTo(sx,-55); ctx.closePath(); ctx.fill();
  }
  // 머리 본체 (모서리 깎인 강철 덩어리)
  const hg=ctx.createLinearGradient(0,-56,0,56);
  hg.addColorStop(0,'#5a616c'); hg.addColorStop(0.45,'#3b4048'); hg.addColorStop(1,'#24272d');
  ctx.fillStyle=hg; ctx.beginPath();
  ctx.moveTo(-60,-56); ctx.lineTo(60,-56); ctx.lineTo(70,-44); ctx.lineTo(70,44);
  ctx.lineTo(60,56); ctx.lineTo(-60,56); ctx.lineTo(-70,44); ctx.lineTo(-70,-44); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#15171b'; ctx.lineWidth=2.5; ctx.stroke();
  // 타격면 (양 끝)
  ctx.fillStyle='#6a717c'; roundRect(64,-48,14,96,4); ctx.fill(); roundRect(-78,-48,14,96,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(66,-46,3,92); ctx.fillRect(-76,-46,3,92);
  // 각인 판
  ctx.fillStyle='#4c525c'; roundRect(-58,-40,58,44,5); ctx.fill();
  ctx.strokeStyle='#1d2025'; ctx.lineWidth=1.5; roundRect(-58,-40,58,44,5); ctx.stroke();
  ctx.fillStyle='rgba(20,22,26,0.85)'; ctx.font='bold 8px Orbitron,monospace';
  ctx.fillText('SENTINEL',-54,-24); ctx.fillText('MAUL',-54,-12);
  ctx.fillStyle='#8a919c';
  for(const [rx,ry] of [[-52,-34],[-6,-34],[-52,-2],[-6,-2]]){ ctx.beginPath(); ctx.arc(rx,ry,2,0,7); ctx.fill(); }
  // 에너지 셀 4개 (파란 발광, 천천히 숨쉬듯 밝기 변화)
  const pulse=0.75+0.25*Math.sin(now*0.006);
  for(let i=0;i<4;i++){
    const cy=-40+i*21;
    ctx.fillStyle='#14161a'; roundRect(8,cy,50,16,7); ctx.fill();
    const cg=ctx.createLinearGradient(0,cy+3,0,cy+13);
    cg.addColorStop(0,rgba(BL,0.55*pulse)); cg.addColorStop(0.5,`rgba(205,235,255,${pulse})`); cg.addColorStop(1,rgba(BL,0.55*pulse));
    ctx.fillStyle=cg; roundRect(12,cy+3,42,10,5); ctx.fill();
  }
  // 파란 강조선
  glowPath(BL,1.4,()=>{ ctx.moveTo(-62,26); ctx.lineTo(-6,26); ctx.lineTo(2,44); });
  glowPath(BL,1.2,()=>{ ctx.moveTo(-58,-50); ctx.lineTo(58,-50); });
  // 자루 소켓
  ctx.fillStyle='#202328'; roundRect(-14,50,28,16,4); ctx.fill();
  ctx.restore();

  // 두 손 (파란 장갑 + 주황 테두리)
  drawHand(px+dx*40,py+dy*40,23,'#1c355f','#2b5592',OR);
  drawHand(px+dx*80,py+dy*80,21,'#1c355f','#2b5592',OR);

  // 오버헤드 궤적 + 임팩트 링 (파란 에너지)
  if(swingT){
    const t=(now-swingT)/SWING_MS;
    if(t>0.25 && t<0.54){            // 위→아래 수직 궤적(모션 블러)
      ctx.save(); ctx.globalAlpha=0.18; ctx.strokeStyle=BL; ctx.lineWidth=74; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(px,py,L, -Math.PI*0.78, Math.PI*0.55); ctx.stroke(); ctx.restore();
    }
    if(t>0.50 && t<0.72){            // 임팩트 링
      const f=(t-0.50)/0.22;
      ctx.save(); ctx.globalAlpha=(1-f)*0.9; ctx.strokeStyle=BL; ctx.lineWidth=9;
      ctx.beginPath(); ctx.arc(hx,hy,30+f*145,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
}

// =========================================================
//  HUD / 이펙트
// =========================================================
function hitFlash(){ const f=el('hitflash'); f.style.opacity=.9; setTimeout(()=>f.style.opacity=0,120); }
function hitMarker(){ const m=el('hitmark'); m.style.transition='none'; m.style.opacity=1;
  m.style.transform='translate(-50%,-50%) scale(1)';
  requestAnimationFrame(()=>{ m.style.transition='.25s'; m.style.opacity=0;
    m.style.transform='translate(-50%,-50%) scale(.5)'; }); }
let toastT;
function toast(txt,color){ const t=el('toast'); t.textContent=txt; t.style.color=color||'#fff';
  t.style.transition='none'; t.style.opacity=1; t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastT);
  requestAnimationFrame(()=>{ t.style.transition='.6s';
    t.style.opacity=0; t.style.transform='translateX(-50%) translateY(-16px)'; }); }

function updateHUD(now){
  el('hpVal').textContent=Math.round(player.hp);
  el('hpVal').style.color = player.hp<player.maxhp*0.3 ? '#ff3030' : '#ff5a5a';
  el('timeVal').textContent=(gameTime/1000).toFixed(1);
  // 조준 표시 (사격 영웅): 크로스헤어가 적을 겨누면 빨갛게
  const cross = document.querySelector('.cross');
  aimOnTarget = hero.fireMode!=='melee' && !paused && !!rayHitEnemy(player.x,player.y,player.ang);
  const sightUp = (hero.weapon==='rifle' || hero.weapon==='sniper') && aimBlend>0.7;   // 조준경으로 겨누는 중
  if((adsActive && hero && hero.weapon==='sniper') || sightUp){
    cross.classList.add('hide');  // 스코프 사용 중엔 CSS 크로스헤어 숨김
  } else {
    cross.classList.remove('hide');
    cross.style.transform=`translate(-50%,-50%) scale(${(1+recoilAmt*0.35).toFixed(3)})`;
    if(hero.fireMode!=='melee'){
      cross.classList.toggle('on', aimOnTarget);
    } else {
      cross.classList.remove('on');
    }
  }
}

// =========================================================
//  루프
// =========================================================
let lastT=0;
function loop(t){
  if(!running) return;
  const dt=Math.min(40, t-lastT||16); lastT=t;
  if(!paused){
    gameTime += dt;
    if(firing && hero.fireMode!=='semi') attack(); // 꾹 누르면 자동 연사/연속 타격
    // 근접 임팩트 순간에 타격 적용 (무기에 따라 타이밍 다름)
    const _impactMs = hero.weapon==='katana' ? 200 : SWING_IMPACT;
    if(!swingHitDone && t-swingT>=_impactMs){ applyMelee(); swingHitDone=true; }
    updatePlayer(dt);
    updateEnemies(dt,t);
    updateMissiles(dt);
    updateAbility(t, dt);
    updateFx(dt);
    // 총 자세 전환: 쏘는 중·방금 쏜 뒤엔 견착(빠르게 올림), 아니면 로우 레디(천천히 내림)
    if(hero.fireMode!=='melee'){
      const nowP=performance.now(), hold=hero.weapon==='sniper'?1200:650;
      let target=(firing || adsActive || nowP-muzzle<hold || nowP-missileFireT<700) ? 1 : 0;
      if(reloading) target=Math.min(target,0.35);
      aimBlend += (target-aimBlend)*Math.min(1, target>aimBlend ? dt/70 : dt/170);
    }
  }
  // 반동·흔들림 감쇠 (시간 기반) — 반동은 클수록 빨리 돌아옴
  recoilAmt = Math.max(0, recoilAmt - dt*(0.0035 + recoilAmt*0.006));
  shake = Math.max(0, shake - dt/26);
  render();
  updateHUD(t);
  if(paused) drawPauseOverlay();
  requestAnimationFrame(loop);
}

function drawPauseOverlay(){
  ctx.save();
  ctx.fillStyle='rgba(8,12,20,.55)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.font='900 46px Orbitron, sans-serif';
  ctx.fillText('일시정지', W/2, H/2-10);
  ctx.font='400 18px "Noto Sans KR", sans-serif';
  ctx.fillStyle='#9af3fb';
  ctx.fillText('화면을 클릭하면 계속됩니다', W/2, H/2+30);
  ctx.font='400 15px "Noto Sans KR", sans-serif';
  ctx.fillStyle='#8893a8';
  ctx.fillText('Q · 우측 상단 버튼 → 메뉴로 나가기', W/2, H/2+58);
  ctx.restore();
}

function endGame(){
  running=false; firing=false;
  el('quitBtn').classList.add('hide');
  if(document.pointerLockElement===cv) document.exitPointerLock();
  const secs = gameTime/1000;
  el('overTitle').textContent = '전투 종료';
  el('ovKill').textContent = kills;
  el('ovTime').textContent = secs.toFixed(1)+'s';
  // 기록 갱신
  const recs = getRecords();
  const cur = recs[hero.id] || {kills:0, time:0};
  const newRecord = (kills>cur.kills) || (secs>cur.time);
  recs[hero.id] = { kills:Math.max(kills,cur.kills), time:Math.max(secs,cur.time) };
  saveRecords(recs);
  const best = recs[hero.id];
  el('ovBest').textContent = `${hero.name} 최고 기록 · 처치 ${best.kills} · 생존 ${best.time.toFixed(1)}s`;
  el('ovNew').classList.toggle('hide', !newRecord);
  show('over');
}

// 초기 포커스
el('idInput').focus();
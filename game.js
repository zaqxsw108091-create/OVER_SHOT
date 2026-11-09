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
});
document.addEventListener('keyup',e=>{ keys[e.code]=false; });

// 포인터 락 (마우스 시점)
cv.addEventListener('click',()=>{ if(running && document.pointerLockElement!==cv) cv.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{
  const locked = document.pointerLockElement===cv;
  paused = !locked;
  if(!locked){ firing=false; adsActive=false; }
  el('lockmsg').classList.toggle('hide', locked);
  el('quitBtn').classList.toggle('hide', locked || !running);
});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===cv) player.ang += e.movementX*0.0024;
});
document.addEventListener('mousedown',e=>{
  if(document.pointerLockElement!==cv) return;
  if(e.button===0){ firing=true; attack(); }
  if(e.button===2 && hero && hero.weapon==='sniper') adsActive=true;
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

// ---------- 사격 ----------
function attack(){
  const now=performance.now();
  if(reloading || now-lastShot < currentFireRate()) return;
  if(hero.fireMode==='melee'){ startSwing(now); return; }
  if(ammo<=0){ reload(); return; }
  lastShot=now; ammo--; el('ammoVal').textContent=ammo; muzzle=now;
  recoilAmt=1; shake=Math.max(shake, hero.weapon==='sniper'?7:4);
  let hitAny=false;
  for(let p=0;p<hero.pellets;p++){
    const spread = (Math.random()-0.5)*hero.spread;
    const a = player.ang + spread;
    const hit = rayHitEnemy(player.x,player.y,a);
    if(hit){ hitAny=true;
      hit.e.hp -= hero.dmg;
      if(hit.e.hp<=0){ killEnemy(hit.e); }
    }
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
  kills++; el('killVal').textContent=kills;
  toast('처치!', hero.color);
  if(enemies.length<=2) spawnWave(3+Math.floor(kills/6)); // 계속 보충
}

function reload(){
  if(reloading||ammo===maxammo) return;
  reloading=true; el('ammoVal').textContent='...';
  setTimeout(()=>{ ammo=maxammo; reloading=false; el('ammoVal').textContent=ammo; }, 900);
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
  recoilAmt=1; shake=Math.max(shake,6);
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
  ctx.save();
  ctx.translate(sx, sy);

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
  things.sort((a,b)=>b.d-a.d);
  for(const it of things){
    if(it.t==='e') drawEnemy(it.o,it.d,numRays,colW);
    else if(it.t==='m') drawSprite(it.o,it.d,'missile');
    else drawSprite(it.o,it.d,'blast');
  }

  // 방벽 (탱커 스킬) — 반투명이라 너머의 적도 보임
  if(abilActive && hero.id==='titan') drawBarrier();

  ctx.restore(); // 흔들림 레이어 끝

  // 무기 (화면 하단) — ADS 중이면 숨김
  if(!(adsActive && hero && hero.weapon==='sniper')) drawWeapon();

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
  const cx=W/2, cy=H/2, bw=Math.min(W*0.62,720), bh=H*0.62;
  ctx.save();
  // 반투명 보호막 면
  const g=ctx.createLinearGradient(0,cy-bh/2,0,cy+bh/2);
  g.addColorStop(0,'rgba(57,211,224,0.10)');
  g.addColorStop(0.5,'rgba(57,211,224,0.20)');
  g.addColorStop(1,'rgba(57,211,224,0.10)');
  ctx.fillStyle=g;
  roundRect(cx-bw/2, cy-bh/2, bw, bh, 26); ctx.fill();
  // 테두리
  ctx.strokeStyle='rgba(120,240,255,0.55)'; ctx.lineWidth=3;
  roundRect(cx-bw/2, cy-bh/2, bw, bh, 26); ctx.stroke();
  // 육각 패턴
  ctx.strokeStyle='rgba(150,243,251,0.14)'; ctx.lineWidth=1;
  const step=46;
  for(let y=cy-bh/2; y<cy+bh/2; y+=step){
    ctx.beginPath(); ctx.moveTo(cx-bw/2,y); ctx.lineTo(cx+bw/2,y); ctx.stroke();
  }
  for(let x=cx-bw/2; x<cx+bw/2; x+=step){
    ctx.beginPath(); ctx.moveTo(x,cy-bh/2); ctx.lineTo(x,cy+bh/2); ctx.stroke();
  }
  // 은은한 깜빡임
  ctx.fillStyle=`rgba(57,211,224,${0.05+0.04*Math.sin(performance.now()*0.008)})`;
  roundRect(cx-bw/2, cy-bh/2, bw, bh, 26); ctx.fill();
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
  ctx.save();
  ctx.translate(screenX, top);
  // 몸통
  ctx.fillStyle=`rgba(${Math.round(200*shade)},${Math.round(60*shade)},${Math.round(40*shade)},1)`;
  roundRect(-size*0.18,size*0.18,size*0.36,size*0.5,size*0.06); ctx.fill();
  // 머리
  ctx.beginPath(); ctx.arc(0,size*0.1,size*0.16,0,7); ctx.fill();
  // 눈 (빨강)
  ctx.fillStyle=`rgba(255,${abilReady?60:90},60,${shade})`;
  ctx.beginPath(); ctx.arc(-size*0.06,size*0.08,size*0.028,0,7);
  ctx.arc(size*0.06,size*0.08,size*0.028,0,7); ctx.fill();
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

// 팔(소매)+손(장갑) 그리기 헬퍼
function drawArm(ax,ay, hx,hy, w){
  ctx.strokeStyle='#2a3142'; ctx.lineWidth=w; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(hx,hy); ctx.stroke();
  // 손목 밴드(영웅 컬러)
  ctx.strokeStyle=hero.color; ctx.lineWidth=w*0.4;
  const mx=ax+(hx-ax)*0.62, my=ay+(hy-ay)*0.62;
  ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+(hx-mx)*0.4,my+(hy-my)*0.4); ctx.stroke();
}
function drawHand(hx,hy,r){
  ctx.fillStyle='#11151f'; ctx.beginPath(); ctx.arc(hx,hy,r,0,7); ctx.fill();
  ctx.fillStyle='#1c2333'; ctx.beginPath(); ctx.arc(hx-r*0.2,hy-r*0.2,r*0.6,0,7); ctx.fill();
}

function drawWeapon(){
  const now=performance.now();
  const moving = keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
  const amp = moving?1:0.4;
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

// 자동소총 (딜러) — 견착 1인칭: 총구가 크로스헤어(중앙)로, 개머리판은 어깨로
function drawRifle(now){
  const k=recoilAmt;
  const tilt=-0.10, muzY=-H*0.45;
  ctx.save();
  ctx.translate(8, k*42);            // 발사 시 어깨로 후퇴(아래로)
  ctx.rotate(tilt - k*0.13);         // 총구 들림
  // 양팔(화면 아래 모서리에서 손으로) — 뒤에 먼저
  drawArm(-150,160, 18,muzY*0.6, 40);   // 받침 왼팔 → 핸드가드
  drawArm(190,160, 54,-52, 46);         // 견착 오른팔 → 그립
  // 개머리판(어깨쪽, 화면 아래로 빠짐)
  ctx.fillStyle='#1d2436'; roundRect(14,-46,46,128,8); ctx.fill();
  // 리시버(몸통)
  ctx.fillStyle='#2c374f'; roundRect(8,-152,52,110,8); ctx.fill();
  ctx.fillStyle='#222a3e'; roundRect(12,-152,44,42,6); ctx.fill();
  // 핸드가드
  ctx.fillStyle='#1f273a'; roundRect(15,-240,38,92,7); ctx.fill();
  // 총열(중앙으로 길게)
  ctx.fillStyle='#161c2a'; roundRect(25,muzY,18,(-240)-muzY,5); ctx.fill();
  ctx.fillStyle='#3a455f'; roundRect(28,muzY,5,(-240)-muzY,3); ctx.fill();
  ctx.fillStyle='#11161f'; roundRect(21,muzY-6,26,16,5); ctx.fill(); // 총구
  // 상단 가늠자(센터라인)
  ctx.fillStyle='#11161f'; roundRect(28,-158,12,12,2); ctx.fill();
  ctx.fillStyle=hero.color; roundRect(30,-160,7,5,2); ctx.fill();
  // 탄창
  ctx.save(); ctx.translate(16,-98); ctx.rotate(0.2);
  ctx.fillStyle='#1a2236'; roundRect(-12,0,28,64,6); ctx.fill();
  ctx.fillStyle='#0f1521'; roundRect(-12,54,28,12,4); ctx.fill(); ctx.restore();
  // 권총 손잡이
  ctx.save(); ctx.translate(48,-58); ctx.rotate(0.42);
  ctx.fillStyle='#141b2b'; roundRect(-12,0,26,54,7); ctx.fill(); ctx.restore();
  // 손(그립 위에 얹힘)
  drawHand(18,muzY*0.6,19);          // 받침 손
  drawHand(54,-50,21);               // 방아쇠 손
  // 머즐 플래시 — 총구(=화면 중앙) 부근
  const mt=now-muzzle;
  if(mt<90){
    const f=1-mt/90, r=18+Math.random()*12;
    ctx.save(); ctx.translate(34,muzY); ctx.rotate(Math.random()*0.7-0.35);
    ctx.fillStyle=`rgba(255,215,110,${0.95*f})`;
    ctx.beginPath();
    for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, rr=(i%2?r:r*2.4);
      ctx[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(255,255,230,${f})`; ctx.beginPath(); ctx.arc(0,0,r*0.85,0,7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// 저격소총 (힐러) — 볼트액션, 스코프가 총열 방향(세로)으로 올바르게 장착
// 우클릭으로 ADS(스코프 조준) 활성화
function drawSniper(now){
  const k=recoilAmt;
  const boltPhase=k>0.45?(1-k)/0.55:1.0;
  const muzY=-H*0.50;
  ctx.save();
  ctx.translate(-30, k*72);
  ctx.rotate(-0.05+k*0.20);

  drawArm(-160,170,12,muzY*0.55,38);
  drawArm(200,170,60,-48,44);

  // 개머리판
  ctx.fillStyle='#19202f'; roundRect(18,-52,50,138,9); ctx.fill();
  ctx.fillStyle='#232c40'; roundRect(18,-52,50,34,9); ctx.fill();
  ctx.fillStyle='#0e131e'; roundRect(60,-48,14,120,6); ctx.fill();
  // 리시버
  ctx.fillStyle='#1e2a40'; roundRect(6,-170,58,122,8); ctx.fill();
  ctx.fillStyle='#16202f'; roundRect(10,-170,30,40,6); ctx.fill();

  // ── 스코프: 총열 방향(세로)으로 총열 좌측에 장착 ──
  // 스코프 레일
  ctx.fillStyle='#131c2e'; roundRect(6,-168,14,106,3); ctx.fill();
  // 마운트 클램프 (위/아래)
  ctx.fillStyle='#0f1826'; roundRect(2,-262,20,14,4); ctx.fill();
  ctx.fillStyle='#0f1826'; roundRect(2,-194,20,14,4); ctx.fill();
  // 스코프 튜브 본체 (세로로 총열과 나란히)
  ctx.fillStyle='#060810'; roundRect(4,-276,18,116,9); ctx.fill();
  ctx.fillStyle='#0a0d18'; roundRect(6,-272,14,108,7); ctx.fill();
  // 줌 링 (중간 돌기)
  ctx.fillStyle='#101828'; roundRect(3,-232,20,22,5); ctx.fill();
  ctx.fillStyle='#18243c'; roundRect(5,-229,16,16,4); ctx.fill();
  // 조정 노브 좌(elevation) / 우(windage)
  ctx.fillStyle='#111927'; roundRect(-7,-224,11,16,4); ctx.fill();
  ctx.fillStyle='#1a2636'; roundRect(-5,-222,7,12,3); ctx.fill();
  ctx.fillStyle='#111927'; roundRect(22,-224,11,16,4); ctx.fill();
  ctx.fillStyle='#1a2636'; roundRect(24,-222,7,12,3); ctx.fill();
  // 앞 렌즈 (대물경, 스코프 상단)
  const fLens=ctx.createRadialGradient(13,-270,1,13,-270,11);
  fLens.addColorStop(0,'rgba(140,210,255,0.75)');
  fLens.addColorStop(0.5,'rgba(40,120,200,0.45)');
  fLens.addColorStop(1,'rgba(6,16,44,0.92)');
  ctx.fillStyle=fLens; ctx.beginPath(); ctx.arc(13,-270,11,0,7); ctx.fill();
  ctx.strokeStyle='#1c2d46'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(13,-270,11,0,7); ctx.stroke();
  ctx.fillStyle='rgba(220,240,255,0.28)';
  ctx.beginPath(); ctx.ellipse(9,-275,5,3,0.5,0,Math.PI*2); ctx.fill();
  // 뒤 렌즈 (접안경, 스코프 하단)
  const rLens=ctx.createRadialGradient(13,-166,0,13,-166,8);
  rLens.addColorStop(0,'rgba(10,18,40,0.97)'); rLens.addColorStop(1,'rgba(18,32,56,0.80)');
  ctx.fillStyle=rLens; ctx.beginPath(); ctx.arc(13,-166,8,0,7); ctx.fill();
  ctx.strokeStyle='#1c2d46'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(13,-166,8,0,7); ctx.stroke();
  ctx.fillStyle=hero.color; ctx.globalAlpha=0.88;
  ctx.beginPath(); ctx.arc(13,-167,2.5,0,7); ctx.fill();
  ctx.globalAlpha=1;

  // 핸드가드
  ctx.fillStyle='#182030'; roundRect(14,-270,34,104,7); ctx.fill();
  ctx.fillStyle='#0f1622'; roundRect(18,-270,12,104,5); ctx.fill();
  // 총열
  ctx.fillStyle='#0d1018'; roundRect(22,muzY,16,(-270)-muzY,4); ctx.fill();
  ctx.fillStyle='#2e3a52'; roundRect(25,muzY,5,(-270)-muzY,2); ctx.fill();
  ctx.fillStyle='#0b0e16'; roundRect(18,muzY-14,24,22,6); ctx.fill();
  ctx.fillStyle='#141b2c'; roundRect(20,muzY-10,20,6,3); ctx.fill();
  // 볼트 핸들
  const boltX=64+(1-boltPhase)*22, boltY=-122;
  ctx.fillStyle='#1a2336';
  ctx.beginPath(); ctx.arc(boltX,boltY,10,0,7); ctx.fill();
  ctx.strokeStyle='#263046'; ctx.lineWidth=8; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(64,boltY); ctx.lineTo(boltX+6,boltY); ctx.stroke();
  if(boltPhase<0.4){
    const ef=1-boltPhase/0.4;
    ctx.fillStyle=`rgba(210,180,80,${ef*0.9})`;
    ctx.beginPath(); ctx.ellipse(boltX+14,boltY-4,5*ef,2*ef,-0.4,0,Math.PI*2); ctx.fill();
  }
  // 탄창
  ctx.save(); ctx.translate(20,-112); ctx.rotate(0.10);
  ctx.fillStyle='#121929'; roundRect(-9,0,22,40,5); ctx.fill();
  ctx.fillStyle='#0d1320'; roundRect(-9,34,22,8,4); ctx.fill(); ctx.restore();
  // 손잡이
  ctx.save(); ctx.translate(52,-58); ctx.rotate(0.38);
  ctx.fillStyle='#101622'; roundRect(-12,0,26,54,7); ctx.fill(); ctx.restore();
  drawHand(12,muzY*0.55,18);
  drawHand(60,-46,21);
  // 머즐 플래시
  const mt=now-muzzle;
  if(mt<160){
    const f=1-mt/160,r=18+Math.random()*10;
    ctx.save(); ctx.translate(30,muzY);
    ctx.fillStyle=`rgba(200,255,215,${0.88*f})`;
    ctx.beginPath(); ctx.ellipse(0,-r*2.2,r*0.35,r*2.4,0,0,Math.PI*2); ctx.fill();
    ctx.rotate(Math.random()*0.4-0.2);
    ctx.fillStyle=`rgba(160,240,180,${0.7*f})`;
    ctx.beginPath();
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,rr=(i%2?r*0.6:r*1.8);
      ctx[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr);}
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(240,255,245,${f})`; ctx.beginPath(); ctx.arc(0,0,r*0.55,0,7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ── 거합베기 스킬 ─────────────────────────────────────────
// 전방 돌진 → 광역 베기 → 원래 위치로 복귀 (진짜 거합 동작)
function iaiSlash(){
  const ca=Math.cos(player.ang), sa=Math.sin(player.ang);
  const ox=player.x, oy=player.y; // 출발 위치 저장

  // 전방 돌진 (최대 2.0칸, 벽 충돌 고려)
  for(let s=0.15;s<=2.0;s+=0.15){
    const nx=player.x+ca*s, ny=player.y+sa*s;
    if(!isWall(nx,ny)){ player.x=nx; player.y=ny; } else break;
  }

  // 전방 광역 베기 피해 (돌진한 위치 기준)
  let hitAny=false;
  for(const e of [...enemies]){
    const dx=e.x-player.x, dy=e.y-player.y;
    const dist=Math.hypot(dx,dy);
    if(dist>2.8) continue;
    let ang=Math.atan2(dy,dx)-player.ang;
    while(ang<-Math.PI)ang+=2*Math.PI; while(ang>Math.PI)ang-=2*Math.PI;
    if(Math.abs(ang)>1.15) continue;
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

// ── 일본도 (사무라이 카게) ─────────────────────────────────
// 중단 자세 대기, 袈裟斬り(케사기리) 사선 베기 모션
function drawKatana(now){
  const KATANA_MS=500;
  const px=30, py=-70;            // 손 피벗
  const handleL=62, bladeL=268;   // 자루·날 길이

  // a: 0=날 수직위, +오른쪽, -왼쪽
  // 대기(중단) → 조단(상단 들기) → 케사기리(오른→왼 사선 베기)
  let a=0.28+Math.sin(now*0.0018)*0.03;
  if(swingT && now-swingT<KATANA_MS){
    const t=(now-swingT)/KATANA_MS;
    if(t<0.20){      a=_lerp(0.28, 0.82,_easeOut(t/0.20)); }           // 조단으로 들어올리기
    else if(t<0.52){ a=_lerp(0.82,-2.00,_easeIn((t-0.20)/0.32)); }    // 오른→왼 사선 강타
    else {           a=_lerp(-2.00,0.28,_easeOut((t-0.52)/0.48)); }   // 복원
  }

  const dx=Math.sin(a), dy=-Math.cos(a);
  const pommX=px-dx*handleL, pommY=py-dy*handleL;  // 자루 끝(봉미)
  const tsubX=px+dx*8,       tsubY=py+dy*8;         // 쓰바(가드)
  const tipX =px+dx*bladeL,  tipY =py+dy*bladeL;    // 칼끝(키사키)
  const perpX=dy, perpY=-dx;                         // 날에 수직 방향

  // 팔 (양손 잡기 — 사무라이 특유 두 손 자세)
  ctx.lineCap='round';
  ctx.strokeStyle='#262d3d'; ctx.lineWidth=44;
  ctx.beginPath(); ctx.moveTo(245,215); ctx.lineTo(px+dx*(-8),py+dy*(-8)); ctx.stroke();
  ctx.strokeStyle='#1f2636'; ctx.lineWidth=38;
  ctx.beginPath(); ctx.moveTo(-215,215); ctx.lineTo(px-dx*32,py-dy*32); ctx.stroke();
  ctx.strokeStyle=hero.color; ctx.lineWidth=10;
  ctx.beginPath(); ctx.moveTo(px-dx*22,py-dy*22); ctx.lineTo(px-dx*6,py-dy*6); ctx.stroke();

  // 쓰카(자루) 본체
  ctx.strokeStyle='#2e1e10'; ctx.lineWidth=22; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(pommX,pommY); ctx.lineTo(tsubX,tsubY); ctx.stroke();
  // 쓰카이토(자루 감기 — 마름모 패턴)
  for(let i=0;i<5;i++){
    const tb=(i+0.5)/5;
    const bx=pommX+(tsubX-pommX)*tb, by=pommY+(tsubY-pommY)*tb;
    ctx.strokeStyle=`rgba(${i%2?75:48},${i%2?50:36},${i%2?22:14},0.85)`;
    ctx.lineWidth=5; ctx.lineCap='butt';
    ctx.beginPath();
    ctx.moveTo(bx-perpX*14,by-perpY*14);
    ctx.lineTo(bx+perpX*14,by+perpY*14);
    ctx.stroke();
  }
  // 봉미(柄頭/폼멜)
  ctx.fillStyle='#5a4022'; ctx.beginPath(); ctx.arc(pommX,pommY,10,0,7); ctx.fill();
  ctx.fillStyle='#7a5530'; ctx.beginPath(); ctx.arc(pommX,pommY,6,0,7); ctx.fill();

  // 쓰바(鍔/가드) — 타원형 철제 가드
  ctx.save(); ctx.translate(tsubX,tsubY); ctx.rotate(a);
  const tg=ctx.createLinearGradient(-22,-6,22,6);
  tg.addColorStop(0,'#3a2a14'); tg.addColorStop(0.5,'#7c5c2e'); tg.addColorStop(1,'#3a2a14');
  ctx.fillStyle=tg; ctx.beginPath(); ctx.ellipse(0,0,22,10,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#201408'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,0,22,10,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#100a04'; ctx.beginPath(); ctx.ellipse(0,0,7,4,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // 칼날(刀身) — 약간 곡선인 일본도 날
  const steps=22;
  // 날 본체 (은빛 그라디언트)
  const bg=ctx.createLinearGradient(px+dx*handleL,py+dy*handleL,tipX,tipY);
  bg.addColorStop(0,'#8ea8c0'); bg.addColorStop(0.4,'#c8dae8'); bg.addColorStop(1,'#f0f6fc');
  ctx.strokeStyle=bg; ctx.lineWidth=7; ctx.lineCap='butt';
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const tb=i/steps, curve=Math.sin(tb*Math.PI)*6;
    const bx=px+dx*(handleL+tb*(bladeL-handleL))+dy*curve;
    const by=py+dy*(handleL+tb*(bladeL-handleL))-dx*curve;
    if(i===0) ctx.moveTo(bx,by); else ctx.lineTo(bx,by);
  }
  ctx.stroke();
  // 날 엣지 하이라이트 (날카로운 빛)
  ctx.strokeStyle='rgba(240,248,255,0.88)'; ctx.lineWidth=1.8;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const tb=i/steps, curve=Math.sin(tb*Math.PI)*6;
    const bx=px+dx*(handleL+tb*(bladeL-handleL))+dy*(curve+4);
    const by=py+dy*(handleL+tb*(bladeL-handleL))-dx*(curve+4);
    if(i===0) ctx.moveTo(bx,by); else ctx.lineTo(bx,by);
  }
  ctx.stroke();
  // 하몬(刃文) — 날 특유의 물결 템퍼 라인
  ctx.strokeStyle='rgba(190,220,255,0.48)'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<=steps*2;i++){
    const tb=i/(steps*2), curve=Math.sin(tb*Math.PI)*6;
    const hamon=Math.sin(tb*Math.PI*9)*1.8;
    const bx=px+dx*(handleL+tb*(bladeL-handleL))+dy*(curve+hamon+2);
    const by=py+dy*(handleL+tb*(bladeL-handleL))-dx*(curve+hamon+2);
    if(i===0) ctx.moveTo(bx,by); else ctx.lineTo(bx,by);
  }
  ctx.stroke();
  // 칼등(spine) — 어두운 선
  ctx.strokeStyle='rgba(55,75,100,0.72)'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const tb=i/steps, curve=Math.sin(tb*Math.PI)*6;
    const bx=px+dx*(handleL+tb*(bladeL-handleL))+dy*(curve-4);
    const by=py+dy*(handleL+tb*(bladeL-handleL))-dx*(curve-4);
    if(i===0) ctx.moveTo(bx,by); else ctx.lineTo(bx,by);
  }
  ctx.stroke();
  // 키사키(切先/칼끝) 삼각형
  ctx.save(); ctx.translate(tipX,tipY); ctx.rotate(a);
  ctx.fillStyle='#e8f2f8';
  ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(0,-22); ctx.lineTo(5,0); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 두 손
  drawHand(px+dx*(-8),py+dy*(-8),22);   // 오른손 (가드 근처)
  drawHand(px-dx*32,py-dy*32,20);        // 왼손 (봉미 근처)

  // ── 베기 이펙트 ──
  if(swingT){
    const t=(now-swingT)/KATANA_MS;
    if(t>0.20 && t<0.56){
      // 잔상 궤적 (조단 위치에서 칼끝까지 호)
      const f=(t-0.20)/0.36;
      ctx.save();
      ctx.globalAlpha=(1-f)*0.30;
      ctx.strokeStyle='rgba(220,240,255,0.9)';
      ctx.lineWidth=28*(1-f)+4; ctx.lineCap='round';
      ctx.beginPath();
      const sx=px+Math.sin(0.82)*bladeL, sy=py-Math.cos(0.82)*bladeL;
      ctx.moveTo(sx,sy); ctx.lineTo(tipX,tipY); ctx.stroke();
      ctx.restore();
    }
    if(t>0.38 && t<0.60){
      // 임팩트 빛 (칼끝)
      const f=(t-0.38)/0.22;
      ctx.save();
      ctx.globalAlpha=(1-f)*0.82;
      const ig=ctx.createRadialGradient(tipX,tipY,0,tipX,tipY,52*(1-f)+6);
      ig.addColorStop(0,'rgba(255,255,220,0.95)'); ig.addColorStop(1,'rgba(180,220,255,0)');
      ctx.fillStyle=ig; ctx.beginPath(); ctx.arc(tipX,tipY,52*(1-f)+6,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
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
  g.addColorStop(0,'rgba(232,197,110,0)');
  g.addColorStop(0.40,'rgba(255,240,180,0.92)');
  g.addColorStop(0.60,'rgba(255,240,180,0.92)');
  g.addColorStop(1,'rgba(232,197,110,0)');
  ctx.fillStyle=g; ctx.fillRect(0,H*0.32,W,H*0.34);
  // 슬래시 라인
  ctx.globalAlpha=f*0.95;
  ctx.strokeStyle='rgba(255,255,220,0.92)';
  ctx.lineWidth=2.5*f+0.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-20,H*0.40); ctx.lineTo(W+20,H*0.60); ctx.stroke();
  ctx.lineWidth=1.2*f;
  ctx.beginPath(); ctx.moveTo(-20,H*0.43); ctx.lineTo(W+20,H*0.63); ctx.stroke();
  ctx.restore();
}

// 망치 (탱커) — 위에서 아래로 크게 내려치는 오버헤드 슬램
function drawHammer(now){
  const px=20, py=-75;           // 피벗 = 손 위치 (화면 하단 중앙)
  const L=255;                   // 자루 길이
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

  // 팔뚝 (양쪽 어깨에서 손으로)
  ctx.lineCap='round';
  ctx.strokeStyle='#262d3d'; ctx.lineWidth=46;
  ctx.beginPath(); ctx.moveTo(260,220); ctx.lineTo(px+dx*78,py+dy*78); ctx.stroke();
  ctx.strokeStyle='#1f2636'; ctx.lineWidth=40;
  ctx.beginPath(); ctx.moveTo(-220,210); ctx.lineTo(px+dx*38,py+dy*38); ctx.stroke();
  // 손목밴드
  ctx.strokeStyle=hero.color; ctx.lineWidth=12;
  ctx.beginPath(); ctx.moveTo(px+dx*18,py+dy*18); ctx.lineTo(px+dx*52,py+dy*52); ctx.stroke();

  // 자루
  ctx.strokeStyle='#3a2a1c'; ctx.lineWidth=28;
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+dx*(L-34),py+dy*(L-34)); ctx.stroke();
  ctx.strokeStyle='#52402c'; ctx.lineWidth=11;
  ctx.beginPath(); ctx.moveTo(px+dx*30,py+dy*30); ctx.lineTo(px+dx*(L-40),py+dy*(L-40)); ctx.stroke();

  // 망치 머리
  ctx.save(); ctx.translate(hx,hy); ctx.rotate(a);
  ctx.fillStyle='#2b3550';
  ctx.beginPath(); ctx.moveTo(-58,-10); ctx.lineTo(-92,0); ctx.lineTo(-58,12); ctx.closePath(); ctx.fill();
  const hg=ctx.createLinearGradient(0,-46,0,46);
  hg.addColorStop(0,'#6c7c9e'); hg.addColorStop(0.5,'#4a566f'); hg.addColorStop(1,'#333d56');
  ctx.fillStyle=hg; roundRect(-58,-46,116,92,14); ctx.fill();
  ctx.fillStyle=hero.color; roundRect(40,-46,18,92,8); ctx.fill();
  ctx.fillStyle='#2b3550'; roundRect(-58,-46,14,92,8); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.16)'; roundRect(-30,-40,18,80,6); ctx.fill();
  ctx.fillStyle='#222a3a'; roundRect(-12,-50,24,100,6); ctx.fill();
  ctx.restore();

  // 두 손
  drawHand(px+dx*40,py+dy*40,23);
  drawHand(px+dx*80,py+dy*80,21);

  // 오버헤드 궤적 + 임팩트 링
  if(swingT){
    const t=(now-swingT)/SWING_MS;
    if(t>0.25 && t<0.54){            // 위→아래 수직 궤적(모션 블러)
      ctx.save(); ctx.globalAlpha=0.16; ctx.strokeStyle=hero.color; ctx.lineWidth=74; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(px,py,L, -Math.PI*0.78, Math.PI*0.55); ctx.stroke(); ctx.restore();
    }
    if(t>0.50 && t<0.72){            // 임팩트 링
      const f=(t-0.50)/0.22;
      ctx.save(); ctx.globalAlpha=(1-f)*0.9; ctx.strokeStyle=hero.color; ctx.lineWidth=9;
      ctx.beginPath(); ctx.arc(hx,hy,30+f*145,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
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
  if(adsActive && hero && hero.weapon==='sniper'){
    cross.classList.add('hide');  // 스코프 사용 중엔 CSS 크로스헤어 숨김
  } else {
    cross.classList.remove('hide');
    if(hero.fireMode!=='melee'){
      const on = !paused && !!rayHitEnemy(player.x,player.y,player.ang);
      cross.classList.toggle('on', on);
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
  }
  // 반동·흔들림 감쇠 (시간 기반)
  recoilAmt = Math.max(0, recoilAmt - dt/200);
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
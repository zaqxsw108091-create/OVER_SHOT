// ═══════════════════════════════════════════════════════════════
//  modes.js — 게임 모드와 전투 AI
//  · 웨이브 디펜스: 8웨이브(마지막은 보스), 웨이브 사이에 강화 3개 중 1개 선택
//  · 거점 점령 4:4: 플레이어 + AI 아군 3명(고르지 않은 세 영웅) vs 적 4명. 거점 A→B→C를 제한 시간 안에 차례로 점령
//  · 자유 생존: 예전 방식 (끝없이 보충되는 적)
//  · 적 종류 4가지(보병·돌격병·중장병·보스), 격자 길 찾기(거리 지도), 아군·적 공용 전투 AI
//  game.js의 상태(player, enemies, hero …)와 그리기 도우미를 같이 쓴다. 이 파일은 game.js보다 먼저 읽히고, 함수는 게임이 시작된 뒤에만 불린다
// ═══════════════════════════════════════════════════════════════
const MODES = [
  { id:'wave',     name:'웨이브 디펜스', tag:'8 WAVES + BOSS', desc:'몰려오는 적을 8웨이브 동안 막아 낸다. 웨이브마다 강화를 하나 고르고, 마지막엔 보스.' },
  { id:'capture',  name:'거점 점령 4:4', tag:'4 vs 4',        desc:'AI 아군 3명과 함께 거점 A→B→C를 제한 시간 안에 차례로 점령한다. 쓰러져도 다시 살아난다.' },
  { id:'survival', name:'자유 생존',     tag:'ENDLESS',       desc:'끝없이 보충되는 적을 상대로 최대한 오래 버틴다.' },
];
let curMode = 'wave';
try { const m = localStorage.getItem('overshot_mode_v1'); if (MODES.some(x => x.id === m)) curMode = m; } catch(e){}

// ── 적 종류 ──────────────────────────────────────────────────
//  speed: 한 프레임(60Hz 기준) 이동량, range: 공격 거리, rate: 공격 간격(ms), acc: 명중률, dmg: [최소, 최대]
//  keep: 이 거리까지 다가옴, scale: 크기, tint: 3D 로봇 색조, col: 2D 그림 색
const ENEMY_TYPES = {
  grunt:  { name:'보병',   hp:60,   speed:0.026, range:8,   rate:1100, acc:0.48, dmg:[8,13],  keep:3.6, scale:1.0,  tint:[1,1,1],          col:[200,60,40] },
  runner: { name:'돌격병', hp:40,   speed:0.050, range:1.0, rate:800,  acc:1,    dmg:[5,8],   keep:0.8, scale:0.78, tint:[1.9,1.25,0.35],  col:[235,150,40], melee:true },
  heavy:  { name:'중장병', hp:190,  speed:0.016, range:9,   rate:1500, acc:0.55, dmg:[12,17], keep:5.0, scale:1.32, tint:[0.60,0.45,1.5],  col:[125,75,195] },
  boss:   { name:'워로드', hp:1500, speed:0.020, range:12,  rate:520,  acc:0.45, dmg:[8,12],  keep:4.5, scale:2.2,  tint:[0.42,0.40,0.46], col:[95,25,25], boss:true },
};
function mkEnemy(type, x, y, hpMul = 1){
  const T = ENEMY_TYPES[type], hp = Math.round(T.hp*hpMul);
  return { x, y, hp, maxhp:hp, lastShot:performance.now()+400+Math.random()*600, type, T, scale:T.scale, tint:T.tint, col:T.col, hue:Math.random()*30 };
}

// ── 강화 (웨이브 사이에 3개 중 1개) ──────────────────────────
const mods = { dmg:1, rate:1, speed:1, cd:1, taken:1, steal:0 };
const UPGRADES = [
  { id:'dmg',   icon:'⚔️', name:'화력 증폭',   desc:'공격 피해 +22%',                 apply(){ mods.dmg *= 1.22; } },
  { id:'rate',  icon:'⚡', name:'신속 사격',   desc:'공격 속도 +18%',                 apply(){ mods.rate *= 1.18; } },
  { id:'hp',    icon:'❤️', name:'강화 장갑',   desc:'최대 체력 +25%, 체력 모두 회복', apply(){ player.maxhp = Math.round(player.maxhp*1.25); player.hp = player.maxhp; } },
  { id:'speed', icon:'👟', name:'기동 장치',   desc:'이동 속도 +12%',                 apply(){ mods.speed *= 1.12; } },
  { id:'cd',    icon:'🔁', name:'과충전 회로', desc:'스킬 재사용 시간 -22%',          apply(){ mods.cd *= 0.78; } },
  { id:'armor', icon:'🛡️', name:'반응 장갑',   desc:'받는 피해 -15%',                 apply(){ mods.taken *= 0.85; } },
  { id:'steal', icon:'🩸', name:'전투 자극제', desc:'적을 처치할 때마다 체력 +10',    apply(){ mods.steal += 10; } },
];
const abilCdMs = () => hero.abilCd*mods.cd;

// ── 상태 ─────────────────────────────────────────────────────
const WAVES = [
  { grunt:5 }, { grunt:4, runner:3 }, { grunt:5, runner:2, heavy:1 }, { grunt:3, runner:4, heavy:2 },
  { grunt:6, heavy:3 }, { grunt:3, runner:6, heavy:3 }, { grunt:5, runner:4, heavy:4 }, { boss:1, grunt:4 },
];
const CAP = { R:1.5, TIME:240000, BONUS:50000, RESPAWN:5000, ALLY_RESPAWN:7000, RED_RESPAWN:4000,
              RATE:2.6, RATE_EXTRA:0.9, DECAY:2.5,     // 점령 속도(%/초): 한 명 기준, 한 명 더 있을 때마다, 적만 있을 때 줄어드는 속도
              RED_HP:1.7, RED_HP_STEP:0.25, RED_VS_ALLY:1.6 };   // 적 체력 배율(거점마다 증가), 적이 AI 아군에게 주는 피해 배율
let wave = 0, waveQueue = [], waveNextSpawn = 0, waveBannerT = -1e9, waveClearT = 0, upgradeOpen = false, upgradeChoices = [];
let allies = [], hazards = [], modeShots = [], playerDead = false, respawnAt = 0, gameResult = '';
let capZone = 0, capProg = 0, capTimeLeft = 0, capState = '', redQueue = [], bossRef = null, bossPhase = 0, bossNextMortar = 0;
let fieldCache = new Map();

// ── 길 찾기: 목표 칸에서 퍼져 나가는 거리 지도 (맵은 변하지 않으므로 목표 칸마다 한 번만 계산) ──
function getField(tx, ty){
  const cx = Math.floor(tx), cy = Math.floor(ty), key = cy*MAP_W+cx;
  let f = fieldCache.get(key); if (f) return f;
  f = new Float32Array(MAP_W*MAP_H).fill(1e9);
  if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H){
    const q = [key]; f[key] = 0;
    for (let i=0;i<q.length;i++){
      const k = q[i], x = k%MAP_W, y = (k-x)/MAP_W, d = f[k]+1;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x+dx, ny = y+dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || MAP[ny][nx] !== 0) continue;
        const nk = ny*MAP_W+nx; if (f[nk] > d){ f[nk] = d; q.push(nk); }
      }
    }
  }
  fieldCache.set(key, f); return f;
}
const moveBlocked = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1-x0, y1-y0)*6);
  for (let i=1;i<n;i++){ const t = i/n; if (isWall(x0+(x1-x0)*t, y0+(y1-y0)*t)) return true; } return false; };
function stepTo(u, tx, ty, sp){
  const dx = tx-u.x, dy = ty-u.y, d = Math.hypot(dx, dy); if (d < 1e-4) return;
  const k = Math.min(1, sp/d), nx = u.x+dx*k, ny = u.y+dy*k;
  if (!isWall(nx, u.y)) u.x = nx; if (!isWall(u.x, ny)) u.y = ny;
  u.face = Math.atan2(dy, dx);
}
// 목표 지점으로 한 걸음: 곧게 갈 수 있으면 곧게, 막혀 있으면 거리 지도를 따라 다음 칸으로
function moveToward(u, tx, ty, sp){
  if (!moveBlocked(u.x, u.y, tx, ty)){ stepTo(u, tx, ty, sp); return; }
  const f = getField(tx, ty), cx = Math.floor(u.x), cy = Math.floor(u.y);
  let best = f[cy*MAP_W+cx] ?? 1e9, bx = cx, by = cy;
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const nx = cx+dx, ny = cy+dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
    if (dx && dy && (MAP[cy][nx] !== 0 || MAP[ny][cx] !== 0)) continue;       // 모서리를 가로질러 가지 않음
    const v = f[ny*MAP_W+nx]; if (v < best){ best = v; bx = nx; by = ny; }
  }
  if (best < 1e8) stepTo(u, bx+0.5, by+0.5, sp);
}

// ── 시작 ─────────────────────────────────────────────────────
function modeStart(){
  mods.dmg = mods.rate = mods.speed = mods.cd = mods.taken = 1; mods.steal = 0;
  wave = 0; waveQueue = []; waveBannerT = -1e9; waveClearT = 0; upgradeOpen = false; hideUpgrade();
  allies = []; hazards = []; modeShots = []; playerDead = false; gameResult = ''; bossRef = null; bossPhase = 0;
  fieldCache = new Map();
  if (curMode === 'wave'){ startWave(1); }
  else if (curMode === 'capture'){
    const b = curMap.blue;
    player.x = b[0]; player.y = b[1]; player.ang = Math.atan2(curMap.zones[0][1]-b[1], curMap.zones[0][0]-b[0]);
    capZone = 0; capProg = 0; capTimeLeft = CAP.TIME; capState = ''; redQueue = [];
    HEROES.filter(h => h.id !== hero.id).forEach((h, i) => {
      const a = { hero:h, name:h.name, x:b[0]+0.5*Math.cos(i*2.1), y:b[1]+0.5*Math.sin(i*2.1), hp:h.hp, maxhp:h.hp, lastShot:0, dead:false, respawnT:0, face:0, blue:true,
        melee: h.fireMode === 'melee', col:[60,130,235], scale: h.id === 'titan' ? 1.2 : 1 };
      if (isWall(a.x, a.y)){ a.x = b[0]; a.y = b[1]; }
      allies.push(a);
    });
    ['grunt','grunt','heavy','runner'].forEach((t, i) => spawnRed(t, i));
    toast('거점 A를 점령하라!', '#39d3e0');
  } else spawnWave(6);
}
function spawnWave(n){                    // 자유 생존: 처치 수가 늘수록 다른 종류가 섞임
  for (let i=0;i<n;i++){ const c = freeCell(), r = Math.random();
    const t = kills > 14 && r < 0.18 ? 'heavy' : kills > 6 && r < 0.42 ? 'runner' : 'grunt';
    enemies.push(mkEnemy(t, c.x, c.y)); }
}
function startWave(n){
  wave = n; waveQueue = [];
  const w = WAVES[n-1];
  for (const t in w) for (let i=0;i<w[t];i++) waveQueue.push(t);
  waveQueue.sort((a, b) => (a === 'boss' ? -1 : b === 'boss' ? 1 : Math.random()-0.5));
  waveNextSpawn = performance.now()+900; waveBannerT = performance.now(); waveClearT = 0;
}
function spawnRed(type, i = 0){
  const s = curMap.reds[Math.min(capZone, curMap.reds.length-1)], e = mkEnemy(type, s[0]+0.4*Math.cos(i*1.7), s[1]+0.4*Math.sin(i*1.7), CAP.RED_HP+capZone*CAP.RED_HP_STEP);
  if (isWall(e.x, e.y)){ e.x = s[0]; e.y = s[1]; }
  enemies.push(e);
}

// ── 피해·처치 ────────────────────────────────────────────────
function damagePlayer(dmg){
  if (playerDead || !running) return;
  if (abilActive && hero.id === 'titan') dmg *= 0.3;       // 방벽
  player.hp -= dmg*mods.taken; hitFlash();
  if (player.hp > 0) return;
  player.hp = 0;
  if (curMode === 'capture'){ playerDead = true; respawnAt = performance.now()+CAP.RESPAWN; firing = false; adsActive = false; toast('쓰러졌다! 곧 다시 투입된다', '#ff5a5a'); }
  else { gameResult = 'lose'; endGame(); }
}
function modeOnKill(e){
  if (mods.steal) player.hp = Math.min(player.maxhp, player.hp+mods.steal);
  if (e === bossRef) bossRef = null;
  if (curMode === 'survival'){ if (enemies.length <= 2) spawnWave(3+Math.floor(kills/6)); }
  else if (curMode === 'capture') redQueue.push({ type:e.type, t:performance.now()+CAP.RED_RESPAWN });
}

// ── 매 프레임: 모드 진행 ─────────────────────────────────────
function modeUpdate(dt, now){
  // 예고된 폭격 (보스)
  for (const h of hazards){
    if (h.done || now < h.t) continue;
    h.done = true; blasts.push({ x:h.x, y:h.y, life:420, max:420 }); shake = Math.max(shake, 9);
    if (Math.hypot(player.x-h.x, player.y-h.y) < h.r) damagePlayer(h.dmg);
  }
  hazards = hazards.filter(h => !h.done);
  modeShots = modeShots.filter(s => now-s.t < 90);
  if (curMode === 'wave'){
    if (waveQueue.length && now >= waveNextSpawn && enemies.length < 6){
      const t = waveQueue.shift(), c = freeCell(), e = mkEnemy(t, c.x, c.y, 1+(wave-1)*0.07);
      enemies.push(e); waveNextSpawn = now+700;
      if (t === 'boss'){ bossRef = e; bossPhase = 0; bossNextMortar = now+3500; toast('보스 등장 — 워로드', '#ff5a3c'); shake = Math.max(shake, 12); }
    }
    if (!waveQueue.length && !enemies.length && !waveClearT){
      waveClearT = now;
      if (wave >= WAVES.length){ gameResult = 'win'; setTimeout(() => { if (running) endGame(); }, 1400); toast('모든 웨이브 격파!', '#3cf06e'); }
      else { player.hp = Math.min(player.maxhp, player.hp+player.maxhp*0.25); setTimeout(() => { if (running && curMode === 'wave' && waveClearT) openUpgrade(); }, 900); toast(`WAVE ${wave} 격파`, '#3cf06e'); }
    }
    if (bossRef) updateBoss(bossRef, now);
  } else if (curMode === 'capture'){
    if (!gameResult) capTimeLeft -= dt;
    if (playerDead && now >= respawnAt){
      playerDead = false; player.hp = player.maxhp;
      const s = capZone > 0 ? curMap.zones[capZone-1] : curMap.blue; player.x = s[0]; player.y = s[1];
    }
    for (const a of allies) if (a.dead && now >= a.respawnT){ a.dead = false; a.hp = a.maxhp; const s = capZone > 0 ? curMap.zones[capZone-1] : curMap.blue; a.x = s[0]; a.y = s[1]; }
    for (const q of redQueue) if (now >= q.t && !q.done){ q.done = true; spawnRed(q.type, Math.floor(Math.random()*4)); }
    redQueue = redQueue.filter(q => !q.done);
    // 점령: 거점 안의 인원이 더 많은 쪽으로 진행
    const z = curMap.zones[capZone], inZ = u => Math.hypot(u.x-z[0], u.y-z[1]) < CAP.R;
    const blue = (!playerDead && inZ(player) ? 1 : 0) + allies.filter(a => !a.dead && inZ(a)).length, red = enemies.filter(inZ).length;
    capState = blue && red ? 'contest' : blue ? 'blue' : red ? 'red' : '';
    if (blue && !red) capProg += (CAP.RATE+CAP.RATE_EXTRA*(blue-1))*dt/1000;      // 적이 한 명이라도 안에 있으면 멈춤(격전)
    else if (red && !blue) capProg -= CAP.DECAY*dt/1000;
    capProg = Math.max(0, Math.min(100, capProg));
    if (capProg >= 100 && !gameResult){
      if (capZone >= curMap.zones.length-1){ gameResult = 'win'; toast('모든 거점 점령!', '#3cf06e'); setTimeout(() => { if (running) endGame(); }, 1200); }
      else { capZone++; capProg = 0; capTimeLeft += CAP.BONUS; toast(`거점 ${'ABC'[capZone-1]} 점령! 다음은 ${'ABC'[capZone]}`, '#39d3e0'); }
    }
    if (capTimeLeft <= 0 && !gameResult){ gameResult = 'lose'; endGame(); }
    updateAllies(dt, now);
  }
}
function updateBoss(b, now){
  const f = b.hp/b.maxhp;
  if ((bossPhase === 0 && f < 0.66) || (bossPhase === 1 && f < 0.33)){
    bossPhase++; toast('워로드가 증원을 부른다!', '#ff5a3c');
    for (let i=0;i<3;i++){ const a = i*2.1, x = b.x+Math.cos(a)*0.9, y = b.y+Math.sin(a)*0.9; enemies.push(mkEnemy('runner', isWall(x,y) ? b.x : x, isWall(x,y) ? b.y : y)); }
  }
  if (now >= bossNextMortar){                               // 폭격: 붉은 원이 먼저 보이고 1.3초 뒤 터짐
    bossNextMortar = now+(bossPhase >= 2 ? 3200 : 4600);
    for (let i=0;i<3+bossPhase;i++){
      const a = Math.random()*6.28, r = i ? 0.8+Math.random()*1.6 : 0, x = player.x+Math.cos(a)*r, y = player.y+Math.sin(a)*r;
      if (!isSightWall(x, y)) hazards.push({ x, y, t0:now, t:now+1300+i*140, r:1.35, dmg:30 });
    }
  }
}

// ── 전투 AI: 적 ──────────────────────────────────────────────
function shotLine(u, t, blue){ modeShots.push({ x0:u.x, y0:u.y, x1:t.x, y1:t.y, t:performance.now(), blue, toPlayer: t === player }); }
function nearestVisible(u, list, maxD){
  let best = null, bd = maxD;
  for (const t of list){ const d = Math.hypot(t.x-u.x, t.y-u.y); if (d < bd && !blockedByWall(u.x, u.y, t.x, t.y)){ best = t; bd = d; } }
  return best ? { t:best, d:bd } : null;
}
function separate(list){
  for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++){
    const a = list[i], b = list[j], dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx, dy), min = 0.42*((a.scale||1)+(b.scale||1))/2;
    if (d > 1e-4 && d < min){ const k = (min-d)/d*0.5, px = dx*k, py = dy*k;
      if (!isWall(a.x-px, a.y-py)){ a.x -= px; a.y -= py; } if (!isWall(b.x+px, b.y+py)){ b.x += px; b.y += py; } }
  }
}
function updateEnemies(dt, now){
  const blues = (playerDead ? [] : [player]).concat(allies.filter(a => !a.dead));
  for (const e of enemies){
    const T = e.T || ENEMY_TYPES.grunt, sp = T.speed*dt*0.06;
    const seen = nearestVisible(e, blues, 11), tgt = seen ? seen.t : null, dist = seen ? seen.d : 1e9;
    if (tgt){
      if (dist > T.keep) moveToward(e, tgt.x, tgt.y, sp);
      else e.face = Math.atan2(tgt.y-e.y, tgt.x-e.x);
    } else if (curMode === 'capture'){
      const z = curMap.zones[capZone]; if (Math.hypot(e.x-z[0], e.y-z[1]) > CAP.R*0.55) moveToward(e, z[0], z[1], sp);
    } else if (!playerDead) moveToward(e, player.x, player.y, sp);      // 안 보여도 길을 찾아 다가옴
    // 공격
    if (tgt && dist < T.range && now-e.lastShot > T.rate){
      e.lastShot = now;
      if (!T.melee) shotLine(e, tgt, false);
      if (tgt === player && abilActive && hero.id === 'titan'){          // 방어막에 총알이 부딪힌 자리에 물결
        const pp = projectPoint(e.x, e.y);
        if (Math.abs(pp.ang) < 0.75){
          barrierHits.push({ x:Math.max(-0.8,Math.min(0.8,pp.sx/W*2-1))+(Math.random()-0.5)*0.12, y:(Math.random()-0.5)*0.6, t:performance.now() });
          if (barrierHits.length > 4) barrierHits.shift();
        }
      }
      if (Math.random() < T.acc){
        const dmg = T.dmg[0]+Math.random()*(T.dmg[1]-T.dmg[0]);
        if (tgt === player) damagePlayer(dmg);
        else { tgt.hp -= dmg*CAP.RED_VS_ALLY; tgt.hitT = now; if (tgt.hp <= 0) killAlly(tgt); }
      }
    }
  }
  separate(enemies);
  el('enemyVal').textContent = curMode === 'wave' ? enemies.length+waveQueue.length : enemies.length;
}

// ── 전투 AI: 아군 (거점 점령) ────────────────────────────────
//  영웅마다 역할이 다름: 타이탄·카게는 붙어서 치고, 스파크는 연사, 메디카는 저격하며 가까운 아군을 치료
const ALLY_KIT = {
  titan:{ range:1.5, rate:760,  dmg:15, acc:1,    keep:1.1 }, kage:{ range:1.6, rate:600, dmg:16, acc:1, keep:1.1 },
  spark:{ range:7,   rate:260,  dmg:5,  acc:0.5,  keep:4.2 }, medi:{ range:9,   rate:1600, dmg:26, acc:0.65, keep:5.5, heal:4 },
};
function killAlly(a){
  a.dead = true; a.respawnT = performance.now()+CAP.ALLY_RESPAWN;
  fxDead.push({ x:a.x, y:a.y, t:performance.now(), dir:Math.random()<0.5?-1:1, blue:true, scale:a.scale, col:a.col });
  toast(`${a.name} 쓰러짐`, '#ff8a8a');
}
function updateAllies(dt, now){
  const z = curMap.zones[capZone], live = allies.filter(a => !a.dead);
  for (const a of live){
    const K = ALLY_KIT[a.hero.id], sp = a.hero.speed*0.62*dt*0.06;
    const seen = nearestVisible(a, enemies, 10), tgt = seen ? seen.t : null, dist = seen ? seen.d : 1e9;
    const dz = Math.hypot(a.x-z[0], a.y-z[1]);
    if (tgt && (a.melee ? dist < 6 : true)){
      if (dist > K.keep) moveToward(a, tgt.x, tgt.y, sp); else a.face = Math.atan2(tgt.y-a.y, tgt.x-a.x);
    } else if (dz > CAP.R*0.6) moveToward(a, z[0]+Math.cos(a.maxhp)*0.5, z[1]+Math.sin(a.maxhp)*0.5, sp);
    if (tgt && dist < K.range && now-a.lastShot > K.rate){
      a.lastShot = now; if (!a.melee) shotLine(a, tgt, true);
      if (Math.random() < K.acc){ tgt.hp -= K.dmg; tgt.hitT = now; if (tgt.hp <= 0) killEnemy(tgt, true); }
    }
    if (K.heal){                                              // 메디카: 4칸 안에서 가장 다친 아군(플레이어 포함)을 치료
      let low = null, lf = 0.95;
      for (const u of (playerDead ? live : live.concat([player]))){ const f = u.hp/u.maxhp; if (u !== a && f < lf && Math.hypot(u.x-a.x, u.y-a.y) < 4){ low = u; lf = f; } }
      if (low) low.hp = Math.min(low.maxhp, low.hp+K.heal*dt/1000);
    }
  }
  separate(live);
}

// ── 강화 선택 화면 ───────────────────────────────────────────
function openUpgrade(){
  upgradeOpen = true; firing = false; adsActive = false;
  upgradeChoices = UPGRADES.slice().sort(() => Math.random()-0.5).slice(0, 3);
  const box = el('upgrade'), list = el('upgradeList'); list.innerHTML = '';
  el('upgradeTitle').textContent = `WAVE ${wave} 격파 — 강화를 하나 고르세요`;
  upgradeChoices.forEach((u, i) => {
    const d = document.createElement('div'); d.className = 'upcard';
    d.innerHTML = `<div class="key">${i+1}</div><div class="ic">${u.icon}</div><h4>${u.name}</h4><p>${u.desc}</p>`;
    d.onclick = () => pickUpgrade(i); list.appendChild(d);
  });
  box.classList.remove('hide');
}
function hideUpgrade(){ const b = el('upgrade'); if (b) b.classList.add('hide'); }
function pickUpgrade(i){
  if (!upgradeOpen || !upgradeChoices[i]) return;
  upgradeChoices[i].apply(); toast(upgradeChoices[i].name+' 획득', '#ffb52e');
  upgradeOpen = false; hideUpgrade(); startWave(wave+1);
}
document.addEventListener('keydown', e => { if (upgradeOpen && /^(Digit|Numpad)[123]$/.test(e.code)) pickUpgrade(+e.code.slice(-1)-1); });

// ── 그리기 ───────────────────────────────────────────────────
// 세계의 점(맵 x, 맵 y, 높이) → 화면. 3D 맵은 원근 투영, 미로는 레이캐스팅과 같은 식
function projectGround(wx, wy, h){
  if (map3dOn()) return World3D.project(player, wx, wy, h);
  const dx = wx-player.x, dy = wy-player.y; let ang = Math.atan2(dy, dx)-player.ang;
  while (ang < -Math.PI) ang += 2*Math.PI; while (ang > Math.PI) ang -= 2*Math.PI;
  if (Math.abs(ang) > 1.25) return null;
  const corr = Math.hypot(dx, dy)*Math.cos(ang); if (corr < 0.12) return null;
  return { x:(0.5+ang/FOV)*W, y:H/2-(h-0.5)*(H/corr)*0.9, depth:corr };
}
function groundRing(x, y, r, stroke, fill, lw){
  const pts = []; for (let i=0;i<=36;i++){ const a = i/36*6.2832, q = projectGround(x+Math.cos(a)*r, y+Math.sin(a)*r, 0.01); if (q) pts.push(q); else if (pts.length) break; }
  if (pts.length < 3) return;
  ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y));
  if (pts.length > 36){ ctx.closePath(); if (fill){ ctx.fillStyle = fill; ctx.fill(); } }
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}
// 세계 위에 얹는 것: 거점 고리, 폭격 예고, 총알 줄기, 아군 이름표, 목표 표시
function modeDrawWorld(now){
  ctx.save(); ctx.lineJoin = 'round';
  for (const h of hazards){ const k = Math.min(1, (now-h.t0)/(h.t-h.t0));
    groundRing(h.x, h.y, h.r, `rgba(255,70,50,${0.5+0.5*k})`, `rgba(255,60,40,${0.10+0.22*k})`, 3);
    groundRing(h.x, h.y, h.r*k, 'rgba(255,190,120,0.9)', null, 2); }
  if (curMode === 'capture'){
    const z = curMap.zones[capZone], col = capState === 'contest' ? '255,190,60' : capState === 'red' ? '255,80,70' : '57,211,224';
    groundRing(z[0], z[1], CAP.R, `rgba(${col},0.95)`, `rgba(${col},${0.10+0.05*Math.sin(now*0.005)})`, 3.5);
    groundRing(z[0], z[1], CAP.R*capProg/100, `rgba(${col},0.7)`, null, 2);
  }
  ctx.lineCap = 'round';
  for (const s of modeShots){
    const a = projectGround(s.x0, s.y0, 0.36), b = s.toPlayer ? { x:W/2+(s.x0%1-0.5)*W*0.2, y:H*0.92 } : projectGround(s.x1, s.y1, 0.36);
    if (!a || !b) continue;
    ctx.globalAlpha = 1-(now-s.t)/90; ctx.strokeStyle = s.blue ? '#8fe0ff' : '#ffb070'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center';
  for (const a of allies){                                    // 아군 이름표 + 체력바 (벽 뒤에서도 보임)
    if (a.dead) continue;
    const q = projectGround(a.x, a.y, 0.74*(a.scale||1)+0.06); if (!q) continue;
    const bw = Math.max(34, Math.min(90, H*0.11/q.depth));
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(q.x-bw/2, q.y-3, bw, 5);
    ctx.fillStyle = '#4aa8ff'; ctx.fillRect(q.x-bw/2, q.y-3, bw*Math.max(0, a.hp/a.maxhp), 5);
    ctx.font = '700 12px "Noto Sans KR",sans-serif'; ctx.fillStyle = '#bfe4ff'; ctx.fillText(a.name, q.x, q.y-8);
  }
  if (curMode === 'capture'){                                  // 목표 표시: 화면 밖이면 가장자리에 붙음
    const z = curMap.zones[capZone]; let q = projectGround(z[0], z[1], 1.0);
    const d = Math.hypot(z[0]-player.x, z[1]-player.y);
    let x, y;
    if (q){ x = Math.max(40, Math.min(W-40, q.x)); y = Math.max(120, Math.min(H*0.7, q.y)); }
    else { let ang = Math.atan2(z[1]-player.y, z[0]-player.x)-player.ang; while (ang < -Math.PI) ang += 2*Math.PI; while (ang > Math.PI) ang -= 2*Math.PI;
      x = ang > 0 ? W-40 : 40; y = H*0.45; }
    ctx.fillStyle = 'rgba(8,14,26,.75)'; ctx.strokeStyle = '#39d3e0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y-18); ctx.lineTo(x+16, y); ctx.lineTo(x, y+18); ctx.lineTo(x-16, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 16px Orbitron,sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('ABC'[capZone], x, y+1);
    ctx.font = '700 11px Orbitron,sans-serif'; ctx.fillStyle = '#9af3fb'; ctx.fillText(d.toFixed(0)+'m', x, y+30); ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}
// 화면 위 정보: 웨이브·보스 체력 / 거점 진행·남은 시간·양 팀 / 부활 대기
function modeDrawHUD(now){
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = W/2, pill = (x, y, w, h) => { ctx.fillStyle = 'rgba(10,15,26,.72)'; roundRect(x-w/2, y-h/2, w, h, h/2); ctx.fill(); };
  if (curMode === 'wave'){
    pill(cx, 100, 170, 28); ctx.font = '900 14px Orbitron,sans-serif'; ctx.fillStyle = '#ffb52e'; ctx.fillText(`WAVE ${wave} / ${WAVES.length}`, cx, 101);
    if (bossRef){ const bw = Math.min(560, W*0.5), f = Math.max(0, bossRef.hp/bossRef.maxhp);
      ctx.fillStyle = 'rgba(10,15,26,.8)'; roundRect(cx-bw/2-4, 126, bw+8, 22, 6); ctx.fill();
      ctx.fillStyle = '#c0281c'; roundRect(cx-bw/2, 130, bw*f, 14, 4); ctx.fill();
      ctx.font = '700 11px Orbitron,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('WARLORD', cx, 138); }
    const bt = now-waveBannerT;
    if (bt < 1800){ const a = Math.min(1, bt/200)*Math.max(0, Math.min(1, (1800-bt)/400));
      ctx.globalAlpha = a; ctx.font = `900 ${Math.round(H*0.09)}px Orbitron,sans-serif`; ctx.fillStyle = wave === WAVES.length ? '#ff5a3c' : '#fff';
      ctx.shadowColor = 'rgba(255,138,42,.9)'; ctx.shadowBlur = 24; ctx.fillText(wave === WAVES.length ? 'BOSS WAVE' : 'WAVE '+wave, cx, H*0.32); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
  } else if (curMode === 'capture'){
    const t = Math.max(0, capTimeLeft), mm = Math.floor(t/60000), ss = Math.floor(t%60000/1000);
    pill(cx, 104, 330, 40);
    ctx.font = '900 15px Orbitron,sans-serif'; ctx.fillStyle = t < 30000 ? '#ff5a5a' : '#fff'; ctx.fillText(`${mm}:${String(ss).padStart(2,'0')}`, cx+128, 105);
    for (let i=0;i<3;i++){ const x = cx-140+i*34, done = i < capZone, cur = i === capZone;
      ctx.fillStyle = done ? '#39d3e0' : cur ? 'rgba(57,211,224,.25)' : 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x, 104, 13, 0, 7); ctx.fill();
      if (cur){ ctx.strokeStyle = capState === 'contest' ? '#ffbe3c' : capState === 'red' ? '#ff5046' : '#39d3e0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, 104, 13, -Math.PI/2, -Math.PI/2+6.2832*capProg/100); ctx.stroke(); }
      ctx.fillStyle = done ? '#06202a' : '#fff'; ctx.font = '900 12px Orbitron,sans-serif'; ctx.fillText('ABC'[i], x, 105); }
    const bw = 118; ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(cx-34, 99, bw, 10, 5); ctx.fill();
    ctx.fillStyle = capState === 'contest' ? '#ffbe3c' : capState === 'red' ? '#ff5046' : '#39d3e0'; if (capProg > 1){ roundRect(cx-34, 99, bw*capProg/100, 10, 5); ctx.fill(); }
    // 양 팀 인원
    pill(cx, 140, 250, 24); ctx.font = '700 11px "Noto Sans KR",sans-serif';
    const blueN = (playerDead ? 0 : 1)+allies.filter(a => !a.dead).length;
    for (let i=0;i<4;i++){ ctx.fillStyle = i < blueN ? '#4aa8ff' : 'rgba(74,168,255,.2)'; ctx.beginPath(); ctx.arc(cx-100+i*16, 140, 5, 0, 7); ctx.fill();
                           ctx.fillStyle = i < enemies.length ? '#ff5046' : 'rgba(255,80,70,.2)'; ctx.beginPath(); ctx.arc(cx+100-i*16, 140, 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#cfd8e6'; ctx.fillText(capState === 'contest' ? '격전 중!' : capState === 'blue' ? '점령 중' : capState === 'red' ? '빼앗기는 중' : '거점으로 이동', cx, 141);
    if (playerDead){ ctx.fillStyle = 'rgba(20,6,8,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.font = `900 ${Math.round(H*0.06)}px Orbitron,sans-serif`; ctx.fillStyle = '#ff6a6a'; ctx.fillText('전투 불능', cx, H*0.42);
      ctx.font = '700 20px "Noto Sans KR",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`${Math.max(0, (respawnAt-now)/1000).toFixed(1)}초 뒤 다시 투입`, cx, H*0.42+52); }
  }
  ctx.restore();
}
function modeMinimap(ox, oy, cell){
  if (curMode === 'capture'){
    curMap.zones.forEach((z, i) => { ctx.strokeStyle = i < capZone ? '#39d3e0' : i === capZone ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ox+z[0]*cell, oy+z[1]*cell, CAP.R*cell, 0, 7); ctx.stroke(); });
    ctx.fillStyle = '#4aa8ff'; for (const a of allies) if (!a.dead){ ctx.beginPath(); ctx.arc(ox+a.x*cell, oy+a.y*cell, 2.6, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,90,60,.8)'; for (const h of hazards){ ctx.beginPath(); ctx.arc(ox+h.x*cell, oy+h.y*cell, h.r*cell, 0, 7); ctx.fill(); }
}

// ── 결과·기록 ────────────────────────────────────────────────
function modeResult(secs){
  const m = MODES.find(x => x.id === curMode), key = hero.id+':'+curMode;
  if (curMode === 'wave') return { key, title: gameResult === 'win' ? '승리!' : '패배', line: gameResult === 'win' ? `8웨이브와 보스를 모두 격파` : `WAVE ${wave} / ${WAVES.length} 에서 쓰러짐`, score: gameResult === 'win' ? 100 : wave, mode:m.name };
  if (curMode === 'capture') return { key, title: gameResult === 'win' ? '승리!' : '패배', line: gameResult === 'win' ? `거점 3곳 점령 · 남은 시간 ${(Math.max(0,capTimeLeft)/1000).toFixed(0)}초` : `거점 ${'ABC'[capZone]} 에서 시간 종료`, score: gameResult === 'win' ? 100+Math.round(capTimeLeft/1000) : capZone, mode:m.name };
  return { key, title:'전투 종료', line:'', score:0, mode:m.name };
}

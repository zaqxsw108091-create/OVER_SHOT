# OVERSHOT

**English:** [README.md](README.md)

> 순수 자바스크립트와 HTML5 Canvas만으로 만든 1인칭 슈팅 게임입니다 — 프레임워크도, 빌드 도구도 없고, `index.html`만 열면 바로 플레이할 수 있습니다.

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 언어 | 순수 JavaScript (ES6+) |
| 렌더링 | HTML5 Canvas 2D API |
| 스타일 | 순수 CSS3 |
| 빌드 도구 | **없음** — 번들러, 프레임워크, npm 패키지 모두 없음 (외부 요청은 `styles.css`의 선택 사항인 Google Fonts 스타일시트 하나뿐이며, 없어도 게임은 동작함) |
| 저장 | 브라우저 `localStorage` (영웅별 최고 기록) |

---

## 핵심 구현

### 레이캐스팅 엔진
90년대 초 FPS 게임에서 영감을 받은 레이캐스팅 렌더러입니다. 각 광선은 벽 타일에 닿을 때까지 0.012타일씩 일정하게 앞으로 나아갑니다(단순 레이 마칭 — DDA 격자 순회 알고리즘이 아님).
- 16 × 16 타일 맵을 화면 전체 해상도로 실시간 렌더링
- 세로 줄마다 벽까지 거리 계산 + 어안(fisheye) 왜곡 보정
- 하늘 그라데이션 / 바닥 음영 / 거리에 따른 벽 밝기

### 빌보드 스프라이트
적, 미사일, 폭발은 깊이 순서로 정렬되어 월드 공간에서 항상 카메라를 향하는 빌보드로 그려지며, 벽에 올바르게 가려집니다.

### 무기 뷰 모델
각 영웅의 무기는 `ctx.translate` / `ctx.rotate`로 코드에서 직접 그리며, 이징 함수(`_easeIn`, `_easeOut`, `_lerp`)로 움직입니다.
- **돌격소총 "RAZOR-FX"** (Spark) — 옆모습이 보이게 들고 있으며, 총열 아래 미사일 포드, 홀로그램 조준경, 주황 발광 라인이 있습니다. 탄창 창에 남은 탄이 표시되고, 미사일 스킬이 충전될수록 포드의 미사일 3발이 밀려 나옵니다(준비되면 "READY" 홀로그램 표시). 반동, 총구 화염.
- **저격소총 "LUX-VALOR"** (Medica) — 흰·파랑 몸체에 회복약이 소용돌이치는 유리관, 빛나는 결정이 달린 금장 총구. 볼트액션 애니메이션, 조준(ADS) 스코프 화면 (우클릭).
- **해머 "SENTINEL MAUL"** (Titan) — 가시 달린 강철 머리에 파랗게 빛나는 에너지 셀 4개. 머리 위에서 수직으로 내리치기 + 모션 블러 호. 방벽 스킬은 파란 육각형 보호막으로 표시됩니다.
- **카타나 "RISING DRAGON"** (Kage) — 하늘색 발광선이 있는 칼날과 검정·금색 쓰바. 평소엔 칼끝이 화면 가운데를 향한 겨눔 자세(날은 아래). 휘두를 때는 손과 칼이 함께 움직여(겨눔 → 上段 → 袈裟斬り) 칼날이 앞장서서 베고, 칼끝이 실제로 지나간 자리를 따라 하늘색 궤적이 남음.

### 사격 연출
- 총 자세: 쏘지 않을 때 소총·저격총은 화면 오른쪽 아래에서 총구가 가운데 쪽을 비스듬히 향하는 1인칭 자세로 보입니다(장갑 낀 왼손이 핸드가드를 아래에서 받침, 총열 쪽은 원근감 있게 조금 짧게 그림). 쏘면 총이 **화면 가운데로 와서 뒤에서 조준경을 들여다보는 자세**(조준 사격)가 됩니다. 소총의 홀로그램 조준경 창과 저격총의 스코프 접안부가 정확히 조준점에 오고, 적을 겨누면 조준점이 빨갛게 바뀌며, 화면의 + 조준선은 숨겨집니다. 옆모습은 가운데로 들어오며 사라지고 가운데 조준 화면은 아래에서 올라옵니다(약 0.15초, smoothstep). 마지막 발사 후 약 0.65초가 지나면(또는 오른쪽 버튼을 떼면) 다시 들고 있는 자세로 돌아오며, 겨누는 동안은 흔들림이 줄어듭니다. 오른쪽 버튼을 누르고 있으면 쏘지 않아도 이 가운데 조준 화면이 됩니다.
- 쏠 때마다: 좌우로 살짝 흔들리는 반동, 탄피 배출구의 노리쇠 왕복, 튀어나가는 탄피, 총구 연기, 조준점까지 순간적으로 보이는 총알 빛줄기, 맞은 곳의 불꽃·먼지, 맞은 적이 하얗게 번쩍이며 살짝 밀려남. 처치한 적은 쓰러지며 사라짐.
- 재장전: 총을 기울이고 빈 탄창이 빠진 뒤 새 탄창을 끼우고 장전 손잡이를 당김. 저격총은 쏠 때마다 오른손으로 노리쇠를 조작.
- 미사일 스킬: 포드가 뒤로 튀며 번쩍이고, 떠 있는 홀로그램이 READY → LAUNCH → 충전 %로 바뀜.

### 충돌 판정
- AABB 방식 벽 미끄러짐: X축과 Y축을 따로 검사해서, 벽에 막혀 딱 멈추지 않고 벽을 따라 미끄러지듯 움직입니다.
- 적의 시야 확인과 스프라이트 가림 판정에 레이캐스팅을 씁니다.

### 조준(ADS) 스코프 화면
Canvas의 `evenodd` 채우기 규칙으로 그립니다 — 화면 전체 사각형에 반시계 방향 원을 빼서 스코프 구멍을 만듭니다. 안쪽에 비네팅 그라데이션, 밀도트 조준선, `4×` 표시를 그립니다.

---

## 영웅

| 영웅 | 역할 | 무기 | 스킬 |
|---|---|---|---|
| 🛡️ **Titan** | 탱커 | 해머 (근접) | 방벽 — 받는 피해를 줄이는 보호막 |
| ⚡ **Spark** | 딜러 | 돌격소총 (연사) | 미사일 — 발사체 범위 폭발 |
| ➕ **Medica** | 지원 | 저격소총 (반자동) | 치유 — 자신의 체력 회복 |
| ⚔️ **Kage** | 검사 | 카타나 (근접) | 거합술 — 앞으로 돌진 + 범위 베기 |

---

## 조작법

| 입력 | 동작 |
|---|---|
| `W A S D` | 이동 |
| 마우스 이동 | 시점 회전. 게임 화면을 클릭하면 마우스가 화면에 고정됨. 브라우저가 고정을 허용하지 않으면(일부 내장·임베드 브라우저) 커서 모드로 자동 전환 — 커서를 움직여 시점 회전, 마우스 움직임은 몇 프레임에 나눠 부드럽게 적용 (방향키 ←→로도 회전) |
| `← →` | 카메라 회전 (마우스를 쓸 수 없을 때) |
| 좌클릭 | 공격 / 발사 |
| 우클릭 (누르고 있기) | 쏘지 않고 조준경으로 겨누기 — Spark: 홀로그램 조준경, Medica: 스코프 화면 |
| `R` | 재장전 |
| `E` | 스킬 사용 |
| `Q` | 메뉴로 나가기 (일시정지 중에만 동작, 오른쪽 위 버튼도 같은 기능) |
| `Esc` | 마우스 해제 / 일시정지 |

---

## 시작하기

설치가 필요 없습니다.

```bash
# Clone the repository
git clone https://github.com/zaqxsw108091-create/OVER_SHOT.git

# Open in your browser — that's it
open index.html
```

(저장소를 받은 뒤 브라우저에서 `index.html`을 열면 끝입니다.)

> `localStorage` 기록 저장을 확실하게 하려면 로컬 HTTP 서버로 여세요.
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## 프로젝트 구조

```
OVER_SHOT/
├── index.html        # Screen layout  (login / hero-pick / game / game-over)
├── styles.css        # All styles
├── game.js           # Complete game engine (~1,960 lines, single file)
└── GAME_GUIDE.md     # Full feature & gameplay reference (Korean)
```

- `index.html` — 화면 배치 (로그인 / 영웅 선택 / 게임 / 게임 오버)
- `styles.css` — 모든 스타일
- `game.js` — 게임 엔진 전체 (약 1,960줄, 파일 하나)
- `GAME_GUIDE.md` — 전체 기능과 플레이 설명서 (한국어)

### `game.js` 한눈에 보기

| 부분 | 역할 |
|---|---|
| `HEROES[]` | 영웅 능력치, 무기, 스킬 정의 |
| `MAP[]` | 16 × 16 타일 격자 |
| `loop()` | `requestAnimationFrame` 메인 게임 루프 |
| `render()` | 레이캐스팅 렌더러 + 스프라이트 처리 |
| `drawWeapon()` | 무기 뷰 모델 그리기 분배 함수 |
| `drawSniper/Rifle/Hammer/Katana()` | 무기별 그리기 함수 |
| `drawScopeOverlay()` | 조준 스코프 화면 |
| `updateEnemies()` | 적 AI — 추격과 사격 |
| `attack()` / `applyMelee()` | 명중 판정 (원거리와 근접) |
| `useAbility()` / `iaiSlash()` | 스킬 실행 |
| `getRecords()` / `saveRecords()` | localStorage 최고 기록 저장 |

---

## 기술 상세

> 아래 각 기능마다 **코드가 무엇을 하는지**, **어디에 있는지**, **다른 방법 대신 왜 그 기법을 골랐는지** 설명합니다. 코드 블록은 `game.js`를 줄여 옮긴 발췌(일부 줄은 생략하거나 단순화함)이며, 그대로 복사한 것이 아닙니다.

---

### 1. 레이캐스팅 렌더러

**위치:** `render()` → 벽 루프, `game.js`

```js
// game.js — render()
const numRays = Math.min(W, 900);   // cap rays for performance
const colW    = W / numRays;

for (let r = 0; r < numRays; r++) {
  const rayAng = player.ang - FOV/2 + (r / numRays) * FOV;
  const ca = Math.cos(rayAng), sa = Math.sin(rayAng);
  let dist = 0, hit = false;
  // step along the ray until we hit a wall tile
  while (dist < 22 && !hit) {
    dist += 0.012;
    if (isWall(player.x + ca*dist, player.y + sa*dist)) hit = true;
  }
  const corr   = dist * Math.cos(rayAng - player.ang); // fisheye correction
  const wallH  = Math.min(H, (H / corr) * 0.9);
  let shade    = Math.max(0, 1 - corr / 16);           // distance fog
  ctx.fillStyle = `rgb(${base*shade}, …)`;
  ctx.fillRect(r * colW, (H - wallH)/2, colW+1, wallH);
}
```

**이 방식을 쓴 이유:**
- 레이캐스터는 픽셀마다가 아니라 화면 세로 줄마다(최대 900개) 광선을 하나씩 쏩니다. 그래서 렌더링 비용이 O(W×H)가 아니라 O(W)이고, 순수 자바스크립트 단일 스레드에서도 60 fps가 가능합니다.
- **어안 보정**(`dist * Math.cos(rayAng − player.ang)`)은 광선 길이 그대로가 아니라 벽 평면까지의 수직 거리로 나눕니다. 이게 없으면 화면 가장자리에서 벽이 휘어 보입니다.
- `numRays = Math.min(W, 900)`으로 세로 줄 수를 제한해서 초광폭 모니터에서도 프레임이 떨어지지 않게 하고, `colW = W/numRays`로 각 줄의 폭을 늘려 화면을 채웁니다.
- `side` 변수(`Math.min(fx,1-fx) < Math.min(fy,1-fy)`)는 광선이 타일의 X면에 맞았는지 Y면에 맞았는지 구분합니다. 면마다 음영을 다르게 줘서, 실제 조명 계산 없이도 벽이 입체적으로 보입니다.

---

### 2. 스프라이트 깊이 정렬과 빌보드 투영

**위치:** `render()` 스프라이트 부분 · `projectPoint()` · `drawEnemy()` · `drawSprite()`

```js
// Collect everything into one list, sort far→near, then draw
const things = [];
for (const e of enemies)  things.push({ t:'e', o:e, d: dist(e) });
for (const m of missiles) things.push({ t:'m', o:m, d: dist(m) });
for (const b of blasts)   things.push({ t:'b', o:b, d: dist(b) });
things.sort((a, b) => b.d - a.d);   // painter's algorithm: far first
for (const it of things) { … }

// projectPoint — world→screen for any (wx, wy)
function projectPoint(wx, wy) {
  let ang = Math.atan2(wy - player.y, wx - player.x) - player.ang;
  // normalise angle to (-π, π)
  while (ang < -Math.PI) ang += 2*Math.PI;
  while (ang >  Math.PI) ang -= 2*Math.PI;
  const dist = Math.hypot(wx - player.x, wy - player.y);
  return { sx: (0.5 + ang/FOV) * W, dist, vis: Math.abs(ang) < FOV/2 + 0.4 };
}
```

**이 방식을 쓴 이유:**
- **화가 알고리즘**(먼 것부터 가까운 것 순으로 정렬해 차례로 그리기)은 스프라이트 수가 적을 때 가장 단순하면서 올바른 방법입니다. 프레임마다 십여 개를 정렬하는 비용은 무시할 만합니다.
- `projectPoint`는 스프라이트와 플레이어 시선 방향 사이의 각도를 구해 `[0, W]` 범위로 옮겨서 월드 좌표를 화면 X 좌표로 바꿉니다. 월드→화면 변환을 재사용 가능한 함수 하나에 모았습니다.
- 벽 가림 판정은 선을 따라 점을 찍어 보는 `blockedByWall()`을 재사용합니다. 벽 뒤의 스프라이트는 따로 Z 버퍼를 두지 않고 그냥 건너뜁니다.
- 벽을 그릴 때 채운 `depth[]` 배열을 `drawEnemy` 안에서 써서, 스프라이트 중심 줄이 더 가까운 벽에 가려지면 그리지 않습니다: `if (depth[rayIdx] < dist - 0.3) return`.

---

### 3. 축 분리 벽 미끄러짐 (충돌 판정)

**위치:** `updatePlayer()`

```js
function updatePlayer(dt) {
  const sp = hero.speed * (dt * 0.06);
  const ca = Math.cos(player.ang), sa = Math.sin(player.ang);
  let mx = 0, my = 0;
  if (keys['KeyW']) { mx += ca; my += sa; }
  if (keys['KeyS']) { mx -= ca; my -= sa; }
  if (keys['KeyA']) { mx += sa; my -= ca; }   // strafe: perpendicular
  if (keys['KeyD']) { mx -= sa; my += ca; }

  const len = Math.hypot(mx, my) || 1;         // normalise so diagonals aren't faster
  mx /= len; my /= len;

  const nx = player.x + mx * sp;
  const ny = player.y + my * sp;
  if (!isWall(nx, player.y)) player.x = nx;   // X axis only
  if (!isWall(player.x, ny)) player.y = ny;   // Y axis only
}
```

**이 방식을 쓴 이유:**
- X와 Y를 따로 검사하면 플레이어가 벽에 막혀 멈추지 않고 벽을 따라 **미끄러집니다**. X 방향은 막혔지만 Y 방향이 비어 있으면 Y 이동은 그대로 적용됩니다 — Wolfenstein 3-D에서 쓰인 표준 기법입니다.
- `dt * 0.06`으로 이동량을 실제 시간에 맞춰서 프레임 속도와 상관없이 게임 속도가 같습니다. 30 fps 컴퓨터와 120 fps 컴퓨터에서 게임 속 이동 속도가 똑같습니다.
- 대각선 입력은 **정규화합니다**(`len = Math.hypot(mx, my)`). 그래서 대각선으로 움직이면 약 41% 더 빨라지는 고전적인 문제가 없습니다.

---

### 4. 원거리 명중 판정 — 광선 vs 적

**위치:** `rayHitEnemy()` · `blockedByWall()`

```js
function rayHitEnemy(ox, oy, ang) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = null, bestDist = 1e9;

  for (const e of enemies) {
    const ex = e.x - ox, ey = e.y - oy;
    const proj = ex*dx + ey*dy;             // scalar projection onto ray
    if (proj <= 0 || proj > 22) continue;   // behind player or too far

    const perp = Math.abs(ex*dy - ey*dx);  // perpendicular distance to ray
    if (perp < 0.34 && proj < bestDist) {  // 0.34 = hit radius
      if (!blockedByWall(ox, oy, e.x, e.y)) { best = e; bestDist = proj; }
    }
  }
  return best ? { e: best, dist: bestDist } : null;
}

function blockedByWall(x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1-x0, y1-y0) * 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(x0 + (x1-x0)*t, y0 + (y1-y0)*t)) return true;
  }
  return false;
}
```

**이 방식을 쓴 이유:**
- **스칼라 투영**(`ex·dx + ey·dy`)은 각 적에 가장 가까운 점이 광선을 따라 얼마나 떨어져 있는지 구하고, **외적의 크기**(`|ex·dy − ey·dx|`)는 광선에서 적 중심까지의 수직 거리를 줍니다. 둘을 합치면 적 하나당 O(1)로 정확한 직선 대 원 판정이 됩니다.
- `blockedByWall`은 선분을 따라 타일의 `1/8` 간격으로 점을 찍어 봅니다. 타일 단위로 정렬된 맵에서는 타일당 8번이면 충분히 정확하고, 제대로 된 벽면 교차 계산보다 훨씬 가볍습니다.
- 가려지지 않은 가장 가까운 적 하나만 돌려주므로, 같은 함수로 `updateHUD`의 조준선 색 변경과 `attack()`의 실제 피해를 모두 처리합니다.

---

### 5. 근접 공격 범위 판정

**위치:** `applyMelee()`

```js
function applyMelee() {
  for (const e of [...enemies]) {
    const dx = e.x - player.x, dy = e.y - player.y;
    if (Math.hypot(dx, dy) > hero.meleeRange) continue;  // range check

    let ang = Math.atan2(dy, dx) - player.ang;           // relative angle
    while (ang < -Math.PI) ang += 2*Math.PI;
    while (ang >  Math.PI) ang -= 2*Math.PI;
    if (Math.abs(ang) > hero.meleeArc) continue;         // arc check

    if (blockedByWall(player.x, player.y, e.x, e.y)) continue;
    e.hp -= hero.dmg;
    if (e.hp <= 0) killEnemy(e);
  }
}
```

**이 방식을 쓴 이유:**
- 근접 피해는 휘두르기 애니메이션이 시작될 때(`startSwing`)가 아니라 정해진 순간에 들어갑니다. 해머는 애니메이션 시작 후 `SWING_IMPACT` ms(210 ms), 카타나는 200 ms입니다. 피해 시점을 화면에서 맞닿는 순간에 맞춰 손맛이 정확합니다.
- `hero.meleeArc`(정면 기준 라디안)는 영웅마다 다릅니다. Titan은 `0.7` rad(약 40°), Kage는 `0.88` rad(약 50°)입니다 — 집중된 해머 타격보다 베는 카타나가 범위가 더 넓습니다.
- `Math.abs(ang) > arc`로 비교하기 전에 각도를 `(−π, π)`로 맞춰 두어서, 플레이어 바로 뒤의 적(각도 ≈ ±π)이 잘못 포함되는 각도 감김 버그를 막습니다.

---

### 6. 화면 흔들림과 반동

**위치:** `loop()` 감소 · `attack()`과 `applyMelee()` 발생 · `render()` 적용

```js
// Trigger (attack) — recoil stacks a little in full-auto, with a small random sideways jitter
recoilAmt = Math.min(1.6, recoilAmt + (sniper ? 1.4 : 0.55));
recoilJit = (Math.random() - 0.5) * (sniper ? 0.04 : 0.10);
shake = Math.max(shake, hero.weapon === 'sniper' ? 7 : 4);

// Decay every frame (loop) — bigger recoil returns faster
recoilAmt = Math.max(0, recoilAmt - dt * (0.0035 + recoilAmt * 0.006));
shake     = Math.max(0, shake     - dt / 26);

// Apply (render) — translate before drawing the world
const sx = shake ? (Math.random() - 0.5) * shake : 0;
const sy = shake ? (Math.random() - 0.5) * shake : 0;
ctx.save();
ctx.translate(sx, sy);
// … draw world …
ctx.restore();

// Weapon recoil (drawRifle)
ctx.rotate(0.30 + recoilAmt * 0.10 + recoilJit * recoilAmt);  // muzzle kicks up (+ jitter)
ctx.scale(s, s);
ctx.translate(recoilAmt * 34, recoilAmt * 5);                 // gun slides back toward the shoulder
```

**이 방식을 쓴 이유:**
- `shake`는 **월드 화면에만** 무작위 픽셀 이동을 줍니다(`ctx.save/restore`로 감쌈). 그래서 HUD와 무기 모델은 흔들리지 않고 항상 잘 보입니다.
- 선형 감소(`값 - dt/상수`)는 스프링 물리보다 단순하면서 원하는 느낌을 줍니다. 처음에 날카롭게 튀고 금방 가라앉습니다. `dt`를 써서 감소 속도도 프레임 속도와 무관합니다. 반동(`recoilAmt`)은 클수록 더 빨리 돌아오게 해서, 저격총의 큰 반동은 빨리 회복되고 연사의 작은 반동은 조금씩 쌓입니다.
- `Math.max(shake, newValue)`를 쓰므로 연속으로 맞아도 매번 초기화되지 않고 쌓입니다. 빠르게 연사하면 한 발마다 0으로 돌아가지 않고 흔들림이 이어집니다.
- 반동은 총을 총열 방향을 따라 **어깨 쪽으로** 밀고 총구를 위로 들어 올립니다 — 실제 총기가 움직이는 방식과 같습니다. 휘두르기 애니메이션에 쓰는 `_easeIn`/`_easeOut`은 여기서는 필요 없습니다. 시간에 따른 감소만으로 충분히 맞는 느낌이 나기 때문입니다.

---

### 7. 무기 뷰 모델 애니메이션 시스템

**위치:** `drawWeapon()` · `drawRifle()` · `drawSniper()` · `drawHammer()` · `drawKatana()`

```js
// drawWeapon — sway pivot at screen-bottom-centre
function drawWeapon() {
  const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
  const amp    = moving ? 1 : 0.4;
  const swayX  = Math.sin(now * 0.0042) * 9 * amp;
  const swayY  = moving
    ? Math.abs(Math.sin(now * 0.0084)) * 16   // bob while walking
    : Math.sin(now * 0.0018) * 6;             // slow breathe while idle
  ctx.translate(W*0.5 + swayX, H + swayY);   // origin: bottom-centre
  ctx.rotate(Math.sin(now * 0.0033) * 0.02 * amp);
}

// Animation helpers
const _easeOut = u => 1 - (1-u)*(1-u);   // fast start, slow finish
const _easeIn  = u => u * u;             // slow start, fast finish
const _lerp    = (a, b, u) => a + (b-a)*u;
```

**이 방식을 쓴 이유:**
- Canvas 원점을 **화면 아래쪽 가운데**(`ctx.translate(W*0.5, H)`)로 옮기면, 모든 무기 형상을 X=0이 화면 중앙인 로컬 좌표계에서 그릴 수 있습니다(위로 갈수록 Y가 작아짐). 무기 좌표가 직관적이고 화면 크기와 상관없이 일정합니다.
- `Math.sin(now * freq)` 진동으로 `performance.now()` 외에는 상태 변수 없이 계속 부드럽게 흔들립니다. X/Y 흔들림 주파수를 다르게 해서 기계적으로 보이지 않게 했습니다.
- `amp` 배율은 움직일 때 흔들림을 키워 무기를 들고 걷는 느낌을 냅니다. 가만히 있을 때는 `amp = 0.4`로 은은하게 숨 쉬는 듯한 움직임만 남습니다.
- **`_easeIn`**(점점 빨라짐)은 휘두르기의 **타격 단계**에 씁니다 — 무기가 가속하며 맞습니다. **`_easeOut`**(점점 느려짐)은 **준비 동작과 복귀**에 씁니다 — 정점까지 빠르게 올라갔다가 천천히 돌아옵니다. 이 비대칭이 근접 공격에 무게감을 주는 핵심입니다.

---

### 8. 해머 내리치기 애니메이션

**위치:** `drawHammer(now)`

```js
// Angle convention: a=0 → head points straight up
//  a = +0.68  idle (hanging at right side)
//  a = -1.30  fully wound up (overhead, leaning back)
//  a = +2.62  fully slammed (pointing forward-down)

let a = 0.68 + Math.sin(now * 0.002) * 0.05;  // idle breathe

if (swingT && now - swingT < SWING_MS) {
  const t = (now - swingT) / SWING_MS;
  if      (t < 0.24) a = _lerp(0.68, -1.3,  _easeOut(t / 0.24));        // windup
  else if (t < 0.52) a = _lerp(-1.3,  2.62, _easeIn((t-0.24) / 0.28));  // SLAM
  else               a = _lerp(2.62,  0.68, _easeOut((t-0.52) / 0.48)); // recovery
}

const dx = Math.sin(a), dy = -Math.cos(a);   // head direction vector
const hx = px + dx*L, hy = py + dy*L;        // head world position

// Motion blur arc (during slam phase only)
if (t > 0.25 && t < 0.54) {
  ctx.arc(px, py, L, -Math.PI*0.78, Math.PI*0.55);  // sweep from up to down
  ctx.stroke();
}
```

(주석의 각도 규칙: a=0이면 해머 머리가 바로 위 · +0.68 대기(오른쪽에 늘어뜨림) · -1.30 최대로 들어 올림(머리 위, 뒤로 젖힘) · +2.62 끝까지 내리침(앞 아래쪽))

**이 방식을 쓴 이유:**
- 해머 자세를 회전축 기준 **각도 `a` 하나**로 나타내면, 변수 하나로 무기 전체(손잡이 + 머리 + 손)가 올바르게 움직입니다. 손잡이 위치와 머리 위치를 따로 관리할 필요가 없습니다.
- 대기 → 들어 올리기 → 내리치기 → 복귀의 키프레임마다 다른 이징 곡선을 써서 무게감을 줍니다. 들어 올릴 때 `_easeOut`은 무거운 것을 드는 느낌이고, 내리칠 때 `_easeIn`은 중력에 끌려 떨어지는 느낌입니다.
- 모션 블러 호는 회전축을 중심으로 `r = L`(손잡이 길이)에 그리며, 내리치는 각도 범위를 정확히 쓸고 지나갑니다. 해머 머리가 실제로 지나가는 경로를 따라가므로 `ctx.arc` 한 번으로 정확한 모션 블러가 됩니다.
- 피해(`applyMelee`)는 `SWING_IMPACT = 210ms`에 들어갑니다. 이 시점은 `_easeIn` 내리치기 구간 안이고 해머 머리가 화면상 적에 가까이 와 있을 때입니다 — 화면이 맞아 보일 때 타격이 들어가야 한다는 감각에 맞춘 것입니다.

---

### 9. 카타나 사무라이 베기 — 袈裟斬り (케사기리)

**위치:** `drawKatana(now)` · `loop()`의 동적 타격 시점

```js
// Keyframes: [hand x, hand y, blade angle, visible blade length] — hands and blade move together
const IDLE = [250, -160, -0.62, 0.86];  // chudan (中段): tip aimed at the screen centre, edge down, foreshortened
const UP   = [300, -320,  0.55, 1.00];  // jodan (上段): hands raised to the right, blade over the shoulder
const CUT  = [-60,   40, -2.25, 1.00];  // kesa-giri: hands travel down-left, edge leading

if (swingT && now - swingT < KATANA_MS) {
  const t = (now - swingT) / KATANA_MS;
  if      (t < 0.20) K = mix(IDLE, UP,  _easeOut(t / 0.20));          // raise
  else if (t < 0.52) K = mix(UP,   CUT, _easeIn((t-0.20) / 0.32));    // kesa-giri strike
  else               K = mix(CUT,  IDLE, _smooth((t-0.52) / 0.48));   // back to guard
}

// Curved blade — 22 steps with sine offset for authentic katana curvature
const P = (tb, off) => {               // point on the blade, pushed sideways by `off`
  const L = B0 + tb*(bladeL-B0), c = Math.sin(tb * Math.PI) * 9 + off;  // peak curve at midpoint
  return [px + dx*L + dy*c, py + dy*L - dx*c];
};
// filled outline: spine side out to the tip, edge side back (blade narrows toward the tip)
for (let i = 0; i <= 22; i++)  ctx.lineTo(...P(i/22, -(8.6 - 2.6*i/22)));
for (let i = 22; i >= 0; i--)  ctx.lineTo(...P(i/22,  (8.6 - 2.6*i/22)));

// Hamon (刃文) — the temper line unique to Japanese swords
ctx.strokeStyle = 'rgba(190,220,255,0.48)';
for (let i = 0; i <= 44; i++) {
  const hamon = Math.sin(tb * Math.PI * 9) * 1.8;  // high-frequency ripple
  // offset by hamon from the blade centre line
}

// Dynamic impact timing in loop()
const _impactMs = hero.weapon === 'katana' ? 200 : SWING_IMPACT;
if (!swingHitDone && t - swingT >= _impactMs) { applyMelee(); swingHitDone = true; }
```

**이 방식을 쓴 이유:**
- 휘어진 칼날은 **한쪽에 22단계씩 점을 찍어 채운 윤곽**으로 그리며, 각 점을 칼날 방향에 수직으로 `Math.sin(t·π)·9`만큼 밀어 냅니다(칼끝으로 갈수록 날이 좁아짐). 사인 곡선은 칼날 가운데에서 가장 많이 휘고 양 끝에서는 휘지 않습니다 — 실제 카타나(시노기즈쿠리 형태)의 모양과 맞습니다.
- **하몬**(刃文, 담금질 무늬)은 높은 주파수의 사인(`Math.PI * 9`, 칼날 길이에 4.5번 물결)을 아주 작은 진폭(1.8 px)과 낮은 불투명도(0.48)로 그립니다. 실제 칼의 하몬도 1~3mm 폭의 결정 경계가 물결 모양의 밝은 선으로 보이는 것이라 이에 맞췄습니다.
- 카타나는 `loop()`의 동적 상수로 해머(210 ms)와 **다른 타격 시점**(200 ms)을 씁니다. 카타나의 `_easeIn` 가속은 전체 시간(500 ms vs 420 ms) 안에서 더 일찍 정점에 이르므로, 200 ms가 화면의 베는 순간과 피해를 정확히 맞춥니다.
- 손 위치를 두 개 따로 두어(`px-dx*24`는 쓰바 바로 아래 오른손, `px-dx*96`은 자루 끝 왼손, 두 손 사이에 자루가 한 뼘 보임) 일본 검술(켄주츠) 특유의 **양손 잡기**를 표현했습니다. 손은 자루를 감싸 쥔 주먹으로 그리며(`drawGripHand`), 손가락 4개가 자루를 가로질러 반대편으로 감싸고 손등·너클은 팔 쪽을 향합니다. 두 팔뚝은 자루를 가리지 않게 자루 양옆에서 아래로 내려갑니다.

---

### 10. 저격 조준(ADS) 스코프 화면 — `evenodd` 채우기 규칙

**위치:** `drawScopeOverlay()`

```js
function drawScopeOverlay() {
  const cx = W/2, cy = H/2, r = Math.min(W,H) * 0.40;

  // KEY TECHNIQUE: punch a circular hole in a solid rectangle
  ctx.beginPath();
  ctx.rect(0, 0, W, H);                  // outer rectangle (clockwise)
  ctx.arc(cx, cy, r, 0, Math.PI*2, true); // inner circle (counter-clockwise)
  ctx.fillStyle = 'rgba(0,0,0,0.97)';
  ctx.fill('evenodd');                    // fills rect but NOT circle

  // Vignette inside the circle
  const vig = ctx.createRadialGradient(cx, cy, r*0.80, cx, cy, r);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

  // Mil-dots at multiples of r*0.12
  const mil = r * 0.12;
  for (let i = 1; i <= 4; i++) {
    const sz = i === 2 ? 3.5 : 2.2;   // larger dot at 2 mils
    [ [cx+i*mil, cy], [cx-i*mil, cy], [cx, cy+i*mil], [cx, cy-i*mil] ]
      .forEach(([x,y]) => { ctx.arc(x,y,sz,0,7); });
  }
}
```

**이 방식을 쓴 이유:**
- **`evenodd` 채우기 규칙**이 클리핑 마스크 없이 원형 구멍을 내는 핵심입니다. 이 규칙은 어떤 점이 경로 윤곽에 홀수 번 둘러싸여 있으면 채웁니다. 화면 사각형이 중앙을 한 번 감싸고, 반시계 방향 원이 한 번을 빼서 원 안은 0(채우지 않음)이 됩니다. 그리기 호출 한 번이면 됩니다 — `ctx.clip()`도, 합성도 없습니다.
- `ctx.clip()`을 쓰면 `ctx.save/restore` 한 쌍이 필요하고 이후 캔버스 상태에 영향을 줍니다. `evenodd` 방식은 이런 문제가 전혀 없습니다.
- 밀도트는 스코프 반지름의 일정 비율인 `i × r × 0.12` 위치에 두어, 창 크기가 바뀌어도 조준선 비율이 맞습니다. 두 번째 점(`i=2`)은 조금 더 큽니다(3.5 vs 2.2 px). 실제 4× ACOG나 Leupold 스코프에서 쓰는 BDC(탄도 낙차 보정) 표기 방식에 맞춘 것입니다.
- 비네팅 그라데이션은 `r×0.80`(스코프 반지름의 80%)에서 시작해 구멍 바깥쪽 20%만 어둡게 합니다. 조준하는 부분은 가리지 않으면서 렌즈 가장자리가 어두워지는 효과를 냅니다.
- 조준 중에는 부모 요소에 `display:none`을 주지 않고 `cross.classList.add('hide')`로 HUD 조준점을 숨깁니다. 요소가 DOM에 그대로 남아 있어서 우클릭을 떼면 바로 다시 보입니다.

---

### 11. 적 AI — 시야 기반 추격과 확률 사격

**위치:** `updateEnemies(dt, now)`

```js
function updateEnemies(dt, now) {
  for (const e of enemies) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const see  = !blockedByWall(e.x, e.y, player.x, player.y);

    // Chase — axis-separated wall slide (same as player movement)
    if (see && dist > 1.4) {
      const sp = 0.026 * dt * 0.06;
      const nx = e.x + (dx/dist)*sp, ny = e.y + (dy/dist)*sp;
      if (!isWall(nx, e.y)) e.x = nx;
      if (!isWall(e.x, ny)) e.y = ny;
    }

    // Shoot — cooldown + hit probability
    if (see && dist < 8 && now - e.lastShot > 1100) {
      e.lastShot = now;
      if (Math.random() < 0.55) {            // 55% hit chance per shot
        let dmg = 8 + Math.random() * 6;
        if (abilActive && hero.id === 'titan') dmg *= 0.3;  // Barrier reduces to 30%
        player.hp -= dmg;
        if (player.hp <= 0) endGame();
      }
    }
  }
}
```

**이 방식을 쓴 이유:**
- 적도 플레이어와 **같은 축 분리 충돌 코드**를 씁니다. `isWall` 함수 하나를 함께 쓰므로 적의 이동이 플레이어 물리와 일관되고, 따로 관리할 물리 시스템이 없습니다.
- `blockedByWall`은 이동 중이 아니라 시야 확인용으로 적마다 프레임당 한 번 부릅니다. 의도한 것입니다. 적은 별도의 길찾기 없이도 벽에 미끄러지며 모퉁이를 돌 수 있습니다. 단순하지만 이 정도 맵 크기에서는 충분히 효과적입니다.
- 확률 사격(명중률 55%, 재사격 대기 1100 ms)은 복잡한 상태 없이도 자연스러운 전투 변화를 만듭니다. 대기 시간은 적마다 따로(`e.lastShot`) 있어서 여러 적이 각자 공격합니다.
- Titan 방벽의 피해 `0.3`배 감소는 플레이어 피해 함수가 아니라 **적 AI 안에서** 적용합니다. 방벽 로직이 피해를 주는 곳과 같은 자리에 있어서 AI 코드를 읽으면 바로 보입니다.

---

### 12. 거합술 스킬 — 순간 돌진 + 부채꼴 범위 공격 + 제자리 복귀

**위치:** `iaiSlash()`

```js
function iaiSlash() {
  const ca = Math.cos(player.ang), sa = Math.sin(player.ang);
  const ox = player.x, oy = player.y;  // remember starting position

  // Forward dash — 0.15-unit steps measured from the start point, stop at wall (max 2.0)
  for (let s = 0.15; s <= 2.0; s += 0.15) {
    const nx = ox + ca*s, ny = oy + sa*s;
    if (!isWall(nx, ny)) { player.x = nx; player.y = ny; }
    else break;
  }
  const dashLen = Math.hypot(player.x - ox, player.y - oy);

  // Damage: enemies the dash passed through + enemies in the arc ahead (2.8 radius, ±1.15 rad)
  for (const e of [...enemies]) {
    const ex = e.x - ox, ey = e.y - oy;
    const along = ex*ca + ey*sa, side = Math.abs(ex*sa - ey*ca);
    const onPath = along > 0 && along <= dashLen && side < 0.9;
    const dx = e.x - player.x, dy = e.y - player.y;
    let ang = Math.atan2(dy, dx) - player.ang;
    while (ang < -Math.PI) ang += 2*Math.PI;
    while (ang >  Math.PI) ang -= 2*Math.PI;
    const inArc = Math.hypot(dx, dy) <= 2.8 && Math.abs(ang) <= 1.15;
    if (!onPath && !inArc) continue;
    if (blockedByWall(ox, oy, e.x, e.y) && blockedByWall(player.x, player.y, e.x, e.y)) continue;
    e.hp -= 135;
    if (e.hp <= 0) killEnemy(e);
  }

  // Return to origin — the defining trait of true iaijutsu
  player.x = ox; player.y = oy;

  iaiFlash = performance.now();  // trigger screen slash effect
}
```

**이 방식을 쓴 이유:**
- **돌진 → 베기 → 복귀의 3단계**: 실제 거합술(居合)의 원리 — 발을 움직이지 않고 같은 자세에서 칼을 뽑고, 베고, 다시 칼집에 넣는 것 — 에 맞췄습니다. 플레이어가 순간적으로 앞으로 나가 그 위치에서 적에게 피해를 주고, 곧바로 제자리로 돌아옵니다.
- 돌진은 한 번에 순간이동하지 않고 **0.15 단위씩** 나아갑니다. 그래서 플레이어 이동에 쓰는 같은 `isWall` 검사가 첫 번째 벽 타일에서 돌진을 자연스럽게 멈추고, Kage가 얇은 벽을 뚫고 지나갈 수 없습니다.
- 돌진 **전에** 출발 위치(`ox, oy`)를 저장하고 범위 판정 **뒤에** 되돌리므로, 피해는 돌진한 위치(앞쪽 최대 2.8 단위까지)에서 올바르게 계산되고 플레이어는 항상 출발점으로 돌아옵니다.
- 돌진의 각 단계는 **출발점 기준**으로 계산합니다(`ox + ca*s`). 예전 버전은 이미 움직인 위치에 단계 거리를 계속 더해서, 실제로는 벽에 닿을 때까지 약 13칸을 날아가 바로 앞의 적을 거의 맞히지 못했습니다. 이 버그를 고쳤고, 돌진 경로에서 스쳐 지나간 적(경로 옆 0.9칸 안)도 함께 베어 가까운 적을 건너뛰지 않습니다.
- 최대 돌진 거리는 복귀 기능을 넣으면서 2.5 → **2.0 단위**로 줄였습니다. 복귀가 없을 때는 시원하게 느껴지려면 더 긴 돌진이 필요했지만, 바로 돌아오는 지금은 짧은 돌진이 스킬을 알아보기 쉽게 하고 Kage가 실수로 벽 모서리에 박히는 것을 막습니다.
- `[...enemies]`로 배열을 복사한 뒤 돌기 때문에, 배열에서 원소를 지우는 `killEnemy`가 반복문을 망가뜨리지 않습니다.
- `Math.abs(ang) > 1.15`로 범위를 약 ±66°로 제한합니다 — 옆쪽에 조금 비켜 있는 적도 맞힐 만큼 넓고, 적 무리를 바라봐야 할 만큼 좁습니다.

---

### 13. 미사일 발사체와 폭발

**위치:** `launchMissile()` · `updateMissiles(dt)` · `explode(x, y)`

```js
// Sub-step integration to prevent tunnelling at high speed
function updateMissiles(dt) {
  const stepN = Math.max(1, Math.round(dt / 8));  // ~2 steps at 60 fps
  for (const m of missiles) {
    for (let s = 0; s < stepN && m.alive; s++) {
      m.x += m.dx * m.spd;
      m.y += m.dy * m.spd;
      if (isWall(m.x, m.y))                          { explode(m.x, m.y); m.alive=false; break; }
      if (enemies.some(e => dist(e, m) < 0.45))      { explode(m.x, m.y); m.alive=false; break; }
      if (dist(player, m) > 26)                       { m.alive = false; }
    }
  }
  missiles = missiles.filter(m => m.alive);
}

function explode(x, y) {
  blasts.push({ x, y, life: 420, max: 420 });
  shake = Math.max(shake, 11);
  const R=2.2, DMG=85;
  for (const e of [...enemies]) {
    const d = Math.hypot(e.x-x, e.y-y);
    if (d < R) { e.hp -= DMG * (1 - d/R); … }  // linear damage falloff
  }
}
```

**이 방식을 쓴 이유:**
- **세분 단계 적분**(`stepN = dt/8`)은 `dt`가 클 때(예: 프레임이 순간 느려짐) 한 프레임에 미사일 물리를 여러 번 돌립니다. 이게 없으면 빠른 미사일이 한 프레임 사이에 얇은 벽을 건너뛰어 버릴 수 있습니다 — 고전적인 "터널링" 버그입니다. `dt/8`이면 60 fps에서 약 2단계로 충분합니다.
- `missiles.filter(m => m.alive)`로 프레임 끝에 사라진 미사일을 걸러냅니다. 반복 중에 splice로 지우지 않아 인덱스가 꼬이는 버그를 피합니다.
- 폭발 피해는 **선형 감소**(`DMG * (1 - d/R)`)입니다 — 중심에서 최대, 가장자리에서 0. 가장 단순하고 직관적인 모델이며, 조정하기 더 어려운 제곱 감소 값이 필요 없습니다.
- `blasts`에 `{life, max}`를 저장해서, 그리기 함수가 `k = 1 - life/max` 하나로 폭발 반지름 확대와 투명해지는 효과를 함께 처리합니다.

---

### 14. 스킬 재사용 대기 UI

**위치:** `updateAbility(now)` · `#abilBar` DOM 요소

```js
function updateAbility(now, dt) {
  // Active ability tick (heal)
  if (abilActive) {
    if (hero.abilType === 'heal') player.hp = Math.min(player.maxhp, player.hp + HEAL_PER_SEC * dt / 1000);  // HEAL_PER_SEC = 10.8
    if (now >= abilEnd) { abilActive = false; abilCdEnd = now + hero.abilCd; }
  }
  if (!abilActive && !abilReady && now >= abilCdEnd) abilReady = true;

  // Map state to a single 0–1 progress value
  let pct;
  if      (abilActive) pct = (abilEnd - now) / hero.abilDur;  // active: time remaining
  else if (abilReady)  pct = 1;                               // ready: full bar
  else                 pct = 1 - (abilCdEnd - now) / hero.abilCd; // charging

  el('abilBar').firstElementChild.style.width = Math.max(0, Math.min(1, pct)) * 100 + '%';
}
```

**이 방식을 쓴 이유:**
- 세 가지 상태(`abilActive / abilReady / 충전 중`)를 **`pct` 값 하나**로 합쳐 CSS 막대의 폭을 정합니다. 그래서 막대가 세 상태 모두에서 의미 있게 보입니다. 사용 중에는 줄어들고, 대기 중에는 차오르고, 준비되면 가득 찹니다.
- 치유 스킬은 매 `requestAnimationFrame`마다 불리는 `updateAbility` 안에서 `HEAL_PER_SEC × dt`(**초당 10.8 HP**)만큼 회복합니다. 한 번에 확 오르지 않고 부드럽게 회복됩니다. 프레임 사이 시간 `dt`를 곱하므로 60Hz 모니터와 144Hz 모니터에서 회복 속도가 같습니다. (예전에는 프레임마다 +0.18 HP를 더해서, 주사율이 높은 모니터일수록 더 빨리 회복되었습니다.)
- `hero.abilDur`와 `hero.abilCd`는 `HEROES` 배열에 영웅별로 정의되어 있어서, 대기 시간을 바꾸려면 한 곳만 고치면 됩니다 — 스킬 코드 곳곳에 숫자가 흩어져 있지 않습니다.

---

### 15. `localStorage`에 영웅별 최고 기록 저장

**위치:** `getRecords()` · `saveRecords()` · `recordFor()` · `endGame()`

```js
const REC_KEY = 'overshot_records_v1';

function getRecords() {
  try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; }
  catch (e) { return {}; }   // corrupt storage → start fresh
}
function saveRecords(r) {
  try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch(e) {}
}

// endGame — keep the best of each stat independently
function endGame() {
  const secs = gameTime / 1000;
  const recs = getRecords();
  const cur = recs[hero.id] || { kills: 0, time: 0 };
  const newRecord = (kills > cur.kills) || (secs > cur.time);   // shows the "new record" badge
  recs[hero.id] = { kills: Math.max(kills, cur.kills), time: Math.max(secs, cur.time) };
  saveRecords(recs);
  // … then fills the result screen and calls show('over')
}
```

**이 방식을 쓴 이유:**
- **모든 localStorage 호출을 `try/catch`로 감쌈** — 시크릿 모드이거나 저장소가 꺼진 브라우저는 `localStorage.setItem`에서 `SecurityError`를 던집니다. 조용히 넘어가게 해서, 꼭 필요하지 않은 기능 때문에 게임이 멈추지 않게 했습니다.
- 키에 버전(`_v1`)이 붙어 있어서, 나중에 저장 형식이 바뀌면 `_v2`로 올리기만 하면 됩니다 — 옛 키는 그냥 무시되므로 변환 과정이 필요 없습니다.
- 기록은 배열이 아니라 `hero.id`(`'titan'`, `'spark'` 등)를 키로 하는 객체로 저장합니다. 찾기가 O(1)이고, 새 영웅을 추가해도 문제가 없습니다 — 새 영웅의 기록은 처음 읽을 때 `|| {}` 기본값으로 `{kills:0, time:0}`부터 시작합니다.
- 처치 수와 생존 시간은 **따로** 기록합니다. 처치 수 최고 기록과 생존 시간 최고 기록이 서로 다른 판에서 나올 수 있습니다. 점수 하나로 합치는 것보다 더 성취감이 있습니다.

---

## 앞으로 할 일

- [ ] 이미지 스프라이트 에셋 (코드로 그린 무기 대체)
- [ ] Web Audio API — 발사, 타격, 폭발 소리
- [ ] 다양한 적 종류 (빠른 적 / 단단한 적 / 원거리 적)
- [ ] 웨이브/라운드 시스템 + 점수 배율 + 보스
- [ ] 영웅과 스킬 추가
- [ ] 모바일 터치 조작

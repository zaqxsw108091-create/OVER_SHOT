# OVERSHOT

**한국어:** [README.ko.md](README.ko.md)

> A first-person shooter built entirely with vanilla JavaScript and HTML5 Canvas — no frameworks, no build tools, just open `index.html` and play.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES6+) |
| Rendering | HTML5 Canvas 2D API |
| Styling | Pure CSS3 |
| Build Tools | **None** — no bundler, no framework, no npm packages (the only external request is the optional Google Fonts stylesheet in `styles.css`; the game still works without it) |
| Storage | Browser `localStorage` (per-hero best records) |

---

## Core Implementation

### Raycasting Engine
A raycasting renderer inspired by early 90s FPS games. Each ray is marched forward in fixed 0.012-tile steps until it hits a wall tile (simple ray marching — not the DDA grid-traversal algorithm).
- 16 × 16 tile map rendered in real-time at full viewport resolution
- Per-column wall distance calculation with fisheye correction
- Sky gradient / floor shading / distance-based wall brightness

### Billboard Sprites
Enemies, missiles, and explosions are depth-sorted and rendered as camera-facing billboards in world space, correctly occluded by walls.

### Weapon View Models
Each hero's weapon is drawn procedurally with `ctx.translate` / `ctx.rotate`, animated using easing helpers (`_easeIn`, `_easeOut`, `_lerp`):
- **Assault Rifle** — recoil bounce, muzzle flash
- **Sniper Rifle** — bolt-action animation, ADS scope overlay (right-click)
- **Hammer** — overhead vertical slam with motion-blur arc
- **Katana** — three-phase samurai swing (中段 → 上段 → 袈裟斬り)

### Collision Detection
- AABB-style wall sliding: X and Y axes tested independently so the player glides along walls instead of stopping dead.
- Enemy raycasting for line-of-sight checks and sprite occlusion.

### ADS Scope Overlay
Rendered with the Canvas `evenodd` fill rule — a full-screen rectangle with a counter-clockwise circle cut out creates the scope aperture. Vignette gradient, mil-dot reticle, and `4×` label drawn inside.

---

## Heroes

| Hero | Role | Weapon | Skill |
|---|---|---|---|
| 🛡️ **Titan** | Tank | Hammer (melee) | Barrier — damage reduction shield |
| ⚡ **Spark** | DPS | Assault Rifle (auto) | Missile — projectile AOE explosion |
| ➕ **Medica** | Support | Sniper Rifle (semi) | Heal — self HP recovery |
| ⚔️ **Kage** | Blade | Katana (melee) | Iaijutsu — forward dash + area slash |

---

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| Mouse move | Look (requires pointer lock) |
| `← →` | Turn the camera (when the mouse can't be used) |
| Left click | Attack / Fire |
| Right click | ADS scope aim *(Medica only)* |
| `R` | Reload |
| `E` | Use ability |
| `Q` | Quit to menu (works only while paused; the top-right button does the same) |
| `Esc` | Release mouse / Pause |

---

## Getting Started

No installation required.

```bash
# Clone the repository
git clone https://github.com/zaqxsw108091-create/OVER_SHOT.git

# Open in your browser — that's it
open index.html
```

> For reliable `localStorage` record saving, serve the file from a local HTTP server:
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## Project Structure

```
OVER_SHOT/
├── index.html        # Screen layout  (login / hero-pick / game / game-over)
├── styles.css        # All styles
├── game.js           # Complete game engine (~1,190 lines, single file)
└── GAME_GUIDE.md     # Full feature & gameplay reference (Korean)
```

### `game.js` at a glance

| Section | Responsibility |
|---|---|
| `HEROES[]` | Hero stats, weapon, and ability definitions |
| `MAP[]` | 16 × 16 tile grid |
| `loop()` | Main `requestAnimationFrame` game loop |
| `render()` | Raycasting renderer + sprite pipeline |
| `drawWeapon()` | Procedural weapon view-model dispatcher |
| `drawSniper/Rifle/Hammer/Katana()` | Per-weapon draw functions |
| `drawScopeOverlay()` | ADS scope UI |
| `updateEnemies()` | Enemy AI — chase & shoot |
| `attack()` / `applyMelee()` | Hit detection (ranged & melee) |
| `useAbility()` / `iaiSlash()` | Skill execution |
| `getRecords()` / `saveRecords()` | localStorage best-score persistence |

---

## Technical Deep Dive

> Every feature below explains **what the code does**, **where it lives**, and **why that specific technique was chosen** over alternatives. Code blocks are shortened excerpts of `game.js` (some lines trimmed or simplified), not verbatim copies.

---

### 1. Raycasting Renderer

**Where:** `render()` → wall loop, `game.js`

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

**Why this approach:**
- A raycaster fires one ray per screen column (up to 900), not per pixel. This keeps the render O(W) rather than O(W×H), making 60 fps possible in pure JS on a single thread.
- The **fisheye correction** (`dist * Math.cos(rayAng − player.ang)`) divides by the perpendicular distance to the wall plane instead of the raw ray length. Without it, walls curve at the edges of the screen.
- `numRays = Math.min(W, 900)` caps the column count so ultra-wide monitors do not tank the frame rate while `colW = W/numRays` scales each column to fill the viewport.
- The `side` variable (`Math.min(fx,1-fx) < Math.min(fy,1-fy)`) detects whether the ray struck the X-face or Y-face of a tile, allowing different shade values to give walls a pseudo-3D look with no actual lighting math.

---

### 2. Sprite Depth Sorting & Billboard Projection

**Where:** `render()` sprite block · `projectPoint()` · `drawEnemy()` · `drawSprite()`

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

**Why this approach:**
- The **painter's algorithm** (sort back-to-front, draw in order) is the simplest correct solution for a small number of sprites. The overhead of sorting a dozen objects per frame is negligible.
- `projectPoint` converts world-space coordinates to screen X by computing the angle between the sprite and the player's look direction, then mapping that to `[0, W]`. This keeps all world→screen logic in one reusable function.
- Wall occlusion reuses `blockedByWall()` — a line-march sampler — so sprites behind walls are simply skipped rather than requiring a separate Z-buffer.
- The `depth[]` array (filled during the wall pass) is used inside `drawEnemy` to skip sprites whose centre column is hidden behind a closer wall: `if (depth[rayIdx] < dist - 0.3) return`.

---

### 3. Axis-Separated Wall Sliding (Collision Detection)

**Where:** `updatePlayer()`

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

**Why this approach:**
- Testing X and Y independently means the player **slides** along a wall rather than stopping dead. If the full move is blocked in X but free in Y, the Y component still applies — this is the standard technique used in Wolfenstein 3-D.
- `dt * 0.06` normalises movement to real time so the game speed is frame-rate-independent. A 30 fps machine and a 120 fps machine move at identical in-game speed.
- Diagonal input **is** normalised (`len = Math.hypot(mx, my)`), preventing the classic diagonal-speed exploit (moving diagonally would otherwise be ~41% faster).

---

### 4. Ranged Hit Detection — Ray vs Enemy

**Where:** `rayHitEnemy()` · `blockedByWall()`

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

**Why this approach:**
- The **scalar projection** (`ex·dx + ey·dy`) finds how far along the ray the closest point to each enemy is, and the **cross product magnitude** (`|ex·dy − ey·dx|`) gives the perpendicular distance from the ray to the enemy's centre. Together they implement an exact line-vs-circle test in O(1) per enemy.
- `blockedByWall` marches in steps of `1/8` of a tile along the segment. 8 samples per tile is accurate enough for a tile-aligned map while being far cheaper than a proper raycasting wall-face intersection.
- Only one enemy is returned (the nearest un-occluded hit) so the same function drives both the crosshair colour change in `updateHUD` and actual damage in `attack()`.

---

### 5. Melee Arc Detection

**Where:** `applyMelee()`

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

**Why this approach:**
- Melee damage is not applied when the swing animation begins (`startSwing`) but at a specific keyframe: `SWING_IMPACT` ms (210 ms) into the animation for the hammer, 200 ms for the katana. This ties the damage window to the visual moment of contact, making the feel accurate.
- `hero.meleeArc` (radians from centre) is unique per hero. Titan has `0.7` rad (~40°), Kage has `0.88` rad (~50°) — wider arc for the slashing katana vs. the focused hammer strike.
- Normalising the angle into `(−π, π)` before comparing `Math.abs(ang) > arc` avoids the angle-wrapping bug where an enemy directly behind the player (angle ≈ ±π) could be wrongly included.

---

### 6. Screen Shake & Recoil

**Where:** `loop()` decay · `attack()` and `applyMelee()` trigger · `render()` apply

```js
// Trigger (attack)
recoilAmt = 1;
shake = Math.max(shake, hero.weapon === 'sniper' ? 7 : 4);

// Decay every frame (loop)
recoilAmt = Math.max(0, recoilAmt - dt / 200);
shake     = Math.max(0, shake     - dt / 26);

// Apply (render) — translate before drawing the world
const sx = shake ? (Math.random() - 0.5) * shake : 0;
const sy = shake ? (Math.random() - 0.5) * shake : 0;
ctx.save();
ctx.translate(sx, sy);
// … draw world …
ctx.restore();

// Weapon recoil (drawWeapon / drawRifle)
ctx.translate(8, recoilAmt * 42);   // push weapon down on recoil
ctx.rotate(tilt - recoilAmt * 0.13);
```

**Why this approach:**
- `shake` drives random pixel offsets applied to the **world layer only** (`ctx.save/restore` wrap), so the HUD and weapon model are unaffected and always readable.
- Linear decay (`value - dt/constant`) is simpler than spring physics and produces the right feel: a sharp initial jolt that quickly settles. `dt` keeps the decay frame-rate-independent.
- `Math.max(shake, newValue)` means overlapping hits accumulate without a hard reset, so rapid gunfire produces sustained shake rather than resetting to 0 between each shot.
- Recoil moves the weapon **downward** (`+y`) and rotates the muzzle up, matching how real firearms behave. The `_easeIn`/`_easeOut` helpers used in swing animations are not needed here because linear decay already gives the right feel.

---

### 7. Weapon View-Model Animation System

**Where:** `drawWeapon()` · `drawRifle()` · `drawSniper()` · `drawHammer()` · `drawKatana()`

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

**Why this approach:**
- Setting the Canvas origin to **bottom-centre of the screen** (`ctx.translate(W*0.5, H)`) means all weapon geometry is drawn in a local coordinate system where X=0 is the screen centre and upward is negative Y. This keeps weapon coordinates intuitive and consistent across any viewport size.
- `Math.sin(now * freq)` oscillators give persistent, smooth sway without needing any state variables beyond `performance.now()`. Different frequencies for X/Y sway prevent the motion from looking mechanical.
- The `amp` multiplier increases sway amplitude during movement, mimicking the bobbing of a carried weapon. At idle `amp = 0.4` gives a subtle breathing motion.
- **`_easeIn`** (accelerating) is used for the **strike phase** of a swing — the weapon accelerates into the hit. **`_easeOut`** (decelerating) is used for **windup and recovery** — it snaps to the apex then gently returns. This asymmetry is the key to making melee feel weighty.

---

### 8. Hammer Overhead Slam Animation

**Where:** `drawHammer(now)`

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

**Why this approach:**
- Encoding the hammer pose as a single **angle `a`** from a pivot point means the entire weapon (handle + head + hands) moves correctly with one variable. There is no need to separately track handle position and head position.
- Three keyframes (idle → windup → slam → recovery) with different easing curves give the swing its visual weight: `_easeOut` for the windup feels like lifting something heavy; `_easeIn` for the slam feels like it's pulled down by gravity.
- The motion blur arc is drawn at `r = L` (handle length) centred on the pivot, sweeping the exact angle range of the slam. This traces the path the hammer head actually travels, giving an accurate motion blur effect with just one `ctx.arc` call.
- Damage (`applyMelee`) fires at `SWING_IMPACT = 210ms`, which falls inside the `_easeIn` slam phase when the head is visually close to the enemy — matching sound-design instinct that impact should occur when the animation looks right.

---

### 9. Katana Samurai Swing — 袈裟斬り (Kesa-giri)

**Where:** `drawKatana(now)` · `loop()` dynamic impact timing

```js
// Three animation phases, same single-angle system as hammer
let a = 0.28 + Math.sin(now * 0.0018) * 0.03;  // chudan idle (中段)

if (swingT && now - swingT < KATANA_MS) {
  const t = (now - swingT) / KATANA_MS;
  if      (t < 0.20) a = _lerp( 0.28,  0.82, _easeOut(t / 0.20));         // jodan (上段)
  else if (t < 0.52) a = _lerp( 0.82, -2.00, _easeIn((t-0.20) / 0.32));   // kesa-giri strike
  else               a = _lerp(-2.00,  0.28, _easeOut((t-0.52) / 0.48));  // return to chudan
}

// Curved blade — 22 steps with sine offset for authentic katana curvature
for (let i = 0; i <= 22; i++) {
  const tb = i/22, curve = Math.sin(tb * Math.PI) * 6;  // peak curve at midpoint
  const bx = px + dx*(handleL + tb*(bladeL-handleL)) + dy*curve;
  const by = py + dy*(handleL + tb*(bladeL-handleL)) - dx*curve;
}

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

**Why this approach:**
- The curved blade is drawn with a **22-step polyline** where each vertex is offset by `Math.sin(t·π)·6` perpendicular to the blade direction. A sine gives maximum curvature at the mid-blade and zero curvature at both ends — exactly matching the geometry of a real katana (shinogi-zukuri profile).
- The **hamon** (temper line) uses a high-frequency sine (`Math.PI * 9`, giving 4.5 full waves over the blade length) at very low amplitude (1.8 px) and low opacity (0.48). This is physically accurate: the hamon in a real sword is a 1–3mm crystalline boundary visible as a wavy bright line.
- The katana uses a **different impact timing** (200 ms) from the hammer (210 ms) via a dynamic constant in `loop()`. The katana's `_easeIn` acceleration peaks earlier in its shorter total duration (500 ms vs. 420 ms), so 200 ms correctly aligns damage with the visual cut.
- Two separate hand positions (`px+dx*(-8)` for the right hand near the guard, `px-dx*32` for the left hand near the pommel) implement the **two-handed grip** characteristic of Japanese sword technique (kenjutsu).

---

### 10. Sniper ADS Scope Overlay — `evenodd` Fill Rule

**Where:** `drawScopeOverlay()`

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

**Why this approach:**
- The **`evenodd` fill rule** is the key to the circular cutout with zero clipping masks. The rule fills a region if a test point is enclosed by an odd number of path contours. The screen rectangle encloses the centre once; the counter-clockwise circle subtracts one count, giving zero (unfilled) inside the circle. This is a single draw call — no `ctx.clip()`, no compositing.
- Using `ctx.clip()` would require a `ctx.save/restore` pair and would interfere with subsequent canvas state. The `evenodd` approach avoids this entirely.
- Mil-dots are placed at `i × r × 0.12` — at a fixed fraction of the scope radius — so the reticle scales correctly to any window size. The second dot (`i=2`) is slightly larger (3.5 vs 2.2 px) matching the BDC (bullet-drop compensator) convention used in real 4× ACOG and Leupold scopes.
- The vignette gradient starts at `r×0.80` (80% of the scope radius) so it only darkens the outer 20% of the aperture, creating lens edge fall-off without obscuring the aiming area.
- During ADS, the HUD crosshair is hidden via `cross.classList.add('hide')` rather than setting `display:none` on the parent, preserving the element in the DOM so it can be instantly re-shown when the right mouse button is released.

---

### 11. Enemy AI — Line-of-Sight Chase & Probabilistic Fire

**Where:** `updateEnemies(dt, now)`

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

**Why this approach:**
- Enemies use the **same axis-separated collision code** as the player. Sharing one `isWall` function for both means enemy pathing is consistent with player physics — no separate physics system to maintain.
- `blockedByWall` is called once per enemy per frame for line-of-sight, not during movement. This is intentional: enemies can navigate around corners by sliding against walls even without explicit pathfinding. Simple, but effective at the map scale used.
- Probabilistic shooting (55% hit rate, 1100 ms cooldown) creates natural-feeling combat variance without storing complex state. The cooldown is per-enemy (`e.lastShot`) so multiple enemies attack independently.
- The Titan Barrier multiplying damage by `0.3` is applied **inside the enemy AI** rather than in the player damage function. This keeps the barrier logic co-located with where the damage is dealt, making it immediately obvious when reading the AI code.

---

### 12. Iaijutsu Skill — Flash Dash + Arc AOE + Return

**Where:** `iaiSlash()`

```js
function iaiSlash() {
  const ca = Math.cos(player.ang), sa = Math.sin(player.ang);
  const ox = player.x, oy = player.y;  // remember starting position

  // Forward dash — step 0.15 units at a time, stop at wall (max 2.0)
  for (let s = 0.15; s <= 2.0; s += 0.15) {
    const nx = player.x + ca*s, ny = player.y + sa*s;
    if (!isWall(nx, ny)) { player.x = nx; player.y = ny; }
    else break;
  }

  // Arc AOE damage from the dashed position (2.8 unit radius, ±1.15 rad arc)
  for (const e of [...enemies]) {
    const dx = e.x - player.x, dy = e.y - player.y;
    if (Math.hypot(dx, dy) > 2.8) continue;
    let ang = Math.atan2(dy, dx) - player.ang;
    while (ang < -Math.PI) ang += 2*Math.PI;
    while (ang >  Math.PI) ang -= 2*Math.PI;
    if (Math.abs(ang) > 1.15) continue;
    e.hp -= 135;
    if (e.hp <= 0) killEnemy(e);
  }

  // Return to origin — the defining trait of true iaijutsu
  player.x = ox; player.y = oy;

  iaiFlash = performance.now();  // trigger screen slash effect
}
```

**Why this approach:**
- **Three-phase sequence — dash → slash → return**: this matches the actual iaijutsu (居合) principle: draw the blade, cut, and resheath from the exact same stance without moving your feet. The player flashes forward, damages enemies at the dashed position, then snaps back instantly.
- The dash uses **incremental steps of 0.15 units** rather than a single teleport so the same `isWall` check that governs player movement naturally stops the dash at the first wall tile — Kage can never clip through thin walls.
- Saving the origin **before** the dash (`ox, oy`) and restoring it **after** the AOE check means damage is correctly evaluated from the dashed position (reaching enemies up to 2.8 units ahead), while the player always ends up back at the starting point.
- The max dash distance was reduced from 2.5 → **2.0 units** alongside the return mechanic. Without return, a longer dash was needed to feel impactful; with instant return, a shorter dash keeps the skill readable and prevents Kage from accidentally dashing into a wall corner.
- `[...enemies]` spread-copies the array before iteration so that `killEnemy` (which splices the array) does not corrupt the loop.
- `Math.abs(ang) > 1.15` limits the arc to ~±66° — wide enough to catch enemies slightly to the side, narrow enough to require facing the target group.

---

### 13. Missile Projectile & Explosion

**Where:** `launchMissile()` · `updateMissiles(dt)` · `explode(x, y)`

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

**Why this approach:**
- **Sub-step integration** (`stepN = dt/8`) runs the missile physics multiple times per frame when `dt` is large (e.g., a frame spike). Without this, a fast missile could skip over a thin wall in a single frame — the classic "tunnelling" bug. `dt/8` gives roughly 2 steps at 60 fps, which is sufficient.
- `missiles.filter(m => m.alive)` replaces dead missiles at the end of the frame rather than splicing during iteration, avoiding index corruption bugs.
- Explosion damage uses **linear falloff** (`DMG * (1 - d/R)`) — full damage at the centre, zero at the edge. This is the simplest physically intuitive model and avoids the need for a squared falloff parameter that would be harder to balance.
- `blasts` store `{life, max}` so their draw function can compute a normalized `k = 1 - life/max` to drive both expansion radius and opacity fade with a single value.

---

### 14. Ability Cooldown UI

**Where:** `updateAbility(now)` · `#abilBar` DOM element

```js
function updateAbility(now) {
  // Active ability tick (heal)
  if (abilActive) {
    if (hero.abilType === 'heal') player.hp = Math.min(player.maxhp, player.hp + 0.18);
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

**Why this approach:**
- Three boolean states (`abilActive / abilReady / charging`) are collapsed into **one `pct` value** that drives the width of a CSS bar. This means the bar shows meaningful progress in all three states: draining during active use, filling during cooldown, full when ready.
- The heal ability applies `+0.18 HP per frame` inside `updateAbility`, which is called every `requestAnimationFrame` tick. At 60 fps this is ~10.8 HP/s, giving a smooth animated heal rather than an instant jump. (Because it is per frame, not per second, the heal rate scales with the display's frame rate — a known simplification.)
- `hero.abilDur` and `hero.abilCd` are per-hero values defined in the `HEROES` array, so changing cooldown timings requires editing only one place — no magic numbers scattered through the ability code.

---

### 15. Per-Hero Best Records in `localStorage`

**Where:** `getRecords()` · `saveRecords()` · `recordFor()` · `endGame()`

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

**Why this approach:**
- **`try/catch` around every localStorage call** — browsers in private mode or with storage disabled throw `SecurityError` on `localStorage.setItem`. The silent catch prevents an unhandled exception from crashing the game over a non-critical feature.
- The key is versioned (`_v1`) so a future schema change can increment to `_v2` without needing a migration path — old keys are simply ignored.
- Records are stored as a plain object keyed by `hero.id` (`'titan'`, `'spark'`, etc.) rather than an array. This makes lookups O(1) and adding new heroes non-breaking — a new hero's record starts as `{kills:0, time:0}` on first access via the `|| {}` default.
- Kills and time are tracked **independently**: you can have a record kill count from one run and a record survival time from a different run. This is more rewarding than a single combined score.

---

## Roadmap

- [ ] Image sprite assets (replace procedural weapons)
- [ ] Web Audio API — fire, impact, and explosion sounds
- [ ] Diverse enemy types (fast / tanky / ranged)
- [ ] Wave/round system with score multiplier and boss
- [ ] Additional heroes and ability variants
- [ ] Mobile touch controls

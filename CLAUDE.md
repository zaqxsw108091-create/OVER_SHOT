# OVERSHOT — 프로젝트 안내 (Claude Code용)

이 파일은 Claude Code가 프로젝트를 빠르게 이해하도록 돕는 설명서입니다.
새 작업을 시작하면 Claude Code가 이 파일을 자동으로 읽습니다.

## 프로젝트 개요
- 순수 바닐라 JS + HTML5 Canvas로 만든 **1인칭 슈터(레이캐스팅)** 게임입니다.
- 빌드 도구·프레임워크·외부 패키지 없음. `index.html`을 브라우저로 열면 바로 실행됩니다.
- UI 텍스트는 **한국어**로 작성합니다.
- 흐름: 로그인(아이디 입력) → 영웅 선택 → 전투 → 결과(기록 저장).

## 파일 구조
- `index.html` — 화면 구조(섹션: #login, #pick, #game, #over)와 css/js 연결
- `styles.css` — 모든 스타일
- `game.js` — 게임 로직 전부 (아래 "코드 지도" 참고)

## 실행 방법
- `index.html`을 더블클릭하거나 브라우저로 열면 됩니다. 서버 불필요.
- 기록 저장(localStorage)을 확실히 테스트하려면 로컬 서버로 여는 것이 안전합니다.

## game.js 코드 지도 (수정 위치 빠르게 찾기)
- **HEROES 배열** — 영웅 3종(titan/spark/medi)의 스탯·무기·스킬 정의.
  - 밸런스(체력 hp, 이동속도 speed, 공격속도 fireRate, 데미지 dmg, 탄약 ammo,
    근접범위 meleeRange, 스킬 쿨다운 abilCd 등)는 전부 여기 숫자만 바꾸면 됩니다.
  - `fireMode`: 'auto'(딜러, 꾹=연사/톡=점사) / 'semi'(힐러, 단발) / 'melee'(탱커, 망치)
  - `abilType`: 'missile'(딜러) / 'barrier'(탱커) / 'heal'(힐러)
- **MAP** — 16x16 문자열 격자. '1'=벽, '0'=빈칸. 맵을 바꾸려면 여기를 수정.
- **상태 변수** — player, ammo, enemies, missiles, blasts, recoilAmt, shake, swingT 등.
- **입력** — keydown/mousedown 핸들러. WASD 이동, 마우스 조준, 좌클릭 공격, R 재장전, E 스킬, Q 메뉴.
- **attack() / meleeSwing 관련** — 사격/근접 공격. 근접은 SWING_IMPACT 시점에 applyMelee()로 타격.
- **useAbility / launchMissile / explode / updateMissiles** — 스킬·미사일·폭발.
- **updateEnemies** — 적 AI(추격·사격·명중확률). 적 체력은 spawnWave에서 hp:60.
- **render()** — 레이캐스팅 렌더(벽/하늘/바닥), 적·미사일·폭발 스프라이트, 화면 흔들림.
- **무기 뷰모델** — drawWeapon → drawRifle / drawSniper / drawHammer.
  - 총은 견착 자세(총구가 화면 중앙으로), 망치는 사선 휘두르기 모션.
  - 손/팔은 drawArm, drawHand 헬퍼로 그림. 애니메이션 헬퍼: _easeIn/_easeOut/_lerp.
- **기록 저장** — getRecords/saveRecords/recordFor (localStorage 키: 'overshot_records_v1').
  영웅별 최고 처치 수·생존 시간을 저장하고 선택 화면·결과 화면에 표시.
- **loop()** — 메인 루프. paused면 업데이트 멈춤(일시정지). endGame()에서 기록 갱신.

## 코딩 컨벤션
- 외부 라이브러리/빌드 단계를 추가하지 않습니다(단일 정적 파일 유지).
- 큰 변경 후에는 브라우저에서 직접 실행해 동작을 확인합니다.
- 변수/함수 이름과 주석은 기존 스타일(한국어 주석)을 따릅니다.

## 다음에 해볼 만한 것 (로드맵)
- 총·망치를 도형이 아닌 **이미지 스프라이트**로 교체해 더 사실적으로 (assets 폴더 추가)
- **사운드** 추가(발사음, 피격음, 폭발음) — Web Audio API 또는 오디오 파일
- **적 종류** 다양화(빠른 적/탱키한 적/원거리 적)
- 웨이브/라운드 시스템, 점수 배율, 보스
- 영웅 추가, 스킬 다양화
- 모바일 터치 조작 지원

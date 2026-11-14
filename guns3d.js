// ═══════════════════════════════════════════════════════════════
//  guns3d.js — 스파크의 자동소총 RAZOR-FX, 메디카의 저격총 LUX-VALOR (1인칭 3D)
//  · 공용 엔진 fp3d.js 위에서 총 모델·탄창·노리쇠·미사일과 두 손이 쥐는 자리를 정의한다
//  · 오른손은 권총 손잡이(검지는 방아쇠), 왼손은 총열 덮개를 아래에서 받침. 재장전 땐 왼손이 탄창으로 내려감
//  · 총 좌표: -z 총구 쪽, +y 위, +x 오른쪽, 원점 = 손잡이 위(방아쇠 근처)
//  · WebGL2가 없으면 ready=false → 게임은 예전 2D 총을 그대로 쓴다
// ═══════════════════════════════════════════════════════════════
const Guns3D = (() => {
  'use strict';
  const { add, sub, mul, mv, norm, rotX } = FP3D.V;
  const { Builder, STEEL } = FP3D;
  const Y = [0,1,0], ZF = [0,0,-1], ZB = [0,0,1];
  const st = { ready:false, failed:false, rifle:null, sniper:null };

  // ── 자동소총 RAZOR-FX: 검은 몸체 + 주황 빛줄, 홀로그램 조준경, 총열 아래 미사일 포드 ──
  const PAL_SPARK = { glove:['#15171a',0,0.8], arm:['#2e3238',0.7,0.42], arm2:['#434851',0.7,0.4], trim:['#ff8a2a',0.3,0.45], steel:STEEL, glow:'#ff8a2a' };
  const OR = '#ff8a2a';
  // 그림판 영역 (512×512)
  const RT = { name:[0,0,1,0.25], pod:[0,0.25,0.5,0.5], mag:[0.5,0.25,0.75,0.75], volta:[0,0.5,0.5,0.625], disp:[0.75,0.25,1,0.5] };
  const RIFLE = {
    grip: [0,-0.03,0.075], gripRot: -0.27,              // 손잡이가 달린 자리와 기울기
    fore: [0,0.03,-0.165], foreR: 0.031,                // 왼손이 받치는 총열 덮개
    mag: [0,-0.055,-0.07], magDown: norm([0,-1,-0.17]), // 탄창 꽂히는 자리와 빠지는 방향
    muzzle: [0,0.03,-0.63], eject: [0.03,0.04,-0.02], pod: [0,-0.062,-0.40],
    sight: [0,0.113,-0.02],                              // 조준경 창 가운데
    tubes: [[-0.027,-0.062],[0,-0.062],[0.027,-0.062]],
  };
  function buildRifle(){
    const b = Builder();
    const BLK = ['#25282e',0.6,0.5], BLK2 = ['#383c44',0.7,0.44], MET = ['#555b65',1,0.38], DK = ['#141518',0.7,0.55];
    const axis = [0,0.03,0];
    // 몸통 (위·아래) + 탄창 끼우는 곳
    b.mat(...BLK2); b.box([0,0.034,-0.03], [0.048,0.062,0.24], 0.008);
    b.mat(...BLK);  b.box([0,-0.012,0.0], [0.044,0.042,0.19], 0.008);
    b.box([0,-0.046,-0.07], [0.040,0.05,0.072], 0.006);
    b.mat(...DK);   b.box([0.0245,0.04,-0.02], [0.002,0.016,0.05]);                        // 탄피 배출구
    // 위쪽 레일 (홈)
    b.box([0,0.068,-0.20], [0.022,0.008,0.50], 0.002);
    for (let z=0.04; z>-0.44; z-=0.02) b.box([0,0.0745,z], [0.024,0.005,0.009]);
    // 총열 덮개 (팔각) + 옆 구멍
    b.mat(...BLK2); b.lathe(axis, ZF, Y, [[0.15,0.026,0.030],[0.156,0.030,0.034],[0.434,0.030,0.034],[0.44,0.026,0.030]], 8);
    b.mat(...DK);
    for (const sx of [-1,1]) for (let z=0.25; z<0.43; z+=0.045){ b.box([sx*0.0302,0.03,-z], [0.003,0.012,0.028], 0.001); b.box([sx*0.022,0.0575,-z], [0.012,0.003,0.028]); }
    // 총열 + 소염기 + 가늠쇠
    b.mat(...MET); b.lathe(axis, ZF, Y, [[0.44,0.0095],[0.565,0.0095]], 12, {smooth:true});
    b.mat('#1a1c20',1,0.4); b.lathe(axis, ZF, Y, [[0.555,0.010],[0.562,0.0145],[0.622,0.0145],[0.63,0.011]], 10, {smooth:true});
    b.mat(...DK); for (const [x,y] of [[0,1],[1,0],[0,-1],[-1,0]]) b.box([x*0.0142,0.03+y*0.0142,-0.592], [x?0.003:0.006, y?0.003:0.006, 0.036]);
    b.mat(...BLK); b.box([0,0.058,-0.415], [0.022,0.024,0.03], 0.004); b.box([0,0.094,-0.415], [0.007,0.05,0.012], 0.002);
    b.box([-0.011,0.085,-0.415], [0.004,0.036,0.018]); b.box([0.011,0.085,-0.415], [0.004,0.036,0.018]);
    // 완충 관 + 개머리판
    b.mat(...MET); b.lathe(axis, ZB, Y, [[0.09,0.016],[0.25,0.016]], 12, {smooth:true});
    b.mat(...BLK); b.box([0,0.026,0.275], [0.042,0.058,0.17], 0.01);
    b.box([0,-0.03,0.315], [0.030,0.06,0.085], 0.008);
    b.mat(...BLK2); b.box([0,-0.004,0.368], [0.046,0.13,0.018], 0.006);
    b.mat('#ffffff',0.3,0.5); b.decal([-0.0215,0.03,0.27], ZB, Y, 0.11, 0.028, RT.volta);
    // 권총 손잡이 (기울어 있음) + 방아쇠울 + 방아쇠
    b.at(rotX(RIFLE.gripRot), RIFLE.grip, () => {
      b.mat('#1a1c20',0.2,0.75); b.box([0,-0.056,0], [0.032,0.116,0.046], 0.009);
      b.mat(...DK); for (let y=-0.02; y>-0.1; y-=0.013) b.box([0,y,0.0235], [0.034,0.004,0.002]);
    });
    b.mat(...BLK); b.box([0,-0.066,0.018], [0.008,0.004,0.07]); b.box([0,-0.05,-0.016], [0.008,0.034,0.004]);
    b.mat(...STEEL); b.box([0,-0.046,0.026], [0.006,0.026,0.006], 0.002);
    // 홀로그램 조준경: 받침 + 양옆 벽 + 지붕 (가운데 창은 뚫려 있음) + 뒤 배터리 통 + 옆 초록 화면
    b.mat(...BLK); b.box([0,0.082,-0.02], [0.042,0.014,0.085], 0.003);
    for (const sx of [-1,1]) b.box([sx*0.0215,0.113,-0.02], [0.005,0.05,0.06], 0.002);
    b.box([0,0.1405,-0.02], [0.048,0.006,0.06], 0.002);
    b.mat(...BLK2); b.box([0,0.094,0.038], [0.04,0.03,0.03], 0.006);
    b.mat('#c8ff3a',0,0.3,1.8,3); b.box([-0.0245,0.118,-0.02], [0.002,0.016,0.03]);
    // 주황 빛줄 + 파란 표시등 (왼쪽 옆면 — 화면에 보이는 쪽)
    b.mat(OR,0,0.3,2.4,1); b.box([-0.0245,0.022,-0.05], [0.002,0.004,0.17]); b.box([-0.0225,-0.004,0.03], [0.002,0.004,0.10]);
    b.box([0.0245,0.022,-0.05], [0.002,0.004,0.17]);
    b.mat('#3aa8ff',0,0.3,2.2,1); b.box([-0.0245,0.046,-0.12], [0.002,0.008,0.014]);
    b.mat('#ffffff',0.4,0.5); b.decal([-0.0246,0.0,0.0], ZB, Y, 0.15, 0.0375, RT.name);
    // 미사일 포드: 걸이 + 몸통 + 발사관 3개 + 옆면 발사 고리·글자
    b.mat(...BLK); b.box([0,-0.012,-0.30], [0.03,0.024,0.09], 0.004);
    b.mat(...BLK2); b.box([0,-0.062,-0.30], [0.090,0.076,0.15], 0.013);
    b.mat(...DK);
    for (const [x,y] of RIFLE.tubes) b.lathe([x,y,-0.3745], ZF, Y, [[0,0.0135],[0.002,0.0135]], 12, {smooth:true});
    b.box([0,-0.062,-0.222], [0.07,0.05,0.008], 0.003);
    for (const sx of [-1,1]){
      b.mat(...DK); b.lathe([sx*0.0452,-0.062,-0.262], [sx,0,0], Y, [[0,0.024],[0.003,0.024]], 16, {smooth:true});
      b.mat(OR,0,0.3,2.6,2); b.lathe([sx*0.0482,-0.062,-0.262], [sx,0,0], Y, [[0,0.019],[0.002,0.019],[0.002,0.013],[0,0.013]], 20, {smooth:true, cap0:false, cap1:false});
      b.mat('#ffffff',0.4,0.5); b.decal([sx*0.0456,-0.062,-0.33], [0,0,-sx], Y, 0.07, 0.035, RT.pod);
    }
    return b.data();
  }
  function buildRifleMag(){            // 원점 = 꽂히는 자리, 아래로 뻗음 (조금 앞으로 휨)
    const b = Builder();
    b.at(rotX(0.17), [0,0,0], () => {
      b.mat('#2b2e35',0.6,0.5); b.box([0,-0.075,0], [0.026,0.19,0.058], 0.006);
      b.mat('#141518',0.7,0.55); b.box([0,-0.172,0], [0.031,0.014,0.064], 0.004);
      b.mat('#ffffff',0,0.4,1.5); b.decal([-0.0132,-0.085,0], ZB, Y, 0.045, 0.09, RT.mag);
      b.decal([0.0132,-0.085,0], ZF, Y, 0.045, 0.09, RT.mag);
    });
    return b.data();
  }
  function buildMissile(){             // 원점 = 꼬리, -z로 뻗음
    const b = Builder();
    b.mat('#5a606a',1,0.4); b.lathe([0,0,0], ZF, Y, [[0,0.009],[0.006,0.0115],[0.105,0.0115]], 12, {smooth:true});
    b.mat(OR,0.3,0.4);      b.lathe([0,0,0], ZF, Y, [[0.105,0.0115],[0.125,0.008],[0.142,0]], 12, {smooth:true, cap0:false});
    b.mat(OR,0,0.3,0.9,2);  b.lathe([0,0,0], ZF, Y, [[0.088,0.0119],[0.094,0.0119]], 12, {smooth:true, cap0:false, cap1:false});
    return b.data();
  }
  function buildCharge(){              // 장전 손잡이 (재장전 끝에 당김)
    const b = Builder();
    b.mat('#30343b',0.8,0.45); b.box([0,0.062,0.092], [0.058,0.01,0.022], 0.003);
    return b.data();
  }

  // ── 저격총 LUX-VALOR: 흰·파랑 몸체, 하늘색 회복약이 흐르는 유리관, 금장 총구와 결정 ──
  const PAL_MEDI = { glove:['#22324d',0,0.75], arm:['#e6ebf2',0.3,0.34], arm2:['#3a6fd4',0.6,0.32], trim:['#d6a23c',1,0.32], steel:['#c9d2de',1,0.3], glow:'#5fe6ff' };
  const CY = '#4fd8ff';
  const ST = { name:[0,0,1,0.25], heal:[0,0.25,0.5,0.5], disp:[0.5,0.25,1,0.5], agent:[0,0.5,0.5,0.625] };
  const SNIPER = {
    grip: [0,-0.028,0.088], gripRot: -0.30,
    fore: [0,0.016,-0.27], foreR: 0.034,
    mag: [0,-0.03,-0.065], magDown: [0,-1,0],
    muzzle: [0,0.035,-0.97], eject: [0.035,0.04,0.04],
    bolt: [0.062,0.04,0.075],                           // 노리쇠 손잡이 (오른손이 가서 당김)
    scope: [0,0.127,0.105],                             // 조준경 접안 렌즈
  };
  function buildSniper(){
    const b = Builder();
    const WHT = ['#e9eef5',0.25,0.34], BLU = ['#2f66c8',0.6,0.34], NAVY = ['#1c2f55',0.8,0.36], GOLD = ['#d6a23c',1,0.3], DK = ['#101622',0.6,0.5];
    const axis = [0,0.035,0];
    const tube = (o, dir, t0, t1, r, grp) => {            // 빛나는 유리관 + 양 끝 마개 + 가운데 띠
      b.mat(CY,0,0.2,1.25,grp); b.lathe(o, dir, Y, [[t0,r],[t1,r]], 14, {smooth:true, cap0:false, cap1:false});
      b.mat(...WHT); b.lathe(o, dir, Y, [[t0-0.014,r+0.003],[t0+0.004,r+0.004]], 12, {smooth:true}); b.lathe(o, dir, Y, [[t1-0.004,r+0.004],[t1+0.014,r+0.003]], 12, {smooth:true});
      b.mat(...GOLD); b.lathe(o, dir, Y, [[(t0+t1)/2-0.004,r+0.0025],[(t0+t1)/2+0.004,r+0.0025]], 12, {smooth:true, cap0:false, cap1:false});
    };
    // 몸통 + 파란 아랫배 + 위 레일
    b.mat(...WHT); b.box([0,0.03,-0.04], [0.058,0.09,0.34], 0.014);
    b.mat(...BLU); b.box([0,-0.019,-0.04], [0.05,0.02,0.30], 0.006); b.box([0,0.079,-0.05], [0.030,0.012,0.31], 0.003);
    for (const sx of [-1,1]){
      tube([sx*0.031,0.036,0.07], ZF, 0.03, 0.21, 0.019, 1);                                   // 옆 유리관
      b.mat(...NAVY); b.box([sx*0.0295,0.0,-0.04], [0.003,0.012,0.26]);
      b.mat('#ffffff',0.2,0.45); b.decal([sx*0.0296,0.0,0.105], [0,0,sx>0?-1:1], Y, 0.12, 0.03, ST.name);
      b.mat(CY,0,0.3,2.0,3); for (let z=-0.23; z>-0.37; z-=0.03) b.box([sx*0.0262,0.046,z], [0.002,0.01,0.018]);   // 앞쪽 통풍구 빛
    }
    // 앞 손받이
    b.mat(...WHT); b.box([0,0.022,-0.30], [0.052,0.066,0.20], 0.012);
    b.mat(...BLU); b.box([0,-0.014,-0.30], [0.044,0.014,0.18], 0.005);
    // 총열 + 금장 총구 + 하늘색 결정 + 두 갈래 끝
    b.mat(...NAVY); b.lathe(axis, ZF, Y, [[0.39,0.015],[0.43,0.0115],[0.85,0.0105]], 14, {smooth:true});
    b.mat(...GOLD); b.lathe(axis, ZF, Y, [[0.845,0.013],[0.852,0.019],[0.868,0.019],[0.875,0.014]], 10, {smooth:true});
    b.mat('#bff3ff',0,0.2,1.6,2); b.lathe(axis, ZF, Y, [[0.875,0.0125],[0.905,0.0125]], 12, {smooth:true, cap0:false, cap1:false});
    b.mat(...GOLD); b.lathe(axis, ZF, Y, [[0.905,0.014],[0.912,0.018],[0.922,0.018],[0.93,0.012]], 10, {smooth:true});
    for (const sy of [-1,1]) b.box([0,0.035+sy*0.0145,-0.95], [0.009,0.006,0.05], 0.002);
    b.mat('#bff3ff',0,0.2,1.8,2); b.box([0,0.035,-0.945], [0.006,0.012,0.022], 0.003);
    // 조준경: 받침 2개 + 통 + 대물 렌즈(앞, 하늘색) + 접안 렌즈(뒤) + 조절 손잡이 + 옆 화면
    const sc = [0,0.127,0];
    b.mat(...BLU); b.box([0,0.094,-0.085], [0.022,0.022,0.024], 0.004); b.box([0,0.094,0.045], [0.022,0.022,0.024], 0.004);
    b.mat(...WHT); b.lathe(sc, ZF, Y, [[-0.105,0.024],[-0.095,0.028],[-0.06,0.028],[-0.05,0.024],[0.125,0.024],[0.145,0.034],[0.215,0.034],[0.222,0.031]], 16, {smooth:true, cap0:false, cap1:false});
    b.mat(...GOLD); b.lathe(sc, ZF, Y, [[0.212,0.0345],[0.220,0.0345]], 16, {smooth:true, cap0:false, cap1:false});
    b.mat('#8fe9ff',0,0.15,1.5,3); b.lathe(sc, ZF, Y, [[0.214,0.030],[0.2145,0.030]], 16, {smooth:true});
    b.mat('#0b1a30',0.4,0.2,0.0); b.lathe(sc, ZF, Y, [[-0.103,0.022],[-0.1025,0.022]], 14, {smooth:true});
    b.mat(...GOLD); b.lathe([0,0.151,-0.02], Y, ZB, [[0,0.011],[0.014,0.011],[0.016,0.009]], 10, {smooth:true});
    b.lathe([0.024,0.127,-0.02], [1,0,0], Y, [[0,0.010],[0.012,0.010]], 10, {smooth:true});
    b.mat(...WHT); b.box([-0.034,0.127,-0.035], [0.012,0.044,0.075], 0.004);
    b.mat('#ffffff',0,0.3,1.5); b.decal([-0.0402,0.127,-0.035], ZB, Y, 0.066, 0.034, ST.disp);
    // 개머리판 + 뺨 받침 유리 통 + 뒤 패드
    b.mat(...WHT); b.box([0,0.012,0.245], [0.05,0.086,0.22], 0.014);
    b.mat(...BLU); b.box([0,-0.02,0.30], [0.036,0.05,0.10], 0.008);
    tube([0,0.066,0.15], ZB, 0.03, 0.17, 0.021, 1);
    b.mat(...BLU); b.box([0,0.008,0.364], [0.054,0.12,0.02], 0.007);
    b.mat(...GOLD); b.box([0,0.008,0.352], [0.056,0.124,0.004]);
    b.mat('#ffffff',0.2,0.45); b.decal([-0.0256,0.0,0.27], ZB, Y, 0.12, 0.03, ST.agent);
    // 손잡이 + 방아쇠울 + 방아쇠
    b.at(rotX(SNIPER.gripRot), SNIPER.grip, () => {
      b.mat(...WHT); b.box([0,-0.052,0], [0.034,0.108,0.046], 0.010);
      b.mat(...BLU); b.box([0,-0.052,0.0225], [0.026,0.08,0.003]);
    });
    b.mat(...BLU); b.box([0,-0.064,0.024], [0.008,0.004,0.07]); b.box([0,-0.048,-0.012], [0.008,0.034,0.004]);
    b.mat(...GOLD); b.box([0,-0.044,0.03], [0.006,0.026,0.006], 0.002);
    b.mat(...DK); b.box([0.0295,0.04,0.03], [0.002,0.016,0.07]);                             // 탄피 배출구
    return b.data();
  }
  function buildSniperMag(){
    const b = Builder();
    b.mat('#e9eef5',0.25,0.34); b.box([0,-0.05,0], [0.030,0.11,0.07], 0.007);
    b.mat('#2f66c8',0.6,0.34);  b.box([0,-0.108,0], [0.034,0.012,0.076], 0.004);
    b.mat('#ffffff',0,0.3,1.4); b.decal([-0.0152,-0.05,0], ZB, Y, 0.06, 0.06, ST.heal); b.decal([0.0152,-0.05,0], ZF, Y, 0.06, 0.06, ST.heal);
    return b.data();
  }
  function buildBolt(){                // 노리쇠 손잡이 (쏜 뒤 당겼다 밀어 넣음). 원점 = 총 원점
    const b = Builder();
    b.mat('#c9d2de',1,0.3); b.box([0.040,0.04,0.075], [0.03,0.011,0.012], 0.003);
    b.mat('#d6a23c',1,0.3); b.lathe([0.052,0.04,0.075], [1,0,0], Y, [[0,0.008],[0.004,0.0125],[0.016,0.0125],[0.02,0.008]], 10, {smooth:true});
    return b.data();
  }
  // 메디카 팔뚝: 손등 쪽에 회복약이 도는 유리 창
  const mediFore = b => { b.mat(CY,0,0.2,1.3,1); b.box([0,0.0525,0.118], [0.03,0.004,0.07], 0.001); };

  // ── 그림판 ────────────────────────────────────────────────
  const F = 'Orbitron, "Arial Black", Arial, sans-serif';
  function paintRifle(g, ammo, max){
    const c = g.cv, x = c.getContext('2d');
    if (g.ammo == null){
      x.fillStyle = '#25282e'; x.fillRect(0,0,512,512);
      x.textBaseline = 'middle'; x.fillStyle = '#d5dbe4';
      x.font = '900 60px '+F; x.fillText('RAZOR-FX', 20, 50); x.font = '700 22px '+F; x.fillStyle = '#9aa3b0'; x.fillText('ASSAULT RIFLE · MK IV', 22, 102);
      x.fillStyle = '#383c44'; x.fillRect(0,128,256,128); x.fillStyle = '#d5dbe4'; x.font = '900 44px '+F; x.fillText('MISSILE', 16, 172); x.fillText('POD', 16, 222);
      x.fillStyle = '#25282e'; x.fillRect(0,256,256,64); x.fillStyle = '#aab2be'; x.font = '700 34px '+F; x.fillText('VOLTA R&D', 12, 290);
    }
    // 탄창 창 (256,128)-(384,384): 남은 탄 수만큼 주황 칸이 켜짐
    x.fillStyle = '#0c0d10'; x.fillRect(256,128,128,256);
    const lit = Math.ceil((max ? ammo/max : 0)*10);
    for (let i=0;i<10;i++){ x.fillStyle = i < lit ? '#ff8a2a' : '#2a1a10'; x.fillRect(296, 318-i*18, 48, 12); }
    x.fillStyle = '#7fc4ff'; x.font = '900 30px '+F; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ammo+'/'+max, 320, 356); x.textAlign = 'left';
    g.ammo = ammo; g.tex = FP3D.texture(c, g.tex);
  }
  function paintSniper(g){
    const c = g.cv, x = c.getContext('2d');
    x.fillStyle = '#e9eef5'; x.fillRect(0,0,512,512);
    x.textBaseline = 'middle'; x.fillStyle = '#1f4fa8';
    x.font = '900 56px '+F; x.fillText('LUX-VALOR', 20, 50); x.font = '700 24px '+F; x.fillStyle = '#3f86d8'; x.fillText('BIO-SNIPER · HEAL UNIT', 22, 100);
    // 회복 탄 표시 (0,128)-(256,256): 하늘색 십자
    x.fillStyle = '#0d2038'; x.fillRect(0,128,256,128);
    x.fillStyle = '#6fe8ff'; x.fillRect(108,150,40,84); x.fillRect(86,172,84,40);
    // 조준경 옆 화면 (256,128)-(512,256): 심박 그래프
    x.fillStyle = '#062033'; x.fillRect(256,128,256,128);
    x.strokeStyle = '#6fe8ff'; x.lineWidth = 5; x.beginPath(); x.moveTo(266,196);
    for (const [px,py] of [[310,196],[326,168],[344,226],[362,150],[380,196],[430,196]]) x.lineTo(px,py);
    x.stroke(); x.fillStyle = '#6fe8ff'; x.fillRect(452,170,14,52); x.fillRect(433,189,52,14);
    x.fillStyle = '#e9eef5'; x.fillRect(0,256,256,64); x.fillStyle = '#3f86d8'; x.font = '700 26px '+F; x.fillText('RESTORATIVE AGENT', 6, 290);
    g.tex = FP3D.texture(c, g.tex);
  }

  function load(){
    if (st.ready || st.failed) return;
    try {
      if (!FP3D.init()) throw new Error('WebGL2 없음');
      const M = FP3D.mesh, cv = () => { const c = document.createElement('canvas'); c.width = c.height = 512; return c; };
      st.rifle = { cv: cv(), tex: null, ammo: null, body: M(buildRifle()), mag: M(buildRifleMag()), missile: M(buildMissile()), charge: M(buildCharge()),
        handR: M(FP3D.buildHand(-1, PAL_SPARK, {R:0.022, trigger:true})), handL: M(FP3D.buildHand(1, PAL_SPARK, {R:RIFLE.foreR})),
        fore: M(FP3D.buildForearm(PAL_SPARK, null, 0.78)), upper: M(FP3D.buildUpper(PAL_SPARK, 0.78)) };
      st.sniper = { cv: cv(), tex: null, body: M(buildSniper()), mag: M(buildSniperMag()), bolt: M(buildBolt()),
        handR: M(FP3D.buildHand(-1, PAL_MEDI, {R:0.022, trigger:true})), handL: M(FP3D.buildHand(1, PAL_MEDI, {R:SNIPER.foreR})),
        fore: M(FP3D.buildForearm(PAL_MEDI, mediFore, 0.76)), upper: M(FP3D.buildUpper(PAL_MEDI, 0.76)) };
      paintRifle(st.rifle, 30, 30); paintSniper(st.sniper);
      st.ready = true;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.ready){ const a = st.rifle.ammo; st.rifle.ammo = null; paintRifle(st.rifle, a, 30); paintSniper(st.sniper); } });
    } catch(e){
      st.failed = true;
      console.warn('[Guns3D] 3D 총을 준비하지 못해 2D 총을 씁니다:', e && e.message);
    }
  }

  const lerp3 = (a, b, u) => [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u];
  // 총 + 두 팔 그리기
  //  kind: 'rifle' | 'sniper',  P: FP3D.aim()으로 만든 자세 {p, R}
  //  o.magDy: 탄창이 빠진 거리(m), o.magShow: 탄창 보임, o.hand: 왼손이 탄창으로 간 정도(0~1), o.pull: 장전 손잡이·노리쇠 당긴 정도(0~1)
  //  o.boltHand: (저격총) 오른손이 노리쇠로 간 정도, o.charge: (소총) 미사일 충전 0~1, o.podKick: 포드 반동(m)
  //  o.E: 발광 묶음 밝기, o.front: 총구 화염 빛, o.ammo/o.maxammo: 탄창 창 숫자
  //  돌려주는 값: 화면 좌표 {muzzle, eject, pod, sight, scale}
  function draw(ctx, kind, P, o = {}){
    if (!st.ready || !FP3D.ready) return null;
    const g = st[kind], D = kind === 'rifle' ? RIFLE : SNIPER, R = P.R;
    const T = [P.p[0]-FP3D.narrow(ctx), P.p[1], P.p[2]], at = q => add(mv(R, q), T), dir = v => mv(R, v);
    if (kind === 'rifle' && o.ammo != null && o.ammo !== g.ammo) paintRifle(g, o.ammo, o.maxammo || 30);
    const items = [{ m: g.body, R, T }];
    const magDy = o.magDy || 0, magAt = add(D.mag, mul(D.magDown, magDy));
    if (o.magShow !== false) items.push({ m: g.mag, R, T: at(magAt) });
    if (kind === 'rifle'){
      items.push({ m: g.charge, R, T: at([0,0,(o.pull||0)*0.045]) });
      const ch = Math.max(0, Math.min(1, o.charge ?? 1));
      for (const [x,y] of D.tubes) items.push({ m: g.missile, R, T: at([x, y, -0.262-ch*0.03+(o.podKick||0)]), tint: [0.45+0.55*ch, 0.45+0.55*ch, 0.45+0.55*ch] });
    } else items.push({ m: g.bolt, R, T: at([0,0,(o.pull||0)*0.06]) });
    // 오른손: 손잡이 (저격총은 쏜 뒤 노리쇠로 갔다가 돌아옴)
    const gy = mv(rotX(D.gripRot), Y), gp = add(D.grip, mul(gy, -0.058));
    let rp = gp, ry = gy;
    if (kind === 'sniper' && o.boltHand > 0){ const u = o.boltHand; rp = lerp3(gp, add(D.bolt, [0.01,-0.01,(o.pull||0)*0.06]), u); ry = norm(lerp3(gy, [0.25,1,0], u)); }
    FP3D.arm(items, 1, at(rp), dir(ry), { hand: g.handR, fore: g.fore, upper: g.upper, fixedX: dir([0.12,-0.25,1]),
      shoulder: [0.20-FP3D.narrow(ctx)*0.5, -0.215, 0.16], hint: [0.6,-0.75,0.3] });
    // 왼손: 총열 덮개를 받침 (재장전 땐 탄창 아래로)
    const h = o.hand || 0, lp = lerp3(D.fore, add(magAt, mul(D.magDown, kind === 'rifle' ? 0.215 : 0.15)), h);
    FP3D.arm(items, -1, at(lp), dir(ZF), { hand: g.handL, fore: g.fore, upper: g.upper,
      shoulder: [-0.21-FP3D.narrow(ctx)*0.5, -0.24, 0.12], hint: [-0.7,-0.7,0.2] });
    FP3D.draw(ctx, items, { tex: g.tex, E: o.E, front: o.front });
    const S = q => FP3D.screen(ctx, at(q));
    return { muzzle: S(D.muzzle), eject: S(D.eject), pod: D.pod ? S(D.pod) : null, sight: D.sight ? S(D.sight) : null,
             scale: FP3D.pxPerM(ctx, at(D.muzzle)[2]) };
  }

  return { load, draw, RIFLE, SNIPER, get ready(){ return st.ready && FP3D.ready; }, get failed(){ return st.failed; } };
})();

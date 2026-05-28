// ============================================================
//  puzzle.js
//  퍼즐 방 로직 — 헬테이커 스타일
//
//  [ 타일 종류 ]
//  0 : 빈 칸       — 자유롭게 이동 가능
//  1 : 흰 벽       — 모든 속성 통과 불가 (이동 자체 불가)
//  2 : 불 바이러스 — 불 속성만 통과 가능, 나머지는 게임 오버
//  3 : 물 바이러스 — 물 속성만 통과 가능, 나머지는 게임 오버
//  4 : 풀 바이러스 — 풀 속성만 통과 가능, 나머지는 게임 오버
//  5 : 파일 아이콘 — 닿으면 방 클리어
//
//  [ 외부에서 사용하는 함수 ]
//  PUZZLE.init(config)      — main.js 에서 방 진입 시 호출
//  PUZZLE.draw()            — main.js draw() 에서 매 프레임 호출
//  PUZZLE.handleKey(key)    — main.js keyPressed() 에서 호출
//
//  [ 퍼즐 클리어/실패 시 ]
//  클리어 → config.onClear() 호출 (main.js 의 onRoomClear)
//  게임 오버/이동 소진 → 방 처음부터 재시작 (init 재호출 없이 내부 리셋)
// ============================================================

const PUZZLE = (() => {

  // ──────────────────────────────────────────────────────
  //  상수
  // ──────────────────────────────────────────────────────
  const GRID_COLS   = 12;
  const GRID_ROWS   = 12;
  const CELL        = 36;          // 한 칸 크기(px)  12*36 = 432
  const HUD_WIDTH   = 180;         // 오른쪽 HUD 영역 너비

  // 그리드 전체 크기
  const GRID_W = GRID_COLS * CELL; // 432
  const GRID_H = GRID_ROWS * CELL; // 432

  // OFFSET_X/Y — draw() 안에서 매 프레임 width/height 기준으로 계산
  // (전체화면 대응: 창 크기가 바뀌어도 항상 중앙 정렬)
  function _offsetX() { return (width  - GRID_W - HUD_WIDTH) / 2; }
  function _offsetY() { return (height - GRID_H) / 2; }

  // 타일 종류
  const TILE = {
    EMPTY    : 0,
    WALL     : 1,
    VIRUS_F  : 2,   // 불 바이러스
    VIRUS_W  : 3,   // 물 바이러스
    VIRUS_G  : 4,   // 풀 바이러스
    FILE     : 5,
    BUTTON   : 6,   // 버튼 기믹
  };

  // 속성 → 통과 가능한 바이러스 타일
  const PASSABLE = {
    '불': TILE.VIRUS_F,
    '물': TILE.VIRUS_W,
    '풀': TILE.VIRUS_G,
  };

  // 타일 색상
  const TILE_COLOR = {
    [TILE.EMPTY]   : [40,  40,  40 ],
    [TILE.WALL]    : [220, 220, 220],   // 흰 벽
    [TILE.VIRUS_F] : [180, 50,  50 ],   // 불 바이러스 — 빨강
    [TILE.VIRUS_W] : [50,  100, 180],   // 물 바이러스 — 파랑
    [TILE.VIRUS_G] : [80,  160, 60 ],   // 풀 바이러스 — 초록
    [TILE.FILE]    : [255, 220, 50 ],   // 파일 아이콘 — 노랑
    [TILE.BUTTON]  : [101, 67,  33 ],
  };

  // ──────────────────────────────────────────────────────
  //  시연용 퍼즐 맵 (12×12)
  //
  //  설계 원칙:
  //  · 시작점: 열6, 행9  (중앙 하단)
  //  · 파일:   열5, 행1
  //  · 이동 제한: 20회
  //  · 불 전용 경로: 반드시 VIRUS_F(2) 를 통과해야만 위로 올라갈 수 있음
  //  · 물 전용 경로: 반드시 VIRUS_W(3) 를 통과해야만 위로 올라갈 수 있음
  //  · 풀 전용 경로: 반드시 VIRUS_G(4) 를 통과해야만 위로 올라갈 수 있음
  //  · 세 경로 모두 20회 이내 파일 도달 가능
  //
  //  타일: 0=빈칸 1=흰벽 2=불바이러스 3=물바이러스 4=풀바이러스 5=파일
  //  [행][열] 순서
  //
  //  구조 (BFS 검증 완료):
  //  · 파일 1개: 행0 열5
  //  · 시작점:   행10 열5
  //  · 불 터널:  열2 수직, 행3에 불 바이러스  → 16회
  //  · 풀 터널:  열5 수직, 행3에 풀 바이러스  → 10회
  //  · 물 터널:  열8 수직, 행3에 물 바이러스  → 16회
  //  · 행7: 하단 수평통로 (열2~열8)
  //  · 행1: 상단 수평통로 (열2~열8) → 파일 연결
  //  · 모든 경로 20회 이내 도달 가능
  // ──────────────────────────────────────────────────────
  //                0  1  2  3  4  5  6  7  8  9 10 11
  const MAP_INITIAL = [
    /* 행 0 */ [1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1],
    /* 행 1 */ [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1],
    /* 행 2 */ [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
    /* 행 3 */ [1, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1],
    /* 행 4 */ [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
    /* 행 5 */ [1, 1, 6, 1, 1, 6, 1, 1, 6, 1, 1, 1],
    /* 행 6 */ [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
    /* 행 7 */ [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    /* 행 8 */ [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    /* 행 9 */ [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    /* 행10 */ [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    /* 행11 */ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];

  // 런타임에서 실제로 수정되는 맵 (버튼 등으로 변형됨)
  // _reset() 호출 시 MAP_INITIAL 로 복원됨
  let MAP = [];

  // 플레이어 시작 위치 (열, 행)
  const START_X = 5;
  const START_Y = 10;

  // 이동 횟수 제한
  const MOVE_LIMIT = 20;

  // ──────────────────────────────────────────────────────
  //  런타임 상태
  // ──────────────────────────────────────────────────────
  let player   = null;   // main.js 의 player 객체 참조
  let onClear  = null;   // 클리어 시 호출할 콜백 (main.js 의 onRoomClear)
  let roomNumber = 1;    // 현재 방 번호 (HUD 표시용)

  let px, py;            // 현재 플레이어 위치 (열, 행)
  let movesLeft;         // 남은 이동 횟수
  let state;             // 'PLAYING' | 'GAMEOVER' | 'CLEAR'
  let message;           // 화면에 표시할 메시지
  let messageTimer;      // 메시지 표시 타이머 (프레임)

  // ──────────────────────────────────────────────────────
  //  초기화 — main.js 에서 방 진입 시 호출
  //
  //  config = {
  //    player  : player 객체 (character.js 참고)
  //    onClear : 클리어 콜백
  //  }
  // ──────────────────────────────────────────────────────
  function init(config) {
    player     = config.player;
    onClear    = config.onClear;
    roomNumber = config.room ?? 1;   // 방 번호 받기 (없으면 1)
    _reset();
  }

  // 방 처음부터 재시작 — MAP도 초기 상태로 복원
  // 버튼(발판)으로 변형된 맵이 재시작 시 원상복구됨
  function _reset() {
    // MAP_INITIAL 을 깊은 복사해서 MAP 에 덮어씀
    MAP = MAP_INITIAL.map(row => [...row]);

    px           = START_X;
    py           = START_Y;
    movesLeft    = MOVE_LIMIT;
    state        = 'PLAYING';
    message      = '';
    messageTimer = 0;
  }

  // ──────────────────────────────────────────────────────
  //  렌더링 — main.js draw() 에서 매 프레임 호출
  // ──────────────────────────────────────────────────────
  function draw() {
    background(20);

    _drawGrid();
    _drawPlayer();
    _drawHUD();

    // 게임오버 메시지 표시 후 자동 재시작
    if (state === 'GAMEOVER') {
      _drawOverlay('게임 오버', '처음부터 다시 시작합니다...', [200, 50, 50]);
      messageTimer--;
      if (messageTimer <= 0) _reset();
    }

    // 클리어 메시지 (0.5초 후 onClear 로 화면 전환됨)
    if (state === 'CLEAR') {
      _drawOverlay('클리어!', '다음 씬으로 이동합니다...', [50, 200, 100]);
    }
  }

  // ── 그리드 렌더링 ──────────────────────────────────────
  function _drawGrid() {
    noStroke();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const tile = MAP[row][col];
        const c    = TILE_COLOR[tile];
        fill(c[0], c[1], c[2]);
        rect(_offsetX() + col * CELL, _offsetY() + row * CELL, CELL, CELL);

        // 타일 라벨 (빈 칸 제외)
        if (tile === TILE.FILE) {
          // 파일 아이콘 표시
          fill(30);
          textSize(10);
          textAlign(CENTER, CENTER);
          text('FILE', _offsetX() + col * CELL + CELL / 2,
                        _offsetY() + row * CELL + CELL / 2);
        } else if (tile === TILE.VIRUS_F) {
          fill(255, 200, 200);
          textSize(9);
          textAlign(CENTER, CENTER);
          text('불', _offsetX() + col * CELL + CELL / 2,
                     _offsetY() + row * CELL + CELL / 2);
        } else if (tile === TILE.VIRUS_W) {
          fill(200, 230, 255);
          textSize(9);
          textAlign(CENTER, CENTER);
          text('물', _offsetX() + col * CELL + CELL / 2,
                     _offsetY() + row * CELL + CELL / 2);
        } else if (tile === TILE.VIRUS_G) {
          fill(200, 255, 200);
          textSize(9);
          textAlign(CENTER, CENTER);
          text('풀', _offsetX() + col * CELL + CELL / 2,
                     _offsetY() + row * CELL + CELL / 2);
        }

        // 그리드 선
        stroke(60);
        strokeWeight(0.5);
        noFill();
        rect(_offsetX() + col * CELL, _offsetY() + row * CELL, CELL, CELL);
        noStroke();
      }
    }
  }

  // ── 플레이어 렌더링 ────────────────────────────────────
  function _drawPlayer() {
    if (state !== 'PLAYING') return;

    const x = _offsetX() + px * CELL;
    const y = _offsetY() + py * CELL;

    if (player?.sprite) {
      imageMode(CORNER);
      noSmooth();
      image(player.sprite, x, y, CELL, CELL);
    } else {
      // 스프라이트 없을 때 fallback — 속성색 원
      const attrName = player?.attribute?.name;
      if      (attrName === '불') fill(205, 52,  52 );
      else if (attrName === '물') fill(52,  118, 205);
      else if (attrName === '풀') fill(132, 180, 67 );
      else                        fill(200, 200, 200);
      noStroke();
      ellipse(x + CELL / 2, y + CELL / 2, CELL * 0.7, CELL * 0.7);
    }
  }

  // ── HUD (이동 횟수 / 속성 표시) ────────────────────────
  function _drawHUD() {
    const hudX = _offsetX() + GRID_COLS * CELL + 20;
    const oy   = _offsetY();   // 그리드 상단 Y — HUD 기준점

    // 방 번호 (임시 텍스트)
    fill(160);
    textSize(11);
    textAlign(LEFT, TOP);
    text(`ROOM ${roomNumber}`, hudX, oy);

    textAlign(LEFT, TOP);
    fill(220);
    textSize(13);
    text('속성', hudX, oy + 26);

    // 속성 이름 (색상 강조)
    const attrName = player?.attribute?.name ?? '없음';
    if      (attrName === '불') fill(205, 80,  80 );
    else if (attrName === '물') fill(80,  150, 220);
    else if (attrName === '풀') fill(100, 200, 80 );
    else                        fill(200, 200, 200);
    textSize(22);
    text(attrName, hudX, oy + 44);

    // 남은 이동 횟수
    fill(220);
    textSize(13);
    text('남은 이동', hudX, oy + 96);
    fill(255, 220, 50);
    textSize(28);
    text(movesLeft, hudX, oy + 114);

    // 조작 안내
    fill(140);
    textSize(11);
    text('방향키로 이동', hudX, oy + 196);
    text('↑ ↓ ← →', hudX, oy + 214);

    // 속성별 통과 안내
    fill(140);
    textSize(10);
    text('─────────────', hudX, oy + 256);
    text('불  = 빨강 통과', hudX, oy + 274);
    text('물  = 파랑 통과', hudX, oy + 289);
    text('풀  = 초록 통과', hudX, oy + 304);
    text('갈색 = 버튼',     hudX, oy + 319);
    text('흰색 = 통과 불가', hudX, oy + 334);
  }

  // ── 오버레이 메시지 ────────────────────────────────────
  function _drawOverlay(title, sub, col) {
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);

    fill(col[0], col[1], col[2]);
    textSize(28);
    textAlign(CENTER, CENTER);
    text(title, width / 2, height / 2 - 20);

    fill(200);
    textSize(13);
    text(sub, width / 2, height / 2 + 20);
  }

  // ──────────────────────────────────────────────────────
  //  키 입력 처리 — main.js keyPressed() 에서 호출
  // ──────────────────────────────────────────────────────
  function handleKey(k) {
    if (state !== 'PLAYING') return;

    let dx = 0, dy = 0;
    if      (k === 'ArrowUp'   ) dy = -1;
    else if (k === 'ArrowDown' ) dy =  1;
    else if (k === 'ArrowLeft' ) dx = -1;
    else if (k === 'ArrowRight') dx =  1;
    else return;  // 방향키 아니면 무시

    _tryMove(dx, dy);
  }

  // ──────────────────────────────────────────────────────
  //  이동 처리
  // ──────────────────────────────────────────────────────
  function _tryMove(dx, dy) {
    const nx = px + dx;
    const ny = py + dy;

    // 그리드 범위 벗어남 → 무시
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile     = MAP[ny][nx];
    const attrName = player?.attribute?.name;

    // ── 흰 벽: 이동 불가 ────────────────────────────────
    if (tile === TILE.WALL) return;

    // ── 속성 바이러스: 해당 속성이면 통과, 아니면 게임 오버 ──
    if (tile === TILE.VIRUS_F || tile === TILE.VIRUS_W || tile === TILE.VIRUS_G) {
      if (PASSABLE[attrName] === tile) {
        // 통과 가능 — 이동 진행
        _move(nx, ny);
      } else {
        // 게임 오버
        _triggerGameOver();
      }
      return;
    }

    // ── 파일: 클리어 ─────────────────────────────────────
    if (tile === TILE.FILE) {
      px    = nx;
      py    = ny;
      state = 'CLEAR';
      // setTimeout 으로 한 프레임 뒤에 호출
      // → draw() 가 CLEAR 상태를 최소 1프레임 그린 후 화면 전환됨
      // → 즉시 호출하면 onClear → transitionTo → PUZZLE.init → _reset() 으로
      //   state 가 다시 PLAYING 이 되는 버그 발생
      setTimeout(() => { if (onClear) onClear(); }, 500);
      return;
    }

    // ── 빈 칸: 그냥 이동 ─────────────────────────────────
    _move(nx, ny);
  }

  function _move(nx, ny) {
    px = nx;
    py = ny;
    movesLeft--;
      // 버튼 밟았는지 검사
  if(MAP[py][px] === TILE.BUTTON)
  {
    activateButton();
  }

    // 이동 횟수 소진 → 게임 오버
    if (movesLeft <= 0) {
      _triggerGameOver();
    }
  }

  function activateButton()
{
  // 파일 아래 벽 제거
  MAP[1][5] = TILE.EMPTY;
}

  function _triggerGameOver() {
    state        = 'GAMEOVER';
    messageTimer = 120;   // 2초 후 재시작 (60fps 기준)
  }

  // 공개 API
  return { init, draw, handleKey };

})();

// ============================================================
//  pixelEditor.js
//  픽셀 그림판 모듈
//  - drawPixelEditor()   : 매 프레임 그림판 UI 렌더링
//  - handlePixelEditorClick() / handlePixelEditorDrag() : 입력 처리
//  - getEditorResult()   : 완료 시 { grid, dominantColor, attribute } 반환
// ============================================================

// ──────────────────────────────────────────────
//  상수 & 내부 상태 (이 파일 안에서만 직접 접근)
// ──────────────────────────────────────────────
const PE = (() => {
  // 레이아웃
  const ROWS      = 16;
  const COLS      = 16;
  const CELL      = 30;          // 셀 크기(px)
  const OFFSET_X  = 0;           // 그리드 왼쪽 시작 X
  const OFFSET_Y  = 0;           // 그리드 위쪽 시작 Y

  // 팔레트
  // index : 0=지우개(흰색)  1=빨강  2=파랑  3=초록
  const PALETTE = [
    { r:255, g:255, b:255 },   // 0 – 흰색(지우개)
    { r:205, g: 52, b: 52 },   // 1 – 빨강
    { r: 52, g:118, b:205 },   // 2 – 파랑
    { r:132, g:180, b: 67 },   // 3 – 초록
  ];

  // 속성 매핑 (dominantColor index → 캐릭터 속성)
  // character.js 의 ATTRIBUTE_TABLE 키와 반드시 일치해야 함
  // 0(투명/지우개) 은 속성 없음 → null 반환
  const ATTRIBUTES = {
    1: '불',
    2: '물',
    3: '풀',
  };

  // UI 버튼 영역 정의 (rectMode CORNER 기준)
  // { x, y, w, h, action }
  const BUTTONS = [
    { x:575, y: 25, w:50, h:50, action:'color_1'    },  // 빨강
    { x:575, y: 95, w:50, h:50, action:'color_2'    },  // 파랑
    { x:575, y:165, w:50, h:50, action:'color_3'    },  // 초록
    { x:575, y:235, w:50, h:50, action:'color_0'    },  // 흰색(지우개)
    { x:560, y:307, w:80, h:26, action:'clear_all'  },  // 모두 지우기
    { x:510, y:355, w:180, h:110, action:'done'     },  // 완료
  ];

  // ── 내부 상태 ──────────────────────────────
  let grid         = [];
  let currentColor = 0;
  let history      = [];
  let historyIndex = -1;
  let onDone       = null;   // 완료 콜백 (main.js 에서 등록)

  // ──────────────────────────────────────────
  //  초기화
  // ──────────────────────────────────────────
  function init(callback) {
    onDone = callback || null;
    currentColor = 1;          // 기본색: 빨강
    grid = [];
    history = [];
    historyIndex = -1;

    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) row.push(0);
      grid.push(row);
    }
    _saveState();
  }

  // ──────────────────────────────────────────
  //  렌더링 (draw() 에서 호출)
  // ──────────────────────────────────────────
  function draw() {
    background(70);

    // 에디터 전체 콘텐츠 크기: 그리드(480) + 우측 UI(약 200) = 680 x 480
    const EDITOR_W = COLS * CELL + 220;  // 480 + 220 = 700
    const EDITOR_H = ROWS * CELL;        // 480
    const tx = (width  - EDITOR_W) / 2;
    const ty = (height - EDITOR_H) / 2;

    // 이 블록 안의 모든 좌표가 중앙 기준으로 이동
    push();
    translate(tx, ty);

    // ── 그리드 ────────────────────────────
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = PALETTE[grid[y][x]];
        fill(c.r, c.g, c.b);
        stroke(50);
        strokeWeight(0.5);
        rect(
          OFFSET_X + x * CELL,
          OFFSET_Y + y * CELL,
          CELL, CELL
        );
      }
    }
    noStroke();

    // ── 중앙 가이드선 (가로 8번째 줄 아래, 세로 8번째 열 오른쪽) ──
    stroke('#800000');
    strokeWeight(1);
    // 세로 중앙선
    line(OFFSET_X + COLS / 2 * CELL, OFFSET_Y,
         OFFSET_X + COLS / 2 * CELL, OFFSET_Y + ROWS * CELL);
    // 가로 중앙선
    line(OFFSET_X,            OFFSET_Y + ROWS / 2 * CELL,
         OFFSET_X + COLS * CELL, OFFSET_Y + ROWS / 2 * CELL);
    noStroke();

    // ── 팔레트 버튼 ────────────────────────
    rectMode(CENTER);

    // 빨강
    fill(205, 52, 52);
    rect(600, 50, 50, 50);

    // 파랑
    fill(52, 118, 205);
    rect(600, 120, 50, 50);

    // 초록
    fill(132, 180, 67);
    rect(600, 190, 50, 50);

    // 흰색(지우개)
    fill(255);
    rect(600, 260, 50, 50);

    // 모두 지우기 (회색 버튼)
    fill(198, 198, 198);
    rect(600, 320, 80, 25);

    // 완료 버튼 (노랑)
    fill(255, 255, 0);
    rect(600, 410, 180, 110);

    rectMode(CORNER);

    // ── 완료 버튼 텍스트 ──────────────────
    fill(30);
    textSize(14);
    textAlign(CENTER, CENTER);
    text('완  료', 600, 410);

    // 모두 지우기 텍스트
    fill(30);
    textSize(11);
    text('모두 지우기', 600, 320);

    // ── Undo / Redo 화살표 ────────────────
    fill(255, 165, 0);
    // ← Undo
    triangle(490, 50, 520, 35, 520, 65);
    // → Redo
    triangle(560, 50, 530, 35, 530, 65);

    // ── 라벨 ──────────────────────────────
    fill(220);
    textSize(10);
    textAlign(CENTER, TOP);
    text('← UNDO   REDO →', 525, 70);
    text('백신 캐릭터를 그려주세요', 240, 8);

    pop();  // translate 종료 — 이후 좌표는 다시 절대좌표

    // ── 커서 미리보기 (절대 마우스 위치에 표시) ────────────
    const c = PALETTE[currentColor];
    fill(c.r, c.g, c.b, 200);
    noStroke();
    ellipse(mouseX, mouseY, 20, 20);
  }

  // ──────────────────────────────────────────
  //  입력 처리
  // ──────────────────────────────────────────
  function handleClick(mx, my) {
    // translate 오프셋 역변환 — 에디터 내부 좌표로 변환
    const EDITOR_W = COLS * CELL + 220;
    const EDITOR_H = ROWS * CELL;
    const tx = (width  - EDITOR_W) / 2;
    const ty = (height - EDITOR_H) / 2;
    const lx = mx - tx;
    const ly = my - ty;

    // Undo
    if (_inRect(lx, ly, 490, 35, 30, 30)) {
      if (historyIndex > 0) { historyIndex--; grid = _copyGrid(history[historyIndex]); }
      return;
    }
    // Redo
    if (_inRect(lx, ly, 530, 35, 30, 30)) {
      if (historyIndex < history.length - 1) { historyIndex++; grid = _copyGrid(history[historyIndex]); }
      return;
    }

    // 버튼 처리
    for (const btn of BUTTONS) {
      if (_inRect(lx, ly, btn.x, btn.y, btn.w, btn.h)) {
        _handleButtonAction(btn.action);
        return;
      }
    }

    // 그리드 칸 칠하기
    _paintCell(lx, ly);
  }

  function handleDrag(mx, my) {
    const EDITOR_W = COLS * CELL + 220;
    const EDITOR_H = ROWS * CELL;
    const tx = (width  - EDITOR_W) / 2;
    const ty = (height - EDITOR_H) / 2;
    _paintCell(mx - tx, my - ty, true);
  }

  function handleKey(k) {
    const map = { r:1, R:1, b:2, B:2, g:3, G:3, e:0, E:0 };
    if (map[k] !== undefined) currentColor = map[k];
  }

  // ──────────────────────────────────────────
  //  버튼 액션
  // ──────────────────────────────────────────
  function _handleButtonAction(action) {
    if (action.startsWith('color_')) {
      currentColor = parseInt(action.split('_')[1]);
      return;
    }
    if (action === 'clear_all') {
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          grid[y][x] = 0;
      _saveState();
      return;
    }
    if (action === 'done') {
      const result = getResult();

      // 팀원 코드의 getCharacterType() 과 동일:
      // 색을 하나도 안 칠했으면 완료 차단
      if (result.dominantColorIndex === null) {
        alert('한 가지 이상의 색깔을 꼭 사용해주세요.');
        return;
      }

      if (onDone) onDone(result);
      return;
    }
  }

  // ──────────────────────────────────────────
  //  셀 칠하기
  // ──────────────────────────────────────────
  function _paintCell(mx, my, isDrag = false) {
    const x = floor((mx - OFFSET_X) / CELL);
    const y = floor((my - OFFSET_Y) / CELL);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    if (isDrag && grid[y][x] === currentColor) return;
    grid[y][x] = currentColor;
    _saveState();
  }

  // ──────────────────────────────────────────
  //  결과 반환
  //  { grid, dominantColorIndex, attribute, imageDataURL }
  //
  //  imageDataURL : 16×16 픽셀을 오프스크린 canvas에 그린 뒤
  //                 투명 PNG base64로 변환한 값.
  //                 index 0(지우개) 셀은 alpha=0(투명) 처리.
  //                 게임 화면에서 loadImage(imageDataURL) 로 바로 사용 가능.
  //                 교수님이 저장/불러오기 기능 붙일 때
  //                 이 문자열 하나만 DB에 저장하면 됨.
  // ──────────────────────────────────────────
  function getResult() {
    const counts = [0, 0, 0, 0];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        counts[grid[y][x]]++;

    // 흰색(0) 제외하고 가장 많이 쓰인 색
    let dominant = null;
    let maxCount = 0;
    for (let i = 1; i <= 3; i++) {
      if (counts[i] > maxCount) { maxCount = counts[i]; dominant = i; }
    }

    return {
      grid:               _copyGrid(grid),
      dominantColorIndex: dominant,              // null = 색 없음
      attribute:          dominant !== null ? ATTRIBUTES[dominant] : null,
      palette:            PALETTE,
      imageDataURL:       _gridToDataURL(grid),  // 투명 PNG base64
    };
  }

  // ──────────────────────────────────────────
  //  그리드 → 투명 PNG DataURL 변환
  //  오프스크린 <canvas> 를 이용해 p5.js 외부에서 렌더링
  //  index 0 셀 → alpha 0 (투명)
  // ──────────────────────────────────────────
  function _gridToDataURL(src) {
    const cvs = document.createElement('canvas');
    cvs.width  = COLS;   // 16px (1셀 = 1px, 게임에서 scale해서 사용)
    cvs.height = ROWS;
    const ctx  = cvs.getContext('2d');

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const idx = src[y][x];
        if (idx === 0) continue;               // 투명 (fillRect 안 함)
        const c = PALETTE[idx];
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return cvs.toDataURL('image/png');         // base64 PNG
  }

  // ──────────────────────────────────────────
  //  히스토리
  // ──────────────────────────────────────────
  function _saveState() {
    history.splice(historyIndex + 1);
    history.push(_copyGrid(grid));
    historyIndex++;
  }

  function _copyGrid(src) {
    return src.map(row => [...row]);
  }

  // ──────────────────────────────────────────
  //  유틸
  // ──────────────────────────────────────────
  function _inRect(mx, my, rx, ry, rw, rh) {
    return mx >= rx && mx <= rx + rw && my >= ry && my <= ry + rh;
  }

  // 공개 API
  return { init, draw, handleClick, handleDrag, handleKey, getResult, PALETTE, ROWS, COLS, CELL };
})();

// ============================================================
//  main.js
//  게임 전체 상태 머신 & p5.js 진입점
//
//  [ 게임 흐름 ]
//
//  INTRO
//    → PIXEL_EDITOR        (캐릭터 생성)
//    → CHARACTER_CONFIRM   (내 캐릭터 + 속성 확인 화면)
//    → PUZZLE_ROOM         (방 1 → 방 2 → 방 3, 스테이지마다 반복)
//    → STAGE_CLEAR         (의뢰자 사연 컷신)
//    → PIXEL_EDITOR        (다음 스테이지 새 캐릭터) 또는 게임 종료
//
//  [ 상태(currentState) 목록 ]
//  'INTRO'              : 오프닝 컷신 / 타이틀
//  'PIXEL_EDITOR'       : 픽셀 그림판 — 캐릭터(백신) 디자인
//  'CHARACTER_CONFIRM'  : 캐릭터 + 속성 확인 화면 (클릭하면 게임 시작)
//  'PUZZLE_ROOM'        : 퍼즐 방 — 스테이지당 3개 순서대로 진행
//  'STAGE_CLEAR'        : 스테이지 클리어 컷신 / 의뢰자 사연
//
//  [ 추후 파일 분리 계획 ]
//  drawPuzzleRoom()  → puzzle.js
//  drawStageClear()  → story.js
// ============================================================


// ──────────────────────────────────────────────────────────
//  전역 게임 상태
// ──────────────────────────────────────────────────────────
let currentState = 'INTRO';

// ──────────────────────────────────────────────────────────
//  스테이지 / 방 진행 추적
//
//  currentStage : 현재 스테이지 번호 (1부터 시작)
//  currentRoom  : 현재 방 번호 (1 ~ ROOMS_PER_STAGE)
//
//  방을 클리어할 때마다 currentRoom++
//  currentRoom > ROOMS_PER_STAGE 이면 STAGE_CLEAR 로 전환
//  스테이지를 클리어할 때마다 currentStage++, currentRoom = 1 로 리셋
// ──────────────────────────────────────────────────────────
const ROOMS_PER_STAGE = 3;   // 스테이지당 퍼즐 방 수 (변경 시 여기만 수정)
let currentStage = 1;
let currentRoom  = 1;

// ──────────────────────────────────────────────────────────
//  플레이어 캐릭터 인스턴스
//
//  픽셀 에디터 완료 후 createCharacter() 로 생성됨 (character.js 참고)
//  이후 모든 화면에서 player 하나만 참조하면 됨.
//
//  [ 접근 예시 ]
//  player.attribute.name → '불' | '물' | '풀'
//  player.moveCount      → 남은 이동 횟수 (이동 시 player.moveCount--)
//  player.isAlive        → 이동 횟수 소진 시 false → 방 재시작
//  player.sprite         → p5.Image (렌더링용)
//  player.imageDataURL   → base64 PNG (저장/불러오기용)
//
//  [ 교수님 저장/불러오기 연결 방법 ]
//  저장: player.imageDataURL + player.attribute.name 을 DB에 보존
//  복원: loadImage(savedDataURL, img => { player = createCharacter(saved, img); })
// ──────────────────────────────────────────────────────────
let player = null;


// ──────────────────────────────────────────────────────────
//  상태 전환 함수
//
//  사용법: transitionTo('PUZZLE_ROOM')
//  어느 파일에서도 호출 가능 (전역 함수)
//
//  새 상태를 추가할 때:
//  1. switch 에 case 추가 (초기화 코드 작성)
//  2. draw() 의 switch 에 렌더 함수 연결
//  3. mousePressed() / keyPressed() 에 입력 처리 추가
// ──────────────────────────────────────────────────────────
function transitionTo(newState) {
  console.log(`[STATE] ${currentState} → ${newState}`);
  currentState = newState;

  switch (newState) {

    // ── 픽셀 에디터 진입 ────────────────────────────────
    case 'PIXEL_EDITOR':
      // 에디터 초기화 + 완료 콜백 등록
      // 완료 버튼을 누르면 아래 콜백이 실행됨
      PE.init((result) => {

        // base64 PNG → p5.Image 변환 후 캐릭터 인스턴스 생성
        loadImage(result.imageDataURL, (sprite) => {

          player = createCharacter(result, sprite);

          console.log('[Character Created] attribute:', player.attribute?.name);

          // 에디터 완료 → 속성 확인 화면으로 이동
          transitionTo('CHARACTER_CONFIRM');
        });
      });
      break;

    // ── 캐릭터 확인 화면 진입 ───────────────────────────
    // 에디터 완료 직후 표시. 클릭하면 PUZZLE_ROOM 으로 이동.
    case 'CHARACTER_CONFIRM':
      // 별도 초기화 없음 — player 가 이미 채워져 있음
      break;

    // ── 퍼즐 방 진입 ────────────────────────────────────
    case 'PUZZLE_ROOM':
      PUZZLE.init({
        player:  player,
        room:    currentRoom,    // 방 번호 전달 → HUD 표시에 사용
        onClear: onRoomClear,
      });
      break;

    // ── 스테이지 클리어 진입 ────────────────────────────
    case 'STAGE_CLEAR':
      // TODO: story.js 구현 후 아래 주석 해제
      // STORY.init({
      //   stage: currentStage,
      //   onEnd: onStageClearEnd,  // 사연 종료 시 호출할 콜백
      // });
      break;

    case 'INTRO':
      // TODO: intro.js 또는 story.js 에서 컷신 구현
      break;

    default:
      console.warn('[STATE] 알 수 없는 상태:', newState);
      break;
  }
}

// ──────────────────────────────────────────────────────────
//  방 클리어 처리
//
//  puzzle.js 에서 방을 클리어하면 이 함수를 호출
//  예: onRoomClear()
//
//  방 3개를 모두 클리어하면 → STAGE_CLEAR
//  아직 남은 방이 있으면    → 다음 방으로 PUZZLE_ROOM 재진입
// ──────────────────────────────────────────────────────────
function onRoomClear() {
  console.log(`[CLEAR] 스테이지 ${currentStage} / 방 ${currentRoom} 클리어`);

  if (currentRoom >= ROOMS_PER_STAGE) {
    // 이 스테이지의 마지막 방 클리어 → 스테이지 클리어
    transitionTo('STAGE_CLEAR');
  } else {
    // 다음 방으로 이동
    currentRoom++;
    transitionTo('PUZZLE_ROOM');
  }
}

// ──────────────────────────────────────────────────────────
//  스테이지 클리어 종료 처리
//
//  story.js 에서 사연 컷신이 끝나면 이 함수를 호출
//  예: onStageClearEnd()
//
//  다음 스테이지로 진행하거나 게임 종료 처리를 여기에 작성
// ──────────────────────────────────────────────────────────
function onStageClearEnd() {
  console.log(`[CLEAR] 스테이지 ${currentStage} 종료`);

  // 다음 스테이지로 초기화
  currentStage++;
  currentRoom = 1;

  // TODO: 마지막 스테이지 도달 시 엔딩 처리 추가
  // if (currentStage > TOTAL_STAGES) { transitionTo('ENDING'); return; }

  // 새 스테이지 → 새 캐릭터 생성부터 시작
  transitionTo('PIXEL_EDITOR');
}


// ──────────────────────────────────────────────────────────
//  p5.js preload() — 게임 시작 전 리소스 로드
//
//  폰트, 이미지 등 setup() 전에 반드시 준비돼야 하는 것들
// ──────────────────────────────────────────────────────────
let gameFont;   // 전역 — 모든 화면에서 textFont(gameFont) 로 사용 가능

function preload() {
  // 픽셀 한글 폰트 로드
  // 모든 텍스트 렌더링에 이 폰트 사용 (setup 에서 기본 설정)
  gameFont = loadFont('assets/x12y12pxMaruMinyaHangul.ttf');
}

// ──────────────────────────────────────────────────────────
//  p5.js setup()
// ──────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(gameFont);
  frameRate(60);

  // TODO: 컷신 완성 후 'INTRO' 로 변경
  transitionTo('INTRO');
}

// 브라우저 창 크기 바뀔 때 캔버스도 같이 조정
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ──────────────────────────────────────────────────────────
//  p5.js draw() — 상태별 렌더 함수 디스패치
//
//  새 상태 추가 시 여기에 case 한 줄 추가
// ──────────────────────────────────────────────────────────
function draw() {
  switch (currentState) {
    case 'INTRO':              drawIntro();            break;
    case 'PIXEL_EDITOR':       PE.draw();              break;
    case 'CHARACTER_CONFIRM':  drawCharacterConfirm(); break;
    case 'PUZZLE_ROOM':        drawPuzzleRoom();       break;
    case 'STAGE_CLEAR':        drawStageClear();       break;
    default:
      background(0);
      fill(255); textSize(14); textAlign(LEFT, TOP);
      text('알 수 없는 상태: ' + currentState, 10, 10);
  }
}

// ──────────────────────────────────────────────────────────
//  p5.js mousePressed()
// ──────────────────────────────────────────────────────────
function mousePressed() {
  switch (currentState) {
    case 'INTRO': // TODO: 컷신 클릭 진행 처리
  // 인트로 처리
  const btnX = width / 2;
  const btnY = 280;
  const btnW = 220;
  const btnH = 70;

  if (
    mouseX >= btnX - btnW/2 &&
    mouseX <= btnX + btnW/2 &&
    mouseY >= btnY - btnH/2 &&
    mouseY <= btnY + btnH/2
  ) {
    transitionTo('PIXEL_EDITOR');
  }
      break;

    case 'PIXEL_EDITOR':
      PE.handleClick(mouseX, mouseY);
      break;

    // 확인 화면 — 아무 곳이나 클릭하면 퍼즐로 이동
    case 'CHARACTER_CONFIRM':
      transitionTo('PUZZLE_ROOM');
      break;

    case 'PUZZLE_ROOM':
      // TODO: puzzle.js 구현 후 아래 주석 해제
      // PUZZLE.handleClick(mouseX, mouseY);
      break;

    case 'STAGE_CLEAR':
      // TODO: story.js 구현 후 아래 주석 해제
      // STORY.handleClick(mouseX, mouseY);
      break;
  }
}

// ──────────────────────────────────────────────────────────
//  p5.js mouseDragged()
// ──────────────────────────────────────────────────────────
function mouseDragged() {
  if (currentState === 'PIXEL_EDITOR') {
    PE.handleDrag(mouseX, mouseY);
  }
}

// ──────────────────────────────────────────────────────────
//  p5.js keyPressed()
// ──────────────────────────────────────────────────────────
function keyPressed() {
  switch (currentState) {
    case 'PIXEL_EDITOR':
      PE.handleKey(key);
      break;

    case 'PUZZLE_ROOM':
      // 방향키는 key 변수에 'ArrowUp' 등으로 들어옴
      PUZZLE.handleKey(key);
      // 방향키 기본 동작(스크롤) 방지
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
        return false;
      }
      break;
  }
}


// ══════════════════════════════════════════════════════════
//  상태별 렌더 함수
//  구현이 완료되면 각자의 .js 파일로 분리하고
//  해당 파일의 draw 함수를 여기서 호출하는 방식으로 교체
// ══════════════════════════════════════════════════════════

// ── CHARACTER_CONFIRM ─────────────────────────────────────
//  에디터 완료 직후 표시되는 캐릭터 확인 화면.
//  왼쪽: 내가 그린 캐릭터 스프라이트
//  오른쪽: 부여된 속성 안내 텍스트
//  클릭하면 PUZZLE_ROOM 으로 이동 (mousePressed 에서 처리)
function drawCharacterConfirm() {
  background(30);

  // ── 속성별 배경 포인트 컬러 ─────────────────────────────
  // 속성에 따라 화면 분위기를 살짝 다르게
  const attrName = player?.attribute?.name ?? null;
  let accentColor;
  if      (attrName === '불') accentColor = color(205, 52,  52);
  else if (attrName === '물') accentColor = color(52,  118, 205);
  else if (attrName === '풀') accentColor = color(132, 180, 67);
  else                        accentColor = color(180, 180, 180);

  // 화면 상단/하단 얇은 강조선
  noStroke();
  fill(accentColor);
  rect(0, 0,      width, 4);
  rect(0, height - 4, width, 4);

  // ── 캐릭터 스프라이트 (왼쪽 중앙) ──────────────────────
  // 16×16 원본을 8배 확대 → 128×128
  const SCALE  = 8;
  const sprW   = PE.COLS * SCALE;
  const sprH   = PE.ROWS * SCALE;
  const sprX   = width / 2 - 150;   // 화면 중앙 기준 왼쪽
  const sprY   = height / 2;

  imageMode(CENTER);
  noSmooth();
  if (player?.sprite) {
    image(player.sprite, sprX, sprY, sprW, sprH);
  }
  imageMode(CORNER);

  // ── 오른쪽 텍스트 영역
  const textX = width / 2 + 20;   // 스프라이트 오른쪽

  textAlign(LEFT, CENTER);

  // 안내 문구
  fill(180);
  textSize(14);
  text('당신의 캐릭터 속성은', textX, height / 2 - 40);

  // 속성 이름 (크게, 강조색)
  fill(accentColor);
  textSize(36);
  text(attrName ?? '없음', textX, height / 2 + 10);

  // "입니다" 마무리
  fill(180);
  textSize(14);
  text('입니다.', textX, height / 2 + 60);

  // ── 하단 클릭 안내 ──────────────────────────────────────
  // 깜빡임 효과
  if ((frameCount % 60) < 40) {
    fill(220);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('클릭하여 게임 시작', width / 2, height - 30);
  }
}

// ── INTRO ─────────────────────────────────────────────────
function drawIntro() {
  // TODO: 컷신 필요 (intro.js 또는 story.js 에서 구현)
  background(255);
  // 첫 화면
  textAlign(CENTER, CENTER);
  fill(20);
  textSize(48);
  text("백신 구조대", width / 2, 150); // 게임 제목

  const btnX = width / 2;
  const btnY = 280;
  const btnW = 220;
  const btnH = 70;

  rectMode(CENTER);

  fill(40, 120, 255);
  stroke(20);
  strokeWeight(2);

  rect(btnX, btnY, btnW, btnH, 12);

  noStroke();
  fill(255);

  textSize(24);
  text("게임 시작", btnX, btnY);

  rectMode(CORNER);

  fill(100);
  textSize(14);
  textAlign(RIGHT, BOTTOM);
  text("김한결, 박소이", width - 20, height - 15);

  fill(70);
  textSize(10);
  textAlign(CENTER, CENTER)
  text("스스로 백신 캐릭터를 디자인 한 다음 속성을 부여받아\n바이러스에 감염된 복잡한 퍼즐 내부 공간을 통과하여 의뢰를 완료하세요!", btnX, btnY + 60);
}

// ── PUZZLE_ROOM ───────────────────────────────────────────
function drawPuzzleRoom() {
  PUZZLE.draw();
}

// ── STAGE_CLEAR ───────────────────────────────────────────
function drawStageClear() {
  // TODO: 의뢰자 사연 컷신 구현 (story.js 에서 구현)
  // 구현 완료 후 이 함수 본문을 STORY.draw() 한 줄로 교체
  // 일단 CLEAR!! 화면으로 대체함(발표때문)
  background(0);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(48);

  text("CLEAR!!", width / 2, height / 2);
}


// ══════════════════════════════════════════════════════════
//  공용 유틸 함수
// ══════════════════════════════════════════════════════════

// ── 캐릭터 스프라이트 렌더링 ──────────────────────────────
//  puzzle.js 등에서 캐릭터를 그릴 때 이 함수를 호출
//  x, y : 그릴 위치 (CENTER 기준)
//  scale: 확대 배수 (기본 4 → 16px × 4 = 64px)
function drawPlayerSprite(x, y, scale = 4) {
  if (!player || !player.sprite) return;
  const w = PE.COLS * scale;
  const h = PE.ROWS * scale;
  imageMode(CENTER);
  noSmooth();   // 픽셀 아트 — 보간 없이 선명하게
  image(player.sprite, x, y, w, h);
  imageMode(CORNER);
}

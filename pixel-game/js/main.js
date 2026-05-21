// ============================================================
//  main.js
//  게임 전체 상태 머신 & p5.js 진입점
//
//  [ 게임 흐름 ]
//
//  INTRO
//    → PIXEL_EDITOR       (캐릭터 생성)
//    → PUZZLE_ROOM        (방 1 → 방 2 → 방 3, 스테이지마다 반복)
//    → STAGE_CLEAR        (의뢰자 사연 컷신)
//    → PIXEL_EDITOR       (다음 스테이지 새 캐릭터) 또는 게임 종료
//
//  [ 상태(currentState) 목록 ]
//  'INTRO'         : 오프닝 컷신 / 타이틀
//  'PIXEL_EDITOR'  : 픽셀 그림판 — 캐릭터(백신) 디자인
//  'PUZZLE_ROOM'   : 퍼즐 방 — 스테이지당 3개 순서대로 진행
//  'STAGE_CLEAR'   : 스테이지 클리어 컷신 / 의뢰자 사연
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

          // createCharacter() 로 데이터 + 스탯 + 런타임 상태를 하나로 합침
          // character.js 의 ATTRIBUTE_TABLE 에서 스탯 자동 조회
          player = createCharacter(result, sprite);

          console.log('[Character Created]',
            'attribute:', player.attribute?.name
          );

          transitionTo('PUZZLE_ROOM');
        });
      });
      break;

    // ── 퍼즐 방 진입 ────────────────────────────────────
    case 'PUZZLE_ROOM':
      // TODO: puzzle.js 구현 후 아래 주석 해제
      // PUZZLE.init({
      //   stage:    currentStage,
      //   room:     currentRoom,
      //   player:   player,      // 캐릭터 인스턴스 (스탯, 스프라이트 포함)
      //   onClear:  onRoomClear, // 방 클리어 시 호출할 콜백
      // });
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
  createCanvas(800, 480);
  textFont(gameFont);   // 전체 기본 폰트를 픽셀 한글 폰트로 설정
  frameRate(60);

  // TODO: 컷신 완성 후 'INTRO' 로 변경
  // 지금은 에디터 화면부터 바로 시작 (개발/테스트용)
  transitionTo('PIXEL_EDITOR');
}

// ──────────────────────────────────────────────────────────
//  p5.js draw() — 상태별 렌더 함수 디스패치
//
//  새 상태 추가 시 여기에 case 한 줄 추가
// ──────────────────────────────────────────────────────────
function draw() {
  switch (currentState) {
    case 'INTRO':        drawIntro();       break;
    case 'PIXEL_EDITOR': PE.draw();         break;
    case 'PUZZLE_ROOM':  drawPuzzleRoom();  break;
    case 'STAGE_CLEAR':  drawStageClear();  break;
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
    case 'INTRO':
      // TODO: 컷신 클릭 진행 처리
      break;

    case 'PIXEL_EDITOR':
      PE.handleClick(mouseX, mouseY);
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
      // TODO: puzzle.js 구현 후 아래 주석 해제
      // PUZZLE.handleKey(key);
      break;
  }
}


// ══════════════════════════════════════════════════════════
//  상태별 렌더 함수
//  구현이 완료되면 각자의 .js 파일로 분리하고
//  해당 파일의 draw 함수를 여기서 호출하는 방식으로 교체
// ══════════════════════════════════════════════════════════

// ── INTRO ─────────────────────────────────────────────────
function drawIntro() {
  // TODO: 컷신 필요 (intro.js 또는 story.js 에서 구현)
  background(0);
}

// ── PUZZLE_ROOM ───────────────────────────────────────────
function drawPuzzleRoom() {
  // TODO: puzzle.js 에서 구현
  // 구현 완료 후 이 함수 본문을 PUZZLE.draw() 한 줄로 교체
  background(0);
}

// ── STAGE_CLEAR ───────────────────────────────────────────
function drawStageClear() {
  // TODO: 의뢰자 사연 컷신 구현 (story.js 에서 구현)
  // 구현 완료 후 이 함수 본문을 STORY.draw() 한 줄로 교체
  background(0);
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

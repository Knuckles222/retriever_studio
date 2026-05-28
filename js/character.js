// ============================================================
//  character.js
//  캐릭터 데이터 정의 및 생성
//
//  [ 구조 ]
//  ① ATTRIBUTE_TABLE  : 속성별 고정 데이터 (절대 안 바뀌는 것)
//  ② createCharacter(): 에디터 결과 → 런타임 캐릭터 인스턴스 생성
//  ③ resetCharacter() : 방 재시작 시 이동 횟수 초기화
//
//  [ 다른 파일에서 사용법 ]
//  player.attribute.name   → '불' | '물' | '풀'
//  player.moveCount        → 남은 이동 횟수 (이동 시 --)
//  player.isAlive          → 이동 횟수 소진 시 false
// ============================================================


// ──────────────────────────────────────────────────────────
//  속성 정적 데이터 테이블
//
//  현재는 속성 이름과 색상 인덱스만 정의.
//  추후 속성 간 상성, 특수 능력 등 추가 시 여기에만 작성하면 됨.
//
//  colorIndex : 팔레트 인덱스와 대응 (1=빨강, 2=파랑, 3=초록)
// ──────────────────────────────────────────────────────────
const ATTRIBUTE_TABLE = {

  '불': {
    name:       '불',
    colorIndex: 1,

    // TODO: 속성 간 상성 추가 시 아래 주석 해제
    // strongAgainst: ['풀'],
    // weakAgainst:   ['물'], 
  },

  '물': {
    name:       '물',
    colorIndex: 2,

    // strongAgainst: ['불'],
    // weakAgainst:   ['풀'],
  },

  '풀': {
    name:       '풀',
    colorIndex: 3,

    // strongAgainst: ['물'],
    // weakAgainst:   ['불'],
  },
};


// ──────────────────────────────────────────────────────────
//  캐릭터 인스턴스 생성 함수
//
//  @param editorResult  PE.getResult() 가 반환한 객체
//  @param sprite        loadImage() 로 얻은 p5.Image 객체
//
//  [ 반환 객체 구조 ]
//  {
//    grid         : 16×16 숫자 배열 (원본 픽셀 데이터)
//    imageDataURL : base64 PNG (저장/불러오기용)
//    sprite       : p5.Image  (렌더링용, 직렬화 불가)
//
//    attribute    : ATTRIBUTE_TABLE 의 항목 (null = 속성 없음)
//
//    // ── 런타임 상태 (게임 중 변하는 값) ──
//    moveCount    : 남은 이동 횟수 — puzzle.js 에서 방 진입 시 resetCharacter() 로 설정
//    isAlive      : 이동 횟수가 0이 되면 false → 방 재시작
//
//    // hp, attack, defense 는 이 게임에서 사용하지 않음 (이동 횟수 제한만 있음)
//    // TODO: 추후 전투 시스템 추가 시 ATTRIBUTE_TABLE 에 스탯 추가 후 여기서 참조
//  }
// ──────────────────────────────────────────────────────────
function createCharacter(editorResult, sprite) {

  const attrName = editorResult.attribute;       // '불' | '물' | '풀' | null
  const attrData = attrName ? ATTRIBUTE_TABLE[attrName] : null;

  if (!attrData) {
    console.warn('[Character] 속성 없음');
  }

  return {
    // ── 비주얼 ────────────────────────────────────────────
    grid:         editorResult.grid,
    imageDataURL: editorResult.imageDataURL,
    sprite:       sprite,

    // ── 속성 ──────────────────────────────────────────────
    attribute:    attrData,   // null 이면 속성 없음

    // ── 런타임 상태 ───────────────────────────────────────
    moveCount:    0,          // puzzle.js 에서 resetCharacter() 로 설정
    isAlive:      true,

    // hp:        0,          // 이 게임은 HP 없음 (이동 횟수 소진 = 재시작)
    // attack:    0,          // TODO: 전투 시스템 추가 시 활성화
    // defense:   0,
  };
}


// ──────────────────────────────────────────────────────────
//  캐릭터 상태 리셋
//
//  방에 진입하거나 재시작할 때 puzzle.js 에서 호출
//
//  @param character  createCharacter() 로 만든 객체
//  @param moveCount  이 방에서 허용되는 이동 횟수
//
//  사용법:
//    resetCharacter(player, 20);   // 방 진입 시
//    resetCharacter(player, 20);   // 이동 소진 → 재시작 시 동일하게 호출
// ──────────────────────────────────────────────────────────
function resetCharacter(character, moveCount) {
  character.moveCount = moveCount;
  character.isAlive   = true;
}

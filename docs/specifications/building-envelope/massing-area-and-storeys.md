# Massing, 면적과 층 시스템 {#building-envelope-massing-area-storey-specification}

## Mass와 면적 정본 {#building-envelope-massing-area-canonical-state}

### Massing 입력과 면적 Basis {#building-envelope-massing-area-input-basis}

<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-massing-area-height 건물 massing, footprint, 면적 basis와 총높이를 하나의 치수 정본으로 해결한다. -->

Resolved building mass는 서로 겹치지 않는 계산 영역 또는 명시된 합성 관계, ground footprint, 지붕까지의 outer extent, 높이 기준과 void를 가진다. 직교 상자만을 전제로 하지 않으며 courtyard, setback, overhang, tower, dome, 경사와 자유형 외곽을 project가 선택한 정확도 수준으로 표현한다.

<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-area-basis gross, net, footprint와 계산 제외 범위를 단위 및 source와 함께 구분한다. -->

입력은 closed footprint 또는 bounded mass representation, length unit, datum, void·overhang 처리, gross·net 규칙과 계산 대상 revision을 제공한다. 출력의 모든 area와 volume은 identity, unit, basis, included region, exclusion, tolerance와 exact·approximate·unsupported 상태를 포함하며 해석할 수 없는 형상을 0으로 기록하지 않는다.

### 총높이와 Silhouette 불변식 {#building-envelope-total-height-silhouette-invariant}

<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-total-height parapet, rooftop equipment와 장식의 포함 여부가 다른 높이 값을 구분하고 silhouette와 결속한다. -->

Ground datum에서 roof surface, parapet, 장식과 equipment 최고점까지의 높이는 서로 다른 측정 target으로 유지한다. Representation tier가 바뀌어도 building footprint, major mass, peak와 negative space는 선언된 tolerance 안에서 보존되어야 하며 하나의 영웅 시점만으로 전 방향 mass를 통과시키지 않는다.

### Massing 변경과 Stale 전이 {#building-envelope-massing-change-staleness}

<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-massing-change-impact massing 변경이 층, 외피, site, interior, 수량과 산출물에 미치는 영향을 stale 상태로 전파한다. -->

Footprint, outer extent, datum, area rule 또는 void가 바뀌면 dependent storey, envelope, facade, roof, opening, structure, service, site seam, interior extent, quantity와 capture를 식별하여 `stale`로 전이한다. 이전 값은 어느 revision에 유효했는지 보존하지만 재해결 전에는 current result에 섞지 않는다.

## 층, Level과 높이 State {#building-envelope-storey-level-height-state}

### 층 입력과 해석 {#building-envelope-storey-input-resolution}

<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-storeys-levels 반복층, 가변층, mezzanine, void와 roof deck의 elevation 및 높이를 독립 상태로 다룬다. -->

Storey는 building root 아래의 stable spatial identity이며 순번과 동일시하지 않는다. 각 storey는 base elevation, top elevation, floor-to-floor height, slab zone, occupied 또는 exterior role과 연결된 공간·요소를 가지며 split level, mezzanine, duplex, attic, void와 roof deck을 허용한다.

<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-variable-levels 층마다 다른 elevation, 높이와 불연속 level을 동일 규칙으로 해결한다. -->

입력은 level datum, ordered 또는 graph 관계, base·top elevation, structural depth, finish build-up, 반복 prototype과 instance override를 제공한다. 출력은 각 층의 world elevation, floor-to-floor height, 구조 surface와 사용 가능한 clear-height envelope이며 배열 위치나 이름에서 높이를 추정하지 않는다.

### Slab와 Clear Height 불변식 {#building-envelope-slab-clear-height-invariant}

<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-slab-clear-height slab, finish와 overhead obstruction을 구분하여 외부 층높이와 내부 clear height가 동시에 성립하게 한다. -->

Floor-to-floor 높이는 연속 datum의 차이와 일치해야 하며 slab와 finish thickness는 같은 공간을 이중 차감하지 않는다. 연결된 interior가 있으면 finished floor에서 lowest overhead obstruction까지의 clear height가 exterior level, slab, roof와 envelope 안에 들어와야 한다.

### 반복층과 실패 {#building-envelope-repeated-storey-failures}

<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-level-refusal 층 순서, 높이, 겹침, 비양수 값과 연결 불일치를 명시적으로 거부한다. -->

Prototype은 공통 층 규칙을 제공하고 instance는 stable identity, elevation과 승인된 예외만 덮어쓴다. Non-finite 또는 non-positive 높이, 역전된 datum, 의도하지 않은 slab overlap, 끊긴 수직 동선, roof보다 높은 occupied extent와 interior의 다른 level 정본은 named finding이며 자동 평균값으로 봉합하지 않는다.

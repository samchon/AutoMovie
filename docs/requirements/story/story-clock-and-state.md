# 이야기 시간과 상태

## Story Clock의 명시 {#story-clock-state}

작품은 사건이 세계 안에서 언제 일어나는지 나타내는 story clock과 관객에게 얼마나 오래 보여 주는지 나타내는 film clock을 구분해야 한다.

Story clock을 사용하지 않는 작품은 이를 생략할 수 있고 생략이 zero 또는 scene 순서와 같은 암묵 시계로 해석되지 않아야 한다. 사용하는 경우 원점, 단위, 방향과 적용 범위를 식별할 수 있어야 한다.

### 절대와 상대 시간 {#story-absolute-relative-time}

날짜, 시간대, 계절과 같은 absolute time과 scene 시작 이후, 사건 이전·이후, named phase와 같은 relative time을 함께 표현할 수 있어야 한다.

정확한 시각, 범위, 순서만 알려진 시간과 unknown time을 구분할 수 있어야 한다. 서로 다른 calendar 또는 fictional time system을 하나의 실세계 timestamp로 강제 변환하지 않아야 한다.

### 생략과 압축 {#story-time-ellipsis-compression}

Time jump, montage, slow presentation, replay, flashback와 parallel event는 story duration과 screen duration의 관계를 명시해야 한다.

한 사건의 실제 발생, 인물의 기억, 상상, 기록 영상과 관객에게 반복 제시되는 replay를 다른 temporal mode로 구분해야 한다. 같은 footage를 다시 썼다는 이유로 story event가 두 번 발생했다고 계산하지 않아야 한다.

### 상태 Ledger {#story-state-ledger}

인물 위치, knowledge, costume, prop ownership, damage, environment와 unresolved action을 scene boundary마다 인계하고 어느 사건이 상태를 바꿨는지 추적해야 한다.

각 state 값은 적용 대상, 유효 시간 또는 phase, 원인 event, confidence 또는 unknown 상태와 source authority를 가질 수 있어야 한다. 서로 다른 인물이 믿는 상태와 세계의 실제 상태를 분리해야 한다.

### 시간 모순 {#story-time-contradictions}

원인보다 앞선 결과, 불가능한 travel, 겹칠 수 없는 동시 출현, 되돌아간 damage와 설명 없는 state reset을 탐지해야 한다.

### Presentation Order와 Chronology {#story-presentation-chronology}

Project는 scene과 event의 story chronology, screenplay 배열과 최종 presentation order를 서로 독립적으로 비교할 수 있어야 한다. 순서 변경은 인과 또는 state continuity를 자동으로 다시 쓰지 않아야 한다.

### 동시 사건과 Synchronization {#story-simultaneous-events}

서로 다른 scene, 장소 또는 관점에서 같은 story moment에 발생하는 사건은 공통 clock 또는 명시적 관계와 허용 오차로 연결할 수 있어야 한다. Edit에서 인접하다는 사실만으로 동시성을 주장하지 않아야 한다.

### 지속, Deadline과 반복 {#story-duration-deadline-recurrence}

Event와 state는 시작, 종료, 지속 범위, deadline, 반복 규칙과 중단 조건 중 필요한 시간 사실을 가질 수 있어야 한다. 반복되는 routine과 montage 표현을 무한하거나 정해지지 않은 occurrence 목록으로 확장하지 않아야 한다.

### State 전이의 단일 원인과 복합 원인 {#story-state-transition-causes}

State change는 하나 이상의 원인 event, 사용자 선언 초기 조건 또는 의도된 불연속과 연결할 수 있어야 한다. 여러 원인이 필요한 변화와 여러 후보 원인 중 하나가 미정인 변화를 구분해야 한다.

### 시간과 State 검토 범위 {#story-time-state-review-scope}

Scene, sequence와 film 수준에서 각각 시간과 state continuity를 검토하고, 국소적으로 유효한 scene이 전체 chronology와 충돌하는 경우 film-level finding으로 남길 수 있어야 한다. 미지원 시간 분석을 통과로 표시하지 않아야 한다.

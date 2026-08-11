# 층, 표고와 층고

## 독립된 Storey와 Level {#building-storeys-levels}

각 storey는 독립 identity, shared datum, base elevation, structural elevation, finished elevation, top elevation, floor-to-floor height, horizontal extent와 building mass 관계를 가져야 한다. Exterior-only 건물도 층을 표현한다면 이 기준을 가져야 하며 창 줄이나 texture band를 storey 사실로 대신하지 않아야 한다.

### 다양한 수직 구성 {#building-variable-levels}

서로 다른 층고, split level, mezzanine, attic, basement, double-height zone, roof level, sloped floor와 한 층 안의 복수 높이 영역을 하나의 균일한 층 반복으로 평탄화하지 않고 표현할 수 있어야 한다.

### Slab와 Clear height {#building-slab-clear-height}

Floor finish, structural slab thickness, raised floor, ceiling zone, beam·service depth와 overhead structure를 구분하여 exterior floor-to-floor height와 interior finished floor·clear height가 같은 storey interval 안에서 함께 성립하는지 확인할 수 있어야 한다.

### Void와 관통 {#building-storey-voids}

Atrium, stair void, shaft, courtyard와 multi-storey space는 storey가 반복된다는 이유로 slab, roof나 facade panel로 자동 폐쇄되지 않아야 한다.

### 반복 층과 예외 {#building-repeated-storeys}

반복 storey는 공통 plan·height·facade·structure·service rule을 prototype으로 공유하면서 한 층, 한 level region, 한 bay, 한 opening와 한 exterior region의 명시적 exception을 가질 수 있어야 한다. 각 resolved storey identity와 최종 값의 provenance는 instancing이나 LOD 뒤에도 유지되어야 한다.

### 수직 모순의 거부 {#building-level-refusal}

Storey overlap, inverted elevation, unresolved datum, unaccounted slab·service depth, impossible clear height와 exterior·interior level mismatch를 구조적 failure로 보고해야 한다. 가까운 facade opening이 맞아 보인다는 이유로 서로 다른 수직 기준을 통과시키지 않아야 한다.

### Interior와의 Level 공유 {#building-storey-interior-level-sharing}

Interior가 연결되면 exterior storey와 interior level은 shared level identity 또는 명시적 대응 관계를 가져야 한다. 양쪽 어느 곳에서 floor-to-floor height, split level, slab, ceiling, attic, basement나 roof interface를 변경해도 상대편의 floor, room, facade, opening, stair, shaft와 service route를 다시 검토해야 한다.

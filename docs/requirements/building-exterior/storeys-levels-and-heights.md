# 층, 표고와 층고

## 독립된 Storey와 Level {#building-storeys-levels}

각 storey는 독립 identity, base elevation, top elevation, floor-to-floor height, horizontal extent와 building mass 관계를 가져야 한다.

### 다양한 수직 구성 {#building-variable-levels}

서로 다른 층고, split level, mezzanine, attic, basement, double-height zone, roof level와 한 층 안의 복수 높이 영역을 표현할 수 있어야 한다.

### Slab와 Clear height {#building-slab-clear-height}

Floor·slab thickness, raised floor, ceiling zone와 overhead structure를 구분하여 exterior floor-to-floor height와 interior clear height가 함께 성립하는지 확인할 수 있어야 한다.

### Void와 관통 {#building-storey-voids}

Atrium, stair void, shaft, courtyard와 multi-storey space는 storey가 반복된다는 이유로 slab, roof나 facade panel로 자동 폐쇄되지 않아야 한다.

### 반복 층과 예외 {#building-repeated-storeys}

반복 storey는 공통 plan·height·facade rule을 공유하면서 한 층, 한 bay, 한 opening와 한 exterior region의 명시적 exception을 가질 수 있어야 하며 최종 provenance를 유지해야 한다.

### 수직 모순의 거부 {#building-level-refusal}

Storey overlap, inverted elevation, unresolved datum, impossible clear height와 exterior·interior level mismatch를 구조적 failure로 보고해야 한다.

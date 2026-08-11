# 결함 분류와 우선순위

## 결함을 일관되게 다루는 분류 {#review-defect-classification}

검토 Finding은 영향을 받는 작품 관점, 심각도, 처리 우선순위와 재현 상태를 구분하여 같은 종류의 결함을 일관되게 검색하고 판단할 수 있어야 한다.

### 작품 관점의 Category {#review-defect-categories}

Story, staging, camera, performance, motion, continuity, geometry, material, lighting, effect, sound, editorial, repaint, rendering, accessibility와 delivery처럼 관찰된 영향의 관점을 분류하되 하나의 Finding이 여러 관점에 미치면 그 관계를 잃지 않아야 한다.

### 결함과 허용된 Variation {#review-defect-versus-variation}

명시된 의도나 tolerance 안의 variation, 주관적 제안과 acceptance를 위반한 결함을 구분하고 선호 차이를 필수 수정 결함으로 과장하지 않아야 한다.

### 심각도와 우선순위 {#review-severity-priority}

심각도는 작품 이해, continuity, 안전한 재생, 접근성과 전달 가능성에 미치는 영향을 나타내고 처리 우선순위는 일정과 제작 결정을 나타내어 서로 대신하지 않아야 한다.

### 재현 상태와 빈도 {#review-reproduction-frequency}

항상 재현, 특정 조건 재현, 간헐적, 재현되지 않음과 확인 불가를 구분하고 발생 빈도와 검토 조건을 함께 남겨야 한다.

### 중복과 공통 영향 {#review-duplicate-common-impact}

같은 관찰을 중복 Finding으로 연결할 수 있어야 하며 여러 frame, 구간 또는 version에서 반복되는 결함은 공통 영향 범위와 개별 증거를 모두 보존해야 한다.

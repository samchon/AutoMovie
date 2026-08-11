# Representation, Bounds와 LOD

## 용도별 표현을 공유하는 자산 identity {#asset-representations-bounds-lod}

하나의 자산은 화면 표현, close-up, distance, collision, shadow, selection, drawing과 repaint guide에 필요한 representation을 가질 수 있어야 하며 모두 같은 semantic identity와 source lineage를 가리켜야 한다.

### 선언 bounds와 측정 bounds {#asset-declared-measured-bounds}

자산은 author-declared bounds와 geometry에서 측정한 bounds를 구분하고 기준 좌표, 단위, representation, rig state와 적용 시간을 함께 기록하여 framing, placement, visibility와 collision 판단에 사용할 수 있어야 한다.

### 상태와 동작을 포함하는 bounds {#asset-bounds-state-motion}

Rig, morph, animation, procedural variation과 detachable component가 bounds를 바꿀 때 neutral, named state, motion range와 authored exception의 보수적 범위를 구분할 수 있어야 한다.

### LOD와 proxy lineage {#asset-lod-proxy-lineage}

각 LOD와 proxy는 자신이 파생된 source와 generation 또는 simplification 조건, intended purpose, material region, rig와 state support, bounds와 known loss를 기록해야 한다.

### Representation 선택 {#asset-representation-selection}

사용자는 shot scale, screen-space error, distance, purpose와 resource budget에 따른 representation 선택과 전환 조건을 선언할 수 있어야 하며 숨은 heuristic이나 파일 순서가 어느 표현을 사용할지 결정하지 않아야 한다.

### 의미와 동작 보존 {#asset-representation-semantic-preservation}

Representation이 바뀌어도 subject identity, count, placement, contact, event readability와 필요한 silhouette가 declared tolerance 안에서 유지되어야 하며 지원하지 않는 material, control 또는 state를 명시해야 한다.

### 전환 안정성 {#asset-lod-transition-stability}

LOD 경계 근처의 작은 camera 또는 subject motion이 representation을 반복 교체하여 flicker, popping, identity drift와 시간 비결정성을 만들지 않아야 한다.

### Stale derivative 거부 {#asset-representation-stale-refusal}

Source geometry, material region, rig, state 또는 bounds가 바뀐 뒤 다시 검증되지 않은 LOD, proxy와 derived bounds를 current representation으로 사용하지 않아야 한다.

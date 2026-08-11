# 채택 방식과 Group Composition

## 외부 입력 채택 방식의 사용자 선택 {#external-adoption-mode-choice}

사용자는 외부 입력마다 direct placement, native reinterpretation, group composition 또는 이들의 명시적 조합을 선택할 수 있어야 한다. 채택 방식은 source의 복잡도나 편의에 따라 몰래 바뀌지 않으며, 같은 source revision을 여러 방식으로 채택한 결과는 서로 다른 identity를 가져야 한다.

### Direct Placement {#external-adoption-direct-placement}

Direct placement는 지원되는 source structure와 resource를 project 공간과 시간에 배치하되 원본 node, track, layer 또는 stream identity를 보존해야 한다. 필요한 좌표, 단위와 시간 변환은 선언된 placement 해석으로 남고 원본을 project-native 자료처럼 다시 저작했다고 주장하지 않아야 한다.

### Native Reinterpretation {#external-adoption-native-reinterpretation}

Native reinterpretation은 선택한 source element를 사용자가 계속 저작할 수 있는 project-native 형상, 재료, rig, motion, spatial relation, text 또는 metadata 의미로 바꿀 수 있어야 한다. 어떤 identity와 의미를 보존·분할·병합·근사·누락했는지 기록하고 source에 없던 의미를 사실처럼 발명하지 않아야 한다.

### Group Composition {#external-adoption-group-composition}

Group composition은 direct source와 reinterpreted result를 다른 authored subject와 함께 상위 group, assembly, formation, location 또는 timeline 관계의 이름 붙은 member로 합성할 수 있어야 한다. Member identity, membership, local transform, order, role와 override를 보존하고 composition을 이유로 원본 자원을 파괴적으로 합치지 않아야 한다.

### 부분 선택과 Override {#external-adoption-selection-overrides}

사용자는 한 file이나 API result 전체가 아니라 특정 scene, node, clip, channel, layer, page, range 또는 metadata field를 채택하고, 원본 identity를 유지한 채 허용된 속성만 override할 수 있어야 한다. 선택하지 않은 요소는 자동 채택되지 않으며 override와 source update의 충돌을 식별할 수 있어야 한다.

### 채택 의도의 지속성 {#external-adoption-intent-persistence}

Refresh, relink, cache 복원과 재변환 뒤에도 사용자가 고른 mode, selection, placement, group membership와 override가 유지되어야 한다. 유지할 수 없는 변경은 새 선택을 요구하며 다른 mode나 source element로 조용히 대체하지 않아야 한다.

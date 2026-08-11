# Group, Instance와 반복

## 복합 Interior의 압축 저작 {#interior-groups-instances-repetition}

Furniture set, cabinet run, ceiling field, fixture cluster, room kit, apartment stack와 repeated floor를 prototype, nested group, instance와 bounded rule로 구성할 수 있어야 한다.

### Nested Group {#interior-nested-groups}

Group은 다른 group과 외부 또는 native asset을 포함할 수 있고 group-local transform, member order, shared state와 semantic role을 유지해야 한다.

### 반복 층과 Room Type {#interior-repeated-storey-room}

같은 plan, room type, finish set와 furniture layout을 여러 storey나 unit에 재사용하면서 층고, ceiling, opening, service, material와 story-relevant member의 개별 예외를 허용해야 한다.

### Instance Override {#interior-instance-overrides}

각 instance는 identity, transform, visibility, material, state, damage, seed와 explicit override를 가질 수 있고 최종 값이 prototype, group와 local override 중 어디서 왔는지 추적할 수 있어야 한다.

### Group Seed와 상관성 {#interior-group-seed-correlation}

Group은 member seed를 독립 random 값으로만 만들지 않고 공통 lot, row, cluster와 installation bias를 표현하는 seed hierarchy와 correlation rule을 가질 수 있어야 한다.

### Bounded Expansion {#interior-group-bounded-expansion}

Expanded object, triangle, material, collider, light와 simulation count의 최대값을 선언하고 report하여 반복 저작이 숨은 무제한 작업이 되지 않아야 한다.

### Identity 보존 {#interior-group-identity-preservation}

Batching, instancing, culling과 LOD를 사용하더라도 선택, 진단, quantity, collision, shot continuity와 evidence에 필요한 member identity를 잃지 않아야 한다.

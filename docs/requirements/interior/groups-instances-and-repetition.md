# Group, Instance와 반복

## 복합 Interior의 압축 저작 {#interior-groups-instances-repetition}

Furniture set, cabinet run, ceiling field, fixture cluster, room kit, apartment stack와 repeated floor를 prototype, nested group, instance와 bounded rule로 구성할 수 있어야 한다.

### Nested Group {#interior-nested-groups}

Group은 다른 group과 외부 또는 native asset을 포함할 수 있고 group-local transform, member order, shared state와 semantic role을 유지해야 한다.

External glTF의 내부 node reuse, 같은 external asset의 project-level instance, native element와 external node를 함께 담은 composite prototype, 그 prototype의 상위 instance를 중첩할 수 있어야 한다. Flattening이나 batching 뒤에도 transform composition order, selection path, material·state override와 원래 hierarchy를 추적할 수 있어야 한다.

### 반복 층과 Room Type {#interior-repeated-storey-room}

같은 plan, room type, finish set와 furniture layout을 여러 storey나 unit에 재사용하면서 층고, ceiling, opening, service, material와 story-relevant member의 개별 예외를 허용해야 한다.

### Instance Override {#interior-instance-overrides}

각 instance는 identity, transform, visibility, material, state, damage, seed와 explicit override를 가질 수 있고 최종 값이 prototype, group와 local override 중 어디서 왔는지 추적할 수 있어야 한다.

### Group Seed와 상관성 {#interior-group-seed-correlation}

Group은 member seed를 독립 random 값으로만 만들지 않고 공통 lot, row, cluster와 installation bias를 표현하는 seed hierarchy와 correlation rule을 가질 수 있어야 한다.

Seed contract는 generator 또는 noise algorithm identity와 version, stream key, channel composition order, distribution, clamp와 correlation scale을 포함해야 한다. Stable member identity로 파생하여 앞선 member의 추가·삭제와 unrelated edit가 남은 instance의 미세 위치, gap, color와 wear를 다시 뽑지 않아야 한다.

### Bounded Expansion {#interior-group-bounded-expansion}

Expanded object, triangle, material, collider, light와 simulation count의 최대값을 선언하고 report하여 반복 저작이 숨은 무제한 작업이 되지 않아야 한다.

### Identity 보존 {#interior-group-identity-preservation}

Batching, instancing, culling과 LOD를 사용하더라도 선택, 진단, quantity, collision, shot continuity와 evidence에 필요한 member identity를 잃지 않아야 한다.

최적화는 authoring group을 바꾸지 않는 파생 표현이어야 한다. 어떤 member를 함께 묶었는지, 고유 geometry·material·skin·morph·state 때문에 무엇을 분리했는지와 proxy 오차를 보고하고 다시 authoring identity로 역추적할 수 있어야 한다.

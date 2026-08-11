# Formation motion, resolution과 budgets

## Group motion과 re-form state {#performance-formation-group-motion-reform-state}

### Sparse member exception과 command event {#performance-formation-member-exception-command-event}

<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-reform-group-motion 시간에 따라 변하는 집단 shape를 explicit state transition으로 정의한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-group-motion-model-selection kinematic cue, procedural rule과 외부 motion model을 사용자가 선택하게 한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-reform-local-blend layout 사이 member local position을 unit frame에서 보간한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-turn-speed-response turn, speed와 member response의 결합을 명시한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-reform-slot-assignment reform 중 stable member와 target slot assignment를 정의한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-reform-interior-state endpoint뿐 아니라 reform interior state를 결정론적으로 평가한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-reform-refusal ground, overlap, capacity와 timing 실패를 거부한다. -->

Group motion cue는 stable cue identity, formation과 command identity, shot-local interval, selected motion model, before·after group transform과 layout, easing, facing·spacing state, optional shared gait와 event mapping을 가진다. 사용자는 bounded kinematic cue, registered procedural group rule, external group motion 또는 static hold 중 하나를 선택하고, source provenance와 compatibility decision을 receipt에 남긴다. Cue가 없는 interval은 이전 resolved group state를 유지하며 design state로 reset하지 않는다.

Re-form은 두 layout parameter를 섞는 것이 아니라 각 stable member의 source slot과 target slot을 unit-local frame에서 연결하는 state transition이다. Assignment policy와 tie-break, interpolation curve, turn·translation composition, response latency·phase, removed·hero exception을 먼저 결정하고 world transform과 terrain을 나중에 적용한다. Turn과 이동 중 shared gait cadence는 unit가 실제로 이동한 ground distance와 chosen gait에 따라 계산하고, 제자리 회전은 각 member의 arc distance를 반영한다.

Output은 sample time별 group transform, active layout과 blend progress, slot correspondence, member local·world state, group and response events, shared gait state와 continuity handoff다. Target layout capacity 부족, assignment ambiguity, overlapping cues, route·ground 이탈, temporal overlap, excessive turn·speed response, interior collision은 실패하며 valid한 두 endpoint만으로 성공하지 않는다.

<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state group state와 개별 member exception을 별도 channel로 유지한다. -->
<!-- @evidence requirements/formations/reform-and-group-motion.md#formation-command-response-events 명령과 member 반응의 semantic event를 동일 clock에 둔다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload formation event의 identity와 subjects를 downstream에 전달한다. -->

한 member 또는 작은 subset의 변화는 group cue를 변형하지 않고 formation identity, stable slot list, interval, present·local offset·facing·state before·after와 easing을 가진 sparse exception cue로 표현한다. Named hero slot은 actor performance가 소유하므로 anonymous exception과 중복 대상이 될 수 없다. Exception은 첫 cue 전 identity state를 유지하고 cue 종료 뒤 `to` state를 유지하며, `present=false`는 drawn·measured set에서 제거하지만 designed count와 group design identity는 바꾸지 않는다.

Command event는 issue, acknowledged, motion-start, contact·break, settled 같은 stable occurrence를 필요에 따라 가진다. Event timing은 group cue, member exception과 같은 shot-local clock에서 평가되고 contract predicate, sound, reaction, coverage가 동일한 realized event를 참조한다. Exception count, affected slots와 cues는 declared sparse budget 안에 있어야 하며, crowd 전체를 per-member curve로 펼치는 요청은 explicit authoring mode와 별도 budget 없이는 거부한다.

## Logical identity와 display resolution {#performance-formation-logical-display-resolution}

### Bounds, framing과 culling failures {#performance-formation-bounds-framing-culling-failures}

<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-culling-evidence logical formation과 표시 해상도를 분리한다. -->
<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection LOD, culling과 proxy policy를 사용자가 선택 가능하게 한다. -->
<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-semantic-minimum 거리별 semantic minimum을 명시한다. -->
<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-transition hysteresis를 가진 stable resolution 전환을 요구한다. -->
<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-evidence-quantity 실제 group quantity와 visible·culled quantity를 함께 증명한다. -->
<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection current camera와 purpose로 representation을 선택한다. -->
<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability LOD 전환이 temporal flicker를 만들지 않게 한다. -->

Logical formation record의 count, hierarchy, member identity, state, event와 group bounds는 display resolution과 독립적이다. Resolution policy는 available tiers, camera distance와 projected contribution, hysteresis, chunk culling, hero exception, semantic minimum, user-selected quality·cost 목표를 입력으로 받는다. 출력은 sample별 chosen tier와 visible chunks·members, culled reason, conservative bounds와 transition history다.

Semantic minimum은 far tier에서도 subject kind, group silhouette·edge·interval, color grouping, shared motion phase와 required event가 읽혀야 하는 정도를 shot contract별로 정한다. 저해상도 tier가 skeleton이나 gait table이 없으면 static하게 보일 수 있음을 compatibility preview에 표시하고, 사용자가 그 shot에서 허용할지 다른 tier 또는 external representation을 선택하게 한다. Culling은 camera와 declared visibility rule로 결정하며 story상 존재 여부나 contact participant를 삭제하지 않는다.

LOD transition은 stable member identity, scale, palette·variation, root state, shared gait phase와 event를 보존하고 threshold 주변 hysteresis로 왕복 flicker를 막는다. Evidence는 designed count, active count, visible count, culled count, promoted heroes, selected tier와 measured group extent를 구분한다. Centroid point 하나나 drawn instance 수만으로 실제 group quantity를 대체하지 않는다.

<!-- @evidence requirements/staging/visibility-and-readability.md#staging-multi-subject-priority 여러 subject와 formation의 readability priority를 보존한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-subject-deliveries shot delivery가 요구하는 formation extent를 current time에서 측정한다. -->
<!-- @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-culling-refusal required subject를 사라지게 하는 resolution policy를 실패로 반환한다. -->

Formation bounds는 designed layout와 member proxy뿐 아니라 current group cue, reform, spacing scale, terrain relief, member exceptions와 current representation의 height·radius를 고려한 conservative extent다. Camera framing과 visibility는 group을 centroid가 아닌 이 extent로 측정하고, close shot의 deliberate crop과 entire-group delivery를 shot contract로 구분한다. Aim, hand reach 또는 projectile target처럼 한 point가 필요한 action은 formation 전체를 target으로 허용하지 않고 named node·landmark 또는 explicit point를 요구한다.

Required subject가 전부 culled되거나 selected tier가 semantic minimum을 충족하지 못하거나 visible quantity가 evidence와 다르거나 bounds가 stale한 경우 resolution failure다. 시스템은 culling을 끄거나 far proxy를 hero로 몰래 승격하지 않고 policy, budget, camera, representation 중 선택 가능한 변경을 반환한다.

## Formation budget와 worst-case cost {#performance-formation-budget-worst-case-cost-group}

### Formation budget와 worst-case cost {#performance-formation-budget-worst-case-cost}

<!-- @evidence requirements/formations/budgets-and-validation.md#formation-budgets-validation 집단 규모와 runtime 비용을 명시적 bound로 제한한다. -->
<!-- @evidence requirements/formations/budgets-and-validation.md#formation-budget-policy-selection count, memory, draw, hero와 motion budget policy를 선택하게 한다. -->
<!-- @evidence requirements/formations/budgets-and-validation.md#formation-complexity-worst-case 현재 frame이 아니라 worst-case를 계산한다. -->

Budget policy는 logical count, nested units, hero overrides, layout·variation complexity, active cues, sparse exceptions, chunks, instance memory, geometry·material·draw·simulation cost, review sample와 evidence size의 inclusive limits를 tier별로 선언한다. 사용자는 production default, shot-specific stricter policy 또는 explicit authorized override를 선택하고, 미선언 metric은 0이나 통과가 아니라 `unbudgeted` 또는 `not-run`이다.

Worst-case는 모든 allowed tier, maximal visible chunks, motion·reform interior, hero and member exceptions, variation cardinality와 simultaneous formations를 고려한다. Current camera가 대부분을 culled한다는 이유로 logical or buffer cost를 낮춰 계산하지 않고, exact cost와 conservative upper bound를 구분한다. Bound와 동일한 값은 허용하되 하나라도 넘으면 dominant owner와 source decision을 보고한다.

### Geometry, layout와 motion validation {#performance-formation-geometry-layout-motion-validation}

<!-- @evidence requirements/formations/budgets-and-validation.md#formation-layout-validation count, capacity, spacing, bounds와 ground를 검증한다. -->
<!-- @evidence requirements/formations/budgets-and-validation.md#formation-resolution-validation 각 resolution에서 identity, readability와 cost를 검증한다. -->
<!-- @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation cue, reform, event와 member exception을 시간 전체에서 검증한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-temporal-overlap motion interior의 실제 body overlap을 측정한다. -->

Validation input은 exact formation design과 revision, prototype and tier identities, world terrain·route snapshot, shot-local cues·events, frame clock, selected budget와 camera evidence target이다. Static pass는 layout capacity, stable slot uniqueness, finite transform, body clearance, bounds와 ground를 검사하고, temporal pass는 cue endpoints와 interior에서 route envelope, terrain, overlap, gait·event, exception retention을 검사한다. Resolution pass는 각 selected tier의 model availability, semantic minimum, phase·identity continuity, culling and quantity evidence를 검사한다.

결과는 finding마다 formation·unit·slot 또는 chunk identity, sample time, policy, expected·actual, tolerance, source revision과 affected event·shot을 제공한다. Layout·motion·resolution을 서로 다른 snapshot으로 검증하지 않고 하나의 input fingerprint로 묶는다. Review는 wide, representative near·far, reform·contact와 continuity frame에서 group silhouette, interval, motion life와 hero exclusion을 확인한다.

### Determinism, status와 호환성 {#performance-formation-determinism-status-compatibility}

<!-- @evidence requirements/formations/budgets-and-validation.md#formation-determinism 같은 design과 seed에서 slot, variation, motion과 LOD 결과를 재현한다. -->
<!-- @evidence requirements/formations/budgets-and-validation.md#formation-failure-status failure, unsupported, not-run과 stale을 통과와 구분한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-deterministic-population seed와 identity의 deterministic population을 요구한다. -->

Formation evaluation identity는 design·prototype·world·shot digest, layout and seed law version, frame clock, chosen policy와 explicit seeds를 포함한다. Parallel chunk generation, worker count, traversal order와 seek order가 달라도 stable slot, variation, ground placement, cue state, LOD and culling outcome은 같아야 한다. 한 member를 재생성하는 oracle과 full runtime은 같은 transform과 state를 반환한다.

Status는 `passed`, `failed`, `unsupported`, `not-run`, `unbudgeted`, `stale`을 구분한다. Unsupported terrain or tier, missing cost input, stale camera evidence, determinism divergence를 빈 formation이나 pass로 바꾸지 않는다. 새 optional cue, layout, tier, variation이나 budget metric을 추가해도 기존 omission behavior는 유지하며, slot identity·seed·layout correspondence 또는 culling meaning 변경은 versioned migration이다.

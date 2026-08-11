# Formation identity, layout과 terrain

## 집단, unit과 member identity {#performance-formation-group-unit-member-identity}

<!-- @evidence requirements/formations/scope-and-identity.md#formation-scope-identity bounded 집단을 하나의 저작 단위로 정의한다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-all-repeated-subjects 사람뿐 아니라 모든 반복 subject를 같은 compact 원칙으로 다룬다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-open-kinds 집단 종류와 member profile을 열린 vocabulary로 둔다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-authoring-mode-selection compact, explicit, hybrid 저작 방식을 사용자가 선택하게 한다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-group-member-identity group, unit, slot과 named member identity를 구분한다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-story-binding story상의 집단과 formation design을 명시적으로 연결한다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-scope-refusal 무제한 anonymous node와 근거 없는 crowd 추정을 거부한다. -->
<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-groups-members story group과 개별 member 관계를 보존한다. -->

Formation record는 stable group identity, member prototype 또는 selectable prototype set, designed count, authoring mode, hierarchy root, layout rule, world anchor·facing, explicit seed, group capability와 story binding을 가진다. Member identity는 compact mode에서 `formation identity + stable slot identity`로 파생하고, explicit mode에서는 authored actor 또는 object identity를 직접 참조하며, hybrid mode는 대부분의 derived slot과 소수의 named override를 함께 둔다. 배열 순서나 현재 culling·LOD 상태가 identity를 만들지 않는다.

`all repeated subjects`는 인간 군중에 한정되지 않고 동물, 차량, 나무, 소품, 기계와 새로운 member profile을 허용한다. 다만 formation은 함께 배치·이동하고 group state를 공유하는 반복 주체를 위한 것이며, 독립 story state와 자유 motion이 필요한 모든 member를 compact formation으로 숨기지 않는다. 사용자가 authoring mode, count, prototype, seed와 override를 선택하고, 시스템은 규모만 보고 anonymous crowd로 자동 전환하지 않는다.

입력에 bounded count·layout·prototype·seed가 없거나 story가 개별 인물을 요구하는데 stable member identity가 없거나 explicit nodes가 declared budget을 넘으면 scope failure다. Output은 선택 mode, identity law, exact count, anonymous·named 분할, source provenance와 user decision을 포함한다.

### Hierarchy, membership와 command propagation {#performance-formation-hierarchy-membership-command}

<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-hierarchies-units 여러 scale의 formation을 nested unit으로 구성한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-membership containment와 membership을 stable identity 관계로 표현한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock child unit의 local frame과 clock mapping을 명시한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation shared rule 위에 unit-local variation을 적용한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-command-propagation 상위 command가 child unit에 전달되는 규칙을 정의한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-hierarchy-rule-provenance inherited, overridden, local rule provenance를 보존한다. -->
<!-- @evidence requirements/formations/hierarchies-and-units.md#formation-hierarchy-refusal cycle, 중복 membership과 모순된 rule을 거부한다. -->

Hierarchy는 formation 또는 unit identity를 node로, `contains`와 `member-of`를 edge로 가지며 한 active alternative에서 각 unit의 직접 parent는 하나다. Child의 placement와 motion은 parent-local frame, clock origin·rate와 inherited group state를 통해 world와 shot-local 상태로 변환한다. 같은 member가 배타적인 두 unit에 동시에 속하거나 containment cycle이 생기거나 child frame이 해석 불가하면 거부한다.

Command는 stable command identity, semantic action, issue time, propagation scope, latency·phase policy, target unit selector와 override rule을 가진다. Child는 shared rule을 상속하되 explicit local variation이나 hero exception이 있으면 그 provenance와 precedence를 기록한다. Output은 각 unit의 resolved command, local interval, inherited·overridden source, 미수용 이유와 group-level event를 포함하며, traversal order가 결과를 바꾸지 않도록 stable identity 순서와 deterministic tie-break을 사용한다.

### Layout 선택, slot과 assignment {#performance-formation-layout-slot-assignment}

<!-- @evidence requirements/formations/layouts-and-slots.md#formation-layouts-slots compact rule에서 모든 member 위치를 파생한다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters layout kind가 실제 사용하는 parameter만 받는다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity slot identity를 layout 배열 위치 변화와 분리한다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-slot-assignment-policy member와 slot 사이 assignment와 재배치 규칙을 명시한다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-local-frame layout을 unit-local frame에서 계산한다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-layout-dressing exact lattice와 authored dressing variation을 구분한다. -->
<!-- @evidence requirements/formations/layouts-and-slots.md#formation-layout-capacity 모든 member를 수용할 capacity를 검증한다. -->

Layout definition은 registered kind, count-dependent parameter schema, unit-local origin·forward·lateral·up basis, capacity law, slot generator와 bounds law를 가진다. Line, column, wedge처럼 spacing을 쓰는 kind는 lateral·depth 간격을 받고, arc는 radius·angle, scatter는 radius·seed처럼 실제 알고리즘이 소비하는 parameter만 받는다. 새 layout kind는 deterministic slot generation, capacity, bounds, reform correspondence와 validation을 함께 등록한다.

Slot identity는 stable index 또는 explicit stable key이고 slot state는 local position, facing, optional semantic role과 assignment를 가진다. Assignment policy는 fixed, stable nearest, role-aware, authored mapping 같은 방식을 선택하고, 동률은 stable identity로 해결한다. Re-layout이나 count 변화가 있을 때 어떤 identity가 유지되고 어떤 slot이 생성·삭제되는지 receipt를 남기며 배열을 다시 정렬해 background identity를 바꾸지 않는다.

Dressing은 exact slot에서 벗어날 수 있는 lateral·depth·facing tolerance와 seed law로 선언하고, layout integrity를 훼손하는 arbitrary per-member offset이 아니다. Parameter 누락·미사용, insufficient capacity, non-positive scale, non-finite result, duplicate slot, unstable ordering은 layout failure다.

## Terrain support와 route envelope {#performance-formation-terrain-route-envelope}

<!-- @evidence requirements/formations/terrain-and-routes.md#formation-terrain-routes formation을 실제 surface와 route 위에 배치한다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-terrain-support-profile member prototype의 ground·slope·step capability를 선언한다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-group-path group anchor가 따를 named path와 timing을 정의한다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-route-layout-envelope route width와 움직이는 layout envelope를 비교한다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-relief-adaptation 각 slot의 terrain height와 slope에 배치를 적응시킨다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-route-interior endpoint뿐 아니라 route interior와 reform interior를 검사한다. -->
<!-- @evidence requirements/formations/terrain-and-routes.md#formation-terrain-refusal unsupported, off-ground와 blocked route를 거부한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface formation mark와 route가 실제 support surface를 참조하게 한다. -->

Terrain input은 stable surface identity, footprint, single-valued height rule 또는 명시적 multi-space 경계, walkability, route centerline·width와 obstacle·zone relation을 제공한다. Formation support profile은 member footprint·height proxy, slope·step·clearance limit, contact points와 allowed surface kind를 가진다. Group path는 route identity나 explicit curve, progress timing, facing policy와 active layout state를 참조한다.

각 sample에서 unit-local slot을 group transform과 현재 layout deformation으로 옮긴 뒤 그 XZ 위치의 authoritative surface height와 normal을 구한다. Relief adaptation은 member vertical placement와 허용 orientation을 바꾸지만 stable slot identity와 group path progress를 바꾸지 않는다. Route gate는 centroid가 아니라 member footprint가 확장한 전체 moving envelope를 route width, turn radius, terrain support와 obstacle에 비교한다.

Endpoint가 모두 valid해도 path 또는 reform interior에서 바닥 밖, 과도한 slope, clearance 부족, route overflow가 발생하면 실패다. Ground가 다가값인 위치는 어느 space를 사용하는지 명시하지 않으면 unsupported이며 가장 위 surface로 몰래 snap하지 않는다. Output은 time, slot·unit, surface·route segment, required와 available envelope, height·slope residual과 변경 선택지를 제공한다.

### Spacing, overlap와 bounded avoidance {#performance-formation-spacing-overlap-avoidance}

<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-spacing-overlap-avoidance member가 차지하는 실제 공간을 spacing 판단에 사용한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-static-spacing 정적 layout의 body clearance를 측정한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-temporal-overlap group motion과 reform 내부의 시간 overlap을 검사한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-bounded-avoidance avoidance 보정을 명시된 범위와 시간 안에 제한한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-avoidance-integrity avoidance가 layout, route와 story 의미를 깨지 않게 한다. -->
<!-- @evidence requirements/formations/spacing-overlap-and-avoidance.md#formation-avoidance-refusal 실제 겹침을 tolerance로 숨기거나 무제한 solve하지 않는다. -->

Spacing 검증은 slot point가 아니라 각 member representation의 conservative body proxy, current scale·pose 또는 declared motion bound, clearance margin을 사용한다. 정적 상태와 cue endpoint뿐 아니라 translation, turn, spacing change, layout reform와 slot exception의 interior sample에서 같은 formation 내부와 서로 다른 formation 사이의 overlap을 검사한다. Removed member는 drawn·measured set에서 제외하지만 designed count와 design bounds는 별도 기록으로 유지한다.

Avoidance가 enabled이면 최대 local offset, response speed, iterations, neighbor radius, protected rank·role, route·zone constraint와 seed를 입력으로 받는다. 보정은 stable identity 순서로 결정되고 group centroid, layout role, command timing, hero path와 semantic contact를 허용 한계 안에서 보존한다. 한계를 넘기거나 보정 후에도 overlap이 남거나 route·ground·formation integrity를 깨면 실패하며, body proxy를 줄이거나 검증 sample을 줄여 통과시키지 않는다.

### Hero, variation과 group state {#performance-formation-hero-variation-group-state}

<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-heroes-variation-state 반복 집단 안의 개별 의미와 group state를 함께 보존한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-hero-overrides 일부 slot을 stable named actor로 승격한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-deterministic-population 같은 seed와 identity에서 같은 population을 재생성한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-authored-variation-profile variation property, range와 상관 관계를 저작한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-stable-background-identity background member identity가 revision과 shot 사이에서 유지되게 한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state group 상태와 member exception을 분리한다. -->
<!-- @evidence requirements/formations/heroes-variation-and-state.md#formation-continuity shot과 scene 사이 formation 상태를 handoff한다. -->
<!-- @evidence requirements/actors/populations-and-doubles.md#actor-doubles-replacement hero와 double 교체가 actor lineage를 보존하게 한다. -->

Hero override는 formation·slot identity와 named actor identity, promotion reason, active range, representation·performance binding을 연결한다. 승격된 member는 group base transform과 shared command를 상속하되 actor performance가 허용된 channel을 override하고, anonymous batch에서는 정확히 한 번 제외된다. Hero를 다시 anonymous로 내리거나 double로 교체하면 actor state handoff와 replacement receipt를 요구한다.

Variation profile은 allowed appearance·scale·phase·behavior property, distribution 또는 finite choices, range, cross-property correlation, unit·slot inheritance와 seed domain을 정의한다. 동일 formation revision, slot identity와 seed에서 모든 shot이 같은 background identity와 base variation을 재생성하고, shot-local event는 이 base를 파괴하지 않는 별도 state로 쌓인다. Group state는 layout, route progress, command, cohesion과 active variation mode를 가지며 member exception은 present·offset·facing·individual event처럼 sparse하게 유지한다.

Continuity handoff는 group transform, active layout, reform progress, command phase, shared gait phase law, removed·moved exceptions, hero actor state를 포함한다. Cut에서 시간을 건너뛰면 change cause를 기록하고, 아무 근거 없이 original layout·full count·default seed로 reset하지 않는다.

### Compact representation 호환성 {#performance-formation-compact-representation-compatibility}

<!-- @evidence requirements/formations/scope-and-identity.md#formation-authoring-mode-selection compact와 explicit 결과가 같은 story identity를 공유하게 한다. -->
<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-semantic-preservation representation 교체가 member와 group 의미를 보존하게 한다. -->

Compact runtime은 모든 anonymous member node를 저장하지 않고 design, hierarchy, layout, seed, bounded chunks, hero·member exception과 regeneration contract를 보존한다. Consumer는 동일한 slot generator와 terrain snapshot, variation law를 사용하고 자체 layout arithmetic을 재구현하지 않는다. Explicit 또는 hybrid 표현으로 바뀌어도 group·member stable identity, state, event와 bounds 의미가 유지되어야 한다.

새 layout·variation·member profile은 기존 기록의 omission semantics를 바꾸지 않는 additive extension이어야 한다. Identity law, slot ordering, seed derivation, terrain selection 또는 assignment 의미가 바뀌면 version과 migration receipt가 필요하며, old runtime을 새 법칙으로 조용히 재생성하지 않는다.

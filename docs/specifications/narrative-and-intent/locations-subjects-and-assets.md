# 장소, Subject와 Asset 계획 {#narrative-intent-locations-subjects-document}

## Location Binding 상태 {#narrative-intent-location-binding-state}

### Location Scope와 Context {#narrative-intent-location-scope-context}

<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-locations-context story, physical과 design identity를 분리한다. -->
<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-place-identity-reuse redress와 geometry reuse의 공유 및 격리 범위를 정한다. -->

Location binding은 story location identity, physical place 또는 bounded stage identity, design variant, scene와 time, weather, access, surrounding context와 current state를 가진다. 같은 이름, 공유 geometry 또는 redress만으로 다른 극중 장소의 damage, dressing와 weather를 합치지 않는다.

<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-scope visible, interaction, camera, light, shadow와 sound 범위를 분리한다. -->
<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-environment terrain, building, interior와 environment 관계의 source 경계를 유지한다. -->

Location scope는 establishing view, visible bounds, interaction bounds, traversable region, camera access, off-screen continuation, light와 shadow influence, sound context, reflection context와 inaccessible background를 구분한다. 범위 밖 geometry와 state는 존재한다고 추정하지 않고 ground, opening, route와 boundary를 여러 source가 복제해 충돌하면 authority finding을 출력한다.

### Semantic Zone, Anchor와 Traversal {#narrative-intent-location-anchor-traversal}

<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-anchors-zones 의미 좌표를 stable identity로 제공한다. -->
<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-access-traversal traversal class별 route와 clearance를 정한다. -->

Entrance, exit, objective, refuge, threat, observation point, route, action zone과 landmark는 stable semantic identity와 physical binding을 가진다. Actor, formation, vehicle 또는 project-defined traversal class마다 width, slope, clearance, obstacle와 forbidden region을 판정하며 화면에서 길처럼 보이는 것은 이동 가능 evidence가 아니다.

### Location Time, Continuity와 Build Scope {#narrative-intent-location-time-build-scope}

<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-time-state weather, occupancy, damage와 service를 story time 또는 phase에 연결한다. -->
<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-continuity scene 사이 location state 변화를 추적한다. -->
<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-production-scope 필요한 view, action과 delivery tier에서 build scope를 도출한다. -->

Weather, season, light, occupancy, damage, dressing와 service state는 유효 story time 또는 named phase와 cause를 가진다. Required view, story action, population, interaction, reflection, shadow, sound와 delivery tier에서 build scope를 도출하며 필요하지 않은 인접 지역 detail을 location completeness로 요구하지 않는다.

### Location Review {#narrative-intent-location-review}

<!-- @evidence requirements/production-design/locations-and-world-context.md#production-design-location-review plan, eye-level, action과 required camera view를 독립 관찰한다. -->

Review는 plan, eye-level, action view와 required camera view별로 scale, route, landmark, ground contact, occlusion, continuity와 state를 판정한다. Concept image 또는 prose 하나는 보지 않은 방향과 traversal의 evidence가 아니며 누락 view는 partial 또는 not-run이다.

## Subject Breakdown Graph {#narrative-intent-subject-breakdown-graph}

### Identity, Prototype와 Representation Role {#narrative-intent-subject-prototype-role}

<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-breakdown scene와 semantic event에서 required subject를 도출한다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-breakdown-completeness required use와 plan item의 양방향 closure를 판정한다. -->

Breakdown edge는 scene 또는 event requirement, subject identity, category, owner, purpose, required state, viewing condition, interaction, continuity phase, consumer와 acceptance를 가진다. Mention-only entity와 제작 또는 등록 대상, valid-empty category와 not-analyzed category를 구분한다.

<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-prototype-instance 고유 subject, prototype, instance, variant와 hero exception을 구분한다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-hero-background hero, interactive, population, proxy와 context tier를 나눈다. -->

Subject occurrence는 story 또는 design identity, shared prototype, instance identity, variant, hero exception과 representation role을 가진다. Close interaction, distant context, reflection 또는 shadow-only 목적은 서로 다른 tier를 사용할 수 있지만 identity, scale, major silhouette, state와 attachment를 보존한다.

### Capability Ledger {#narrative-intent-subject-capability-ledger}

<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-capability-ledger scene이 요구하는 pose, motion, state와 interaction을 검증 가능하게 만든다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-missing-subject owner 없는 model, state 또는 behavior를 찾는다. -->

Capability entry는 requesting scene 또는 event, subject, pose, motion, state, interaction, material change, damage 또는 attachment kind, range, target, timing, failure condition과 evidence를 가진다. 이름과 외형은 articulation이나 behavior 증거가 아니며 owner 없는 required capability는 missing-subject failure다.

### Build, Import와 Reuse 결정 {#narrative-intent-subject-source-strategy}

<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-build-import-reuse build, direct placement, conversion, reuse와 group composition 선택을 사용자에게 남긴다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-external-asset-closure 외부 asset의 bytes, license, axes, lineage와 permission을 닫는다. -->

Source strategy는 project-native build, external direct use, native conversion, prototype reuse 또는 group composition 중 선택되고 source bytes, license, permission, conversion loss, editability, axes와 unit, capability, proxy, LOD, budget와 consumer consequence를 비교한다. 제품은 특정 provider나 catalogue를 자동 우선하지 않는다.

### Asset Plan Lifecycle {#narrative-intent-asset-plan-lifecycle}

<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-asset-plan-status-owner plan item의 owner, dependency, milestone과 status를 명시한다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-state-inventory mutually exclusive state와 variant를 열거한다. -->
<!-- @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-replacement-retirement replacement와 retired evidence의 재지정을 막는다. -->

Asset plan item은 owner, source strategy, tier, dependency, planned, acquired, authored, validated, approved 또는 superseded 상태, milestone, review scope와 blocking issue를 가진다. Required state와 mutually exclusive variant를 나누고 replacement는 scale, silhouette, capability, state mapping과 affected scene을 비교하며 retired evidence를 새 identity에 자동 연결하지 않는다.

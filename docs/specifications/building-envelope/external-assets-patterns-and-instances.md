# 외부 자산, Pattern과 Instance {#building-envelope-external-pattern-instance-specification}

## 외부 3D 자산 채택 {#building-envelope-external-asset-adoption}

<!-- @evidence requirements/building-exterior/external-assets-and-placement.md#building-exterior-external-assets 건물 외피용 glTF·GLB의 direct placement, native conversion과 group composition을 사용자 선택으로 규정한다. -->

외부 자산 revision은 exact source bytes, dependency closure, digest, format·feature interpretation, unit·axis·origin, license와 adoption receipt를 가진다. 건물은 그 revision을 direct representation, native result 또는 mixed group의 구성원으로 채택하며 특정 provider나 asset catalogue를 전제하지 않는다.

### Direct, Native와 Group 입력 {#building-envelope-external-adoption-input}

<!-- @evidence requirements/building-exterior/external-assets-and-placement.md#building-exterior-external-adoption-choice 사용자가 선택한 채택 방식을 보존하고 시스템이 다른 방식을 몰래 선택하지 않게 한다. -->

입력은 selected scene 또는 node subtree, adoption mode, source-to-building transform, target building·element·space, supported feature subset와 semantic enrichment를 제공한다. Direct mode는 지원되는 scene graph와 local transform을 보존하고 native mode는 source-to-result identity, 변환·병합·근사·loss를 기록하며 group mode는 원본 hierarchy와 상위 assembly relation을 함께 유지한다.

### Building Placement 불변식 {#building-envelope-external-building-placement-invariant}

<!-- @evidence requirements/building-exterior/external-assets-and-placement.md#building-exterior-external-size-level-constraints 외부 자산의 실제 크기, level, facade·roof host, support와 collision을 resolved geometry로 검증한다. -->

외부 bounds만이 아니라 최종 geometry가 building frame의 mass, storey elevation, facade·roof surface, opening, support, clearance와 declared view range 안에서 성립해야 한다. Source node identity와 building element identity의 mapping은 replacement 뒤에도 lineage를 보존한다.

### Closure, 실패와 호환성 {#building-envelope-external-asset-failure-compatibility}

<!-- @evidence requirements/building-exterior/external-assets-and-placement.md#building-exterior-external-resource-closure 외부 자산의 dependency closure, unsupported feature, provenance와 credential 경계를 검증한다. -->

Missing dependency, path escape, digest mismatch, non-finite transform, unit·axis ambiguity, unsupported required feature, budget 초과와 credential 포함은 채택을 중단한다. 비필수 feature degradation은 사용자 선택, consequence와 receipt를 요구하며 source revision이나 interpretation이 바뀌면 placement, quantity, LOD, render와 review를 stale로 만든다.

## Pattern과 Instance Resolution {#building-envelope-pattern-instance-resolution}

<!-- @evidence requirements/building-exterior/patterns-and-instances.md#building-exterior-patterns-instances facade bay, cladding, roof module, rail, 반복층과 건물군을 prototype·pattern·instance로 해결한다. -->

Pattern은 host-local coordinate, prototype, module, joint, orientation, bounded region, exclusion, border, transition, seed, variation과 explicit exception을 가진다. Instance는 stable identity, prototype relation, composed transform, material·state override, phase와 provenance를 유지한다.

### Pattern 입력과 Occurrence 출력 {#building-envelope-pattern-input-output}

<!-- @evidence requirements/building-exterior/patterns-and-instances.md#building-exterior-pattern-continuity opening, corner, zone과 tile boundary를 가로지르는 pattern continuity를 재현 가능하게 한다. -->

입력은 host face 또는 path, zone별 module law, cut rule, minimum piece, adjacency, correlation scale, seed와 expansion budget을 제공한다. 출력은 whole occurrence transform, cut piece geometry, exception, joint, covered·consumed·waste quantity, finding과 source rule digest다.

### Instance Identity와 국소 안정성 {#building-envelope-instance-local-stability-invariant}

<!-- @evidence requirements/building-exterior/patterns-and-instances.md#building-exterior-instance-exceptions prototype, inherited variation과 explicit override의 출처를 각 instance에 보존한다. -->

Unchanged host region과 stable member identity는 unrelated edit, generation order, 병렬 실행, batching, culling과 LOD 전환 뒤에도 같은 placement와 variation을 유지해야 한다. Hero exception과 cut piece는 일반 instance로 다시 흡수되지 않고 고유 identity와 geometry를 유지한다.

### 반복층·건물과 Budget 실패 {#building-envelope-repeated-building-budget-failures}

<!-- @evidence requirements/building-exterior/patterns-and-instances.md#building-exterior-instance-bounded-expansion 반복 외피, 층과 건물군의 expanded object·triangle·material·collision 수를 제한하고 보고한다. -->

Repeated storey와 building은 prototype scale, level offset, site transform와 instance override를 분리한다. Expansion bound 초과, sliver, overlap, unsupported cut, joint deviation, grain break, duplicate identity와 prototype cycle은 named finding이며 story-relevant instance를 조용히 제거해 budget을 맞추지 않는다.

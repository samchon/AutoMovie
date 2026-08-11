# Pattern, 공차와 Aging

## 물리적 module pattern {#interior-space-physical-module-pattern}

<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-texture-pattern-variation Requires physical modules to remain distinct from texture repetition. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-source Requires a user-authored pattern source and frame. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-cuts-borders Requires real cuts, borders, exclusions, and minimum pieces. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-deterministic-variation Requires seeded reproducible variation. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-group-correlated-variation Requires shared deviations to correlate across a declared group. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-refusal Requires invalid or unsupported pattern results to fail. -->

Tile, brick, board, panel, slab와 반복 ornament는 host face와 bounded zone, local origin·basis, 실제 module geometry·size·thickness, layout law, nominal joint, border, exclusion, minimum surviving fraction, grain direction, seed와 variant 집합을 입력으로 받는 물리적 배치다. 여러 zone은 서로 다른 law와 module을 가질 수 있고, opening·drain·fixture·access panel을 실제로 비우며 boundary에서 whole·cut occurrence를 stable identity로 출력해야 한다. 동일 입력과 seed는 동일 placement, cut, joint와 quantity를 내야 하고 texture UV repeat는 module 수량을 대신하지 못한다. Sliver, unsupported piece, overlap, joint deviation, grain break, budget 초과와 unresolved border는 failure이며 지원하지 않는 curved host는 faceted 또는 explicit degradation으로 선언되지 않으면 성공이 아니다.

## Seed hierarchy와 correlated tolerance {#interior-space-seed-correlated-tolerance}

<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerances-imperfections Requires bounded authored imperfections rather than accidental noise. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-authoring-choice Requires the user to choose whether imperfections exist. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerance-kinds Requires distinct gap, offset, rotation, scale, bow, and color channels. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-seed-hierarchy Requires work, group, zone, and occurrence seed scopes. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerance-channels Requires channel-specific distributions and limits. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-boundaries Requires deviations to respect host and clearance boundaries. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-canonical-result Requires canonical resolved deviations. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-refusal Requires unbounded or unseeded variation to fail. -->

Imperfection은 `none`, explicit occurrence values 또는 seeded rule 중 사용자가 선택하는 입력이며 시스템 default로 자동 추가하지 않는다. Rule은 work·assembly group·zone·occurrence seed hierarchy, shared bias와 local residual의 결합 방식, gap·translation·rotation·scale·bow·edge·surface·color별 distribution, bound, correlation length와 mutual-correlation matrix를 선언해야 한다. 동일 group의 타일은 shared installation error를 함께 받고 occurrence residual만 미묘하게 달라질 수 있으며, measured gap과 nominal gap, intended misalignment와 accidental topology error를 구분한 canonical 결과를 identity별로 출력한다. Non-finite·unbounded 값, seed 없는 무작위성, non-positive scale, opening·host·clearance 침범, negative joint와 distribution order에 따른 결과 변화는 failure이고 새로운 channel을 추가해도 기존 channel의 seed stream을 바꾸지 않는 호환성 규칙을 가져야 한다.

## 사용자 저작 wear, soiling과 aging {#interior-space-user-authored-aging}

<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-wear-soiling-aging Requires wear, soiling, and aging as traceable authored state. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-authoring-choice Requires explicit user choice instead of automatic realism. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-source-mask Requires source and mask identity. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-causal-placement Requires causal placement by use, contact, moisture, and exposure. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-group-variation Requires group-level continuity with member variation. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-surface-geometry-distinction Requires visual aging and geometric damage to remain distinct. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-continuity-refusal Requires implausible discontinuity and unsupported aging claims to fail. -->

Wear, dirt, staining, discoloration, corrosion, fading, polish와 damage는 사용자가 `none`, texture·mask source, procedural rule 또는 explicit geometry로 선택하고 phase·time·use state에 연결하는 입력이다. Source digest, UV·world projection, mask domain, intensity·color·roughness·normal·displacement channel, threshold·door handle·traffic path·water edge·leak·sunlight 같은 causal anchor, seed와 group correlation을 보존해야 한다. 출력은 resolved visual channels와 실제 chipped·warped·eroded geometry를 구분하고 같은 continuous surface와 repeated group에서 intentional continuity와 occurrence variation을 재현한다. 자동 dirty preset, source 없는 얼룩, 물리 damage를 normal map만으로 검증했다는 주장, host seam에서 이유 없이 끊긴 aging과 phase에 맞지 않는 상태는 failure이며 source가 교체되면 affected material, quantities, captures와 review가 stale이다.

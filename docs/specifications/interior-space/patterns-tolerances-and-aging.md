# Pattern, 공차와 Aging

## Contract units {#spec-patterns-tolerances-and-aging-contract-units}

### 물리적 module pattern {#interior-space-physical-module-pattern}

<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-texture-pattern-variation Requires physical modules to remain distinct from texture repetition. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-source Requires a user-authored pattern source and frame. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-cuts-borders Requires real cuts, borders, exclusions, and minimum pieces. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-deterministic-variation Requires algorithm, stream and channel policy to participate in reproducible pattern identity. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-group-correlated-variation Requires shared deviations to correlate across a declared group. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-refusal Requires invalid or unsupported pattern results to fail. -->

Tile, brick, board, panel, slab와 반복 ornament는 host face와 bounded zone, local origin·basis, 실제 module geometry·size·thickness, layout law, nominal joint, border, exclusion, minimum surviving fraction, grain direction, seed, generator 또는 noise algorithm identity와 version, stable stream-key scheme, channel별 distribution·quantization·outlier policy·correlation·composition order와 variant 집합을 입력으로 받는 물리적 배치다. 여러 zone은 서로 다른 law와 module을 가질 수 있고, opening·drain·fixture·access panel을 실제로 비우며 boundary에서 whole·cut occurrence를 stable identity로 출력해야 한다.

Pattern receipt는 입력 rule과 algorithm revision, stream-key scheme, channel policy, occurrence별 stream key, nominal·variation transform, cut, joint와 quantity를 resolved revision identity에 결속해야 한다. 동일 receipt basis는 동일 placement, cut, joint와 quantity를 내야 하고 texture UV repeat는 module 수량을 대신하지 못한다. Algorithm identity·version, stream-key scheme 또는 channel composition policy가 바뀌면 새 resolved revision을 만들고 이전 quantity, drawing, capture와 review를 stale로 표시해야 한다.

Sliver, unsupported piece, overlap, joint deviation, grain break, budget 초과, unresolved border, undeclared algorithm version, unstable stream key와 policy 밖 outlier는 failure이며 지원하지 않는 curved host는 faceted 또는 explicit degradation으로 선언되지 않으면 성공이 아니다.

### Seed hierarchy와 correlated tolerance {#interior-space-seed-correlated-tolerance}

<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerances-imperfections Requires bounded authored imperfections rather than accidental noise. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-authoring-choice Requires the user to choose whether imperfections exist. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerance-kinds Separates comparison, survey, material, fabrication, installation, movement and authored variation semantics. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-seed-hierarchy Requires versioned algorithms and stable streams across work, group, zone and occurrence scopes. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-tolerance-channels Requires channel-specific distributions, quantization, outliers, correlation and composition order. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-boundaries Requires deviations to respect host and clearance boundaries. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-canonical-result Requires canonical resolved deviations. -->
<!-- @evidence requirements/interior/tolerances-and-imperfections.md#interior-imperfection-refusal Requires unbounded or unseeded variation to fail. -->

Imperfection은 `none`, explicit occurrence values 또는 seeded rule 중 사용자가 선택하는 입력이며 시스템 default로 자동 추가하지 않는다. 모든 tolerance value는 `numeric-comparison`, `survey-uncertainty`, `material-dimension`, `fabrication`, `installation`, `movement` 또는 `authored-aesthetic` semantic kind, 수치 또는 분포, unit, 적용 identity·scope, source basis와 유효 조건을 가져야 한다. Numeric comparison tolerance는 판정 threshold이고 survey uncertainty는 관측 범위이며 material·fabrication·installation·movement tolerance와 authored aesthetic variation은 서로 다른 설계·제작 의미이므로 한 kind의 값을 다른 kind의 geometry offset, pass threshold 또는 결함 면제로 사용할 수 없다.

Seeded rule은 work·assembly group·zone·occurrence seed hierarchy, generator 또는 noise algorithm identity와 version, stable stream-key scheme, shared bias와 local residual의 결합 방식, gap·translation·rotation·scale·bow·edge·surface·color별 distribution, bound, quantization, bounded outlier policy, correlation length, mutual-correlation matrix와 channel composition order를 선언해야 한다. 동일 group의 타일은 shared installation error를 함께 받고 occurrence residual만 미묘하게 달라질 수 있으며 grout·gap의 누적 drift와 rare outlier를 독립 noise로 축약하지 않는다.

Resolved tolerance receipt는 typed input values, algorithm revision, stream-key scheme, channel policy, occurrence별 stream key, nominal value, sampled deviation, measured residual과 적용한 comparison threshold를 canonical result identity에 결속해야 한다. Algorithm identity·version, stream-key scheme, distribution·quantization·outlier policy, correlation 또는 composition order가 바뀌면 새 revision을 만들고 이전 quantity, clearance, capture와 review를 stale로 표시해야 한다.

Non-finite·unbounded 값, unit 없는 tolerance, semantic kind 교환, seed 없는 무작위성, non-positive scale, opening·host·clearance 침범, negative joint와 선언되지 않은 composition order에 따른 결과 변화는 failure다. 새로운 channel을 추가해도 기존 channel의 stable stream key와 resolved deviation을 바꾸지 않는 호환성 규칙을 가져야 한다.

### 사용자 저작 wear, soiling과 aging {#interior-space-user-authored-aging}

<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-wear-soiling-aging Requires wear, soiling, and aging as traceable authored state. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-authoring-choice Requires explicit user choice instead of automatic realism. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-source-mask Requires source and mask identity. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-causal-placement Requires causal placement by use, contact, moisture, and exposure. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-group-variation Requires versioned stable streams for group continuity and member variation. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-surface-geometry-distinction Requires visual aging and geometric damage to remain distinct. -->
<!-- @evidence requirements/interior/wear-soiling-and-aging.md#interior-aging-continuity-refusal Requires implausible discontinuity and unsupported aging claims to fail. -->

Wear, dirt, staining, discoloration, corrosion, fading, polish와 damage는 사용자가 `none`, texture·mask source, procedural rule 또는 explicit geometry로 선택하고 phase·time·use state에 연결하는 입력이다. Source digest, UV·world projection, mask domain, intensity·color·roughness·normal·displacement channel, threshold·door handle·traffic path·water edge·leak·sunlight 같은 causal anchor와 group correlation을 보존해야 한다. Procedural aging은 project·room·installation lot·route 또는 exposure zone·occurrence seed hierarchy, generator 또는 noise algorithm identity와 version, stable stream-key scheme, channel별 distribution·quantization·bounded outlier policy·correlation·composition order를 추가 입력으로 가져야 한다.

Aging receipt는 source와 mask revision, causal anchor, algorithm revision, stream-key scheme, occurrence별 stream key, channel policy와 resolved visual·geometry result를 하나의 aging revision identity에 결속해야 한다. 출력은 resolved visual channels와 실제 chipped·warped·eroded geometry를 구분하고 같은 continuous surface와 repeated group에서 intentional continuity와 occurrence variation을 재현한다. Algorithm identity·version, stream-key scheme 또는 channel policy가 바뀌면 새 aging revision을 만들고 affected material, quantities, captures와 review를 stale로 표시해야 한다.

자동 dirty preset, source 없는 얼룩, seed 또는 algorithm version 없는 procedural result, policy 밖 outlier, 물리 damage를 normal map만으로 검증했다는 주장, host seam에서 이유 없이 끊긴 aging과 phase에 맞지 않는 상태는 failure다. Texture·mask source 교체도 기존 aging revision을 덮어쓰지 않고 같은 downstream 결과를 stale로 만들어야 한다.

# Identity, Coordinate와 Unit Normalization

## Identity 계층과 참조 {#interchange-identity-hierarchy}

### Immutable Source Revision {#interchange-source-revision-identity}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-import-identity Path와 label에 독립적인 source, revision, interpretation과 consumer identity를 분리한다. -->

Identity graph는 logical source, immutable source revision, source-local element, interpretation, adoption, derived result와 consumer reference를 별도 node kinds로 유지한다. Path, URL, response name와 display label은 locator 또는 alias이며 digest와 interpretation identity를 대신하지 않고 relink는 identity graph의 edge만 갱신한다.

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-source-revision Mutable source의 취득 결과를 덮어쓰지 않는 revision identity로 만든다. -->

Source revision은 canonical raw payload digest, acquisition envelope digest, closure root와 source locator snapshot으로 식별된다. Structured response, archive member와 dependency는 각자 content digest와 parent position을 가지며 새 retrieval의 digest나 closure가 다르면 이전 revision과 공존하는 successor가 된다.

### Content와 Provenance 분리 {#interchange-content-provenance-identity}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-content-provenance 같은 bytes의 content identity와 서로 다른 source·license identity를 합치지 않는다. -->

Content digest는 byte deduplication과 equality에 사용할 수 있지만 provenance node, rights snapshot과 acquisition activity는 source별로 유지한다. Metadata-only 변화가 interpretation, license, attribution, coordinate, clock 또는 consumer 결과를 바꾸면 raw media digest가 같아도 distinct import revision을 만든다.

### Element와 Dependency Identity {#interchange-element-dependency-identity}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Source 내부 element와 import result의 대응을 stable identity로 유지한다. -->

Element identity는 source revision과 format-defined key 또는 deterministic source-order key의 pair이며 duplicate labels와 reorderable display names를 key로 사용하지 않는다. Derived result는 one-to-one, one-to-many, many-to-one 또는 omitted mapping을 명시하고 dependency identity는 consumer edge와 required·optional role을 함께 가진다.

### Spatial Transform Chain {#interchange-spatial-transform-chain}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Axis, handedness, origin, unit와 datum을 project space에 명시적으로 연결한다. -->
<!-- @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Source에서 world까지의 transform order와 precision을 추적한다. -->

Spatial normalization은 source reference, axis basis와 handedness conversion, length·angle unit scale, local transform, placement transform, geographic reprojection 또는 local-datum link를 ordered chain으로 기록한다. 각 stage의 input·output reference, finite parameters, precision과 residual을 검증하고 missing 또는 contradictory basis에서는 transform을 산출하지 않는다.

### Rational Time와 Sample Mapping {#interchange-time-sample-mapping}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-time-units Video, audio, motion과 observation clock을 rational mapping으로 결속한다. -->

Timed input은 source time domain, rational rate 또는 sample rate, start, duration, inclusive·exclusive boundary, timestamp epoch와 project film-time mapping을 가진다. Frame, sample, second와 wall-clock timestamp 사이 변환은 exact rational relation과 rounding policy를 기록하고 누적 floating conversion을 identity 밖 hidden behavior로 두지 않는다.

### Value Interpretation Layer {#interchange-value-interpretation-layer}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-value-interpretation Color, channel, no-data와 scalar unit을 값과 함께 해석한다. -->

Raster, material, audio와 numeric dataset의 value layer는 channel roles와 order, color space와 transfer, alpha semantics, scalar unit, normalization, no-data sentinel와 encoding을 source fact로 기록한다. Missing metadata에 default를 적용할 때는 profile-defined assumption과 consequence를 degradation record에 남기며 source-declared fact로 serialize하지 않는다.

### Collision과 Ambiguity Refusal {#interchange-identity-ambiguity-refusal}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-collision-ambiguity Duplicate id, mapping과 coordinate ambiguity를 순서로 해소하지 않고 거부한다. -->

같은 scope의 duplicate identity, 여러 target에 맞는 element mapping, digest disagreement, incompatible spatial reference와 competing authority는 typed ambiguity findings를 만든다. Resolver는 discovery order, newest timestamp, shortest path와 visual similarity로 winner를 고르지 않고 candidate identities와 blocked consumers를 반환한다.

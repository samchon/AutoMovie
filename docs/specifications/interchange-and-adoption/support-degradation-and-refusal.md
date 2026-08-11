# Support, Degradation과 Refusal

## Support 상태 모델 {#interchange-support-state-model}

### Format과 Feature Matrix {#interchange-format-feature-support-matrix}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-degradation Supported, degraded, unsupported, invalid, unavailable, quarantined와 not-run을 구분한다. -->

Support result는 selected format, version, feature, element, dependency와 intended consumer 각각에 `supported`, `degraded`, `unsupported`, `invalid`, `unavailable`, `quarantined` 또는 `not-run`을 부여하고 overall adoption state의 derivation을 제공한다. Visible output나 parser success는 child results를 supported로 승격하지 않는다.

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-format-feature Container 지원과 내부 feature 및 consumer 목적의 지원을 분리한다. -->

Media profile은 container version과 feature identifiers를 consumer capability matrix에 대해 판정하고 each feature의 source elements, required dependency와 interpretation result를 연결한다. Container가 accepted여도 unknown extension, codec, material, rig, animation, channel, schema와 semantic relation은 독립 status를 유지한다.

### Hard Refusal Predicate {#interchange-hard-refusal-predicate}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-hard-failure 신뢰, 안전, identity와 권리 불변식을 깨는 입력의 adoption을 중단한다. -->
<!-- @evidence requirements/repaint/providers-models-and-credentials.md#repaint-provider-refusal Unknown version, terms, leaked credential와 undeclared upload를 external result refusal에 포함한다. -->

Required closure 누락, digest mismatch, identity ambiguity, invalid coordinate·clock, unsafe active content, credential exposure, rights conflict, non-finite value와 resource budget exceed가 selected result의 truth를 깨면 hard refusal이 된다. Refusal은 blocked revision과 consumers를 반환하고 origin object, generic mesh, black frame, silence, empty metadata 또는 alternate provider result를 생성하지 않는다.

### Explicit Degradation Policy {#interchange-explicit-degradation-policy}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-user-chosen-degradation Optional feature의 제거, approximation, proxy와 source 교체를 사용자 승인 정책으로 제한한다. -->

Degradation은 unsupported feature가 optional이고 safety, rights, identity, coordinate, timing과 required semantic contract를 손상하지 않을 때만 candidate가 된다. Policy는 affected feature, permitted fallback, measurable consequence, review obligation과 user approval을 기록하고 receipt 및 current status에 결속하며 다른 source나 provider를 자동 선택하지 않는다.

### Independently Closed Partial Adoption {#interchange-partial-adoption-closure}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-partial-adoption-boundary 안전하고 complete한 subset만 독립 identity와 closure로 채택한다. -->

Partial adoption은 selected scene, stream, track, layer, range 또는 fields에서 새 closure roots를 계산하고 excluded elements로 향하는 required edge가 없음을 증명해야 한다. Accepted subset은 own identity, technical facts와 support report를 가지며 excluded behavior와 resource를 보존했다는 claim을 포함하지 않는다.

### Placeholder Status Fence {#interchange-placeholder-status-fence}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-placeholder-final-boundary Proxy와 placeholder를 accepted final input 및 검증된 fidelity와 분리한다. -->

Placeholder는 replacement target, preserved timing·bounds·identity, known differences, permitted authoring stages와 expiration condition을 가진 explicit non-final adoption이다. Review와 publication gates는 placeholder-aware acceptance가 별도로 선언되지 않으면 placeholder를 required final resource, motion, picture, audio와 metadata의 충족으로 계산하지 않는다.

### Appearance와 Semantics Fence {#interchange-appearance-semantics-fence}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-fidelity-semantic-boundary Imported appearance와 실제로 해석한 rig, collision, behavior, likeness와 rights 의미를 구분한다. -->

Support report는 rendered appearance features, manipulable project-native semantics와 unverified semantics를 separate capability sets로 제공한다. High-detail geometry, realistic raster와 complex motion의 direct placement는 rig constraints, collision, physical behavior, likeness, authorability 또는 rights understanding을 암시하지 않는다.

### Compatibility와 Migration Gate {#interchange-compatibility-migration-gate}

<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-support-regression-compatibility 이후 environment가 이전 feature를 지원하지 않을 때 silent reinterpretation을 막는다. -->

Reader는 adopted revision의 interpretation profile과 support matrix version을 확인하고 current environment가 이를 재현하지 못하면 existing pinned result, compatible prior interpreter, explicit migration candidate 또는 unsupported state 중 가능한 outcomes를 반환한다. Migration은 source-to-result diff, new degradation과 user approval을 요구하며 기존 bytes를 새 semantics로 조용히 해석하지 않는다.

# Validation과 Quarantine

## Quarantine State Machine {#interchange-quarantine-state-machine}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-quarantine 검증 전 외부 bytes를 production input과 분리된 quarantine 상태에 둔다. -->

Acquisition이 완료된 source revision은 항상 quarantine namespace와 identity를 얻고 validation transaction이 성공하기 전에는 executable input, agent context, scene, timeline, build와 publication graph에서 참조할 수 없다. Preview와 inspection은 bounded read-only view를 사용하며 state transition은 원본 revision과 findings digest를 함께 봉인한다.

### Declared와 Observed Fact Comparison {#interchange-declared-observed-comparison}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-content-facts Filename, media declaration, signature와 parser facts를 교차 검증한다. -->

Validation은 filename suffix, request media type, response header, byte signature, container declaration과 parser-confirmed facts를 independent observations로 유지한다. Required observations가 충돌하거나 한 byte sequence가 여러 active interpretation을 허용하면 media profile을 임의 선택하지 않고 `ambiguous-content` finding을 반환한다.

### Layered Structural Validation {#interchange-layered-validation}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Syntax 성공과 사용 목적에 맞는 구조·의미 검증을 분리한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-external-generated-validation External과 generated asset의 provenance, units, closure와 feature를 함께 검증한다. -->

Validation transaction은 container integrity, reference closure, scalar finiteness와 ranges, hierarchy·topology 또는 schema consistency, coordinate·unit·clock coherence, media-specific feature support와 intended-consumer suitability를 순서와 무관한 findings set으로 평가한다. Parser success는 placement, retarget, synchronization, geographic alignment 또는 publication suitability를 충족하지 않는다.

### Active Content Isolation {#interchange-active-content-isolation}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-active-content Macro, executable payload와 instruction-like content를 data inspection에서 실행하지 않는다. -->

Inspector는 macro, script, executable section, dynamic link, embedded command, remote include와 instruction-like text를 active-content inventory로 보고하되 실행하지 않는다. 명시적 별도 tool execution은 user authorization, isolated input·output closure와 새 acquisition activity를 요구하며 imported content 자체에 credential, filesystem 또는 network authority를 부여하지 않는다.

### Atomic Adoption Gate {#interchange-atomic-adoption-gate}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-adoption-gate Revision, validation, support, rights와 degradation을 하나의 adoption gate에서 결속한다. -->

Adoption gate는 source와 closure digests, inspection profile, complete findings, support decision, rights snapshot, adoption mode, explicit degradation과 user decision이 같은 transaction basis를 가리킬 때 candidate를 current로 승격한다. Gate 평가 중 어느 basis가 바뀌면 아무 consumer pointer도 갱신하지 않고 stale transaction으로 끝난다.

### Validation Result Envelope {#interchange-validation-result-envelope}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-result-states Acquired, quarantined, accepted, rejected, unavailable, unsupported, degraded와 not-run을 구분한다. -->

Result envelope는 overall state, inspection과 validation phase별 state, stable finding code, severity, source member와 element selector, violated invariant, consumer consequence와 correction boundary를 포함한다. `not-run`과 `unsupported`는 failure와 구분된 terminal observation이며 일부 phase의 pass가 전체 closure의 accepted state를 만들지 않는다.

### Quarantine Exposure와 Removal {#interchange-quarantine-exposure-removal}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-quarantine-handling 격리 자료의 안전한 preview, 교체와 제거 상태를 정의한다. -->

Quarantine view는 binary와 markup을 inert representation으로 제한하고 credentials, personal data와 hostile payload를 logs와 evidence에 복제하지 않는다. Replacement는 새 quarantine revision을 만들며 removal은 current candidates, active cache entries와 publication reachability에서 해당 revision을 끊고 audit record에는 redacted tombstone만 남긴다.

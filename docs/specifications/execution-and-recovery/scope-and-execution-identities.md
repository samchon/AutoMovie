# Scope와 실행 Identity

## 공통 실행 경계 {#execution-scope-boundary}

### Logical Job Identity {#execution-logical-job-identity}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-scope-job-identity Compile부터 publication까지 중단 이후 추적되어야 하는 작업의 공통 경계를 구체화한다. -->
<!-- @evidence requirements/product/charter.md#product-deterministic-prototype 결정론적 실행기가 제작 선언을 검증 가능한 결과로 만든다는 제품 경계를 보존한다. -->

실행 경계의 입력은 production identity와 revision, 작업 종류, target scope, requested parameters, effective parameters, dependency closure, compatibility profile, budget policy, priority와 요청 authority다. 출력은 canonical job identity, admission decision, 상태 및 transition history, attempt lineage, artifact와 checkpoint reference, diagnostics, resource accounting와 terminal outcome이며 어떤 실행 환경도 이 계약 밖의 hidden input으로 결과를 바꾸어서는 안 된다.

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs 결과에 영향을 주는 production, scope, 설정, dependency와 compatibility를 job identity에 닫는다. -->
<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work 요청값과 실제 확정값을 함께 보존하는 입력 계약을 정규화한다. -->

Logical job identity는 결과 의미를 결정하는 effective execution contract의 canonical digest다. Requested parameters와 default resolution 결과를 모두 기록하되 digest는 effective values를 사용하며, 의미 없는 property order, path separator와 locale 표기는 정규화하고 의미 있는 collection order와 absence는 보존해야 한다.

### Attempt Identity와 Lineage {#execution-attempt-identity-lineage}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-attempt-separation 논리 작업과 매 실행의 history를 분리하여 retry가 이전 기록을 덮지 않게 한다. -->

Attempt는 job identity, 증가하는 attempt ordinal, 시작 trigger, owner claim generation, execution profile, 시작 시각과 parent attempt를 가진다. Retry, owner 상실 뒤 checkpoint resume, manual restart와 recovery는 새 attempt를 만들고 같은 owner가 유지되는 pause resume은 기존 attempt의 상태 전이로 남기며, 하나의 attempt record는 다른 attempt의 상태, diagnostic, resource usage나 side effect receipt를 수정할 수 없다.

### 결정적 Output Identity {#execution-deterministic-output-identity}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-deterministic-reexecution-identity Scheduling과 retry 사실이 결정적 결과 의미를 바꾸지 않는 identity 불변식을 고정한다. -->
<!-- @evidence requirements/product/charter.md#product-reproducible-judgment 같은 입력과 실행 조건의 정규 결과를 비교할 수 있는 기준을 제공한다. -->

Output identity는 job identity와 해당 output role 및 deterministic compatibility profile로 결정하고 attempt ordinal, compatible machine assignment, worker 수, queue position, heartbeat, progress observation, wall clock과 retry delay를 제외해야 한다. Exact byte equality가 아닌 tolerance profile을 허용하면 metric, bound와 runtime class를 identity에 포함하고 exact profile과 같은 결과로 합치지 않는다.

### 실행 Record의 Input과 Output {#execution-record-input-output}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-terminal-state-truth Succeeded, published와 retained를 독립된 출력 사실로 표현한다. -->
<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-machine-readable-result 실행 상태와 완전성을 자유 문구 없이 소비할 수 있는 정규 출력을 요구한다. -->
<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-artifact-state-ownership Artifact completeness, integrity, validation과 publication을 독립된 정규 출력으로 보존한다. -->
<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-preserve-prior-success 과거 성공 evidence를 현재 freshness와 publication 여부가 덮어쓰지 않게 한다. -->

정규 실행 record는 versioned machine-readable data이며 입력 identity, execution state, artifact별 materialization과 completeness, integrity와 validation, freshness와 compatibility, publication selection과 generation, availability와 quarantine, retention status, domain verdict와 phase를 독립 field로 전달해야 한다. 과거 성공 receipt는 새 snapshot이 stale, incompatible, superseded, unavailable 또는 quarantined가 되어도 이력으로 보존하고, human message는 이 정규 의미를 보조하며 record를 읽지 못하는 consumer는 unknown version을 success나 empty result로 해석해서는 안 된다.

### Domain Result와 운영 상태의 분리 {#execution-domain-result-separation}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-derived-separation 입력 결함, 실행 실패와 파생 결과 상태를 서로 다른 경계로 전달한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized 계획, 실제 bytes와 검증 상태를 실행 단계의 상태와 혼동하지 않게 한다. -->

Job state는 작업이 어디까지 수행되었는지를 말하고 domain result는 만들어진 artifact나 verdict의 의미를 말한다. Running job이 complete artifact를 일부 가질 수 있고 succeeded job이 아직 unpublished일 수 있으므로 어느 한 상태를 다른 상태에서 추론하지 않으며, domain-specific failure는 해당 domain identity와 affected scope를 보존한 채 execution failure로 연결해야 한다.

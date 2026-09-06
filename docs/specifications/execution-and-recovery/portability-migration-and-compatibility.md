# Portability, Migration과 Compatibility

## Durable Record Compatibility {#execution-record-compatibility}

### Cross-platform Record Portability {#execution-cross-platform-portability}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-compatibility Job, checkpoint, artifact, receipt, policy와 audit record를 환경 변화 뒤에도 해석 가능하게 한다. -->

모든 durable execution record는 schema version, semantic protocol identity, producer compatibility profile, canonical encoding과 integrity를 가진다. Consumer는 supported version range와 feature set을 선언하고 unknown required field, state 또는 semantic version을 success, absent 또는 default로 해석하지 않는다.

<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-paths Windows와 POSIX 차이가 identity, naming과 dependency discovery를 바꾸지 않게 한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism Locale, timezone와 wall clock을 결과의 hidden input에서 제외한다. -->

Canonical record는 UTF-8 text or declared binary encoding, normalized logical path, explicit case and ordering rules, finite numeric representation, rational time와 explicit unit을 사용해야 한다. Host path, inode-like identity, process id와 wall-clock observation은 operational evidence로 보존할 수 있지만 portable job, checkpoint와 output identity의 의미를 결정하지 않는다.

### Resume Compatibility Classification {#execution-resume-compatibility}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification 이전 checkpoint를 exact compatible, migration-required 또는 incompatible로 분류한다. -->

Compatibility evaluator는 checkpoint schema and semantics, job contract, dependency closure, deterministic profile와 current consumer capability를 입력으로 받아 exact, migratable, incompatible 또는 unknown과 affected fields and work units를 출력한다. Exact만 직접 resume할 수 있고 migratable은 migration result를 새 checkpoint로 검증한 뒤 사용한다.

### Non-destructive Migration {#execution-nondestructive-migration}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration 원래 durable record와 provenance를 보존하고 새 record의 변환 계보를 남긴다. -->

Migration input은 immutable source record, source and target protocol, migration policy와 authority다. Output은 new identity, source reference, transformed and preserved fields, loss report, validation과 compatibility result를 가지며 source generation을 수정하거나 sole recovery point를 target validation 전에 교체하지 않는다.

Scaffold contract migration은 이전 generation의 path, digest와 anchor inventory, 설치된 목표 bytes, 현재 project bytes를 입력으로 고정한다. Planner는 add, write와 unambiguous rename을 exact source digest에 묶고 authored divergence, removed anchor or contract, missing source, rename ambiguity와 target collision을 conflict로 출력하며 apply는 그 source identity가 변하지 않은 경우에만 동일 plan을 실행한다.

### Semantic Change와 New Identity {#execution-semantic-change-identity}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-semantic-change-new-identity Default, validation, dependency와 deterministic semantics 변화가 새 job identity를 만들게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change 정규 결과 의미의 변화에 version과 migration 책임을 요구한다. -->

결과 meaning, state transition, default resolution, validation gate 또는 deterministic comparison을 바꾸는 protocol change는 semantic identity를 증가시키고 affected job and output identities를 새로 만든다. Representation-only migration은 semantic equality proof를 가져야 하며 proof가 없으면 byte or behavior equivalence를 주장하지 않는다.

### Mixed-version Concurrency {#execution-mixed-version-concurrency}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-mixed-version-concurrency 서로 다른 version의 writer가 새 record와 current state를 축소하거나 손상시키지 못하게 한다. -->

Claim과 publication은 writer protocol, minimum reader and writer versions와 protected record generation을 포함한다. Old writer가 unknown required state를 보거나 compatibility range 밖 current를 만나면 mutation을 거부하고, newer writer의 extension fields를 drop한 축소 record를 successor로 publish하지 않는다.

### Downgrade와 Rollback Compatibility {#execution-downgrade-rollback-compatibility}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-downgrade-rollback-compatibility 이전 환경이 읽지 못하는 state, 잃는 field와 재생성 범위를 사전에 보고한다. -->

Downgrade plan은 target capability, unreadable records, lossy fields, non-resumable jobs, reusable artifacts와 required rebuild set을 출력한다. Lossless proof가 없으면 downgrade는 derived environment이며 current authority를 자동 인계받지 않고 explicit acceptance와 rollback point를 요구한다.

### Migration Validation {#execution-migration-validation}

<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Migration 뒤 lineage, 완료 범위, integrity, publication과 audit continuity를 확인한다. -->

Validation은 source and target inventory, job lineage, state sequence, completed units, checkpoint closure, artifact digests, current reference, authority와 audit sequence를 비교해야 한다. Missing record와 partial population을 정확히 보고하고 모든 required class가 검증되기 전에는 migration outcome을 complete로 표시하지 않는다.

### Runtime Compatibility Evidence {#execution-runtime-compatibility-evidence}

<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Renderer, platform, feature, font와 decoder identity를 결과 evidence에 기록한다. -->

Execution profile은 runtime family, version, platform, relevant capability set와 external decoder or model identities를 canonical record로 제공해야 한다. 같은 profile로 비교할 수 없는 실행은 compatibility mismatch를 반환하고 prior receipt, review와 byte equality를 current로 상속하지 않는다.

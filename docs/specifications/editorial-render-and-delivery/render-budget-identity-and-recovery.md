# Render budget, identity와 recovery

## Contract units {#spec-render-budget-identity-recovery-contract-units}

### Worst-case render budget {#spec-render-budget-preflight}
<!-- @evidence requirements/rendering/budgets.md#rendering-budgets Render cost의 worst-case bound를 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Geometry와 memory 항목을 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Per-frame과 total 비용을 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-budget-tiers Purpose별 tier를 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-expansion-bounds Expansion bound를 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-budget-decision Budget decision의 관찰 결과를 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-runtime-budget-enforcement Runtime enforcement를 정밀화한다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-budget-refusal Budget 거절 조건을 정밀화한다. -->

Budget preflight는 requested product와 tier, exact schedule, lowered owner inventory와 runtime profile에서 draw submission, geometry, instance, skin·morph, material, decoded texture, light·shadow·effect, intermediate target, frame-pass work, encode work, output bytes와 wall-time-like limit의 conservative bound를 만든다. Source bytes, expanded resident bytes, shared resource, per-frame peak, chunk retention, concurrent products와 whole-film total을 별도 dimension으로 유지한다.

Instancing, procedural population, particles-like effects, sequences와 archives는 materialization 전 maximum expansion을 가져야 한다. Tier는 dimensions, sampling, passes, representation과 allowed resources를 소유하고 proxy 성공을 final clearance로 바꾸지 않는다. Decision은 target limit, exact 또는 conservative estimate, confidence, dominant owners, worst frame과 requested product를 사용자에게 제공한다.

Dominant owner는 production이 선언하고 편집할 수 있는, 자기 자신의 비용을 지는 owner여야 한다. Frame pass는 앞선 owner들이 이미 지불한 geometry를 다시 제출하므로 그 비용이 곧 그들의 합이며, conservative bound와 measured total에는 반드시 남되 ranking에는 참여하지 않는다. Ranking에서 제외한 pass와 보고 bound를 넘어선 owner는 omitted count와 omitted cost에 남겨 listed contributor와 omitted cost의 합이 measured total과 같아야 한다. 초과 거절은 pass가 더한 cost와 dominant pass attribution을 ranking과 구분되는 별도 accounting 사실로 진술하며, 그 attribution을 편집 지시로 표현하지 않는다.

Unknown 또는 unbounded required cost, overflow, declared limit 초과와 profile 밖 degradation은 실행 전 거절한다. Actual usage가 bound를 넘으면 safe checkpoint에서 중단하고 completed atomic chunks와 measurements를 보존하며 frame drop, nondeterministic culling, downscale 또는 pass skip을 적용하지 않는다. 사용자가 명시적으로 다른 profile을 선택한 rerun은 새 request이지 원 budget의 성공이 아니다.

### Exact raster admission bound {#spec-render-raster-admission-bound}

<!-- @evidence requirements/rendering/budgets.md#rendering-frame-total-budget 한 frame의 exact raster peak를 전체 film 비용과 분리해 제한한다. -->

Raster admission은 declared width와 height의 exact pixel product를 overflow 없이 계산하고 selected production limit과 비교한다. Limit과 같은 값은 허용하며 초과, non-finite 또는 정수로 materialize할 수 없는 raster는 capture와 review 전에 거절한다. 이 gate는 encoding, visual review 또는 전체 render validation을 수행했다고 주장하지 않는다.

### Frame identity와 content addressing {#spec-render-frame-identity}
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-identity-content-addressing Frame을 결정하는 input closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint Canonical fingerprint를 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-dependency-closure External dependency closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-output-naming Collision-resistant output naming을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-byte-digest Input, content와 byte digest를 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Current와 stale 판정을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption Collision과 corruption 처리를 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-digest-refusal Missing digest 거절 조건을 정밀화한다. -->

Frame input identity는 production·compiled·edit revision, global sample time와 number, camera·view, pass, dimensions, shutter schedule, renderer·runtime profile, settings와 model·texture·font·media·color-transform 등 모든 external dependency digest를 canonical serialization으로 묶는다. Property와 collection ordering, relative path, rational, finite scalar, string과 absent value의 표현을 고정하며 mutable alias나 remote current를 digest 없이 허용하지 않는다.

Input fingerprint, canonical pixel·channel content digest와 encoded file byte digest는 서로 다른 사실이다. Human-readable production·time·view suffix에는 collision-resistant fingerprint를 결합하되 filename을 truth로 사용하지 않는다. Current 판정은 expected fingerprint, receipt, actual bytes와 dependency closure의 일치를 모두 요구하고 source, edit, runtime, pass 또는 setting 변경을 relation에 따라 stale로 만든다.

같은 identity에 다른 content가 연결되거나 다른 identity가 같은 final destination을 요구하면 publication을 멈춘다. Corrupt entry와 partial bytes는 격리할 수 있지만 이름이나 크기로 복구하지 않는다. Canonicalization failure, missing digest, unsafe path, numeric unsupported value와 receipt-byte mismatch는 해당 frame을 거절하고 independent valid cache만 보존한다.

### Target fingerprint protocol {#spec-render-target-fingerprint-protocol}

<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint Target-local fingerprint가 versioned canonical field encoding을 사용하게 한다. -->

Target fingerprint protocol은 canonical field ordering과 encoding revision을 identity input에 포함한다. Protocol revision 없이 serialization meaning을 바꾸거나 human-readable suffix를 fingerprint로 대신하지 않는다.

### Target dependency fingerprint {#spec-render-target-dependency-fingerprint}

<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-dependency-closure Target 결과를 바꿀 수 있는 generated payload와 declared render content만 fingerprint closure에 포함하게 한다. -->

Target dependency fingerprint는 target-owned generated payload와 명시된 render content bytes를 canonical role로 결합한다. 관계없는 source 변경은 target identity를 무효화하지 않으며, 영향을 주는 dependency는 closure에서 빠질 수 없다.

### Chunk partition, resume와 atomic result {#spec-render-chunk-recovery}
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunks-resume-recovery Bounded chunk 작업 단위를 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition Deterministic partition을 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-resume Verified output resume를 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-atomic-publication Chunk atomic publication을 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-concurrent-work Concurrent ownership을 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-failure-recovery Crash와 cancellation recovery를 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-retry-identity Retry identity를 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-assembly Assembly closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Unsafe resume 거절 조건을 정밀화한다. -->

Chunk plan은 전체 ordered schedule을 frame range, view, pass와 product별 bounded, contiguous, non-overlapping, complete partition으로 나눈다. 각 chunk는 plan identity, global start-inclusive·end-exclusive frame range, exact sample subset, dependencies, expected outputs, owner claim, attempt, status와 verified receipt를 가진다. Chunk size, worker count와 execution order는 global frame number, sample time, state 또는 content identity를 바꾸지 않는다.

Worker는 isolated temporary ownership tree에서 expected files를 materialize하고 각 byte digest, dimensions, channels와 inventory closure를 검사한 뒤 immutable complete receipt와 current pointer를 원자적으로 publish한다. Resume는 current plan과 일치하며 bytes와 receipt가 재검증된 output만 재사용하고 partial, stale, corrupt, missing과 unverified 항목의 exact work unit만 다시 수행한다. Same-input retry는 attempt·diagnostic·elapsed facts만 바뀌며 setting이나 dependency 변화는 새 plan identity다.

Chunk와 project-root pointer 검사는 absent, current, verified-stale, integrity-failed, unsafe-locator, foreign-generation, unavailable과 observation-conflict를 typed finding으로 반환한다. Existing unresolved pointer는 absence가 아니며 status, resume, render와 finalize가 같은 finding을 소비한다. Verified stale의 exact captured pointer만 자동 remove할 수 있고 integrity failure는 exact quarantine 권한이 증명된 때만 격리하며 나머지는 original generation과 evidence를 manual adjudication에 남긴다.

Concurrent worker와 publisher는 expected identity와 exclusive ownership 또는 compare-and-publish precondition을 사용한다. Crash, timeout, cancellation, storage exhaustion과 worker loss 뒤 verified atomic chunks는 보존하고 orphan이나 ambiguous owner는 격리한다. Assembly 전 모든 expected chunk·frame·pass·view가 current, contiguous, unique한지 확인하며 불완전 set은 partial manifest일 뿐 complete sequence나 encode input이 아니다. Ambiguous ownership, overlapping range, pointer-byte mismatch, unbounded retry와 unsafe temporary destination은 재개를 거절한다.

Local render owner schema는 versioned host·positive safe-integer PID·per-process UUID generation을 session, GC guard, chunk lock, running attempt와 temporary-tree name에 동일하게 운반한다. Signal-zero success 또는 permission denial은 `occupied-or-reused`, foreign host는 `elsewhere`, malformed record와 unsupported process query는 `unknown`이며 모두 보존한다. 같은 validated owner의 two `absent` observations와 그 사이 exact snapshot fence만 reclaim을 허가하고, GC live-worker scan은 하나라도 reclaimable하지 않은 owner가 있으면 apply를 거절한다.

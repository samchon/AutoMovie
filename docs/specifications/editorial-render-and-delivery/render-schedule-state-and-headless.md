# Render schedule, state와 headless 실행

## Contract units {#spec-render-schedule-state-headless-contract-units}

### Render phase와 공통 Artifact 축 {#spec-render-artifact-lifecycle}

<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-scope-artifact-identity Render artifact의 complete identity를 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Compile과 render 책임을 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized 계획과 materialization 상태를 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-product-scope Product별 독립 identity를 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-deterministic-lane Deterministic lane의 보증 범위를 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Artifact invalidation을 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-partial-artifact Partial artifact 상태를 정밀화한다. -->
<!-- @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Missing artifact의 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-validation-status Render phase, materialization, validation, freshness와 failure classification을 한 상태값으로 합치지 않고 모두 구분한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-validation-recovery Independent prior success evidence와 현재 partial verdict를 함께 보존한다. -->
<!-- @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Current publication selection과 expected input에 대한 freshness를 독립적으로 판정한다. -->
<!-- @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Optional rendition이 deterministic artifact와 별도 identity를 가져야 한다. -->

Render request는 production과 compiled revision, selected edit, film range, camera·view, schedule, products, dimensions, color, runtime profile, external dependency closure와 requested destination을 고정한다. Compilation이 확정한 scene·timeline truth만 소비하며 missing structure, source 또는 camera를 render 단계의 placeholder로 보완하지 않는다. Deterministic product와 optional external rendition은 source, identity, receipt, validation과 publication을 공유하지 않는다.

Status와 verify 경로는 source descriptor를 먼저 읽고 기존 plan과 artifact만 관찰하며 생성·설치·capture·publication 동작을 호출하지 않는다. 관찰 중 plan descriptor 또는 generation이 바뀌면 source, input, chunk와 row를 읽기 전후에 currentness를 다시 확인하여 stale 결과가 successor publication을 덮지 못하게 한다. Resource cleanup은 primary failure를 보존하면서 모든 acquired resource를 닫고, cleanup도 실패하면 primary error를 첫 cause로 유지하는 `AggregateError`로 두 실패를 함께 보고한다.

각 render product는 [독립 Artifact 상태 축 계약](../execution-and-recovery/artifacts-and-atomic-publication.md#execution-artifact-lifecycle-contract)의 같은 다섯 축 snapshot을 소비하고 render-specific phase record만 추가한다. Portable render target은 renderer, settings, asset closure와 content digest를 고정하고, CLI lifecycle은 plan, run, status, verify와 finalize 단계 전이를 소유한다. Phase record는 requested, planned, scheduled, lowering, rendering, probing, reviewing과 finished position 및 active, succeeded, failed, unsupported 또는 not-run outcome을 가지며 expected predecessor와 새 evidence에 결속된다. Requirement의 partially-materialized와 materialized는 materialization 및 completeness 축에, probed와 reviewed는 validation evidence와 method receipt에, stale은 freshness에 남기므로 phase, path, plan, process success와 과거 receipt가 artifact truth나 current publication을 대신하지 않는다.

Input 변경은 dependency relation에 따라 정확한 product와 downstream encode·review의 freshness를 stale로 바꾸고 consumer 또는 runtime profile 변화는 compatibility를 별도로 다시 판정하며, 이미 관측한 materialization coverage, integrity와 과거 validation receipt를 지우지 않는다. 이전 성공 product는 complete, integrity verified와 당시 validation passed evidence를 유지하면서 현재 expected input에는 stale, 현재 runtime에는 incompatible, publication에는 current 또는 superseded, storage에는 unavailable, policy에는 quarantined일 수 있으며 이 조합을 새 render success로 확대하지 않는다.

Product 하나의 성공은 다른 pass, view, audio-related product나 encode의 성공으로 승격되지 않는다. Verified independent output은 expected identity, byte digest와 receipt가 일치할 때 자기 축 snapshot과 함께 보존한다. Missing identity, ambiguous scope, compile contradiction, stale cache와 zero-byte 또는 unverified output은 확인된 materialization과 completeness, integrity와 artifact-scoped validation, freshness와 compatibility, publication selection과 generation, availability와 quarantine 및 safe retry 범위를 각각 반환하고 materialization complete 또는 current publication을 주장하지 않는다.

### Exact frame schedule과 direct seek {#spec-render-frame-schedule}
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-schedule-sampling Rational timeline의 frame schedule을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Frame boundary convention을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time Frame number와 time mapping을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling 모든 component의 동시 sampling을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples Shutter sample 계약을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues Audio와 cue의 공통 origin을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Subrange와 chunk 안정성을 정밀화한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal Invalid schedule 거절 조건을 정밀화한다. -->

Schedule은 selected start-inclusive, end-exclusive film range, exact rational frame rate, presentation origin, first output number, sample convention, requested view·pass와 optional shutter samples에서 ordered work set을 생성한다. Frame number n의 sample time은 origin과 exact integer relation으로 계산하며 이전 frame time에 duration을 누적하지 않는다. Count와 마지막 포함 sample은 rational inequality로 판정하여 decimal rounding과 platform numeric formatting에 의존하지 않는다.

한 sample은 actor, rig, morph, camera, light, material, effect, visibility, environment와 presentation event를 같은 film instant에서 resolve한다. Multiple temporal samples는 interval, positions, weights와 range-edge policy를 schedule identity에 포함하고, 지원하지 않으면 단일 sample임을 그대로 보고한다. Audio samples와 text cues는 frame grid에 강제 양자화하지 않지만 동일 presentation origin, duration과 edit mapping을 공유한다.

Direct seek, sequential execution, repeated seek, reordered pass, subrange와 chunk execution은 같은 global frame number에서 동일 state와 identity를 만들어야 한다. Invalid rate, empty required range, overflow, duplicate number, ambiguous origin, unrepresentable count와 component clock mismatch는 실행 전 거절한다. 유효 prefix는 partial plan으로 보일 수 있으나 complete schedule로 실행하거나 boundary를 임의로 줄이지 않는다.

### Scene lowering과 state isolation {#spec-render-state-isolation}
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-scene-lowering-runtime Compiled source의 runtime lowering을 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Runtime object ownership을 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Dependency 기반 build order를 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-time-update Fixed film clock update를 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-state-isolation Frame과 pass 상태 격리를 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Resource lifecycle을 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-partial-retry Partial lowering과 retry를 정밀화한다. -->
<!-- @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-refusal Lowering 거절 조건을 정밀화한다. -->

Lowering은 compiled model, instance, actor, rig, formation, camera, light, environment, effect와 material identity를 runtime owner와 derived resource로 결정적으로 연결한다. Parent와 dependency graph의 canonical topological order를 사용하고 입력 배열이나 filesystem enumeration을 의미 있는 order로 사용하지 않는다. Runtime object는 source subject, semantic owner, instance placement와 material을 역추적할 수 있어야 하며 batching이 review identity를 지우지 않는다.

각 frame·view·pass evaluation은 clean state snapshot에서 declared film time을 직접 적용한다. Camera, pass override, temporary visibility, animation accumulator, random state와 capture setting은 작업 단위마다 격리하고, prior frame이나 failed pass의 mutation을 관찰 가능한 결과에 남기지 않는다. Resources와 listener는 acquisition, replacement, ownership과 release를 추적하며 cancellation이나 retry 뒤 stale callback이 다음 작업에 참여하지 않는다.

Lowering receipt는 source closure, runtime ownership graph, resource별 ready·missing·unsupported 관측과 lowering phase를 제공한다. Independent verified subtree는 source identity가 같은 retry에서 재사용할 수 있지만 required scene closure가 깨지면 renderable state는 partial이다. Unknown model, missing required material, hierarchy cycle, duplicate owner, non-finite state, incompatible capability와 cleanup failure는 거절하고 affected subtree와 safe retry 여부를 보고한다.

### Capture runtime identity {#spec-render-capture-runtime-identity}

<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Capture 결과가 browser, executable, platform, graphics와 mode의 exact runtime closure를 기록하게 한다. -->

Capture runtime identity는 versioned schema로 검증되고 canonical encoding을 가져야 한다. 누락되거나 noncanonical한 identity는 current pixel evidence에 사용할 수 없다.

### Headless와 supported platform determinism {#spec-render-headless-platform}
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-headless-platform-determinism Headless와 interactive 실행의 공통 계약을 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Runtime identity closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-paths Cross-platform path 규칙을 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism Locale과 wall time 격리를 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-hardware-variation Hardware variation profile을 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-font-decoder-closure Font와 decoder closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-process-isolation Process isolation과 exit 상태를 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-evidence Cross-platform evidence 범위를 정밀화한다. -->
<!-- @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-headless-refusal Missing capability 거절 조건을 정밀화한다. -->

Headless와 interactive capture는 동일 compiled input, film clock, lowering, camera, pass, dimensions와 color contract를 소비하고 실행 mode만 identity의 한 field로 구분한다. Runtime identity는 renderer, graphics capability, browser 또는 host runtime, platform, executable, font, image·media decoder와 declared device facts를 포함한다. Exact byte·pixel profile과 metric·tolerance profile을 분리하며 tolerance는 channel, metric, bound와 compared runtime scope를 선언한다.

Logical path canonicalization, case-fold collision 검사, stable sorting과 reserved-name 정책은 Windows와 POSIX에서 같은 output population을 만든다. Locale, timezone, wall clock, daylight-saving, user profile, network와 unseeded randomness은 숨은 input이 될 수 없다. 필요한 date, locale, seed와 remote bytes는 immutable declared dependency가 되고 process는 이전 session state와 interactive input 없이 시작한다.

Receipt는 input closure, runtime facts, process start·exit, timeout·cancellation, requested와 actual capture surface와 comparison claim을 제공한다. Crash, timeout, nonzero exit와 cleanup failure는 file 존재와 무관하게 실패다. Required surface, pass, font, decoder, runtime identity 또는 capability가 없으면 blank frame을 성공으로 기록하지 않으며, 가능한 product만 partial로 보존하고 missing capability와 supported retry condition을 보고한다.

# Validation, Evidence, and Compatibility

## Effect evidence identity와 freshness {#effect-evidence-identity-and-freshness}

### Hand math와 negative twins {#effect-hand-math-and-negative-twins}

<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-validation-evidence 이 절은 effect state와 관찰 결과를 함께 검증한다. -->
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-evidence-identity-freshness 이 절은 evidence를 정확한 productionㆍshotㆍrevisionㆍtime에 묶는다. -->

Effect evidence identity는 production, shot, effect instance/domain, tier, inputㆍworldㆍsolver revision, clock range, compatibility class와 artifact digest를 포함한다. Evidence는 상태 receipt와 필요시 관찰 artifact를 분리해 보관한다. 어느 dependency라도 달라지면 stale이며 이전 결과를 현 revision의 성공으로 표시할 수 없다.

<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-hand-math-boundary 이 절은 간단한 경계 사례를 독립 산식과 비교하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-negative-twins 이 절은 한 위반만 바꾼 실패 쌍으로 validator를 검증한다. -->

Fixed-step mapping, spawn ordinal, ballistic sample, volume accounting, budget composition과 sample mapping은 작은 hand-computable fixture에서 독립 기대값과 비교한다. 각 주요 거절에는 하나의 위반만 도입한 negative twin과 같은 입력의 valid twin을 둔다. Empty result, unrelated earlier failure, 너무 넓은 tolerance는 증거가 아니다.

### Seek equivalence와 visual review 경계 {#effect-seek-equivalence-and-visual-review}
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-seek-equivalence-evidence 이 절은 순차ㆍscrambledㆍcheckpoint 평가의 state equivalence를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-visual-review 이 절은 수치 검증과 별도로 실제 관찰 검토가 필요한 범위를 정한다. -->

같은 identity의 sequential playback, arbitrary seek, scrambled order와 checkpoint resume는 선언 compatibility class 안에서 같은 state digest와 consequence log를 내야 한다. Visual review가 필요한 항목은 exact frame/time, expected blocking relationship, 관찰 artifact digest와 reviewer verdict를 기록한다. 수치 통과가 visual fidelity를 증명하지 않고, 이 문서 자체는 render를 관찰했다는 주장이 아니다.

### Effect evidence status와 external result {#effect-evidence-status-and-external-result}
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-evidence-status 이 절은 통과하지 않은 검사를 명시 상태로 남긴다. -->
<!-- @evidence requirements/effects-and-simulation/validation-and-evidence.md#effects-external-result-evidence 이 절은 adopted simulation 결과의 입력ㆍ도구ㆍ출력 identity를 검증한다. -->

각 effect evidence row는 결과 상태 `authored`, `approximate`, `solved`, `failed`, `unsupported`, `not-run` 중 하나와 검증 verdict `passed`, `failed`, `not-run`, `stale` 중 하나를 따로 가진다. Reason, measured/expected 값과 artifact links를 함께 기록하며 numeric verdict와 visual verdict도 합치지 않는다. External result evidence는 source snapshot digest, neutral settings, tool/model revision, output digest, units/basis/clock과 adoption receipt를 포함한다. `not-run`, `unsupported`, `stale`은 성공 집계에 들어가지 않는다.

## Sound evidence와 numeric verification {#sound-evidence-and-numeric-verification}

### Audio budget와 audible review {#sound-budget-and-audible-review}

<!-- @evidence requirements/sound/validation-and-delivery.md#sound-validation-delivery 이 절은 source에서 final stream까지 단계별 증거 사슬을 요구한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness 이 절은 sound evidence를 sourceㆍtimelineㆍmixㆍdelivery revision에 묶는다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification 이 절은 duration, sync, peak, loudness와 channel facts를 수치로 판정한다. -->

Sound evidence identity는 source digests, decode facts, timeline/conform revision, sample rate/range, spatial/acoustic dependency, mix graph, delivery profile와 final bytes digest를 포함한다. Numeric checks는 decoded sample count, cue/event offset, dialogue mark bounds, seam discontinuity, peak/clipping, loudness, channel layout와 A/V duration을 expected rule과 tolerance에 대해 판정한다.

<!-- @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence 이 절은 decode, voices, processing, mix와 retained artifact의 실제량을 상한과 비교한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-audible-review 이 절은 수치 검증과 별도로 청취 판단의 범위와 identity를 기록한다. -->

Budget evidence는 dimension별 estimate, admitted limit, observed maximum과 status를 기록한다. Audible review는 exact mix/stem digest, sample range, playback conditions, expected dialogue clarityㆍevent timingㆍcontinuity와 reviewer verdict를 남긴다. 숫자만으로 가청 품질을 통과시키지 않고 이 문서 자체는 청취를 수행했다는 주장이 아니다.

### Delivery status와 failure propagation {#sound-delivery-status-and-failure-propagation}
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-evidence-status 이 절은 sound와 delivery 검사의 미실행ㆍ실패ㆍstale 상태를 보존한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-final-status 이 절은 sound 단계 상태가 published artifact의 최종 상태에 포함되게 한다. -->

Source, decode, timing, spatial/acoustic, mix, probe와 A/V join은 진행 상태 `planned`, `rendered`, `probed`, `reviewed`와 verdict `passed`, `failed`, `not-run`, `unsupported`, `stale`를 별도 축으로 기록한다. 단계는 앞선 상태를 건너뛸 수 없고 downstream은 required upstream verdict가 `passed`일 때만 통과하며 failure reason과 identity를 전달한다. Partial stem이나 임시 mix는 `probed` 또는 `reviewed` final delivery evidence로 승격하지 않는다.

## Compatibility와 복구 규칙 {#simulation-sound-compatibility-and-recovery-group}

### Compatibility와 복구 규칙 {#simulation-sound-compatibility-and-recovery}

<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity 이 절은 compatibility가 전체 입력 identity equality에서만 성립하게 한다. -->
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-conform-invalidation 이 절은 timeline 변경 뒤 재사용 가능한 결과의 범위를 제한한다. -->

Schema 또는 algorithm revision은 의미가 동일하고 명시 migration이 digest와 unitsㆍbasisㆍclockㆍordering을 보존할 때만 compatible이다. Unknown field, 바뀐 default, 다른 rounding, changed channel meaning, altered solver order는 새 identity다. Recovery는 immutable inputs와 마지막 complete checkpoint에서 재실행하고 손상된 output을 patch하거나 failure 뒤 state를 이어 쓰지 않는다.

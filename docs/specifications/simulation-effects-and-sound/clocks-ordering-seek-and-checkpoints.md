# Clocks, Ordering, Seek, and Checkpoints

## 시간 도메인과 정수 tick {#effect-and-audio-time-domains}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-clock-seek-determinism 이 절은 effect 평가를 고정 step으로 제한한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-fixed-audio-clock 이 절은 sound presentation을 고정 sample clock으로 제한한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases 이 절은 film, frame, solver와 audio clock을 정확한 유리 시간으로 결합한다. -->

Film time은 유리수이고 effect domain은 양의 고정 step, audio domain은 양의 정수 sample rate를 선언한다. 변환은 부동소수 누적이 아니라 `floor((time-origin)/step)`와 `floor((time-origin)*sampleRate)`에 해당하는 명시된 정수 경계 규칙으로 수행한다. 입력은 film-time, origin, rate 또는 step이며 출력은 절대 tickㆍsample index와 잔여 구간이다. NaN, 무한대, 음수 rate, 범위 밖 index는 평가 전에 거절한다.

### Film-time mapping과 경계 {#effect-film-time-step-boundary}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping 이 절은 film time에서 solver step으로의 단일 변환을 정한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-step-boundary 이 절은 정확한 step 경계의 소유 구간을 정한다. -->

각 domain은 origin, fixed step, end boundary, pre-roll을 가진다. Tick `k`의 상태는 origin에서 정확히 `k`번 전이한 결과이며 sample 구간은 `[k, k+1)`로 소유된다. End와 정확히 겹치는 요청은 계약에 선언된 마지막 상태 또는 범위 밖 중 하나로만 판정하고, 실행 경로마다 반올림을 달리하지 않는다.

### 결정적 dependency order {#deterministic-dependency-and-contact-order}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-dependency-order 이 절은 같은 tick의 evaluation dependency를 안정 정렬한다. -->
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-rigid-contact-order-seek 이 절은 contact resolution order를 seek와 독립적으로 고정한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies 이 절은 effect가 읽는 motion channel의 선행 평가를 dependency graph에 포함한다. -->

같은 tick은 world snapshot, authored motion과 anchor, emitters와 forces, solve, contacts, consequences, sound emission의 위상 순서로 평가한다. 각 위상 내부는 dependency depth, stable object identity, operation kind, local ordinal의 총순서로 정렬한다. 입력 순서, hash iteration, worker completion, chunk 분할은 결과 순서에 영향을 줄 수 없으며 dependency cycle은 참여 identity를 열거한 실패다.

### 임의 seek와 재구성 {#arbitrary-seek-reconstruction-contract}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek 이 절은 선형 playback 없이 절대 시간을 평가하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction 이 절은 초기 상태 또는 유효 checkpoint에서 같은 상태를 재구성하게 한다. -->

Arbitrary seek 입력은 target tick, full identity, world dependency revision이다. Authored와 analytic tier는 target을 직접 평가하고, solved tier는 초기 상태 또는 target 이하의 가장 가까운 호환 checkpoint에서 정해진 순서로 재생한다. 출력은 target state, 출발 checkpoint, 수행 step 수와 state digest다. 이전 playback의 mutable state를 몰래 이어 쓰거나 future checkpoint를 역적분하지 않는다.

### Checkpoint와 cache identity {#checkpoint-cache-identity-and-validity}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity 이 절은 cache가 재사용 가능한 전체 입력 identity를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupling-dependency-invalidation 이 절은 world dependency 변경이 coupled result를 무효화하게 한다. -->

Checkpoint key는 productionㆍshotㆍdomainㆍinstanceㆍtier, initial-state digest, solver revision, fixed step, seed, parameter digest, dependency snapshot digest, target tick, numeric compatibility class를 포함한다. 값은 완전한 재시작 상태와 digest를 포함하며 부분 accumulator만 저장할 수 없다. Key가 다르거나 payload digest가 맞지 않으면 cache miss이고, stale 결과를 사용한 성공으로 바꾸지 않는다.

### Platform compatibility와 repeatability {#numeric-platform-repeatability-class}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-platform-determinism 이 절은 byte identity와 tolerance identity의 범위를 선언하게 한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence 이 절은 sound seek와 chunk 결과의 동일성을 같은 시간축에서 판정한다. -->

시스템은 각 결과에 `byte-exact` 또는 이름 붙은 `numeric-tolerance` compatibility class를 기록한다. Class는 numeric format, 연산 순서, rounding, codec 경계와 tolerance를 고정한다. 같은 class에서 연속 평가, scrambled seek, checkpoint 재개, chunk 분할은 같은 digest 또는 선언 tolerance 안의 같은 sample/state를 내야 하며, 다른 class 사이의 일치를 성공 근거로 삼지 않는다.

### Clock failure와 복구 {#clock-seek-failure-and-recovery}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek 이 절은 범위 밖 seek를 부분 성공과 구분한다. -->

요청 tick이 budget end를 넘거나 필요한 checkpoint가 손상되고 초기 상태로부터 재생도 상한을 넘으면 `not-run` 또는 `refused`와 정확한 경계를 반환한다. 복구는 더 이른 유효 checkpoint 또는 초기 상태에서만 시작하며 step 생략, 가변 step, seed 교체, 낮은 tier로의 묵시적 강등을 허용하지 않는다.

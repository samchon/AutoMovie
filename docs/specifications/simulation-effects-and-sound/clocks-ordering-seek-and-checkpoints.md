# Clocks, Ordering, Seek, and Checkpoints

## 시간 도메인과 정수 tick {#effect-and-audio-time-domains}

### Film-time mapping과 경계 {#effect-film-time-step-boundary}

<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-clock-seek-determinism 이 절은 effect 평가를 고정 step으로 제한한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-fixed-audio-clock 이 절은 sound presentation을 고정 sample clock으로 제한한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases 이 절은 film, frame, solver와 audio clock을 정확한 유리 시간으로 결합한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time 이 절은 동치인 유리 시간과 rate를 하나의 boundary identity로 정규화한다. -->

Film time은 정규화된 유리수이고 effect domain은 stable time-domain identity, 유리수 origin과 양의 유리수 fixed step을 선언하며 audio domain은 별도 time-domain identity와 양의 정수 sample rate를 선언한다. 변환은 부동소수 누적이 아니라 정수의 유리수 나눗셈과 명시된 floor 규칙으로 수행한다. Effect clock boundary 출력은 time-domain identity, 정확한 유리수 film instant, domain origin과 step, 음이 아닌 절대 effect tick, endpoint sampling law를 하나의 identity로 묶고, audio 변환은 같은 film instant에 대한 절대 sample index를 별도로 반환한다. 어느 timebase의 값인지 정의되지 않은 tick 이름은 사용하지 않는다. NaN, 무한대, zero 또는 음수 rate와 step, 범위 밖 tickㆍsample index, 정규화할 수 없는 유리수는 평가 전에 거절한다.

<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping 이 절은 film time에서 solver step으로의 단일 변환을 정한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-step-boundary 이 절은 정확한 step 경계의 소유 구간을 정한다. -->

각 domain은 origin, fixed step, end boundary와 pre-roll을 가진다. 절대 effect tick `k`의 boundary identity가 가리키는 film instant는 정확히 `origin + k × step`이고, 상태 `k`는 origin의 initial state에서 정확히 `k`번 전이한 결과다. 전이 `k → k+1`은 destination endpoint law를 사용하여 moving anchor, transform, collider, emitter와 environment를 모두 정확한 boundary `k+1`에서 sample한다. Presentation 요청이 `[origin + k × step, origin + (k+1) × step)`에 있으면 상태 `k`를 소유하고 정확한 다음 boundary는 상태 `k+1`을 소유한다. 예를 들어 origin이 0인 24 fps film frame `n`과 120 Hz solver의 경계가 만나면 유리수 instant `n/24`는 중간 반올림 없이 절대 effect tick `5n`이고, 다른 solver는 같은 film instant를 자기 time-domain identity와 originㆍstep으로 독립 변환한다. End와 정확히 겹치는 요청은 계약에 선언된 마지막 상태 또는 범위 밖 중 하나로만 판정하며 frame number, 부동소수 second 또는 다른 domain의 tick을 중간 정본으로 사용하지 않는다.

### 결정적 dependency order {#deterministic-dependency-and-contact-order}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-dependency-order 이 절은 같은 tick의 evaluation dependency를 안정 정렬한다. -->
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-rigid-contact-order-seek 이 절은 contact resolution order를 seek와 독립적으로 고정한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies 이 절은 effect가 읽는 motion channel의 선행 평가를 dependency graph에 포함한다. -->

같은 tick은 world snapshot, authored motion과 anchor, emitters와 forces, solve, contacts, consequences, sound emission의 위상 순서로 평가한다. 각 위상 내부는 dependency depth, stable object identity, operation kind, local ordinal의 총순서로 정렬한다. 입력 순서, hash iteration, worker completion, chunk 분할은 결과 순서에 영향을 줄 수 없으며 dependency cycle은 참여 identity를 열거한 실패다.

### 임의 seek와 재구성 {#arbitrary-seek-reconstruction-contract}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek 이 절은 선형 playback 없이 절대 시간을 평가하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction 이 절은 초기 상태 또는 유효 checkpoint에서 같은 상태를 재구성하게 한다. -->

Arbitrary seek 입력은 target clock boundary identity, full simulation identity와 그 boundary에 결속된 world dependency revision이다. Authored와 analytic tier는 target film instant를 직접 평가하고, solved tier는 initial state 또는 target absolute effect tick 이하의 가장 가까운 호환 checkpoint에서 정해진 순서로 재생한다. 출력은 target boundary identity, target state, 출발 checkpoint, 수행 step 수와 state digest다. Seek 경로가 target film instant를 frame number나 근사 second에서 다시 계산하거나 이전 playback의 mutable state를 몰래 이어 쓰거나 future checkpoint를 역적분하지 않는다.

### Checkpoint와 cache identity {#checkpoint-cache-identity-and-validity}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity 이 절은 cache가 재사용 가능한 전체 입력 identity를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupling-dependency-invalidation 이 절은 world dependency 변경이 coupled result를 무효화하게 한다. -->

Checkpoint key는 productionㆍshotㆍdomainㆍinstanceㆍtier, initial-state digest, solver revision, seed, parameter digest, dependency snapshot digest, target clock boundary identity와 numeric compatibility class를 포함한다. Boundary identity 안의 time-domain identity, 정확한 film instant, origin, step, absolute effect tick과 endpoint sampling law는 개별 필드로 재해석하거나 생략할 수 없다. 값은 완전한 재시작 상태와 digest를 포함하며 부분 accumulator만 저장할 수 없다. Key가 다르거나 dependency snapshot이 다른 boundary identity에 묶였거나 payload digest가 맞지 않으면 cache miss이고, stale 결과를 사용한 성공으로 바꾸지 않는다.

### Platform compatibility와 repeatability {#numeric-platform-repeatability-class}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-platform-determinism 이 절은 byte identity와 tolerance identity의 범위를 선언하게 한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence 이 절은 sound seek와 chunk 결과의 동일성을 같은 시간축에서 판정한다. -->

시스템은 각 결과에 `byte-exact` 또는 이름 붙은 `numeric-tolerance` compatibility class를 기록한다. Class는 numeric format, 연산 순서, rounding, codec 경계와 tolerance를 고정한다. 같은 class에서 연속 평가, scrambled seek, checkpoint 재개, chunk 분할은 같은 digest 또는 선언 tolerance 안의 같은 sample/state를 내야 하며, 다른 class 사이의 일치를 성공 근거로 삼지 않는다.

### Clock failure와 복구 {#clock-seek-failure-and-recovery}
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek 이 절은 범위 밖 seek를 부분 성공과 구분한다. -->

요청 boundary의 absolute effect tick이 budget end를 넘거나 time-domain identityㆍfilm instantㆍoriginㆍstepㆍendpoint law가 서로 모순되거나 필요한 checkpoint가 손상되고 initial state로부터 재생도 상한을 넘으면 `not-run` 또는 `refused`와 정확한 boundary identity를 반환한다. 복구는 같은 boundary 계약에 묶인 더 이른 유효 checkpoint 또는 initial state에서만 시작하며 step 생략, 가변 step, seed 교체, 다른 clock으로의 재매핑과 낮은 tier로의 묵시적 강등을 허용하지 않는다.

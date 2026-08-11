# Budget Admission and Bounded Work

## Budget identity와 차원 {#effect-budget-identity-and-dimensions}

### Frame, shot, sequence composition {#budget-frame-shot-sequence-composition}

<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budgets-bounded-work 이 절은 모든 비싼 effect 경로에 유한 상한을 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-identity 이 절은 budget을 production과 tier revision에 묶는다. -->

Budget 입력은 productionㆍshotㆍtierㆍdomain revision과 workload 선언이다. 차원은 최소 active instance, spawned population, cellㆍparticleㆍbody 수, solver stepㆍiteration, contact pair, cache bytes, decoded audio samples, mix operation, retained evidence bytes를 포함하며 단위와 시간 범위를 갖는다. 출력은 dimension별 estimate, limit, estimation kind와 identity digest다.

<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget 이 절은 순간 상한과 누적 상한을 함께 판정한다. -->
<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-composition 이 절은 겹치는 population을 합성된 workload로 계산한다. -->

Per-frame budget은 한 presentation frame에서 활성인 상태와 평가 작업의 최대치를 제한하고 per-shot budget은 전체 step, spawn, contact, sample과 artifact 합계를 제한한다. Sequence budget은 동시 shot이나 overlap을 포함한다. 합성은 동일 자원을 중복 세지 않는다고 증명된 경우에만 공유를 빼며, 그 외에는 보수적으로 더한다.

### 실행 전 admission {#effect-budget-preflight-admission}

<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-admission 이 절은 첫 비싼 할당 전에 수용 여부를 결정하게 한다. -->

Estimate는 `exact`, `conservative`, `unknown` 중 하나다. 모든 강제 차원의 estimate가 limit 이하이면 `admitted`, 하나라도 초과하면 `refused`, 상한을 증명할 수 없으면 `not-run`이다. Admission receipt는 입력 digest, 산식 revision, estimate와 headroom을 남긴다. 실행 중 실제량이 estimate를 넘으면 그 지점에서 `partial`로 실패하고 초과 dimensionㆍtick, 마지막 complete state/checkpoint와 분리된 partial artifact를 반환하며 partial을 downstream 입력이나 complete 결과로 사용하지 않는다.

### 외부 cache와 memory 상한 {#external-cache-and-retention-bound}
<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-external-cache-bound 이 절은 adopted result와 checkpoint retention도 budget 안에 둔다. -->

외부 artifact, decoded sound, checkpoint, evidence는 각각 최대 item 수, item bytes, aggregate bytes와 eviction policy를 선언한다. Eviction은 재계산 가능한 immutable entry에만 적용하며 현재 evaluation이 참조하는 값은 제거하지 않는다. Remote quota나 provider cache는 성공 조건이 아니며 local retained bytes를 숨기는 근거가 될 수 없다.

### Audio workload admission {#audio-workload-budget-admission}
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence 이 절은 sound workload의 estimate, limit와 observed work를 같은 차원으로 기록한다. -->
<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-admission 이 절은 sound의 비싼 decode와 processing도 실행 전 admission을 받게 한다. -->

Audio admission은 decoded sample 수와 bytes, 동시 source/voice 수, spatial path sample, acoustic rayㆍtapㆍtail, processing operation, mix blockㆍstem과 evidence retention의 상한을 판정한다. Unknown duration, unbounded sustained source나 response, target layout이 정해지지 않아 work를 계산할 수 없는 경우는 `not-run`이다. Runtime receipt는 observed maximum을 같은 차원으로 기록하며 source truncation, voice drop, tail 절단으로 상한을 맞추지 않는다.

### 거절과 호환성 {#effect-budget-refusal-and-compatibility}
<!-- @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-refusal 이 절은 초과를 묵시적 품질 저하가 아닌 진단으로 만든다. -->

거절은 dimension, requested, limit, scope, 계산 근거와 가능한 author action을 반환한다. 시스템은 population thinning, step 확대, solver iteration 감소, source truncation, channel drop, 낮은 tier 전환을 자동으로 하지 않는다. Budget revision이나 tier가 바뀌면 admission과 관련 checkpoint가 무효화되며, 명시적으로 다시 수용된 결과만 호환된다.

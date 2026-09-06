# Scope, Tiers, and Identities

## 시스템 경계 {#simulation-effects-sound-system-boundary}

### 공통 불변식 {#simulation-effects-sound-common-invariants}

<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authored-solved 이 절은 authored와 solved effect의 책임을 구분한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-story-world-binding 이 절은 sound가 story event와 world source를 잃지 않게 한다. -->

시스템 입력은 production revision, shot 또는 sequence identity, 유리 film-time 구간, world snapshot, authored effect와 sound 선언, 채택된 외부 artifact이다. 출력은 시간에 따라 평가 가능한 effect state, emission에서 presentation까지 추적되는 sound state, 진단과 증거 receipt이다. 시스템은 저작되지 않은 의미를 추측하거나 누락된 source를 침묵으로 바꾸지 않으며, rendererㆍeditorㆍdelivery는 이 상태를 소비할 뿐 소유권을 다시 결정하지 않는다.

<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-clock-seek-determinism 이 절은 모든 effect state가 같은 clockㆍseedㆍorder 불변식을 지키게 한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-scope-identity 이 절은 모든 sound 단계가 sourceㆍtimeㆍownerㆍprovenance를 잃지 않게 한다. -->

게시 가능한 모든 상태는 stable identity가 유일하고, 하나의 시간 범위에 하나의 authority만 있으며, time은 선언된 정수 tick/sample로 환원되고, dependency revision이 닫혀 있고, work가 admission 상한 안에 있어야 한다. 같은 full input identity는 같은 compatibility class의 같은 상태와 presentation을 내야 한다. 이 불변식 하나라도 증명하지 못하면 complete가 아니라 `refused`, `not-run`, `unsupported` 또는 `stale`이다.

### Effect tier 상태 기계 {#effect-tier-state-machine}
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control 이 절은 각 effect에 author-visible control과 seed를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-simulation-tier 이 절은 tier별 실행과 증거 의무를 상태 기계로 만든다. -->

각 effect instance는 `authored`, `analytic`, `bounded-solved`, `adopted-result` 중 정확히 한 tier와 stable identity를 가진다. Authored는 key와 상태 전환을 그대로 평가하고, analytic은 닫힌 형태의 시간 함수만 계산하며, bounded-solved는 선언된 clockㆍdomainㆍbudget 안에서만 적분하고, adopted-result는 immutable artifact와 adoption receipt를 읽는다. Tier 변경은 새 revision이며 이전 cache와 checkpoint를 재사용할 수 없다.

### Story와 lifecycle identity {#effect-sound-story-lifecycle-identity}
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-story-binding 이 절은 effect lifecycle을 원인 사건과 연결한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-emission-presentation 이 절은 source emission과 listener presentation의 identity를 분리한다. -->

Effect identity는 production, shot, instance, causal event, tier, parameter revision을 포함한다. Sound identity는 production, timeline, cue 또는 sustained source, source revision, emission event와 presentation route를 포함한다. 생성, 활성, 소멸, tail의 구간은 반열림 구간으로 기록하며 동일 원인에서 파생된 effect와 sound는 원인 identity를 공유하되 서로의 presentation identity를 대신하지 않는다.

### 외부 결과와 provider 중립성 {#external-result-provider-neutrality}

<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-external-provider-neutrality 이 절은 외부 effect 결과를 provider가 아닌 채택 artifact로 식별한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-provider-neutrality 이 절은 sound source와 timing을 provider product에 종속시키지 않는다. -->
<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-content-provenance 동일 content와 서로 다른 source provenance를 합치지 않는 identity 경계를 유지한다. -->

외부 생성 또는 해석은 입력 snapshot hash, provider-neutral 설정, 도구ㆍ모델 revision, 출력 byte digest, unitsㆍbasisㆍclock, license와 receipt를 가진 immutable adopted result로만 들어온다. Runtime 계약은 provider 이름, remote job handle, credential에 의존하지 않는다. 같은 bytes와 해석 metadata는 같은 simulation evaluation content identity를 공유할 수 있지만 source, acquisition, provenance, rights와 adoption revision은 각각 보존하며 하나의 adopted result로 합치지 않는다. Bytes나 해석 metadata가 바뀌면 새 evaluation content revision이고 provenance 또는 rights가 바뀌면 content가 같아도 새 adoption revision이다.

Generator adoption은 실제 UTC calendar terms-review date와 생성 또는 채택 instant를 분리해 보존한다. Canonical identity는 date 문자열의 실재성만 검증하고, preflight와 receipt validation은 주입된 동일 UTC instant에 대해 미래 review를 거절한다. 따라서 UTC 자정 양쪽, leap day, cache resume와 direct generation이 같은 비교 의미를 가지며 credential presence는 이 검증이나 실행을 시작시키지 않는다.

### 침묵과 누락 상태 {#authored-silence-and-missing-state}
<!-- @evidence requirements/sound/scope-and-identity.md#sound-authored-silence 이 절은 의도된 침묵을 명시적 상태로 보존한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-missing-refusal 이 절은 미해결 sound 의무를 침묵과 구분해 거절한다. -->

`authored-silence`는 범위, 이유, 소유자를 가진 유효한 presentation 상태다. 반면 필요한 dialogueㆍcueㆍbedㆍmusic source가 없거나 decode되지 않거나 timing authority가 없으면 `missing` 진단이며 성공한 무음으로 출력할 수 없다. 상태 전이는 `declared`, `resolved`, `admitted`, `presented`, `verified` 또는 명시적 `refused`, `not-run`, `unsupported`로 닫힌다.

### Prototype fidelity ceiling {#simulation-effects-sound-prototype-fidelity-ceiling}
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-scope-refusal 이 절은 무상한 물리나 미지원 효과를 성공으로 낮추지 않는다. -->
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-prototype-fidelity-boundary blocking prototype이 final physical fidelity를 주장하지 못하게 한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-prototype-fidelity-boundary 이 절은 추적 가능성과 perceptual fidelity를 구분한다. -->

호환 가능한 출력은 staging, timing, causal state, coarse interaction과 반복 가능성을 판단할 수 있는 blocking prototype이다. 지원하지 않는 난류ㆍ파괴ㆍ연성ㆍ음향ㆍmix fidelity는 `unsupported` 또는 더 낮은 명시 tier로 남기며 시각ㆍ청각적으로 그럴듯하다는 이유로 물리적 정확성이나 final quality를 주장하지 않는다.

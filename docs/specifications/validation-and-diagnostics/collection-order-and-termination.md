# 수집, 순서와 중단

## 검사 계획과 수집 방식 {#validation-collection-plan}

### Aggregate 실행 {#validation-aggregate-execution}

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-declared-collection-mode aggregate와 fail-fast 방식 및 실제 완료 상태를 session 입력과 결과에 고정한다. -->

Session은 validation target을 canonical check plan으로 확장하고 각 check의 identity, prerequisite, owned scope, cost class와 blocking policy를 확정한다. Effective collection mode는 aggregate 또는 fail-fast이며 request와 result에 모두 기록한다.

같은 check를 수행했다면 collection mode가 diagnostic identity, classification, severity와 observed verdict를 바꾸지 않는다. 두 mode의 차이는 실행한 check 집합, stop reason과 result completeness로만 설명할 수 있어야 한다.

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-aggregate-boundary 독립 검사를 계속하면서 선행 사실이 없는 종속 검사를 추측하지 않는다. -->

Aggregate mode는 prerequisite graph에서 독립적으로 실행 가능한 모든 check를 수행하고 발견한 모든 occurrence를 모은다. 한 scope의 error는 그 scope에 의존하지 않는 check를 중단시키지 않으며, 병렬 실행은 허용해도 결과 의미와 순서를 바꾸지 않는다.

Prerequisite가 invalid, missing, unknown, unsupported 또는 failed이면 그 사실에 의존하는 check는 not-run으로 남고 원인 edge를 가리킨다. 같은 선행 원인에서 파생될 수 있는 가상의 위반을 생성하지 않으며 checked, blocked와 not-run scope를 결과에 모두 보존한다.

### Fail-fast 실행 {#validation-fail-fast-execution}

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-fail-fast-boundary 안전하거나 의미 있는 진행이 불가능한 정확한 경계에서 중단하고 잔여 범위를 표시한다. -->

Fail-fast mode는 canonical plan에서 첫 blocking diagnostic이 확정되거나 계속하면 안전, 무결성, 격리 또는 결과 의미를 침해하는 boundary에 도달하면 멈춘다. Stop record는 trigger diagnostic, stop policy, 완료한 check와 not-run remainder를 가진다.

병렬 check는 dependency와 canonical plan position으로 고정된 wave 안에서만 함께 실행한다. 한 wave를 끝낸 뒤 그 안의 가장 이른 blocking diagnostic으로 stop boundary를 정하고 이후 wave를 시작하지 않아 completion timing이 checked scope나 trigger를 바꾸지 않게 한다.

한 subject의 failure가 독립 subject까지 중단시키는지는 scope propagation policy로 선언한다. 사용자가 aggregate를 요청해도 security와 integrity의 mandatory stop은 우선하며, 이 강제 전환과 영향을 받은 범위를 결과에 기록한다.

### 반복 발생과 Deduplication {#validation-diagnostic-deduplication}

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-duplicates-and-occurrences 반복 원인을 요약하면서 개별 위치와 전체 발생 범위를 보존한다. -->

Deduplication key는 diagnostic identity, confirmed cause identity와 equivalent affected scope를 사용하며 display message나 번역 문자열을 사용하지 않는다. 서로 다른 subject, time, path, input revision 또는 severity의 occurrence는 같은 문구라도 합치지 않는다.

요약은 total occurrence count, distinct affected scope, representative occurrence와 selection rule을 가진다. 전체 count를 budget 때문에 확정하지 못하면 lower bound와 unknown remainder를 구분하고, 대표 occurrence만 반환해도 원래 overall verdict를 다시 계산하지 않는다.

### Canonical 진단 순서 {#validation-canonical-diagnostic-order}

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order 병렬 완료나 번역에 흔들리지 않는 사용자 가시 순서를 정의한다. -->

정규 순서는 severity rank, affected scope identity, location kind와 canonical location, diagnostic identity, occurrence identity 순의 total order를 사용한다. Domain에서 의미 있는 authored order가 우선해야 하는 check는 그 order를 scope location에 포함하고, 의미 없는 map과 filesystem discovery order는 정규화한다.

수집자는 병렬 completion, host scheduling, filesystem enumeration, network response arrival와 localized message를 정렬 입력으로 사용하지 않는다. 정렬 규칙의 semantic change는 compatibility version을 바꾸고 이전 결과와 같은 ordered contract라고 주장하지 않는다.

### 완전성과 결정성 {#validation-result-completeness-determinism}

<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism 검사 coverage와 결정성 보장 범위 및 허용 차이를 결과에 명시한다. -->

Result completeness는 complete, incomplete 또는 refused이며 complete는 계획된 required check가 모두 실제로 실행되어 terminal observation 또는 supported classification을 가진 상태다. 실행 결과가 unknown이나 unsupported이면 coverage는 complete일 수 있지만 overall acceptance는 통과하지 않으며, required check가 not-run이면 complete가 아니다. Incomplete는 fail-fast, budget, cancellation, dependency failure 또는 execution truncation으로 미검사 범위가 남은 상태이고 refused는 유효한 session을 시작할 전제조건을 만들지 못한 상태다.

같은 immutable input, policy, compatibility identity와 deterministic dependency snapshot은 같은 diagnostic set, occurrence identity, order와 overall verdict를 낸다. 외부 상태나 platform 차이가 허용되는 boundary는 그 identity와 tolerance를 입력에 포함하고, 고정하지 못한 차이는 non-deterministic scope로 선언하여 complete deterministic result로 표시하지 않는다.

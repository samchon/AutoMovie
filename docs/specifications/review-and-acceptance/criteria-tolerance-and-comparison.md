# Criterion, Tolerance와 비교

## Criterion 레코드 {#acceptance-system-criterion-record}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-criterion-completeness Defines every field required for a valid criterion. -->
<!-- @evidence requirements/review/criteria-and-comparison.md#review-observable-criteria Makes review criteria observable, bounded and falsifiable. -->

Criterion 레코드는 stable identity와 version, target과 scope, intent basis, precondition, observable, expected state, comparison rule, tolerance 또는 exact 선언, failure condition, required evidence, severity, profile과 authority를 가진다. 필수 field가 빠지면 criterion은 invalid이며 대상 verdict를 만들지 않는다.

### 반증 가능성과 단일 책임 {#acceptance-system-falsifiable-single-responsibility}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-falsifiable-statement Requires another observer to distinguish success from failure. -->
<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-single-responsibility Separates criteria with different observations, authority, evidence or impact. -->

Criterion 문장은 동일 범위를 본 다른 관찰자가 pass와 fail을 구분할 수 있게 observable과 반증 조건을 명시한다. 서로 다른 observable, authority, evidence kind 또는 failure impact를 가진 조건은 별도 criterion identity로 분리한다.

## Observable 유형 {#acceptance-system-observable-types}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-observable-kinds Defines numeric, structural, state, perceptual, semantic and comparison observations. -->

Observable은 수치, 구간, 집합과 관계, 순서와 state transition, 존재와 부재, perceptual feature, semantic 전달 또는 정의된 comparison result 중 하나 이상의 명시된 유형을 가진다. 서로 다른 유형을 결합할 때 각 부분의 판정과 evidence를 잃지 않는다.

### 수치 Observable {#acceptance-system-numeric-observable}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-numeric-observable Defines units, coordinate or time basis, samples, aggregation and significant precision. -->

수치 observable은 측정 대상, 단위, 좌표계 또는 시간 기준, 표본 범위, 집계 방식, 정밀도와 불확실성을 가진다. Planned parameter와 measured result를 별도 값으로 보존한다.

### 구조 Observable {#acceptance-system-structural-observable}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-structural-observable Defines identity, relationship, order, coverage, cardinality and transition checks. -->

구조 observable은 required identity, 포함과 연결 관계, 순서, coverage, cardinality, state transition과 forbidden relation을 표현한다. 항목 존재만으로 관계의 정확성을 충족했다고 판정하지 않는다.

### 지각 Observable {#acceptance-system-perceptual-observable}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-perceptual-observable Defines actual visual and audio observation under explicit presentation conditions. -->

지각 observable은 관찰 target, presentation context, 시간과 view 범위, 기대되는 특징과 실패 artifact를 가진다. 설명, metadata 또는 구조 검사만으로 pixel이나 decoded audio의 지각값을 생성하지 않는다.

### 의미 Observable {#acceptance-system-semantic-observable}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-semantic-observable Defines narrative information, events, state and audience inference with human observations. -->

의미 observable은 전달할 정보, 사건, character state, causality, emotional transition 또는 audience inference와 이를 관찰할 scene과 시간 범위를 가진다. 결과는 authority의 실제 관찰문과 결속되고 자동 수치값으로 가장하지 않는다.

## Baseline과 Reference 순서 {#review-system-baseline-reference-order}

<!-- @evidence requirements/review/criteria-and-comparison.md#review-criteria-comparison Requires every judgment to name its authored intent, criterion, baseline or reference. -->
<!-- @evidence requirements/review/criteria-and-comparison.md#review-criteria-precedence Defines precedence when criteria or references conflict. -->

Comparison context는 authored intent, criterion, accepted baseline, source, reference와 alternative candidate의 역할과 적용 순서를 명시한다. Reference와 과거 baseline은 현재 필수 criterion을 자동으로 대체하지 않으며 충돌한 근거는 숨기지 않는다.

### 비교 가능성 {#review-system-comparability}

<!-- @evidence requirements/review/criteria-and-comparison.md#review-comparable-subjects Requires common source, intent, semantic position and presentation for comparison. -->
<!-- @evidence requirements/review/criteria-and-comparison.md#review-noncomparable-state Defines noncomparable as a first-class result rather than a forced ranking. -->

비교 가능한 후보는 공통 source와 intent, 대응 semantic event 또는 시간 위치, presentation context, criterion version과 허용된 variation을 공유한다. 필수 대응이 없으면 comparison state는 noncomparable이며 우열, regression 또는 pass를 만들지 않는다.

## Tolerance 레코드 {#acceptance-system-tolerance-record}

<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-tolerance-declaration Defines tolerance kind, value, unit, reference, direction and boundary inclusion. -->

Tolerance는 종류, 값, 단위, 기준값, 적용 방향과 경계 포함 여부를 가진다. Exact 선언과 미정 tolerance를 구분하며 미정 상태는 0 tolerance가 아니라 invalid criterion이다.

### 절대, 상대와 방향 Tolerance {#acceptance-system-tolerance-kinds}

<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-absolute-relative-tolerance Defines absolute and relative tolerance composition including zero denominators. -->
<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-asymmetric-directional-tolerance Defines independent upper and lower risk boundaries. -->

절대 tolerance는 기준값과 같은 단위를 사용하고 상대 tolerance는 분모와 0 근처 규칙을 가진다. 상한과 하한의 영향이 다르면 비대칭 값을 사용하며 여러 tolerance의 AND 또는 OR 결합을 명시한다.

### 공간과 시간 Tolerance {#acceptance-system-spatiotemporal-tolerance}

<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-spatiotemporal-tolerance Defines rotation, coordinate, distance and time bases before comparison. -->

각도 tolerance는 회전 주기와 최단 방향을, 공간 tolerance는 좌표계와 distance definition을, 시간 tolerance는 story time, presentation time, frame 또는 sample basis를 가진다. 기준이 다른 값은 명시된 변환 없이 비교하지 않는다.

### 경계, 반올림과 이산 표본 {#acceptance-system-boundary-precision}

<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-boundary-semantics Defines inclusive and exclusive endpoints and exact-boundary verdicts. -->
<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-rounding-quantization Preserves decision precision independently from display rounding. -->
<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-discrete-sample-boundary Defines inclusion and nearest-sample behavior at frame, sample and event boundaries. -->

범위 criterion은 endpoint 포함 여부와 exact boundary verdict를 정의하고 판정 정밀도, 반올림과 양자화 규칙을 기록한다. 이산 대상의 시작과 끝, nearest-sample 선택과 verdict를 바꾸는 양쪽 인접 표본을 보존한다.

### 지각 Tolerance와 Profile 소유값 {#acceptance-system-perceptual-profile-tolerance}

<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-perceptual-tolerance Defines perceptual tolerance against an identified reference and observer context. -->
<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-profile-owned-thresholds Keeps destination-specific numeric values inside their profile. -->

지각 tolerance는 기준 reference, 관찰자 또는 authority, target presentation과 허용 가능한 차이의 관찰 언어를 가진다. 해상도, rate, loudness, color, caption timing과 접근성 threshold는 목적별 profile이 소유하며 보편 기본값으로 승격하지 않는다.

## 자동 판정과 사람 판정 {#acceptance-system-deterministic-subjective-verdict}

<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-verdict-determinism Requires identical numeric and structural inputs to yield identical verdicts. -->
<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-subjective-verdict-boundary Keeps perceptual and semantic human judgment explicit. -->
<!-- @evidence requirements/review/criteria-and-comparison.md#review-quantitative-qualitative-criteria Separates quantitative pass from qualitative judgment. -->

수치와 구조 criterion은 같은 version, profile, target, observable과 comparison context에서 같은 verdict를 산출한다. 지각, 서사와 미학 criterion은 사람 judgment record를 요구하며 정량 threshold의 pass가 그 judgment를 대신하지 않는다.

# Acceptance Criterion과 관찰값

## Criterion의 완전성 {#acceptance-criterion-completeness}

각 criterion은 안정된 identity, 적용 대상, 의도 근거, 전제 조건, 관찰 범위, 관찰값, 기대값 또는 기대 상태, 비교 규칙, 허용오차 또는 exact 선언, 실패 조건, 필수 evidence, severity와 적용 profile을 가져야 한다.

필수 요소가 빠진 criterion은 fail이 아니라 invalid criterion으로 보고해야 한다. 기준을 완성하지 않은 상태에서 결과를 통과 또는 실패로 추정하지 않아야 한다.

### 반증 가능한 문장 {#acceptance-falsifiable-statement}

Criterion은 다른 관찰자가 같은 범위에서 성공과 실패를 구분할 수 있게 써야 한다. “좋아 보여야 한다”, “자연스러워야 한다”, “문제가 없어야 한다” 같은 표현은 관찰 가능한 특징, 비교 대상과 반증 조건이 함께 있을 때만 사용할 수 있어야 한다.

### 단일 책임 {#acceptance-single-responsibility}

서로 다른 관찰값, authority, evidence 종류 또는 실패 영향을 가진 조건은 별도 criterion으로 나누어야 한다. 한 복합 문장의 일부만 통과했을 때 전체를 pass로 표시하지 않아야 한다.

## 판정 결정성 {#acceptance-verdict-determinism}

수치·구조 criterion은 같은 criterion version, profile, 대상, 관찰값과 비교 조건에서 항상 같은 verdict를 내야 한다. 숨은 threshold, 실행마다 바뀌는 기본값 또는 판정 뒤의 임의 보정이 verdict에 개입하지 않아야 한다.

### 주관적 판정의 경계 {#acceptance-subjective-verdict-boundary}

시각·청각·서사 criterion에서 사람의 판단이 필요하면 이를 결정적 수치 판정으로 가장하지 않아야 한다. 같은 관찰 범위, criterion, authority와 실제 판단을 결속하여 누가 무엇을 보고 어떤 결론을 내렸는지 재검토할 수 있어야 한다.

## 관찰값의 종류 {#acceptance-observable-kinds}

Acceptance는 수치값, 구간, 집합과 관계, 순서와 상태 전이, 존재와 부재, 시각·청각 특징, 서사 전달과 사용자가 정의한 비교 결과를 관찰값으로 다룰 수 있어야 한다.

### 수치 관찰값 {#acceptance-numeric-observable}

수치 criterion은 단위, 좌표계 또는 시간 기준, 측정 대상, 표본 범위, 집계 방식과 유효 숫자를 명시해야 한다. 측정값과 계획값을 구분하고 계획값만으로 실제 결과를 통과시키지 않아야 한다.

### 구조 관찰값 {#acceptance-structural-observable}

구조 criterion은 필요한 identity, 포함 관계, 연결, 순서, coverage, cardinality, 상태 전이와 금지된 관계를 판정할 수 있어야 한다. 항목의 존재만 검사하고 관계의 정확성을 생략하지 않아야 한다.

### 시각과 청각 관찰값 {#acceptance-perceptual-observable}

시각·청각 criterion은 관찰할 대상, presentation 조건, 시간 범위, 기대되는 지각 특징과 실패 artifact를 명시해야 한다. 설명이나 metadata만으로 실제 pixel 또는 decoded audio의 관찰을 대체하지 않아야 한다.

### 서사와 의미 관찰값 {#acceptance-semantic-observable}

서사 criterion은 전달되어야 할 정보, 사건, 인물 상태, 인과, 정서적 전환 또는 audience inference를 가리키고 이를 드러내는 장면과 시간 범위를 지정해야 한다. 주관적 판정에는 판단 authority와 실제 관찰문이 필요하다.

## 전제 조건과 소비 조건 {#acceptance-preconditions-consumers-group}

### 전제 조건과 소비 조건 {#acceptance-preconditions-consumers}

Criterion은 판정 전에 충족되어야 할 입력, 의존 대상, representation tier, display 또는 playback 조건과 필요한 하류 사용 목적을 밝혀야 한다.

전제 조건이 충족되지 않으면 대상 결과의 fail로 오인하지 않고 not-run, unsupported 또는 indeterminate 중 실제 상태로 보고해야 한다.

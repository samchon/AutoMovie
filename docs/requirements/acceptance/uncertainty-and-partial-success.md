# Acceptance 불확실성과 부분 성공

## Criterion verdict 상태 {#acceptance-criterion-verdicts}

각 criterion은 pass, fail, indeterminate, not-run, unsupported 또는 stale 중 현재 사실에 맞는 상태를 가져야 하며 상태의 원인과 적용 범위를 보여야 한다.

- `pass`는 현재 evidence가 criterion과 profile의 모든 필수 조건을 만족한 상태다.
- `fail`은 현재 evidence가 명시된 실패 조건 또는 허용오차 밖 결과를 보여 준 상태다.
- `indeterminate`는 current evidence가 서로 충돌하거나 정해진 불확실성 안에서 pass와 fail을 구분할 수 없는 상태다.
- `not-run`은 지원되는 판정을 아직 수행하지 않았거나 필수 관찰이 없는 상태다.
- `unsupported`는 선택한 대상 또는 profile에서 요구된 판정을 제품이 제공할 수 없는 상태다.
- `stale`은 이전 verdict의 대상, profile 또는 evidence 결속이 변경되어 현재 상태를 보증하지 못하는 상태다.

Invalid criterion은 대상 verdict가 아니라 기준 정의의 오류로 별도 보고해야 한다.

## 불확실성의 표현 {#acceptance-uncertainty-expression}

측정, 시간 정렬, 좌표 변환, 관찰자 판단, 외부 자료 또는 sampling에서 불확실성이 생기면 그 원인, 크기 또는 가능한 범위와 verdict에 미치는 영향을 보여야 한다.

### 수치 불확실성 {#acceptance-numeric-uncertainty}

측정 구간 전체가 pass 영역에 있으면 pass, 전체가 fail 영역에 있으면 fail로 판정할 수 있어야 한다. 구간이 acceptance boundary를 걸치면 추가 규칙이 없는 한 indeterminate이어야 한다.

### 지각과 의미 불확실성 {#acceptance-perceptual-uncertainty}

관찰자가 필요한 특징을 판별하지 못했거나 권한 있는 판단이 서로 충돌하면 그 사실을 의견 평균으로 숨기지 않아야 한다. Profile이 합의, 다수결 또는 최종 authority 규칙을 명시한 경우에만 그 규칙으로 verdict를 확정할 수 있어야 한다.

## 부분 성공 {#acceptance-partial-success}

Partial은 blocking fail 없이 대상의 명시된 일부 범위 또는 criterion이 pass이고 나머지 필수 범위가 미완료, unsupported, stale 또는 indeterminate인 집계 상태다.

Partial 결과는 통과한 criterion과 범위, 통과하지 않은 criterion과 범위, 남은 위험, 소비 가능한 목적과 금지된 목적을 함께 보여야 한다.

### 부분 산출물 {#acceptance-partial-artifact}

일부 frame, shot, stream, language, pass 또는 package만 존재하면 존재하는 부분은 좁게 판정할 수 있어야 하지만 전체 delivery나 film을 accepted로 표시하지 않아야 한다.

### 부분 evidence {#acceptance-partial-evidence}

수치 evidence만 있고 필수 visual review가 없거나 일부 시간과 view만 관찰했다면 관찰된 범위의 결과와 미관찰 범위를 분리해야 한다. Evidence 일부의 pass를 criterion 전체의 pass로 올리지 않아야 한다.

## 상태 간 승격 금지 {#acceptance-status-no-promotion}

Indeterminate, not-run, unsupported, stale와 partial을 경고가 있는 pass로 자동 변환하지 않아야 한다. 승격은 누락된 조건이 충족되고 current evidence로 다시 판정되었을 때만 가능해야 한다.

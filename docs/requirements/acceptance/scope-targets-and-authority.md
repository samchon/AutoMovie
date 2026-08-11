# Acceptance 범위, 대상과 권한

## 판정 대상의 정체성 {#acceptance-target-identity}

Acceptance 요청은 작품, sequence, shot, 시간 구간, 자산, actor, formation, 공간, camera, 음향, render product, delivery package 또는 명시된 하위 범위를 안정된 identity로 가리킬 수 있어야 한다.

대상 identity는 version, variant, profile과 판정 시점을 구분해야 하며, 이름이 같더라도 내용이나 의존 상태가 다른 대상을 같은 승인 대상으로 합치지 않아야 한다.

### 범위의 포함과 제외 {#acceptance-scope-inclusion-exclusion}

승인 범위는 포함되는 대상, 시간, 시점, view, 언어, channel, pass, rendition과 delivery를 열거하거나 반증 가능한 선택 규칙으로 한정해야 한다. 제외 범위는 이유와 함께 보여야 하며, 침묵한 제외를 통과로 간주하지 않아야 한다.

### 요청 가능한 단위 {#acceptance-requestable-unit}

사용자는 전체 작품 승인과 별도로 한 criterion, 한 대상, 한 시간 구간, 한 profile 또는 한 변경분의 판정을 요청할 수 있어야 한다. 좁은 요청의 결과는 그 범위를 넘어서는 보증이 되지 않아야 한다.

## 권한의 분리 {#acceptance-authority-separation}

Acceptance는 criterion을 요청한 주체, evidence를 생산한 주체, 관찰값을 판정한 주체, 예외 위험을 인수한 주체와 최종 승인 authority를 구분해 보여야 한다.

한 사람이 여러 역할을 맡을 수 있지만 각 역할과 권한 범위는 명시되어야 한다. 자동 판정은 수치와 구조 사실을 제공할 수 있으나 선언된 사람의 미학·서사 판단을 대신했다고 주장하지 않아야 한다.

### Criterion 소유 권한 {#acceptance-criterion-owner-authority}

Criterion owner는 기대 상태, 비교 규칙, 허용오차 또는 exact 선언, 필수 evidence, severity와 적용 profile을 확정할 수 있어야 한다. 판정자는 owner가 확정한 기준을 임의로 완화하거나 숨은 기준을 추가하지 않아야 한다.

### 검토와 승인 권한 {#acceptance-review-approval-authority}

Reviewer는 관찰과 판정을 소유하고 approver는 그 판정을 승인 상태로 채택할 권한을 소유한다. 두 역할이 다르면 reviewer의 pass만으로 승인이 완료되지 않아야 하며, approver의 서명만으로 누락된 evidence가 생기지 않아야 한다.

### 최종 게시 권한 {#acceptance-publication-authority}

작품 또는 delivery의 최종 게시 authority는 하위 승인, 남은 예외, profile 적합성, stale 상태와 부분 성공을 모두 볼 수 있어야 한다. 게시 선택은 기술적 pass와 별도 결정으로 남아야 한다.

## 권한 충돌과 부재 {#acceptance-authority-conflict-group}

### 권한 충돌과 부재 {#acceptance-authority-conflict}

서로 다른 authority가 같은 범위에 상충하는 판정을 내리면 우선순위나 합의 규칙이 명시되지 않은 한 결과는 indeterminate이어야 한다.

필수 authority가 지정되지 않았거나 승인할 수 없는 경우 criterion의 관찰이 끝났더라도 승인 상태는 pending-authority로 남아야 한다.

# Acceptance 승인, 예외와 게시

## 승인 결정 {#acceptance-approval-decision}

승인 결정은 대상과 version, 적용 profile, criterion별 verdict, evidence identity, 남은 예외, 승인 authority, 결정 시점과 승인 범위를 보여야 한다.

승인은 blocking criterion의 observed pass, 다른 required criterion의 완료와 authority의 채택을 모두 요구해야 한다. Criterion pass가 있어도 authority 승인이 없으면 승인 완료가 아니고, authority의 선호가 있어도 blocking fail을 pass로 바꾸지 않아야 한다.

### 승인 상태 {#acceptance-approval-status}

승인 상태는 accepted, rejected, partial, accepted-with-deviation 또는 pending-authority를 구분해야 한다. Accepted는 모든 required criterion이 current한 pass 또는 fail이고 모든 blocking criterion이 pass이며 필요한 권한이 충족된 상태, rejected는 비면제 blocking fail 또는 허용된 deviation이 없는 blocking fail이 남은 상태, partial은 blocking fail 없이 명시된 일부 범위나 criterion만 성공한 상태, accepted-with-deviation은 허용된 위반과 위험 인수를 함께 채택한 상태, pending-authority는 판정이 끝났지만 필수 승인이 없는 상태여야 한다.

판정 자체가 완료되지 않은 범위는 원인에 따라 indeterminate, not-run, unsupported 또는 stale을 유지해야 한다. 이 상태를 authority만 남은 pending-authority로 바꾸지 않아야 한다.

### 승인과 선택의 구분 {#acceptance-approval-selection-separation}

여러 대안 중 하나를 선택한 사실과 선택한 대안이 profile을 통과한 사실을 구분해야 한다. 최선의 후보라는 이유만으로 기준 미달 결과를 accepted로 표시하지 않아야 한다.

### 조건부 사용 {#acceptance-conditional-use}

완전 승인 전의 결과를 권한 있는 주체가 제한된 목적에 사용하도록 허용할 때는 허용 목적, 금지 목적, 남은 criterion, 위험 owner와 만료 조건을 명시해야 한다. 조건부 사용은 pass가 아니라 partial 또는 accepted-with-deviation 상태로 보여야 한다.

## 예외와 Deviation {#acceptance-deviation-contract}

Profile이 허용하는 deviation은 대상 criterion, 관찰된 위반, 영향 범위, 사유, 대안, 위험 인수 authority, 만료 또는 재검토 조건과 publication 영향을 기록해야 한다.

Deviation은 fail 사실을 지우거나 criterion verdict를 pass로 바꾸지 않아야 한다. 전체 결정은 accepted-with-deviation으로 구분되고 원래 verdict를 보존해야 한다.

### 비면제 조건 {#acceptance-nonwaivable-criteria}

Profile은 무결성, 안전, 권리, credential 노출, 필수 접근성 또는 다른 blocking 조건 중 면제할 수 없는 항목을 선언할 수 있어야 한다. 비면제 fail이 있으면 authority도 같은 profile의 게시 승인을 만들 수 없어야 한다.

### 예외 만료 {#acceptance-deviation-expiry}

시간, version, 대상, profile 또는 위험 조건에 묶인 deviation은 경계가 바뀌면 stale이 되어야 한다. 이전 예외를 새 결과에 자동 상속하지 않아야 한다.

## 게시 판정 {#acceptance-publication-decision}

게시 대상은 required profile의 승인 상태, 실제 delivery evidence, known deviation, partial 또는 unsupported 범위와 publication authority의 결정을 함께 가져야 한다.

### 게시 원자성 {#acceptance-publication-atomicity}

사용자는 게시된 package가 승인된 한 version의 완전한 구성인지 확인할 수 있어야 한다. 서로 다른 승인 세대의 frame, audio, caption, manifest 또는 provenance를 섞은 package를 완전한 게시로 표시하지 않아야 한다.

### 게시 후 상태 {#acceptance-post-publication-status}

게시 뒤 대상 bytes, manifest, profile 또는 승인 결속이 바뀌면 기존 게시 verdict와 현재 후보 verdict를 구분해야 한다. 이전 게시가 유효했다는 사실로 변경된 후보를 자동 승인하지 않아야 한다.

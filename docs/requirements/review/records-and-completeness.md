# 검토 기록과 완결성

## 검토가 실제로 수행되었음을 보여 주는 기록 {#review-records-completeness}

검토 기록은 예정된 범위와 기준, 실제로 본 대상, 발견 사항, 최종 판정과 미완료 사유를 연결하여 검토의 coverage와 완결성을 판단할 수 있어야 한다.

### 계획과 실제 Coverage {#review-planned-actual-coverage}

필수 frame, 구간, 주체, 작품 단계, criterion과 담당자를 계획한 coverage와 실제 검토한 coverage로 구분하고 빠진 범위를 명시해야 한다.

### 상태의 구분 {#review-execution-status}

Not-started, in-review, reviewed, blocked, not-run, unsupported와 stale을 구분하고 artifact가 존재하거나 주석이 하나 있다는 이유로 검토 완료를 주장하지 않아야 한다.

### 불완전한 검토 {#review-incomplete-review}

대상 누락, 재생 실패, 필수 reference 부재, 권한자 부재 또는 재현 불가능한 context 때문에 끝내지 못한 검토는 그 사유와 영향받은 판정을 표시해야 한다.

### 완결성 주장 {#review-completeness-claim}

검토 완료는 선언된 필수 범위와 기준이 실제로 검토되고 모든 blocking Finding과 필요한 사람의 판정이 처리되었을 때만 주장할 수 있어야 한다.

### 판정 Receipt {#review-verdict-receipt}

최종 기록은 대상 identity, review context, coverage, Finding 요약, 판정, 판정자와 시점을 함께 보여 주고 이후 변경이 그 판정을 유지하는지 무효화하는지 추적할 수 있어야 한다.

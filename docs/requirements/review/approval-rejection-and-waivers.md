# 승인, 반려와 Waiver

## 명시적인 검토 결과 {#review-approval-rejection-waivers}

검토 결과는 pending, approved, approved with conditions, rejected, waived와 superseded를 구분하고 누가 어느 범위와 version에 언제 판정했는지 보여야 한다.

### 승인 {#review-approval}

승인은 적용된 필수 기준이 충족되고 미해결 Finding이 허용 범위 안에 있다는 최종 권한자의 명시적 결정이어야 하며 이후 다른 범위나 version의 승인 근거로 자동 확장되지 않아야 한다.

### 반려 {#review-rejection}

반려는 충족되지 않은 기준, 근거 Finding, 영향을 받는 범위와 다시 검토하기 위한 조건을 식별하고 단순히 실패 상태만 남기지 않아야 한다.

### 조건부 승인 {#review-conditional-approval}

조건부 승인은 남은 조건, 확인 책임, 기한 또는 다시 검토할 사건을 명시하고 조건이 충족되기 전에는 무조건 승인과 구분해야 한다.

### Waiver {#review-waiver}

Waiver는 알려진 미충족 조건을 숨기지 않고 최종 권한자가 이유, 수용한 영향과 위험, 적용 범위, 유효 기간 또는 재검토 trigger를 명시하여 수용한 결정이어야 한다.

### 변경 뒤 판정 Freshness {#review-verdict-freshness}

승인, 반려 또는 waiver 뒤 대상, 기준이나 필수 context가 바뀌면 영향받은 판정을 stale 또는 superseded로 표시하고 변경되지 않은 범위의 판정과 구분해야 한다.

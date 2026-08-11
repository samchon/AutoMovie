# 취소와 중단

## 의도가 보존되는 작업 중단 {#operations-cancellation-interruption}

사용자는 긴 작업을 pause하거나 cancel할 수 있어야 하며, 요청 접수와 실제 중단 완료를 구분하여 작업이 계속 실행 중인지 알 수 있어야 한다.

### Pause와 Cancel의 구분 {#operations-pause-cancel-distinction}

Pause는 재개 가능한 상태 보존을 요청하고 cancel은 남은 작업을 포기하도록 요청하며, 두 요청의 결과와 허용되는 후속 동작을 서로 바꾸어 보고하지 않아야 한다.

### 안전한 중단 지점 {#operations-safe-interruption-point}

중단은 일관된 작업 단위와 artifact 경계에서 확인되어야 하며, 그 경계에 도달하기 전에는 pausing 또는 cancelling 상태와 예상되는 추가 작업 범위를 보여야 한다.

### 부분 결과의 상태 {#operations-cancelled-partial-results}

중단 전에 검증된 결과, 재개에 사용할 수 있는 checkpoint, 폐기해야 하는 partial artifact와 완료되지 않은 범위를 구분하고, cancelled job의 일부를 전체 성공으로 제시하지 않아야 한다.

### 강제 종료 {#operations-forced-termination}

안전한 중단을 기다릴 수 없어 강제 종료할 때는 별도 권한, 명시된 사유와 영향 범위가 필요하며, 종료 뒤 완료 여부가 불명확한 side effect와 artifact를 복구 전까지 격리해야 한다.

### Timeout과 자동 중단 {#operations-timeout-interruption}

Timeout, quota 회수와 운영 정책에 따른 자동 중단은 사용자 cancel과 구분되는 원인을 남기고, 적용된 한계, 마지막 recovery point와 재개 가능 여부를 보고해야 한다.

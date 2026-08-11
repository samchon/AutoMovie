# Chunk, Resume와 Recovery

## 긴 Render의 Bounded 작업 단위 {#rendering-chunks-resume-recovery}

Film render를 frame range, pass와 output product의 chunk로 나누고 각 chunk의 input identity, planned outputs, status, receipt와 retry relation을 가져야 한다.

### Resume {#rendering-resume}

Current digest와 complete receipt가 일치하는 frame만 재사용하고 partial, stale, corrupt와 missing output을 다시 materialize해야 한다.

### Atomic Publication {#rendering-atomic-publication}

Chunk와 final product는 temporary 또는 isolated output에서 완성·검증한 뒤 원자적으로 publish하여 half-written file을 current로 노출하지 않아야 한다.

### Failure Recovery {#rendering-failure-recovery}

Runtime crash, timeout, missing frame, encode failure와 concurrent job conflict에서 completed work의 정확한 범위를 보존하고 unsafe lock stealing을 하지 않아야 한다.

### Retry Identity {#rendering-retry-identity}

같은 input retry와 changed input rerun을 구분하고 retry count나 wall-clock time이 frame bytes를 바꾸지 않아야 한다.

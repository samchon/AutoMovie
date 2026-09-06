# Chunk, Resume와 Recovery

## 긴 Render의 Bounded 작업 단위 {#rendering-chunks-resume-recovery}

Film render는 frame range, view, pass와 output product의 bounded chunk로 나눌 수 있어야 한다. 각 chunk는 input identity, exact schedule subset, expected outputs, dependency closure, status, attempt와 verified receipt를 가져야 한다.

### Deterministic Partition {#rendering-chunk-partition}

Chunk는 전체 schedule의 겹치지 않는 완전한 partition이어야 하며 numbering gap이나 duplicate output을 만들면 안 된다. Chunk size, worker count 또는 실행 순서가 frame identity와 content를 바꾸어서는 안 된다.

### Resume {#rendering-resume}

현재 expected identity와 일치하고 bytes, digest, dimensions, channel과 receipt가 검증된 output만 재사용해야 한다. Partial, stale, corrupt, missing 또는 unverified output은 exact affected work unit만 다시 materialize해야 한다.

기존 pointer나 publication을 읽을 수 없거나 integrity, locator, ownership 또는 observation이 모순되면 그 generation은 missing으로 취급하지 않아야 한다. 명시적 cleanup 판정이 exact remove 또는 quarantine 권한을 확정하기 전에는 자동 재사용, overwrite와 rerender를 모두 막고 원래 target, captured generation, reason과 evidence를 보존해야 한다.

### Atomic Publication {#rendering-atomic-publication}

Chunk는 final product와 분리된 temporary 또는 isolated destination에서 모든 expected output을 쓰고 검증한 뒤 원자적으로 current로 publish해야 한다. Half-written frame, incomplete sequence와 receipt 없는 bytes를 다른 job이나 viewer가 current로 보아서는 안 된다.

### Concurrent Work {#rendering-concurrent-work}

동일 output에 대한 concurrent job은 expected identity와 ownership 또는 동등한 precondition으로 조정되어야 한다. 서로 다른 identity가 같은 path를 덮어쓰거나 오래된 worker가 새 결과를 current로 승격해서는 안 된다.

Local worker ownership은 bare PID가 아니라 host·PID·process generation 전체를 기록해야 한다. PID occupancy는 recorded worker와 동일성을 증명하지 않으며, session, GC guard, chunk claim, attempt와 temporary tree가 서로 다른 owner 의미를 사용해서는 안 된다.

### Failure Recovery {#rendering-failure-recovery}

Runtime crash, timeout, cancellation, storage exhaustion, missing frame, encode failure와 worker loss에서 검증 완료된 atomic chunks의 정확한 범위를 보존해야 한다. Unsafe lock stealing이나 불명확한 process 상태에서 재개하지 말고 orphan을 격리하고 ownership을 확인해야 한다.

Worker-loss recovery는 같은 complete owner를 독립적으로 두 번 확인하여 모두 absent이고 그 사이 exact claim 또는 artifact generation이 바뀌지 않았을 때만 reclaim해야 한다. Reused PID, 다른 host, malformed owner와 query failure에서는 chunk, attempt와 temporary evidence를 보존해야 한다.

### Retry Identity {#rendering-retry-identity}

같은 input retry는 attempt number, diagnostic와 elapsed facts만 달라질 수 있고 frame bytes를 결정하는 값은 바꾸면 안 된다. Setting이나 dependency가 달라진 rerun은 새 input identity이며 이전 receipt를 같은 작업의 retry로 합쳐서는 안 된다.

### Assembly Closure {#rendering-chunk-assembly}

전체 product를 assemble하기 전에 모든 expected chunk, frame, pass와 view가 current이고 중복 없이 contiguous한지 검증해야 한다. 일부 chunk만 성공한 상태에서는 partial manifest를 제공할 수 있지만 complete sequence나 encode input으로 승인해서는 안 된다.

### Recovery Refusal {#rendering-recovery-refusal}

Ambiguous ownership, mismatched schedule, receipt와 byte mismatch, overlapping chunks, unbounded retry와 unsafe temporary path는 재개를 거절해야 한다. Diagnostic은 reusable set, rerender set, quarantined set과 safe next action을 구분해야 한다.

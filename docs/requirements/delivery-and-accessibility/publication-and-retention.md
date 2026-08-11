# Publication과 Retention

## 검증 뒤의 원자적 Publication {#delivery-publication-retention}

Final media 또는 package는 encode, probe, integrity, required accessibility와 review가 exact current input에 대해 통과한 뒤에만 immutable 또는 versioned destination에 원자적으로 publish되어야 한다. Publication은 public reference, artifact identity, digest, time와 actor를 기록해야 한다.

### Candidate와 Published {#delivery-candidate-published}

Temporary, partial, candidate, selected, publishing, published, superseded, withdrawn와 failed state를 구분해야 한다. Candidate path, preview URL 또는 upload completion을 public delivery success로 보고해서는 안 된다.

### Publication Preconditions {#delivery-publication-preconditions}

Expected profile revision, selected edit, package digest, current validation, required approvals와 destination identity를 publication 직전에 다시 확인해야 한다. 하나라도 stale 또는 missing이면 이전 성공 기록과 관계없이 publish를 중단해야 한다.

### Concurrent Publication {#delivery-concurrent-publication}

Expected current revision과 exclusive ownership 또는 동등한 compare-and-publish precondition을 사용해야 한다. 다른 session의 publication을 조용히 덮어쓰거나 늦게 끝난 old revision이 current pointer를 되돌려서는 안 된다.

### Atomic Visibility와 Recovery {#delivery-publication-atomicity}

Bytes와 manifest는 final destination과 분리된 위치에서 완전하게 전송 및 검증된 뒤 한 version으로 visible해져야 한다. Interrupted upload, partial copy와 manifest-only update는 public current가 되어서는 안 되며 retry는 already verified bytes를 안전하게 재사용할 수 있어야 한다.

### Published Verification {#delivery-published-verification}

Publication 뒤에는 destination에서 다시 읽은 artifact와 manifest의 identity, size와 digest가 candidate와 일치하고 public reference가 정확한 version을 가리키는지 확인해야 한다. Readback 또는 reference resolution이 실패하면 새 version을 published로 기록하지 말고 이전 current version을 유지해야 한다.

### Supersede, Withdraw와 Rollback {#delivery-publication-state-change}

New version publication, withdrawal과 rollback-like selection은 append-only activity로 기록하고 이전 immutable artifact를 다른 bytes로 덮어쓰지 않아야 한다. Rollback은 old version을 다시 current로 선택하는 새 결정이며 old review가 여전히 valid한지 확인해야 한다.

### Retention과 Cleanup {#delivery-retention-cleanup}

Source, intermediate, receipt, candidate, published artifact와 superseded version은 목적지별 retention period, hold, deletion eligibility와 owner를 가져야 한다. Current manifest, provenance 또는 active review가 참조하는 bytes를 cleanup해서는 안 된다.

### Deletion Evidence {#delivery-retention-deletion}

Cleanup은 exact target identity, resolved path 또는 object, policy decision, deleted bytes와 failure를 기록해야 한다. Partial deletion은 complete로 보고하지 말고 remaining references와 safe retry condition을 제공해야 한다.

### Publication Refusal {#delivery-publication-refusal}

Failed probe, stale review, missing required stream, digest mismatch, concurrent change, unsafe destination, partial copy와 retention conflict는 publication을 거절해야 한다. 기존 published version은 명시적 supersede 또는 withdrawal 전까지 그대로 유지해야 한다.

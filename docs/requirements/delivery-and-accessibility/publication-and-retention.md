# Publication과 Retention

## 검증 뒤의 원자적 Publication {#delivery-publication-retention}

Final media와 package는 encode, probe, integrity와 required review가 current일 때만 immutable 또는 versioned destination에 원자적으로 publish되어야 한다.

### Candidate와 Published {#delivery-candidate-published}

Temporary, candidate, selected, published, superseded와 withdrawn state를 구분하고 candidate path를 public delivery로 보고하지 않아야 한다.

### Concurrent Publication {#delivery-concurrent-publication}

Expected current revision과 lock 또는 equivalent precondition을 사용하여 다른 session의 새 publication을 조용히 덮어쓰지 않아야 한다.

### Retention과 Cleanup {#delivery-retention-cleanup}

Source, intermediate, receipt, published artifact와 superseded version의 retention policy를 구분하고 current evidence가 참조하는 bytes를 cleanup하지 않아야 한다.

### Publication Refusal {#delivery-publication-refusal}

Failed probe, stale review, missing stream, digest mismatch, concurrent change와 partial copy를 published success로 기록하지 않아야 한다.

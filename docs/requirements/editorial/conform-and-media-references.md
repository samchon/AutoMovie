# Conform과 Media Reference

## Timeline과 실제 Media의 연결 {#editorial-conform-media-references}

각 clip은 source production 또는 external media, revision, byte digest, available range, timebase, dimensions 또는 channel과 decode facts를 참조해야 한다. Conform은 edit decision을 실제 media 구간에 결정적으로 연결하고 그 mapping과 결과 receipt를 추적할 수 있어야 한다.

### Reference Resolution {#editorial-reference-resolution}

Reference는 stable source identity를 먼저 확인하고 location은 그 source를 찾는 수단으로만 사용해야 한다. 상대 경로, manifest relation 또는 승인된 external locator를 정규화하되 이름이 같다는 이유만으로 다른 bytes를 선택해서는 안 된다.

### Image Sequence와 Movie {#editorial-image-sequence-movie}

Image sequence, encoded movie, generated source와 audio file을 구분하고 frame numbering, rate, start, expected count, gap, stream와 duration을 검증해야 한다. Movie seek와 sequence index가 같은 source time을 가리키는지 확인할 수 있어야 한다.

### Proxy와 Final {#editorial-proxy-final-conform}

Proxy와 final media는 source identity, range, frame count, timing, picture geometry와 audio channel 관계를 공유한다는 검증을 거쳐야 한다. Proxy review는 final media의 byte, color, compression artifact 또는 channel review를 대신하지 않는다.

### Relink {#editorial-media-relink}

Media location 변경은 expected digest와 source identity를 만족하는 declared replacement를 통해서만 relink해야 한다. Relink 전후 mapping과 affected clips를 기록하고, 같은 filename이나 가까운 duration을 근거로 자동 채택해서는 안 된다.

### Time와 Channel Conform {#editorial-time-channel-conform}

Source timebase를 film time으로 변환할 때 selected frame과 audio sample, start offset, reel-like origin과 channel mapping을 명시해야 한다. Rounding 또는 decode 차이가 clip 종료에서 누적되지 않아야 하며 실제 mapped range를 receipt에서 재확인할 수 있어야 한다.

### Partial Conform과 Recovery {#editorial-partial-conform-recovery}

Batch conform에서 유효한 clip의 mapping은 보존할 수 있지만 missing, stale 또는 unsupported reference가 포함된 timeline은 partial이어야 한다. Missing media가 복구되면 영향받는 clip만 다시 검증할 수 있어야 하며 unrelated successful mapping은 바꾸지 않아야 한다.

### Conform Publication {#editorial-conform-publication}

Conform 결과는 모든 required reference와 selected range를 검증한 뒤 하나의 revision에 대해 원자적으로 current가 되어야 한다. 실행 중 실패한 임시 결과나 이전 revision의 receipt를 현재 conform으로 노출해서는 안 된다.

### Conform Refusal {#editorial-conform-refusal}

Missing 또는 duplicate frame, rate mismatch, duration drift, wrong channel, stale digest, path escape, unsupported decode와 source closure 불일치는 거절해야 한다. Diagnostic은 clip, expected facts, observed facts와 recoverable 여부를 포함해야 한다.

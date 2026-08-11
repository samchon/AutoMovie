# Conform과 Media Reference

## Timeline과 실제 Media의 연결 {#editorial-conform-media-references}

Clip은 source production, shot 또는 external media, revision, digest, available range, channel와 decode facts를 참조하고 conform result를 추적해야 한다.

### Image Sequence와 Movie {#editorial-image-sequence-movie}

Image sequence, encoded movie, generated source, audio file와 missing reference를 구분하고 frame numbering, rate, start, gap와 file closure를 검증해야 한다.

### Proxy와 Final {#editorial-proxy-final-conform}

Proxy와 final media가 같은 source identity, range, frame count와 channel을 나타내는지 확인하고 proxy review를 final bytes review로 사용하지 않아야 한다.

### Relink {#editorial-media-relink}

Media path 변경은 digest, source identity와 declared replacement를 통해 relink하고 같은 filename의 다른 bytes를 자동 채택하지 않아야 한다.

### Conform Refusal {#editorial-conform-refusal}

Missing frame, duplicate frame, rate mismatch, duration drift, wrong channel, stale digest와 path escape를 거부해야 한다.

# 최종 Delivery 검증

## 실제 Published Bytes의 재검증 {#delivery-validation}

Delivery는 manifest, path, digest, container, stream, codec, duration, frame rate, dimensions, color, audio, caption, accessibility asset와 publication state를 actual bytes에서 확인해야 한다.

### Profile Conformance {#delivery-profile-conformance}

각 required field와 measured fact를 delivery profile의 target, range와 optional rule에 대조하고 planned setting을 actual result로 사용하지 않아야 한다.

### Audiovisual Review {#delivery-audiovisual-review}

Final decoded film에서 picture, motion, sound, caption, language, accessibility, sync, artifact와 ending state를 전체 재생 또는 declared review protocol로 검토해야 한다.

### Negative와 Corruption {#delivery-negative-corruption}

Truncated file, missing stream, wrong language, stale caption, digest mismatch, extra frame와 partial package를 각각 실패로 검증해야 한다.

### Final Status {#delivery-final-status}

Planned, encoded, probed, reviewed, published, failed, unsupported와 not-run을 구분하고 output path가 있다는 이유로 delivery complete를 주장하지 않아야 한다.

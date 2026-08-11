# 음향 검증과 Delivery

## Source에서 최종 Stream까지의 검증 {#sound-validation-delivery}

Audio는 decode, cue, timing, spatialization, room response, mix, loudness, channel, encode와 final media facts를 각 단계의 identity와 digest로 검증해야 한다.

### Numeric Verification {#sound-numeric-verification}

Sample count, duration, delay, gain, attenuation, loudness, peak, clipping와 channel order를 hand-computable fixture와 boundary case로 확인해야 한다.

### Audible Review {#sound-audible-review}

Dialogue intelligibility, event sync, ambience continuity, spatial relation, mix hierarchy, silence, transition와 artifact를 실제 decoded final audio에서 검토해야 한다.

### Final Media Probe {#sound-final-media-probe}

Container와 codec, sample rate, channel layout, duration와 stream presence를 published bytes에서 다시 읽고 planned path와 metadata만으로 delivery를 주장하지 않아야 한다.

### Evidence Status {#sound-evidence-status}

Planned, rendered, probed, reviewed, failed, unsupported와 not-run을 구분하고 test tone 또는 silent fallback을 완성된 soundtrack으로 보고하지 않아야 한다.

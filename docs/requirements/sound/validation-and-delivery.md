# 음향 검증과 Delivery

## Source에서 최종 Stream까지의 검증 {#sound-validation-delivery}

Audio는 decode, cue, timing, spatialization, room response, mix, loudness, channel, encode와 final media facts를 각 단계의 identity와 digest로 검증해야 한다.

### Evidence Identity와 Freshness {#sound-evidence-identity-freshness}

Evidence는 source bytes, cue graph, world와 edit revision, sample clock, processing chain, delivery profile, encoder와 final artifact digest에 묶여야 하며 어느 dependency가 바뀌면 이전 probe와 audible review를 current로 재사용하지 않아야 한다.

### Numeric Verification {#sound-numeric-verification}

Sample count, duration, delay, gain, attenuation, loudness, peak, clipping와 channel order를 hand-computable fixture와 boundary case로 확인해야 한다.

### Audio Budget Evidence {#sound-budget-evidence}

Source와 cue count, decoded·resident bytes, sample count, spatial path, processing operation, stem, encode와 output bytes의 per-interval과 full-film bound를 delivery tier별로 계산해야 한다. 계산하지 못한 비용은 within-budget이 아니라 incomplete 또는 not-run으로 보고하고 초과 source drop이나 품질 감소를 숨기지 않아야 한다.

### Audible Review {#sound-audible-review}

Dialogue intelligibility, event sync, ambience continuity, spatial relation, mix hierarchy, silence, transition와 artifact를 실제 decoded final audio에서 검토해야 한다.

### Seek와 Chunk Equivalence {#sound-seek-chunk-equivalence}

같은 film interval을 full sequential mix, arbitrary seek, repeated seek와 서로 다른 chunk boundary로 render하여 sample count, cue population, alignment와 decoded waveform digest가 declared determinism 범위에서 일치함을 검증해야 한다.

### Final Media Probe {#sound-final-media-probe}

Container와 codec, sample rate, channel layout, duration와 stream presence를 published bytes에서 다시 읽고 planned path와 metadata만으로 delivery를 주장하지 않아야 한다.

### Picture와 Delivery Join {#sound-picture-delivery-join}

Final media에서 audio와 picture stream의 start, duration, time base, required tail, caption·audio-description relation와 sync tolerance를 probe하고 video-only, stale proxy audio, truncated final sample와 undeclared fallback track을 거부해야 한다.

### Delivery Inventory {#sound-delivery-inventory}

Delivery profile이 master, stems, clean dialogue, alternate language, accessibility track, waveform 또는 review artifact를 요구하면 각 file의 role, channel, duration, digest와 master relation을 inventory로 검증해야 한다. Test tone, silence와 placeholder는 명시된 prototype 상태가 아니면 요구된 deliverable을 만족하지 않는다.

### Evidence Status {#sound-evidence-status}

Planned, rendered, probed, reviewed, failed, unsupported와 not-run을 구분하고 test tone 또는 silent fallback을 완성된 soundtrack으로 보고하지 않아야 한다.

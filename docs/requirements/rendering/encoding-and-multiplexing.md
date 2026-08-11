# Encoding과 Multiplexing

## Frame과 Audio를 전달 Media로 조립 {#rendering-encoding-multiplexing}

Image sequence, video stream, audio stream, caption 또는 subtitle과 metadata는 selected delivery profile의 container, codec, rate, channel, color와 duration contract에 따라 encode 및 multiplex되어야 한다. Encode plan과 actual output facts를 분리하고 published bytes에서 다시 확인해야 한다.

### Input Closure {#rendering-encode-input-closure}

Expected frame count와 numbering, dimensions, pixel format, alpha, color metadata, per-frame identity, audio sample count와 format, cue set, duration 및 모든 digest를 encode 전에 검증해야 한다. Missing 또는 stale input을 duplicate frame, silence나 empty cue로 채워서는 안 된다.

### Timestamp와 Sync {#rendering-encode-timestamps}

Video frame, audio sample, subtitle cue와 metadata event의 start, duration과 common presentation origin을 exact rational timestamp로 정해야 한다. Stream timebase 변환과 mux rounding이 누적 sync drift, negative start 또는 unintended tail을 만들지 않아야 한다.

### Codec와 Container Facts {#rendering-codec-container-facts}

Codec, profile-like setting, pixel 또는 sample format, bitrate나 quality mode, channel layout, color facts, metadata, encoder와 muxer identity 및 version을 receipt에 기록해야 한다. Human-readable filename이나 requested option을 actual media fact로 간주해서는 안 된다.

### Stream Selection {#rendering-encode-stream-selection}

각 video, audio와 text stream은 role, language, source artifact와 ordering을 가져야 한다. 요청된 optional stream을 지원하지 않아 제외한 경우 partial output임을 명시하고 required stream을 조용히 drop하거나 다른 language로 대체해서는 안 된다.

### Atomic Encode Output {#rendering-encode-atomic-output}

Encode는 temporary destination에서 완료되고 process success, nonzero size, stream probe, duration와 digest 검증 뒤 final destination에 원자적으로 publish되어야 한다. 이전 성공 file이 남아 있어도 현재 attempt 실패를 성공으로 보고해서는 안 된다.

### Retry와 Reproducibility {#rendering-encode-retry}

같은 lossless profile과 supported runtime에서 재실행한 결과의 reproducibility 범위를 선언해야 한다. Encoder가 nondeterministic metadata나 byte layout을 만들 수 있으면 semantic media facts와 content comparison 기준을 명시하고 byte equality를 허위로 약속해서는 안 된다.

### Encode Refusal {#rendering-encode-refusal}

Missing frame, numbering gap, duration drift, unsupported codec-container 조합, stale input, failed process, probe mismatch, zero-byte output와 required metadata 누락은 거절해야 한다. Independent encode variant는 유지할 수 있지만 실패 variant를 전체 delivery 성공으로 승격해서는 안 된다.

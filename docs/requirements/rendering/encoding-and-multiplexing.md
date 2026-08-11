# Encode와 Multiplex

## Frame와 Audio를 전달 Media로 조립 {#rendering-encoding-multiplexing}

Image sequence, video stream, audio stream, caption와 metadata를 delivery profile의 container, codec, rate, channel, color와 duration 계약에 따라 encode하고 multiplex할 수 있어야 한다.

### Input Closure {#rendering-encode-input-closure}

Expected frame count, numbering, dimensions, pixel format, color metadata, audio samples, caption와 duration을 encode 전에 검증해야 한다.

### Timestamp와 Sync {#rendering-encode-timestamps}

Video frame, audio sample, subtitle cue와 stream start·duration의 rational timestamps를 고정하고 mux rounding이 sync를 누적 이동시키지 않아야 한다.

### Codec와 Container Facts {#rendering-codec-container-facts}

Codec, profile, level-like supported setting, bitrate 또는 quality, channel, color, metadata와 tool version을 receipt에 기록해야 한다.

### Encode Refusal {#rendering-encode-refusal}

Missing frame, duration drift, unsupported codec, stale input, failed process와 zero-byte output을 final media로 publish하지 않아야 한다.

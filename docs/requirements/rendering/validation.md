# Render 검증

## Planned Output에서 Current Pixel까지 {#rendering-validation}

Render는 source identity, schedule, runtime, frame set, pass, pixel content, encode receipt와 published media facts를 단계별로 검증해야 한다.

### Nonblank와 Expected Content {#rendering-nonblank-expected-content}

Frame dimensions, alpha, pixel variance, required mask identity와 acceptance subject를 검사하여 blank, uniform, missing layer와 wrong camera output을 탐지해야 한다.

### Multi-time와 Multi-pass {#rendering-multitime-multipass}

Start, middle, end, semantic event와 transition boundary의 beauty와 relevant structural pass를 확인해야 한다.

### Byte와 Media Probe {#rendering-byte-media-probe}

Frame digest, count, container, streams, codec, duration, frame rate, dimensions, channel와 color facts를 실제 published bytes에서 다시 읽어야 한다.

### Visual Review {#rendering-visual-review}

Actual deployed viewer 또는 final media에서 composition, motion, lighting, material, effect, continuity와 artifact를 검토하고 numeric test로 대체했다고 주장하지 않아야 한다.

### Result Status {#rendering-validation-status}

Planned, rendering, materialized, probed, reviewed, failed, unsupported와 not-run을 구분하고 path 존재만으로 success를 보고하지 않아야 한다.

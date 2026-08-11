# Frame Rate, Timebase와 Timecode

## Film Time의 전달 표현 {#delivery-frame-rate-timebase-timecode}

Delivery는 exact rational picture rate, media timebase, timeline origin, frame numbering, audio sample rate, presentation start offset과 필요한 경우 timecode profile을 선언해야 한다. 서로 다른 시간 표현은 같은 film instant로 변환되는 관계를 가져야 한다.

### Rational Rate {#delivery-rational-frame-rate}

Integer와 fractional rate는 exact numerator와 denominator 또는 동등한 canonical representation으로 보존해야 한다. Decimal approximation이나 rounded display string을 frame count, duration 또는 identity 계산의 정본으로 사용해서는 안 된다.

### Constant와 Declared Variable Rate {#delivery-rate-mode}

Constant-frame-rate profile은 expected frame grid와 모든 output frame을 일치시켜야 한다. Variable-rate output을 지원하는 profile은 각 timestamp와 duration을 보존하고 constant rate인 것처럼 단일 fps 값만 보고해서는 안 된다.

### Timecode Profile {#delivery-timecode-profile}

Drop-frame-like 또는 non-drop convention, start value, nominal rate relation, day wrap, reel 또는 clip relation과 burn-in 여부를 profile에 명시해야 한다. Frame rate scalar만으로 timecode convention을 추정하거나 burn-in image를 machine-readable timecode로 간주해서는 안 된다.

### Stream Synchronization {#delivery-stream-synchronization}

Video frame, audio sample, caption cue, chapter와 metadata timestamp는 공통 presentation origin과 duration relation을 가져야 한다. Timebase rounding은 exact conversion에서 파생되고 film 끝까지 누적 drift가 허용 범위를 넘지 않아야 한다.

### Edit와 Media Origin {#delivery-edit-media-origin}

Edit timeline zero, media presentation start와 displayed timecode start를 구분해야 한다. Head leader-like offset, negative source time 또는 nonzero start를 지원하면 trimming, playback와 caption mapping에서 어느 origin을 사용하는지 고정해야 한다.

### Boundary와 Count {#delivery-time-boundary-count}

첫 frame, end-exclusive film range, last presented frame, audio tail과 final cue boundary를 exact count와 timestamp로 검증해야 한다. Extra repeated frame, missing final frame와 unintended silence를 단순 duration tolerance에 숨겨서는 안 된다.

### Time Refusal {#delivery-time-refusal}

Invalid rate, ambiguous timecode convention, unrepresentable mapping, frame count mismatch, timestamp reversal, overflow와 stream drift는 거절해야 한다. Valid stream 일부가 있어도 sync closure가 실패하면 synchronized delivery로 표시해서는 안 된다.

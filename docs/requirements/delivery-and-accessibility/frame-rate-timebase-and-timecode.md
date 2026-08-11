# Frame Rate, Timebase와 Timecode

## Film Time의 전달 표현 {#delivery-frame-rate-timebase-timecode}

Delivery는 rational frame rate, timeline origin, frame numbering, audio timebase, start offset와 필요한 경우 timecode representation을 선언할 수 있어야 한다.

### Rational Rate {#delivery-rational-frame-rate}

Integer와 fractional rate를 exact numerator·denominator 또는 동등한 표현으로 보존하고 decimal approximation을 frame count의 정본으로 사용하지 않아야 한다.

### Timecode Profile {#delivery-timecode-profile}

Drop-frame-like convention, start value, day wrap, reel 또는 clip relation과 burn-in 여부는 delivery profile이 요구할 때 명시하고 fps scalar만으로 timecode를 추정하지 않아야 한다.

### Stream Synchronization {#delivery-stream-synchronization}

Video frame, audio sample, caption cue와 metadata timestamp가 같은 presentation origin과 duration을 가져야 한다.

### Time Refusal {#delivery-time-refusal}

Invalid rate, unrepresentable mapping, frame count mismatch, ambiguous timecode convention와 stream drift를 거부해야 한다.

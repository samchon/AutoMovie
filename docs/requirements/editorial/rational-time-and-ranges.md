# Rational Time과 Range

## 손실 없는 Timeline Time {#editorial-rational-time-ranges}

Time은 value와 rate 또는 동등한 rational basis로 표현하고 frame rate, audio sample rate와 source-specific timebase 사이 변환을 명시해야 한다.

### Time Range {#editorial-time-ranges}

Start, duration, end-exclusive 또는 declared boundary convention을 고정하고 zero duration, gap, overlap와 hold를 구분해야 한다.

### Time Transform {#editorial-time-transforms}

Trim, offset, scale, reverse와 nested composition의 source-to-film transform을 합성하고 반복 rounding으로 drift하지 않아야 한다.

### Frame Grid {#editorial-frame-grid}

Published frame rate와 render grid를 선언하고 event와 clip boundary가 frame 사이에 있을 때 inclusion과 sampling rule을 명시해야 한다.

### Time Refusal {#editorial-time-refusal}

Non-finite rate, negative duration, overflow, incompatible timebase, ambiguous boundary와 representable range 밖 time을 거부해야 한다.

# Rational Time과 Range

## 오차 없는 Timeline Time {#editorial-rational-time-ranges}

Film time은 정확한 유리수 값과 rate 또는 동등한 정규 표현으로 보존되어야 한다. Frame rate, audio sample rate, source tick과 film timebase가 다를 때 어느 기준의 값인지 항상 식별할 수 있어야 하며 부동소수점 근삿값을 정본으로 사용해서는 안 된다.

### Canonical Time {#editorial-canonical-time}

수학적으로 같은 time과 rate는 비교, 정렬, identity 계산에서 같은 값으로 취급되어야 한다. 분모 부호, 약분, zero 표현과 단위 변환 규칙은 고정되어야 하며 입력 순서나 locale이 결과를 바꾸어서는 안 된다.

### Time Range {#editorial-time-ranges}

모든 range는 start와 duration을 갖고 start-inclusive, end-exclusive 경계를 사용해야 한다. Zero-duration marker, positive-duration clip, intentional gap, hold와 overlap을 구분하고 맞닿은 range를 중복 frame이나 누락으로 해석해서는 안 된다.

### Time Transform {#editorial-time-transforms}

Trim, offset, scale, reverse와 nested composition은 source time에서 film time으로 가는 ordered transform으로 합성되어야 한다. 왕복 가능한 경우 변환의 역관계를 제공하고, 역변환이 하나로 정해지지 않는 hold나 반복 구간은 그 모호성을 명시해야 한다.

### Frame Grid {#editorial-frame-grid}

Published frame rate는 frame numbering, sample instant와 clip boundary 포함 규칙을 결정해야 한다. Event나 edit point가 frame 사이에 있으면 이전, 다음 또는 보간 sample 중 어떤 결과가 관객에게 보이는지 선언해야 한다.

### Audio와 Mixed Timebase {#editorial-mixed-timebases}

Audio sample boundary, caption cue와 picture frame boundary를 변환할 때 rounding 방향과 누적 오차 처리 규칙을 명시해야 한다. 긴 timeline에서도 각각의 변환을 독립적으로 반올림하여 sync drift를 누적해서는 안 된다.

### Range 연산과 경계 {#editorial-range-operations}

Intersection, union, clamp, split과 duration 합계는 동일한 경계 규칙을 따라야 한다. 서로 다른 timebase를 결합할 수 없거나 정확한 공통 표현이 허용 범위를 넘으면 근사 결과 대신 실패 원인과 영향을 받는 range를 보고해야 한다.

### Time Refusal {#editorial-time-refusal}

Zero 또는 non-finite rate, negative duration, 범위 overflow, ambiguous boundary, 허용되지 않은 reverse, 표현 불가능한 frame count와 incompatible clock은 거절해야 한다. 유효한 구간이 일부 있더라도 invalid 구간을 잘라 성공으로 만들지 말고 partial 결과와 제외된 범위를 분리해 보고해야 한다.

# Target, Focus, Exposure와 Sampling {#target-focus-exposure-sampling-specification}

## Target와 Focus State {#clv-target-focus-state}

### Focus Intent와 Appearance 경계 {#clv-focus-intent-appearance-boundary}

<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-focus-depth Camera가 주의를 두는 target의 identity와 용도를 정규화한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-sampling Target과 performance를 같은 film-time sample에서 resolve한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-loss-policy Target loss에 대한 project-owned 결과를 상태 전이로 정의한다. -->

Target state는 actor landmark, object surface, group extent, spatial mark, event 또는 authored world point의 stable identity, framing·orientation·focus 용도, valid interval, resolver와 source revision을 가진다. Moving target은 camera, performance, formation, object와 scene geometry가 읽는 같은 rational film sample에서 world position과 validity를 resolve한다.

Target이 occluded, detached, destroyed, merged 또는 frame 밖으로 나가는 interval은 `hold`, `transfer`, `world-point`, `continue-authored-motion` 또는 `refuse` 중 선언된 transition을 수행한다. 마지막 valid position을 숨은 cache로 계속 쓰는 상태는 허용하지 않는다.

<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Focus target과 distance를 optical metadata로 보존한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-pulls Focus pull의 event anchor, interpolation과 error를 정밀화한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-visibility Focus metadata와 관객 visibility 판정을 분리한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-depth-of-field-boundary Depth-of-field appearance를 지원 rendition의 별도 claim으로 제한한다. -->

Focus intent는 target identity 또는 metric distance, 시작·종료 event, interval, interpolation, 허용 error와 review samples를 가진다. Focus distance는 camera optical axis의 declared convention에서 계산하고 target·camera motion과 같은 sample에서 재평가한다.

Focus target의 존재나 distance 일치는 projected visibility, occlusion, contrast 또는 readability를 증명하지 않는다. Depth-of-field blur, bokeh, breathing와 rack-focus appearance는 해당 model과 rendition profile이 지원되고 current pixels가 검토됐을 때만 `rendered` 상태가 되며 그 전에는 `declared-only`, `unsupported` 또는 `not-run`이다.

### Focus Diagnostic와 Refusal {#clv-focus-diagnostics-refusal}

<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-depth-claim-validation Depth appearance claim이 profile, metadata, samples와 pixels를 식별하게 한다. -->
<!-- @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Missing target와 impossible tracking의 failure를 정밀화한다. -->

Focus diagnostic은 take, target, camera state, sample, requested appearance, support status, measured distance 또는 error와 affected delivery를 식별한다. Missing identity, detached landmark, zero look direction, non-finite distance, impossible tracking rate와 required interval의 unhandled target loss는 `failed`다.

## Rational Frame Clock {#clv-rational-frame-clock}

### Frame와 Shutter Sample Set {#clv-frame-shutter-sample-set}

<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-shutter-exposure-sampling Camera의 frame time, shutter와 exposure metadata를 하나의 clock context로 정규화한다. -->
<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-rational-timebase Frame rate, origin과 index mapping을 exact rational relation으로 만든다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-timebase-interval Event interval과 camera sample이 같은 endpoint rule을 읽게 한다. -->

Film clock은 정수 numerator와 denominator로 된 frame rate, time origin, first frame index, valid index range, frame interval의 시작·끝 포함 규칙과 exact timestamp mapping을 가진다. Frame identity는 decimal 누적이 아니라 정수 index와 rational expression으로 계산하며 camera, light, motion, effect와 event가 같은 origin을 사용한다.

<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-frame-sampling Frame start, center, end와 component sampling 기준을 고정한다. -->
<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-shutter-interval-sampling Shutter open·close, ordered samples와 weights를 재현 가능하게 만든다. -->
<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-motion-blur-boundary Sample metadata와 실제 motion-blur 결과를 구분한다. -->

각 frame은 declared sample instant와 선택적 shutter interval을 가진다. Shutter set은 open·close rational offset, sample count, ordered positions, weights, boundary inclusion, global 또는 supported scan policy와 edge-clamping policy를 포함하고 모든 component를 같은 ordered sample에서 평가한다.

다중 sample이 지원되지 않으면 단일 declared instant만 사용하고 hidden subframe을 만들지 않는다. Shutter metadata가 있더라도 supported integration 결과가 없으면 motion blur 상태는 `unsupported` 또는 `not-run`이며 blur가 생성됐다고 보고하지 않는다.

## Exposure Ownership {#clv-exposure-ownership}

### Determinism과 Sampling Refusal {#clv-sampling-determinism-refusal}

<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-exposure-lighting-distinction Camera exposure가 scene light intensity를 변경하지 않게 한다. -->
<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-exposure-basis Brightness에 참여하는 exposure basis, unit과 precedence를 명시한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-camera-exposure Lighting state와 camera presentation state 사이의 경계를 공유한다. -->

Exposure state는 camera 또는 shot presentation identity, compensation 또는 artistic gain, 지원되는 aperture·shutter·sensitivity-like metadata, 실제 brightness 계산에 참여하는 subset, unit, valid range와 적용 순서를 가진다. Scene light, material emission, camera exposure, display transform과 grade는 별도 provenance를 유지한다.

한 output에는 정확히 하나의 effective exposure owner가 있고 inherited default와 shot override의 선택 근거를 receipt에 기록한다. Exposure 변경은 source light analysis를 통과시키거나 잘못된 lighting design을 수정한 것으로 간주하지 않는다.

<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-temporal-reproducibility 같은 source와 clock이 playback history와 무관한 결과를 내게 한다. -->
<!-- @evidence requirements/camera/shutter-exposure-and-sampling.md#camera-sampling-refusal Invalid clock, shutter와 exposure를 명시적으로 거부한다. -->

같은 source closure, camera take, rational clock, frame index, shutter policy, exposure state와 seed는 traversal direction, dropped preview frame, chunking, retry와 이전 playback history에 관계없이 같은 ordered camera·light state와 exposure metadata를 만든다.

Zero 또는 negative denominator, invalid frame range, component마다 다른 origin, negative shutter span, unordered sample, non-finite exposure와 declared range 밖의 sample은 `failed`다. Exact rational time을 consumer numeric domain으로 변환할 때 rounding mode와 허용 오차를 기록하며 변환 전 identity를 잃지 않는다.

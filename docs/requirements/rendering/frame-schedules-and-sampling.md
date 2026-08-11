# Frame Schedule과 Sampling

## Rational Timeline에서 생성되는 Frame Grid {#rendering-frame-schedule-sampling}

Frame schedule은 selected film range, exact rational frame rate, time origin, first frame convention, sample instant, frame count, output numbering과 requested passes를 명시해야 한다. 같은 schedule identity는 실행 순서와 관계없이 같은 ordered work set을 만들어야 한다.

### Boundary Convention {#rendering-frame-boundary-convention}

Film range는 start-inclusive, end-exclusive로 해석하고 final frame policy를 하나로 고정해야 한다. Duration에 frame rate를 곱한 부동소수점 rounding으로 frame count를 정하지 말고 exact arithmetic으로 boundary sample의 포함 여부를 판정해야 한다.

### Frame Number와 Time Mapping {#rendering-frame-number-time}

각 output frame number는 정확히 하나의 film sample time과 양방향으로 연결되어야 한다. Start number가 zero가 아니거나 time origin이 offset이어도 duplicate, gap과 off-by-one 없이 mapping을 설명할 수 있어야 한다.

### State Sampling {#rendering-state-sampling}

Actor, rig, motion, camera, light, material, effect, visibility, environment와 presentation event는 각 frame의 declared sample time에서 함께 resolve되어야 한다. Component마다 현재 wall clock이나 서로 다른 implicit clock을 사용해서는 안 된다.

### Shutter Sample {#rendering-shutter-samples}

여러 temporal sample을 지원하면 shutter interval, sample positions, weights, camera와 scene evaluation rule 및 edge clamping을 schedule에 포함해야 한다. 단일 sample만 지원하는 경우 motion blur가 생성되었다고 주장하거나 hidden subframe을 사용해서는 안 된다.

### Audio와 Cue Relation {#rendering-schedule-audio-cues}

Frame schedule은 audio sample과 caption cue 자체를 frame grid에 양자화하지 않더라도 공통 presentation origin과 duration relation을 제공해야 한다. Frame chunking이 audio 또는 cue boundary를 이동시키거나 중복시키면 안 된다.

### Subrange와 Chunk Stability {#rendering-subrange-stability}

전체 range를 한 번에 render한 frame과 동일 schedule의 subrange 또는 retry에서 render한 frame은 같은 identity와 결과를 가져야 한다. Chunk마다 local frame zero나 warm-up state를 사용하여 경계 frame을 바꾸어서는 안 된다.

### Schedule Refusal {#rendering-schedule-refusal}

Invalid rate, negative 또는 empty required range, overflow, unrepresentable frame count, duplicate output number, ambiguous origin과 component clock mismatch는 거절해야 한다. 유효 prefix가 있으면 partial plan으로 보고할 수 있지만 완전한 schedule로 실행해서는 안 된다.

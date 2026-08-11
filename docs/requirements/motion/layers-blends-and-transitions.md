# 동작 Layer와 Transition

## 여러 동작의 명시적 Composition {#motion-layers-blends-transitions}

Base locomotion, upper-body action, gaze, expression, hand pose, additive correction와 object driver를 target mask, weight, time range와 precedence로 조합할 수 있어야 한다.

### Channel Ownership {#motion-layer-channel-ownership}

각 control은 한 시점에 어느 layer가 absolute 또는 additive authority를 갖는지 알 수 있어야 하며 두 absolute layer를 순서 없이 섞지 않아야 한다.

### Mask와 Weight 의미 {#motion-layer-mask-weight}

Layer mask는 stable control identity를 선택하고 weight의 range, normalization, per-channel scaling와 zero 또는 missing 의미를 선언해야 하며 skeleton array order나 현재 존재하는 channel 수에 따라 대상이 바뀌지 않아야 한다.

### Transition Window {#motion-transition-window}

Enter, exit, crossfade, inertial 또는 authored transition의 duration, easing, source와 target state를 선언하고 cue boundary에서 pose가 snap하지 않아야 한다.

### Phase Alignment {#motion-phase-alignment}

Gait, cycle, contact와 repeated motion을 blend할 때 support phase와 event를 보존하고 평균 pose가 양쪽 contact를 모두 깨뜨리지 않아야 한다.

### Event와 State Composition {#motion-layer-event-composition}

Layer가 marker, semantic event 또는 end state를 포함할 때 suppress, remap, merge와 exclusive precedence를 선언하여 crossfade가 impact, release와 state transition을 중복하거나 잃지 않게 해야 한다.

### Blend Refusal {#motion-blend-refusal}

Incompatible skeleton, missing channel, invalid weight, overlapping exclusive layer, event duplication와 state discontinuity를 탐지해야 한다.

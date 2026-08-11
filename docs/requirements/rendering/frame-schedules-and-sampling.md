# Frame Schedule과 Sampling

## Rational Timeline에서 파생되는 Frame Grid {#rendering-frame-schedule-sampling}

Frame schedule은 film range, rational frame rate, first frame convention, sample time, frame count와 output numbering을 명시해야 한다.

### Boundary Convention {#rendering-frame-boundary-convention}

Start-inclusive, end-exclusive와 final frame policy를 고정하고 duration 곱셈의 floating rounding으로 frame count가 달라지지 않아야 한다.

### State Sampling {#rendering-state-sampling}

Actor, motion, camera, light, effect, sound event와 environment를 한 frame의 같은 declared sample time에서 resolve해야 한다.

### Shutter Sample {#rendering-shutter-samples}

여러 temporal sample을 지원하는 경우 shutter interval, sample positions, weights와 composition을 선언하고 unsupported blur를 생성했다고 주장하지 않아야 한다.

### Schedule Refusal {#rendering-schedule-refusal}

Invalid rate, negative range, unrepresentable frame count, duplicate output number와 component clock mismatch를 거부해야 한다.

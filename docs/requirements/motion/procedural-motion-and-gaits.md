# 절차 동작과 Gait

## 저작 가능한 Compact Motion Rule {#motion-procedural-gaits}

Walk, run, march, idle, sway, wheel rotation, machine cycle와 repeated gesture를 소수의 의미 parameter와 fixed phase rule로 생성할 수 있어야 한다.

### Rule 선택과 소유권 {#motion-procedural-rule-selection}

사용자와 저작 에이전트는 subject, story action과 shot에 적용할 procedural rule, parameter, gait table와 correction policy를 선택하고, 이름에서 style을 추측하거나 renderer가 realism variation을 몰래 추가하지 않게 해야 한다.

### Gait Table {#motion-gait-table}

Stride, cadence, support phase, foot clearance, pelvis와 arm relation, speed range와 transition을 declared gait table로 소유하고 hidden heuristic에서 만들지 않아야 한다.

### 일반 Procedural Control {#motion-general-procedural-control}

Project-defined repeated object motion과 driver는 input channel, phase, bounded function, output control, unit와 event를 선언하여 humanoid gait와 같은 deterministic sampling, ownership과 validation을 받아야 한다.

### Variation과 Seed {#motion-procedural-variation}

Phase, amplitude, timing와 style variation은 bounded seed와 subject identity로 재현되어야 하며 관련 없는 population 변경으로 다시 섞이지 않아야 한다.

### Terrain Adaptation {#motion-terrain-adaptation}

Ground height, normal, slope와 step을 sample하여 foot와 root를 조정할 수 있으나 supported bound 밖 terrain을 계속 걸을 수 있다고 주장하지 않아야 한다.

### Procedural Bound {#motion-procedural-bound}

Sample count, search range, speed, slope, turn, correction와 subject population의 최대값을 선언하고 초과를 무한 iteration이나 silent clamp로 숨기지 않아야 한다.

# Damage와 Destruction 경계

## State로 저작되는 Damage {#effects-damage-destruction-boundary}

Scratch, dent, crack, break, detached part, collapsed state와 debris proxy를 base asset identity, event, phase와 replacement geometry 또는 material state로 저작할 수 있어야 한다.

### Trait와 Result 구분 {#effects-damage-trait-result}

Breakable, combustible, fragile와 같은 trait 선언은 실제 fracture, fire spread와 structural collapse result가 아니며 solver나 authored state가 없으면 capability로 주장하지 않아야 한다.

### Authored Destruction State {#effects-authored-destruction-state}

사용자가 intact, damaged와 destroyed variant, transition event, debris group와 clearance consequence를 직접 제공하고 deterministic state change로 사용할 수 있어야 한다.

### Solver Ceiling {#effects-destruction-solver-ceiling}

Production-grade fracture, arbitrary topology split, structural progressive collapse와 material failure는 authoring path, bounded solver와 verification이 함께 존재하기 전까지 unsupported로 표시해야 한다.

### Continuity {#effects-damage-continuity}

Damage는 story time에 누적되고 repair 또는 alternative가 없는 한 shot과 scene 사이에 사라지지 않아야 한다.

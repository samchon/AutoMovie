# Clipping, Occlusion과 공간 제약

## Camera와 Scene Geometry의 실제 관계 {#camera-clipping-occlusion-spatial}

Near·far clipping range, optional clipping plane, camera body clearance, wall·terrain intersection와 subject occlusion을 resolved scene에서 검토할 수 있어야 한다.

### Clipping Range {#camera-clipping-range}

Near와 far는 positive ordered distance를 가지고 required subject, environment와 depth precision 범위에 맞아야 한다.

### Camera Clearance {#camera-clearance}

Interior wall, ceiling, floor, furniture, terrain, vehicle와 moving subject에 대한 camera position과 path clearance를 선언할 수 있어야 한다.

### Occlusion Metric {#camera-occlusion-metric}

Required landmark, surface sample 또는 screen coverage를 통해 visibility를 측정하고 center point 하나가 보인다는 이유로 subject 전체가 readable하다고 간주하지 않아야 한다.

### Intended Obstruction {#camera-intended-obstruction}

Foreground frame, over-shoulder, concealment, wipe와 reveal을 intentional obstruction으로 명시하여 accidental occlusion과 구분해야 한다.

# 연성 재료, 식물과 변형

## 공간에 반응하는 Soft Element {#interior-soft-materials-plants}

Curtain, blind, drape, upholstery, rug, bedding, cable, hanging element, indoor plant와 project-defined deformable object를 anchor, rest shape, material, state와 bounded motion으로 표현할 수 있어야 한다.

### Anchor와 Host {#interior-soft-anchor-host}

Soft element는 wall, ceiling, floor, furniture, rail, actor 또는 다른 object의 named anchor에 연결되고 host가 움직일 때 같은 fixed clock에서 target을 읽어야 한다.

### Collision과 Clearance {#interior-soft-collision-clearance}

Floor, wall, furniture, actor와 opening의 supported collision proxy를 사용하고 curtain이 벽을 통과하거나 moving door sweep을 무시하는 상태를 검토할 수 있어야 한다.

### 식물 배치와 상태 {#interior-plant-placement-state}

Indoor planting은 pot, soil 또는 substrate, root extent, light, water, growth, health와 maintenance state를 가질 수 있으나 생태 simulation을 수행하지 않았다면 decorative authored population으로 구분해야 한다.

### Bounded Simulation {#interior-soft-simulation-bound}

Particle, constraint, collider, step와 sample count의 최대값을 선언하고 budget을 넘는 solve를 거부해야 하며 per-frame hand-authored fallback으로 성공을 가장하지 않아야 한다.

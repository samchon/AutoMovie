# 물과 유체 요소

## Interior에 놓인 Bounded Fluid {#interior-water-fluid-features}

Sink, bath, pool, tank, fountain, channel, aquarium, water wall, waterfall, spill와 project-defined liquid volume을 container, boundary, free surface, source, sink와 state로 표현할 수 있어야 한다.

### 수량과 Level {#interior-fluid-volume-level}

Container geometry, liquid depth, volume, fill level, inflow, outflow와 overflow를 실제 단위로 연결하고 화면용 surface plane만으로 수량을 대신하지 않아야 한다.

### 흐름과 Spray {#interior-fluid-flow-spray}

Standing, flowing, pouring, falling, spraying, draining, leaking와 agitated state를 film이 요구하는 bounded model로 표현하고 수행하지 않은 fluid simulation을 주장하지 않아야 한다.

### 물과 Material 상호작용 {#interior-fluid-material-interaction}

Wetness, reflection, refraction, absorption, stain, splash와 damage를 supported material state와 시간에 연결할 수 있어야 한다.

### Fluid 거부 {#interior-fluid-refusal}

Container 밖 초기 volume, 음수 depth, mass balance 위반, source 없는 증가, drain 없는 영구 유출과 unsupported simulation 범위를 명시적으로 보고해야 한다.

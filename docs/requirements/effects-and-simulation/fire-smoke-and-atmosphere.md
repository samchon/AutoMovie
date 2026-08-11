# Fire, Smoke와 Atmosphere

## 사건과 공간에 놓인 Volumetric-like State {#effects-fire-smoke-atmosphere}

Flame proxy, smoke, steam, fog, cloud, dust plume와 heat-like visual distortion을 source, region, density 또는 authored opacity, direction, light relation와 time state로 표현할 수 있어야 한다.

### Source와 Fuel State {#effects-fire-source-state}

Ignition, burning, growth, decay와 extinguish를 object, material, fuel-like authored parameter와 semantic event에 연결하고 source 없이 영구적으로 증가하지 않아야 한다.

### Lifecycle와 Seek {#effects-fire-lifecycle-seek}

Ignition 이전, active burn, extinguish와 residual smoke state를 같은 fixed clock에서 재구성하고 arbitrary seek가 flame, emission light, smoke와 source state를 서로 다른 phase에 남기지 않아야 한다.

### Wind와 Boundary {#effects-smoke-wind-boundary}

Map 또는 interior wind, opening, ceiling, obstacle와 authored flow direction을 bounded domain에서 사용할 수 있으나 full computational fluid dynamics를 수행했다고 주장하지 않아야 한다.

### Atmospheric Composition {#effects-atmosphere-composition}

Fog, cloud, smoke, steam와 dust가 겹칠 때 density-like channel, blend order, occlusion contribution와 combined budget을 선언하고 독립 layer의 합을 임의의 physical concentration으로 해석하지 않아야 한다.

### Light와 Visibility {#effects-fire-light-visibility}

Fire emission, smoke attenuation, shadow-like effect와 camera visibility를 같은 effect state에 연결하고 beauty-only haze를 physical density로 되돌려 쓰지 않아야 한다.

### Safety와 Claim 경계 {#effects-fire-claim-boundary}

Visual fire·smoke와 fire spread, toxicity, evacuation, structural damage 분석을 구분하고 전문 결과를 수행하지 않았다면 unsupported로 표시해야 한다.

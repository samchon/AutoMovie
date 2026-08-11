# 날씨, 배수와 시간 상태

## 외부 환경에 놓인 건물 {#building-weather-drainage-state}

Rain, snow, ice, sunlight, wind, dust, temperature와 pollution이 facade, roof, exterior space, opening, service, water와 material state에 미치는 bounded authored 또는 simulated consequence를 map environment와 film time에 연결할 수 있어야 한다.

### 물의 경로 {#building-rainwater-path}

Roof, balcony, terrace, courtyard와 facade의 catchment, slope, low point, gutter, drain, scupper, downpipe, overflow와 discharge가 연속된 route와 port identity로 map water, ground discharge 또는 service network에 연결되어야 한다. Exterior-only set는 out-of-scope discharge edge를 명시해야 한다.

### Weathering {#building-exterior-weathering}

Discoloration, efflorescence, rust, patina, streak, erosion, crack, wear, dirt와 repair를 exposure direction, water path, contact, material, elapsed time, event 또는 phase에 연결하고 source 없는 random aging을 자동 적용하지 않아야 한다.

### 표면 변화와 손상 {#building-exterior-surface-damage}

Color·roughness 변화, wetness와 coating loss를 deformation, breach, detached part, failed joint와 같은 geometry, envelope 또는 structural damage에서 구분하고 texture 변화만으로 opening·leak·collapse를 구현했다고 주장하지 않아야 한다.

### Film continuity {#building-exterior-state-continuity}

Weather, wetness, snow, ice, opening, light, equipment, damage, temporary protection와 repair state가 story time과 shot 사이에서 추적되고 같은 building, map location와 time의 상태가 임의로 바뀌지 않아야 한다.

### Drainage 검증 수준 {#building-drainage-validation-level}

Geometric fall과 connectivity, bounded flow·capacity check, hydrologic simulation와 professional design review를 구분하고 실제로 수행한 수준, input, unit, time range와 unsupported 범위를 표시해야 한다. 물이 화면에서 사라지는 것을 배수 성공으로 간주하지 않아야 한다.

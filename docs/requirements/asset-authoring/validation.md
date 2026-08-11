# 자산 검증

## 사용 전 자산 검증 {#asset-validation}

자산은 scene에 배치되기 전에 구조, scale, topology, material, rig, state, resource bound와 provenance가 선언된 용도에 맞는지 검증할 수 있어야 한다.

### 형상 검증 {#asset-geometry-validation}

Degenerate surface, non-finite coordinate, inverted orientation, invalid solid, unintended self-intersection과 missing region을 탐지해야 한다.

### 동작 가능성 검증 {#asset-rig-validation}

Joint hierarchy, range, dependency, skin binding, morph target와 named state가 서로 일관되고 motion consumer가 요구하는 control을 제공하는지 확인해야 한다.

### 표면 검증 {#asset-surface-validation}

Material assignment, texture coordinate, channel, color space, pattern boundary와 physical thickness가 누락되거나 충돌하는지 확인해야 한다.

### 목적별 적합성 {#asset-purpose-validation}

같은 asset이라도 collision, close-up, crowd proxy, shadow, reflection, drawing과 repaint guide에 필요한 정보가 다를 수 있으므로 사용 목적별 충족 여부를 구분해야 한다.

### 검증 gap의 보존 {#asset-validation-gap}

검증하지 못한 특성은 성공으로 간주하지 않고 unknown 또는 unsupported 상태로 남겨야 한다.

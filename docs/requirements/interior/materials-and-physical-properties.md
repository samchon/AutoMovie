# 재료와 물리 속성

## 열린 Interior 재료 범위 {#interior-material-properties}

Wood, stone, ceramic, plaster, concrete, metal, glass, fabric, paper, resin, paint, composite와 project-defined material을 닫힌 catalogue 없이 구성할 수 있어야 한다.

Material identity, constituent 또는 composite, ordered surface assembly, visible render material과 product information을 구분해야 한다. 같은 substance가 coating, polish, cut, orientation와 state에 따라 다른 surface로 보이거나 비슷한 appearance가 다른 build-up에서 나오는 관계를 표현할 수 있어야 한다.

### 시각 속성과 물리 속성 {#interior-material-visual-physical}

Color, roughness, gloss, reflection, transmission, refraction, emission와 relief를 density, thickness, hardness, friction, porosity, absorption와 같은 supported physical property에서 구분해야 한다.

### 단위와 측정 근거 {#interior-material-units-sources}

실제 property를 사용하는 경우 unit, source, temperature나 moisture 같은 condition과 approximation 범위를 기록하고 색상 이름에서 물성을 추정하지 않아야 한다.

방향과 위치에 따라 달라지는 property는 material-local axis, frequency 또는 wavelength range, thickness와 spatial field를 가질 수 있어야 한다. 필요한 방향이나 condition이 없으면 isotropic 또는 nominal value로 묵시 대체하지 않고 사용한 fallback과 신뢰도 저하를 밝혀야 한다.

### 상태와 열화 {#interior-material-state-aging}

Wet, dirty, worn, scratched, stained, burned, corroded, broken와 repaired state를 base material identity와 phase 또는 film time에 연결할 수 있어야 한다.

State는 appearance뿐 아니라 supported friction, absorption, transmission, stiffness와 다른 physical property 변화도 가질 수 있으나 visual rust, crack 또는 dirt만으로 실제 성능 저하를 확정하지 않아야 한다.

### Unsupported 분석 {#interior-material-analysis-boundary}

Material 속성을 선언했다고 해서 구조, 화재, 독성, 열, 음향과 법규 성능을 모두 검증한 것으로 주장하지 않으며 수행한 analysis만 결과로 표시해야 한다.

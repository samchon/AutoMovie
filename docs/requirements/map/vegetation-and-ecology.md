# 식생과 생태

## 식생 population과 서식 환경 {#map-vegetation-ecology}

나무, 관목, 초지, 작물, 수생 식물, 숲과 생태 군집을 species 또는 authored archetype, age, size, density, health와 공간 분포로 구성할 수 있어야 한다.

### 식생 층과 형상 {#map-vegetation-layers-form}

Canopy, understory, shrub, ground cover, crop row와 aquatic layer를 높이 범위, footprint, density, seasonal form과 root 또는 anchoring zone이 필요한 경우의 관계로 표현할 수 있어야 한다. Camera와 actor는 같은 canopy·trunk·ground extent를 가시성, 충돌과 이동 판단에 사용해야 한다.

### 개체와 군집 {#map-vegetation-individual-cluster}

주요 나무와 story-relevant 식생은 개별 identity를, 대규모 숲과 초지는 bounded population rule을 가질 수 있어야 하며 둘을 함께 검토할 수 있어야 한다.

### 지형과 수계 관계 {#map-vegetation-terrain-water}

식생은 elevation, slope, soil, moisture, shoreline, land use와 disturbance zone에 연결되어야 하며 unsupported surface에 임의로 뿌리지 않는다.

### 서식지와 생태 관계 {#map-habitat-ecological-relations}

Habitat, corridor, patch, edge, succession과 project-defined community를 공간 identity로 선언하고 필요한 species 또는 archetype population과 관계를 맺을 수 있어야 한다. 관계의 source, confidence와 적용 scale을 추적하고 시각적 배치 규칙을 검증된 생태 관계로 바꾸어 말하지 않아야 한다.

### 계절과 생장 상태 {#map-vegetation-season-growth}

잎, 꽃, 열매, 낙엽, 적설, 고사, 화재와 훼손 상태를 film time 또는 authored phase에 따라 재현할 수 있어야 한다.

### 교란과 회복 {#map-vegetation-disturbance-recovery}

Fire, flood, windthrow, logging, grazing, cultivation, trampling, battle와 construction이 개체와 군집에 남기는 removal, damage, debris, regrowth와 restoration을 phase와 event provenance로 표현할 수 있어야 한다.

### 생태 gap {#map-ecology-gap}

생태 정확성을 검증하지 않은 population은 시각적 authored population으로 구분하고 실제 생태 simulation 결과로 주장하지 않는다.

# 지형과 지물

## 제한되지 않은 지형 형상 {#map-terrain-landforms}

평지, 언덕, 산지, 계곡, 고원, 분지, 절벽, 협곡, 사구, 화산, crater와 인공 성토·절토를 실제 높이와 경계를 가진 지형으로 표현할 수 있어야 한다.

### 고도와 경사 {#map-elevation-slope}

지표의 elevation, slope, aspect, ridge, drainage divide와 breakline을 보존하여 배치, 이동, 물 흐름, 시야와 건설 가능한 영역을 설명할 수 있어야 한다.

### 표면과 체적 표현 {#map-terrain-surface-volume}

Regular height surface가 충분한 영역과 overhang, vertical face, void, excavation 또는 subsurface volume이 필요한 영역을 구분하고 한 맵에서 함께 사용할 수 있어야 한다. Source sample, contour, breakline, authored form과 resolved surface의 관계와 유효 해상도를 사용자가 확인할 수 있어야 한다.

### 지형 변형 {#map-terrain-modification}

Trench, embankment, terrace, quarry, tunnel portal, crater, fortification과 공사 단계는 원래 지형과 변경된 지형을 구분하여 표현할 수 있어야 한다.

### 다층 지형 {#map-multilevel-terrain}

Overhang, cave, arch, cliff shelter와 지하 공간처럼 하나의 수평 위치에 여러 표면이 존재하는 지형을 단일 높이장으로 강제하지 않는다.

### 접촉과 경계 {#map-terrain-contact-boundary}

Terrain은 building pad, road section, bridge abutment, tunnel portal, retaining structure, shoreline와 adjacent tile이 만나는 접촉선과 우선관계를 가져야 한다. 서로 다른 source의 표면이 겹칠 때 절삭, 성토, 덮기, 혼합 또는 보존 중 선택된 관계를 추적할 수 있어야 한다.

### 지형 해상도와 불확실성 {#map-terrain-resolution-uncertainty}

영역별 horizontal spacing, vertical accuracy, simplification과 unknown 범위를 선언하고 shot, 이동, drainage, 수량과 construction 판단에 충분한지 목적별로 판정할 수 있어야 한다. 멀리서 매끄럽게 보인다는 이유로 접촉과 측량 정밀도를 주장하지 않아야 한다.

### 지형 gap {#map-terrain-gap}

해상도 부족, source 경계, 비정상 삼각형, hole과 불명확한 지표는 명시적 finding으로 남겨야 하며 주변 높이로 조용히 메우지 않는다.

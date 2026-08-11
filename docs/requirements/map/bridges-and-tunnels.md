# 교량과 터널

## 지형과 network를 잇는 구조 {#map-bridges-tunnels}

Bridge, viaduct, causeway, culvert, tunnel, underpass, trench와 portal을 terrain, water, road, rail 또는 pedestrian network의 실제 연결 요소로 표현할 수 있어야 한다.

### Crossing identity와 level {#map-crossing-identity-level}

각 crossing은 위와 아래를 지나는 network 또는 water body, 접근 segment, level, direction과 current state를 안정된 identity로 연결해야 한다. 서로 교차하는 선이 같은 평면에 보인다는 이유만으로 junction을 만들거나 실제 연결을 누락하지 않아야 한다.

### Span과 support {#map-bridge-span-support}

Deck, span, pier, abutment, cable, arch, clearance와 load-bearing relationship을 선언하여 떠 있거나 연결이 끊긴 구조를 찾을 수 있어야 한다.

### Tunnel volume {#map-tunnel-volume}

Tunnel은 지표 texture가 아니라 portal, bore, lining, cross section, grade, ventilation 또는 service zone과 host terrain의 절삭 관계를 가져야 한다.

### Tunnel drainage와 내부 상태 {#map-tunnel-drainage-state}

Tunnel과 underpass는 필요한 경우 low point, sump, drain, water ingress, smoke·air zone, lighting, access와 emergency route를 current phase에 연결할 수 있어야 한다. Flooded, blocked, unventilated 또는 incomplete volume을 열린 route로 취급하지 않아야 한다.

### 수리와 파괴 state {#map-crossing-state}

부분 붕괴, 봉쇄, 임시 교량, 개통 단계와 수리 상태를 network connectivity와 visible geometry에 함께 반영할 수 있어야 한다.

### Clearance 검증 {#map-crossing-clearance}

수면, 차량, 열차, 배우와 주변 terrain에 필요한 vertical·horizontal clearance를 동일한 resolved geometry에서 검토할 수 있어야 한다.

### 구조 검증 범위 {#map-crossing-structural-bound}

Support relation과 clearance 검토는 blocking과 공간 모순을 찾기 위한 것이며 수행하지 않은 structural load, seismic, hydraulic 또는 safety analysis를 통과한 것으로 주장하지 않아야 한다. 필요한 외부 분석과 그 결과가 적용되는 phase를 구분해야 한다.

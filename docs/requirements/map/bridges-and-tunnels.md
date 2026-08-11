# 교량과 터널

## 지형과 network를 잇는 구조 {#map-bridges-tunnels}

Bridge, viaduct, causeway, culvert, tunnel, underpass, trench와 portal을 terrain, water, road, rail 또는 pedestrian network의 실제 연결 요소로 표현할 수 있어야 한다.

### Span과 support {#map-bridge-span-support}

Deck, span, pier, abutment, cable, arch, clearance와 load-bearing relationship을 선언하여 떠 있거나 연결이 끊긴 구조를 찾을 수 있어야 한다.

### Tunnel volume {#map-tunnel-volume}

Tunnel은 지표 texture가 아니라 portal, bore, lining, cross section, grade, ventilation 또는 service zone과 host terrain의 절삭 관계를 가져야 한다.

### 수리와 파괴 state {#map-crossing-state}

부분 붕괴, 봉쇄, 임시 교량, 개통 단계와 수리 상태를 network connectivity와 visible geometry에 함께 반영할 수 있어야 한다.

### Clearance 검증 {#map-crossing-clearance}

수면, 차량, 열차, 배우와 주변 terrain에 필요한 vertical·horizontal clearance를 동일한 resolved geometry에서 검토할 수 있어야 한다.

# 연결과 Circulation

## 실제 경계를 통과하는 공간 연결 {#interior-connections-circulation}

Door, opening, corridor, stair, ramp, lift, ladder, bridge와 passage는 연결하는 공간과 level, 방향, 폭, 높이, slope, threshold와 current state를 가져야 한다.

### 수평과 수직 Route {#interior-horizontal-vertical-routes}

한 층의 room 사이 route와 여러 층의 stair, lift, ramp, escalator, shaft route를 같은 connectivity graph에서 추적할 수 있어야 한다.

### 출입과 접근 State {#interior-access-state}

Open, closed, locked, blocked, restricted, one-way와 user-profile-dependent access가 actor, crowd, camera와 evacuation route에 일관되게 반영되어야 한다.

### Landing과 Transition {#interior-circulation-transitions}

Landing, vestibule, lobby, threshold, turn, headroom change와 floor finish transition을 잔여 공간이 아니라 addressable connection condition으로 표현해야 한다.

### Route 거부 조건 {#interior-route-refusal}

끊긴 출입구, 잘못 연결된 storey, 충돌하는 stair, 부족한 headroom, 닫힌 문을 통과하는 path와 boundary 없는 teleport를 named finding으로 남겨야 한다.

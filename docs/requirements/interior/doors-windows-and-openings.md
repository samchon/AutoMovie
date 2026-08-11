# 문, 창과 Opening

## Interior Boundary를 관통하는 Opening {#interior-doors-windows-openings}

Door, window, hatch, pass-through, archway, service opening와 custom aperture는 wall, floor, ceiling 또는 envelope를 실제 depth로 절단하고 연결하는 공간과 외부를 식별해야 한다.

Through opening, partial-depth recess, niche, trench와 finish-only marking을 구분하고 host에서 제거하는 volume, 남는 reveal, 채우는 element와 각 face의 마감 termination을 추적할 수 있어야 한다. 표면 위에 다른 mesh를 겹친 결과를 실제 관통으로 취급하지 않아야 한다.

### 구성 요소와 Hardware {#interior-opening-components}

Frame, leaf, sash, panel, glass, mullion, jamb, head, sill, threshold, handle, hinge, lock, closer와 track을 필요한 상세 수준에서 구성할 수 있어야 한다.

### 가동 State와 Sweep {#interior-opening-operable-state}

Hinged, sliding, folding, rolling, pivoting와 removable state는 motion path, sweep, clearance, access, sightline, sound와 light transfer에 함께 반영되어야 한다.

### 내외부 정합 {#interior-opening-exterior-alignment}

Exterior와 연결된 window, door, skylight와 vent는 위치, 크기, orientation와 state를 공유하면서 interior trim과 exterior flashing을 독립적으로 상세화할 수 있어야 한다.

연결된 exterior가 정한 building identity, facade 또는 roof boundary, opening profile과 envelope depth가 권위 기준이어야 한다. Interior는 trim, lining, sill과 hardware를 추가할 수 있지만 촬영이나 가구 배치를 위해 opening을 이동·확대하거나 외피를 얇게 만들지 않아야 한다.

### Opening 검증 {#interior-opening-validation}

Host 밖 cut, 겹친 opening, invalid frame depth, 벽을 남겨 둔 채 통과하는 route, 충돌하는 leaf와 접근 불가능한 hardware를 탐지해야 한다.

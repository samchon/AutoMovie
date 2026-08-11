# 천장과 상부 Zone

## 층과 공간마다 독립된 천장 {#interior-ceiling-per-space}

각 storey와 room은 같은 건물의 다른 층과 같거나 다른 ceiling type, elevation, slope, profile, finish와 state를 가질 수 있어야 한다. 반복 층은 공통 rule과 개별 예외를 함께 보존해야 한다.

한 층 안에서도 room, perimeter, cove, service band, feature field와 open-to-structure zone마다 서로 다른 ceiling assembly, tile 또는 panel pattern, material과 datum을 가질 수 있어야 한다. 공유 type을 재사용하더라도 각 zone의 해석된 geometry와 override 출처가 남아야 한다.

### 천장과 구조의 구분 {#interior-ceiling-structure-distinction}

Exposed slab, suspended ceiling, vaulted ceiling, soffit, beam underside, roof underside와 open-to-structure condition을 구분하여 ceiling을 항상 위층 slab의 texture로 대체하지 않아야 한다.

### 상부 Plenum과 Service {#interior-overhead-plenum-services}

Ceiling finish 위의 suspension, plenum, duct, pipe, cable tray, light, diffuser, sprinkler와 access zone은 실제 depth, support, clearance와 maintenance access를 가져야 한다.

### 천장 Pattern과 Opening {#interior-ceiling-pattern-openings}

Tile grid, panel, coffer, baffle, slat, acoustic element와 custom pattern을 light, vent, detector, hatch, curtain track와 조정하고 edge cut와 border를 제어할 수 있어야 한다.

### Clear Height 검증 {#interior-ceiling-clear-height}

Finished floor부터 lowest overhead obstruction과 nominal ceiling까지의 높이를 구분하고, exterior level·slab·roof와 합쳐졌을 때 음수 void, 겹침과 불가능한 clear height를 거부해야 한다.

### 지지, 탈착과 수량 {#interior-ceiling-support-removal-quantity}

Panel, baffle, island, canopy, luminaire와 service terminal은 hanger, rail, support, removal direction과 access 관계를 가질 수 있어야 한다. Reflected ceiling plan, section, panel·hanger 수량과 maintenance 검토는 같은 resolved ceiling zone, cut piece, opening와 state를 읽어야 한다.

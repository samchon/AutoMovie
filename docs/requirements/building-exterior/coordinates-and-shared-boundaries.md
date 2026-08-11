# 좌표와 공유 경계

## 건물 내부에서 끊기지 않는 좌표 {#building-coordinate-shared-boundaries}

각 building work는 길이 단위, handedness, up·forward axis, local origin, orientation, elevation datum과 map까지의 placement transform을 선언하고 mass, storey, facade, roof, opening, attachment와 interior가 그 변환 연쇄를 통해 같은 실제 위치를 참조하게 해야 한다.

### 좌표 Transform 연쇄 {#building-coordinate-transform-chain}

Map source에서 world, building root, building unit, element와 imported asset local frame까지의 translation, rotation와 scale 순서가 추적 가능해야 한다. 숨은 scale·offset, camera별 보정과 중복 적용된 transform으로 접합을 맞추지 않아야 한다.

### 공유 Boundary Identity {#building-shared-boundary-identity}

Interior가 연결된 경우 exterior face, construction core, interior face, slab, roof underside, opening cut, core, shaft와 service penetration은 양쪽 표현이 참조하는 shared-boundary identity를 가져야 한다. Exterior와 interior의 독립 마감은 같은 construction을 덮을 수 있지만 별도의 겹친 wall, slab나 opening을 정합된 경계로 가장하지 않아야 한다.

### 양방향 변경 전파 {#building-shared-boundary-change}

Exterior의 footprint, mass, level, envelope, opening, structure와 service interface 변경은 영향받는 interior를 stale로 만들고, interior의 boundary, slab, core, shaft, opening와 service 요구 변경도 영향받는 exterior를 stale로 만들어야 한다. 어느 쪽도 항상 우선하는 사본이 아니며 선택된 current design에서 두 결과가 함께 성립해야 한다.

### Control Point와 허용오차 {#building-coordinate-control-tolerance}

Corner, grid intersection, entrance threshold, storey datum, roof point, opening jamb와 service port를 control point로 비교하고 source, exterior, interior와 map 사이 residual과 project-defined tolerance를 기록할 수 있어야 한다. 허용오차 밖의 차이를 반올림이나 화면상 근접으로 통과시키지 않아야 한다.

### Large World 정밀도 {#building-coordinate-large-world-precision}

광역 map의 큰 좌표에서 local working origin이나 origin rebasing을 사용하더라도 building identity, 실제 placement, interior contact, facade module, actor clearance와 quantity가 바뀌지 않아야 한다. 정밀도가 접합 검증에 부족한 경우 성공 대신 unsupported 또는 failure 범위를 보고해야 한다.

### 독립 Set 좌표 {#building-coordinate-exterior-set}

Map이나 interior가 없는 exterior-only set도 project-local frame, reference ground, valid extent와 camera-relative가 아닌 실제 scale을 가져야 한다. 이 좌표만으로 geographic placement, terrain contact나 interior alignment를 검증했다고 주장하지 않아야 한다.

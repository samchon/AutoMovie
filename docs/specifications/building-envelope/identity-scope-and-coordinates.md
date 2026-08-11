# 건물 Identity, 범위와 좌표 {#building-envelope-identity-scope-coordinates-specification}

## 건물 소유 경계 {#building-envelope-building-ownership-boundary}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-scope 건물 외형의 소유 범위, identity, 외피 전용 세트와 운송 수단 제외를 하나의 경계 계약으로 고정한다. -->

건물 work는 하나 이상의 building unit을 소유하며 각 unit은 stable building identity, revision, 단위, 좌표 root, element root와 논리 범위 root를 가진다. Facade, roof, balcony, exterior stair, ladder, rail, bridge와 건물에 고정된 설비는 건물에 속하고 terrain, road, 자연 수계, 하늘, 날씨와 주변 건물은 site context에 속한다.

### 범위 입력과 정규화 {#building-envelope-scope-input-normalization}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-identity 같은 이름이나 배열 순서가 아니라 stable identity와 revision으로 건물 및 부속 요소를 결속한다. -->

입력은 building unit, 부모-자식 관계, 소유 역할, source revision, 실제 단위와 선택한 phase·alternative를 제공해야 한다. 같은 identity가 둘 이상의 독립 root를 소유하거나, element가 어떤 unit에도 귀속되지 않거나, 건물 밖 context가 건물의 편집 가능한 구성원으로 들어오면 정규화를 거부한다.

### 외피 전용 세트 상태 {#building-envelope-exterior-only-set-state}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-only 내부 진입 없는 세트형 건물을 독립적인 유효 상태로 정의한다. -->

`exterior-only` 상태는 외부에서 관찰되는 mass, facade, roof, opening, attachment와 ground contact의 유효 범위 및 카메라가 내부를 볼 수 있는 모든 개구부의 backing 정책을 가져야 한다. 이 상태는 보이지 않는 room, floor, service와 구조를 존재한다고 추정하지 않으며 interior constraint를 요구하지 않는다.

### 운송 수단 제외와 호환성 {#building-envelope-building-only-compatibility}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-transport-exclusion 건물 외피 계약을 차량, 선박과 다른 운송 수단의 외장·내부 계약으로 확장하지 않는다. -->

기존 exterior-only 기록은 interior link가 없어도 계속 유효하며 후속 revision에서 interior를 연결할 수 있다. Building identity가 아닌 host를 이 명세로 해석하거나 vehicle body, ship hull, cabin과 cargo compartment를 building unit으로 승격하면 `scope-mismatch`로 거부한다.

## 공유 좌표 Frame {#building-envelope-shared-coordinate-frame}

<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-shared-boundaries 건물 local 좌표와 interior·site 공유 경계의 변환 및 허용오차를 규정한다. -->

각 building unit은 길이 단위, 축 방향, handedness, local origin과 building-to-world 변환을 선언하며 모든 child placement는 정해진 합성 순서로 그 root를 따른다. Site, interior와 외부 자산은 같은 숫자를 공유하는 것이 아니라 명시된 frame identity와 변환 receipt를 통해 연결된다.

### 좌표 입력과 출력 {#building-envelope-coordinate-input-output}

<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain source에서 building과 world까지의 변환 순서와 결과 좌표를 재현 가능하게 한다. -->

입력은 source frame, unit·axis 변환, translation, rotation, scale, control point와 tolerance를 제공한다. 출력은 정규화된 transform chain, 각 공유 기준점의 resolved world coordinate, residual, 사용 범위와 interpretation revision이며 숨은 scale이나 임의 offset은 허용하지 않는다.

### 공유 경계 Identity와 소유권 {#building-envelope-coordinate-shared-boundary-identity}

<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity interior와 site가 같은 경계를 복제하지 않고 한 identity를 양방향으로 참조하게 한다. -->

Footprint, facade·roof face, slab datum, opening cut, service port와 terrain contact seam은 stable shared-boundary identity를 가질 수 있다. 건물이 기하와 허용오차를 소유하고 상대 영역은 역할별 finish, route 또는 terrain 관계를 추가하며 어느 쪽도 공유 위치를 별도 정본으로 복제하지 않는다.

### 정밀도와 좌표 실패 {#building-envelope-coordinate-precision-failures}

<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-control-tolerance 기준점 잔차, 허용오차와 광역 좌표 정밀도 실패를 명시적으로 판정한다. -->

Control point 부족, residual 초과, unit·axis·datum 충돌, non-finite transform, collapsed scale, frame cycle와 large-world precision 범위 초과는 affected identity와 measured residual을 가진 finding이 된다. Local working origin 변경은 world position과 identity를 보존해야 하며 이를 증명하지 못하면 배치 결과는 `unknown` 또는 `failed`이지 자동 보정된 성공이 아니다.

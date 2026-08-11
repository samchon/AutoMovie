# 외부 3D 자산과 맵 배치

## 열린 맵 구성 자산 {#map-external-asset-placement}

사용자와 저작 에이전트는 외부 glTF 또는 GLB를 terrain prop, landmark, bridge component, vegetation prototype, vehicle, ruin, street furniture와 project-defined map element로 배치할 수 있어야 한다.

### 채택 방식과 Identity {#map-external-adoption-identity}

Direct placement, project-native conversion과 group composition 중 사용자가 선택한 방식을 보존하고 source scene·node identity와 map element identity의 관계를 추적해야 한다.

### 좌표와 실제 단위 {#map-external-coordinate-units}

외부 자산의 axis, handedness, unit, origin, bounds와 local transform을 map coordinate와 지리 또는 local datum에 명시적으로 연결하고 숨은 scale과 offset으로 맞추지 않아야 한다.

### 지형과 Network 제약 {#map-external-terrain-network-constraints}

최종 geometry는 terrain contact, slope, water level, parcel, road·path, clearance, support, collision와 visibility scope에서 성립해야 하며 imported bounds만으로 배치 성공을 주장하지 않아야 한다.

### Population과 Group {#map-external-population-groups}

하나의 외부 prototype을 settlement, forest, army, street와 infrastructure group에 반복 사용할 수 있으나 stable seed, member identity, exception, expanded budget와 story-relevant hero를 유지해야 한다.

### Source와 State {#map-external-source-state}

Source digest, license, conversion receipt, placement transform, group membership, material override, animation 또는 named state와 current map phase를 함께 추적해야 한다.

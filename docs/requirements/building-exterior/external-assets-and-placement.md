# 외부 3D 자산과 건물 구성

## 외부 자산으로 구성 가능한 Building Exterior {#building-exterior-external-assets}

사용자와 저작 에이전트는 자신이 선택한 외부 glTF 또는 GLB를 전체 exterior-only building, 원경 mass, facade set, roof, opening assembly, attachment, ornament, equipment와 project-defined exterior element로 사용할 수 있어야 한다. 특정 provider, 생성 서비스나 asset catalogue를 필수 경로 또는 기본값으로 정하지 않아야 한다.

### 사용자가 고르는 채택 방식 {#building-exterior-external-adoption-choice}

원본 scene graph의 direct placement, project-native building element와 저작 규칙으로의 native conversion, 원본 또는 변환 결과를 더 큰 mass·facade·building group으로 넣는 composition 중 어느 방식을 쓸지는 사용자와 저작 에이전트가 결정해야 한다. 제품은 어느 경로를 몰래 선택하거나 다른 경로로 바꾸지 않아야 한다.

### Direct Placement {#building-exterior-external-direct-placement}

Direct placement는 선택한 scene, 여러 root와 child node, local transform, mesh reuse, material, texture, skin, morph와 animation 중 지원하는 범위를 보존하고 building 또는 element identity와 placement transform을 추가해야 한다. 지원하지 않는 extension이나 feature를 유지한 것처럼 보이게 flatten하거나 여러 root를 임의로 하나의 mesh로 합치지 않아야 한다.

### Native Conversion {#building-exterior-external-native-conversion}

Native conversion은 각 source scene·node·mesh·material을 어느 building, mass, storey, facade, roof, opening, attachment, geometry, material region와 program rule로 바꾸었는지 대응을 기록해야 한다. Coordinate·unit 변환, merge, approximation, generated topology, preserved state, loss와 unsupported feature를 conversion receipt에 남겨 결과를 다시 저작하고 재생성할 수 있게 해야 한다.

### Group Composition {#building-exterior-external-group-composition}

Direct 또는 converted asset은 building work, multi-building composition, repeated block, facade assembly와 nested group의 member가 될 수 있어야 한다. Group transform, member order, source hierarchy, building ownership, attachment, phase, override와 group-local transform을 합성 뒤에도 유지해야 한다.

### Building Identity 연결 {#building-exterior-external-identity-link}

외부 scene, node와 mesh identity를 building, mass, storey, facade region, roof, opening, service equipment 또는 attachment identity에 연결하고 direct, conversion와 group 경로마다 source-to-result 관계를 잃지 않아야 한다. Bare geometry에 원본이 제공하지 않은 storey, structure, opening나 service 의미를 자동 사실로 부여하지 않아야 한다.

### 실제 크기와 층별 제약 {#building-exterior-external-size-level-constraints}

Axis, handedness, unit, origin, pivot, bounds와 local transform을 명시적으로 해석하고 최종 resolved geometry가 footprint, total height, storey elevation, floor-to-floor height, structure, roof, envelope, opening, service interface, site와 linked interior의 shared boundary 안에서 성립해야 한다. Imported bounds와 화면상 크기만으로 배치 성공을 주장하지 않아야 한다.

### Set와 Facade 경계 {#building-exterior-external-set-boundary}

Interior가 없는 외부 set 또는 원경 building은 valid camera region, 거리, face coverage, backside·edge, opening depth, support, collision와 representation scope를 명시해야 한다. 보이지 않는 구조, 내부, roof, service와 site contact를 외부 자산이 제공한다고 추정하지 않아야 한다.

### Provenance와 Override {#building-exterior-external-provenance}

Source, acquisition time, license, source digest, selected scene, coordinate convention, conversion receipt, result digest, placement, material·state override, repeated instance, representation와 selected phase를 추적해야 한다. Source bytes나 interpretation 변경은 affected building, facade, quantity, drawing, render와 evidence를 stale로 만들게 해야 한다.

### Resource Closure와 Bound {#building-exterior-external-resource-closure}

glTF JSON, GLB chunk, buffer, image, URI와 extension dependency의 closure, content identity, maximum bytes, node·mesh·material·texture count와 decoded resource budget을 검증해야 한다. Missing dependency, path escape, unexpected remote fetch, decompression expansion와 credential 포함을 부분 성공으로 숨기지 않아야 한다.

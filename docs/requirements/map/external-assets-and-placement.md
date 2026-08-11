# 외부 공간자료와 3D 자산 배치

## 열린 맵 구성 자산 {#map-external-asset-placement}

사용자와 저작 에이전트는 외부 glTF 또는 GLB를 terrain prop, landmark, bridge component, vegetation prototype, vehicle, ruin, street furniture와 project-defined map element로 배치할 수 있어야 한다.

### 외부 공간자료 {#map-external-spatial-data}

사용자는 raster elevation, imagery, vector feature, point cloud, contour, survey point, bathymetry와 project-defined spatial dataset을 맵 source로 채택할 수 있어야 한다. 지원 format, feature subset, nodata, attribute, resolution, extent와 resource bound를 명시하고 읽지 못한 값을 추측하여 채우지 않아야 한다.

### Source provenance와 품질 {#map-spatial-source-provenance-quality}

각 spatial source는 provider 또는 author, license, version 또는 acquisition time, digest, CRS, vertical datum, accuracy, resolution, coverage, processing history와 usage constraint를 가져야 한다. Reference image와 visually aligned sketch는 measured data와 구분해야 한다.

### 결합, clip과 우선관계 {#map-spatial-source-composition}

여러 source를 clip, mosaic, overlay, resample 또는 replace할 때 target extent, resolution, interpolation, nodata, overlap priority, seam 처리와 발생한 loss를 추적할 수 있어야 한다. 최신, 고해상도 또는 화면상 보기 좋은 source가 자동으로 모든 영역의 정본이 되지 않아야 한다.

### 채택 방식과 Identity {#map-external-adoption-identity}

Direct placement, project-native conversion과 group composition 중 사용자가 선택한 방식을 보존하고 source scene·node identity와 map element identity의 관계를 추적해야 한다.

### 좌표와 실제 단위 {#map-external-coordinate-units}

외부 자산의 axis, handedness, unit, origin, bounds와 local transform을 map coordinate와 지리 또는 local datum에 명시적으로 연결하고 숨은 scale과 offset으로 맞추지 않아야 한다.

### glTF scene graph와 의미 보강 {#map-external-gltf-semantics}

선택한 glTF scene, node hierarchy, instancing, mesh, material, animation과 local transform의 지원 범위를 보존하고 unsupported feature를 보고해야 한다. Bare geometry에는 project가 map identity, semantic role, contact, support, collision, phase와 traveler relation을 추가할 수 있어야 하며 원본에 없던 의미를 자동 사실로 만들지 않아야 한다.

### 지형과 Network 제약 {#map-external-terrain-network-constraints}

최종 geometry는 terrain contact, slope, water level, parcel, road·path, clearance, support, collision와 visibility scope에서 성립해야 하며 imported bounds만으로 배치 성공을 주장하지 않아야 한다.

### Population과 Group {#map-external-population-groups}

하나의 외부 prototype을 settlement, forest, army, street와 infrastructure group에 반복 사용할 수 있으나 stable seed, member identity, exception, expanded budget와 story-relevant hero를 유지해야 한다.

### Source와 State {#map-external-source-state}

Source digest, license, conversion receipt, placement transform, group membership, material override, animation 또는 named state와 current map phase를 함께 추적해야 한다.

### Source 교체와 영향 {#map-external-source-replacement}

Spatial data 또는 asset bytes, CRS 해석, conversion과 placement rule이 바뀌면 affected tile, terrain, network, quantity, route, render와 delivery를 식별하고 이전 결과를 stale로 처리할 수 있어야 한다.

# Media Family와 선언 사실

## 서로 다른 외부 입력의 공통 채택 {#external-media-family-contract}

AutoMovie는 외부 입력을 filename 하나로 취급하지 않고 media family와 해석에 필요한 사실을 함께 채택해야 한다. 지원 범위는 family, format, version과 feature subset으로 설명되어야 하며 알려지지 않은 자료를 비슷해 보이는 family로 추측하지 않아야 한다.

### glTF, GLB와 3D Scene {#external-media-gltf-glb}

사용자는 외부 glTF와 GLB를 포함한 지원 3D scene을 가져올 수 있어야 한다. 선택된 scene, node hierarchy, local transform, mesh와 primitive, material과 texture, skin, morph, animation, camera, light와 extension 중 무엇을 원본대로 읽고 무엇을 지원하지 않는지 구분해야 하며, 여러 root와 instance를 임의로 한 mesh로 축약하지 않아야 한다.

### Image와 Video {#external-media-image-video}

Still image, image sequence와 encoded video는 pixel extent, orientation, alpha, color space와 transfer interpretation, pixel aspect, frame rate 또는 timebase, duration, channel과 sequence gap을 구분하여 채택할 수 있어야 한다. Filename extension만으로 decode, 색 또는 시간 의미를 확정하지 않아야 한다.

### Audio {#external-media-audio}

External audio는 container와 codec, sample format, sample rate, channel layout, duration, start 또는 synchronization 기준, loudness와 peak 같은 실제 측정 여부를 구분하여 채택할 수 있어야 한다. 알 수 없는 channel이나 timing을 임의의 stereo와 zero start로 가장하지 않아야 한다.

### Motion과 Performance Data {#external-media-motion}

Motion clip, keyframe, capture data와 procedural motion result는 source skeleton 또는 target roles, rest basis, root motion, coordinate와 unit, timebase, event, contact, loop와 supported channel을 함께 가져야 한다. Bone 이름이 비슷하다는 이유만으로 mapping, scale와 contact 의미를 추정하지 않아야 한다.

### 공간 자료 {#external-media-spatial-data}

Terrain, geographic raster와 vector, survey, CAD-like drawing, point cloud, map, route와 관측 자료는 coordinate reference, datum 또는 local origin, axis, unit, extent, resolution 또는 level, timestamp와 uncertainty를 표현할 수 있어야 한다. 지리 좌표와 scene-local 좌표를 숫자 모양이 같다는 이유로 직접 겹치지 않아야 한다.

### Text와 Metadata {#external-media-text-metadata}

Script, subtitle, transcript, prompt record, tabular data, structured document와 sidecar metadata는 encoding, language, schema 또는 vocabulary, version, identity field, ordering과 reference target을 검증할 수 있어야 한다. Text 안의 markup, URL, command-like content와 embedded instruction은 명시적 채택 범위 밖에서 실행되거나 에이전트 지시로 승격되지 않아야 한다.

### 새로운 Format과 Family {#external-media-extensible-families}

현재 목록에 없는 format이나 media family도 사용자가 지원되는 중간 결과로 변환하거나 해석 계약을 제공하면 같은 provenance, closure, validation, receipt와 degradation 규칙 아래 채택할 수 있어야 한다. 새 provider나 filename suffix가 생길 때마다 제품 계약을 한 업체의 catalogue로 확장하지 않아야 한다.

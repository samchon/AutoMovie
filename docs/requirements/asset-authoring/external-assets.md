# 외부 자산 도입

## 외부 자산의 명시적 채택 {#asset-external-adoption}

사용자는 model, motion, image, audio, font와 reference data를 작품 자산으로 채택할 수 있어야 하며, 채택된 bytes와 해석 조건이 project에 고정되어야 한다.

### 외부 3D Scene {#asset-external-gltf-scene}

사용자는 자신이 선택한 서드파티 제작 도구나 생성 API에서 얻은 glTF 또는 GLB를 포함한 지원 3D 자산을 가져올 수 있어야 한다. 특정 provider, model, service와 asset catalogue를 AutoMovie의 필수 경로로 정하지 않는다.

### 채택 방식의 선택권 {#asset-external-adoption-mode}

사용자와 저작 에이전트는 원본 scene graph를 유지하는 direct placement, geometry·material·rig·animation을 project-native 구조와 프로그램으로 바꾸는 conversion, 또는 원본·변환 자산을 상위 group과 assembly에 합성하는 방식을 선택할 수 있어야 한다. Engine과 MCP는 이 선택지를 지원하고 어느 하나를 몰래 대신 결정하지 않는다.

### Scene Graph 보존 {#asset-external-scene-graph-preservation}

Direct placement는 선택된 scene, root와 child node, local transform, mesh reuse, material, texture, skin, morph와 animation의 지원 범위를 보존해야 하며 여러 root나 instance를 임의로 단일 mesh에 합치지 않아야 한다.

### Conversion Receipt {#asset-external-conversion-receipt}

Native conversion은 source element와 result identity의 대응, 좌표·단위 변환, 병합, 근사, loss와 unsupported extension을 기록하여 사용자가 변환 결과를 수정하고 다시 만들 수 있게 해야 한다.

### Provenance와 digest {#asset-external-provenance-digest}

외부 자산은 source, license, digest, format, unit, coordinate convention, version과 consumer identity를 가져야 한다.

### Bounded decoder {#asset-bounded-decoder}

지원하는 format과 feature subset, 최대 크기, count, duration과 resource budget을 명시하고 범위 밖 입력을 부분적으로 추측하여 읽지 않는다.

### Resource Closure와 안전 {#asset-external-resource-closure}

glTF JSON, GLB chunk, buffer, image, URI와 extension dependency의 closure를 검증하고 path escape, remote surprise fetch, content-type mismatch, decompression expansion과 credential 노출을 거부해야 한다.

### Semantic enrichment {#asset-semantic-enrichment}

가져온 bare geometry나 motion은 project가 필요한 identity, material role, rig constraint, scale, ownership과 behavior를 추가할 수 있어야 하며 원본에 없던 의미를 자동으로 사실처럼 만들지 않는다.

### Replacement traceability {#asset-external-replacement}

외부 bytes가 바뀌면 affected model, shot, render와 evidence를 식별하고 이전 receipt를 stale로 처리해야 한다.

### 비밀정보 분리 {#asset-external-secret-boundary}

Provider, model, version, prompt, seed, controls, source와 output digest는 provenance가 될 수 있지만 API key, access token, cookie와 다른 credential은 project source, build log, receipt, generated artifact와 evidence에 들어가서는 안 된다.

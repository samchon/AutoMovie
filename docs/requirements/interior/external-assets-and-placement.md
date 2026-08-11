# 외부 자산과 배치 선택

## 공급자 독립 외부 3D 자산 {#interior-external-asset-placement}

사용자와 MCP knowledge and evidence boundary를 통해 계약과 current evidence를 받는 저작 에이전트는 외부에서 취득하거나 text-to-3D, image-to-3D와 다른 제작 서비스로 생성한 glTF 또는 GLB 자산을 interior에 사용할 수 있어야 한다. AutoMovie는 특정 공급자나 asset catalogue를 필수로 정하지 않는다.

### 사용자가 고르는 채택 방식 {#interior-external-adoption-choice}

사용자는 원본 glTF scene graph를 유지한 direct placement, 형상·재료·rig·animation을 project-native 저작 구조로 변환하는 방식, 또는 어느 쪽이든 더 큰 group과 assembly에 합성하는 방식을 선택할 수 있어야 한다. 제품과 MCP knowledge and evidence boundary는 각 경로의 계약과 current evidence를 제공하되 source나 asset을 직접 저작하는 API로 가장하거나 그 결정을 대신하지 않아야 한다.

### Direct Placement {#interior-external-direct-placement}

Direct placement는 전체 또는 선택한 scene, node subtree, local transform, mesh, material, texture, skin, morph, animation, camera, light와 required·optional extension 중 지원하는 범위를 보존하고 하나 이상의 instance를 room, host surface와 group에 실제 단위로 배치할 수 있어야 한다. 지원하지 않는 항목은 원본에 남긴 채 영향과 fallback을 명시해야 한다.

### Native Conversion {#interior-external-native-conversion}

Native conversion은 어느 source element를 어떤 identity, geometry, material region, rig, state와 program rule로 바꾸었는지, 무엇을 병합·근사·탈락시켰는지 기록하고 변환 결과를 사용자가 다시 저작할 수 있어야 한다.

한 자산 안에서도 일부 node는 direct reference로 유지하고 다른 node는 native form으로 변환할 수 있어야 한다. 이 경계, 변환 tool과 version, 분석 시각, 사용자 확정, geometry·material 편차와 이후 수동 보정을 기록하여 자동 변환 mesh를 수정 가능한 의미 모델로 가장하지 않아야 한다.

### Group Composition {#interior-external-group-composition}

원본 또는 변환된 자산은 furniture set, equipment assembly, decorative composition, repeated room kit와 다른 semantic group의 구성원이 될 수 있고 각 member의 source identity와 group-local transform을 유지해야 한다.

### Host Constraint {#interior-external-host-constraint}

외부 자산은 imported bounds만 믿고 배치 성공으로 간주하지 않는다. 최종 resolved geometry가 floor, ceiling, wall, opening, route, clearance, support, collision와 current state 안에서 성립해야 한다.

Visual mesh와 별도로 collision·placement proxy, support surface, attachment point, operable range와 maintenance volume을 연결할 수 있어야 한다. 원본에 없는 의미를 추정했다면 자동 observation과 사용자 confirmation을 구분해야 한다.

### 자산 Closure와 가용성 {#interior-external-asset-closure}

선택한 scene와 node가 요구하는 buffer, image, texture, extension와 상대 reference를 content digest와 함께 닫힌 dependency set로 확인할 수 있어야 한다. Missing byte, decode failure, path escape, case collision와 unsupported required feature를 조용한 대체로 숨기지 않고 original reference와 stable placeholder를 보존해야 한다.

### Provenance와 Credential 경계 {#interior-external-provenance-secrets}

Source URL 또는 provider, model과 version, prompt와 controls, source digest, license, conversion receipt와 result digest는 추적하되 API key, access token과 다른 credential을 source, log, generated artifact, render metadata와 evidence에 기록하지 않아야 한다.

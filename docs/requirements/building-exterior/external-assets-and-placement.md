# 외부 3D 자산과 건물 구성

## 외부 자산으로 구성 가능한 Building Exterior {#building-exterior-external-assets}

사용자와 저작 에이전트는 외부 glTF 또는 GLB를 전체 exterior-only building, facade set, roof, opening assembly, attachment, ornament, equipment와 project-defined exterior element로 사용할 수 있어야 한다.

### 사용자가 고르는 채택 방식 {#building-exterior-external-adoption-choice}

원본 scene graph의 direct placement, project-native building element로의 conversion과 더 큰 mass·facade·building group으로의 composition 중 어느 방식을 쓸지는 사용자가 결정하며 Engine과 MCP는 각 경로를 검증 가능하게 지원해야 한다.

### Building Identity 연결 {#building-exterior-external-identity-link}

외부 scene, node와 mesh identity를 building, mass, storey, facade region, roof, opening 또는 attachment identity에 연결하고 group 안에서도 source와 local transform을 잃지 않아야 한다.

### 실제 크기와 층별 제약 {#building-exterior-external-size-level-constraints}

최종 geometry는 footprint, total height, storey elevation, floor-to-floor height, roof, envelope, opening, site와 interior가 있는 경우 그 shared boundary 안에서 성립해야 한다.

### Set와 Facade 경계 {#building-exterior-external-set-boundary}

Interior가 없는 외부 set 또는 원경 building은 그 scope를 명시할 수 있으나 보이지 않는 구조와 내부를 외부 자산이 제공한다고 추정하지 않아야 한다.

### Provenance와 Override {#building-exterior-external-provenance}

Source digest, license, conversion loss, placement, material·state override, repeated instance와 selected phase를 추적하고 source 교체가 affected facade, drawing, render와 evidence를 stale로 만들게 해야 한다.

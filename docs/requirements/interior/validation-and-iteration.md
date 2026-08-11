# 검증과 반복

## Interior 전체 관계 검증 {#interior-validation-iteration}

Interior는 space graph, host boundary, geometry, assembly, material, pattern, object placement, route, clearance, service, environment, state와 evidence를 같은 resolved design에서 검증할 수 있어야 한다.

### Geometry와 Topology {#interior-geometry-topology-validation}

Gap, overlap, inverted surface, degenerate solid, invalid boundary, impossible opening, unsupported element와 disconnected route를 탐지해야 한다.

Point·curve·surface·solid와 explicit mesh의 closure, self-intersection, non-manifold edge, duplicate face, local-to-world transform, finite value와 tolerance를 목적별로 검토해야 한다. Authoring geometry, analysis boundary, collision proxy, simplified representation와 render mesh 중 어느 representation에서 finding이 나왔는지 밝혀야 한다.

### Host와 층별 제약 {#interior-host-storey-validation}

각 층의 floor, ceiling, clear height, wall, shaft, opening와 object가 연결된 exterior footprint, level, slab, roof와 envelope 안에서 성립하는지 확인해야 한다.

같은 building identity의 mass, 건축면적과 연면적 definition, storey elevation, floor-to-floor height, structural and envelope thickness, core, shaft와 facade·roof opening을 authoritative host input으로 사용해야 한다. Interior-only set는 검증하지 못한 exterior constraint와 virtual extent를 분리해서 보고해야 한다.

### 배치와 사용 가능성 {#interior-placement-usability-validation}

Native와 external asset을 동일한 최종 geometry 기준으로 support, collision, clearance, reach, route, opening sweep와 maintenance access에 대해 검토해야 한다.

### Positive, Negative와 Boundary {#interior-validation-twins}

주요 capability는 성립하는 사례, 한 조건만 깨뜨린 negative twin과 최대 허용 경계에서의 사례를 가져야 하며 눈으로 그럴듯하다는 판단만으로 gate를 대신하지 않아야 한다.

### 주소 가능한 진단 {#interior-addressable-diagnostics}

자동 finding은 stable code, severity, description, affected building·storey·space·element·property·location·time, observed value, expected condition, unit, tolerance와 optional correction direction을 제공해야 한다. Error, warning, information, unknown, unsupported, validator failure와 suppressed finding을 구분하고 suppression에는 author, reason, scope와 expiry를 남겨야 한다.

### 실행 범위와 현재성 {#interior-validation-scope-freshness}

Whole building, storey, room, zone, selected element, phase, alternative, time와 rule set를 검증 범위로 선택할 수 있어야 한다. Partial run은 excluded surface를 밝히고 source, host, asset, rule 또는 algorithm revision이 바뀌면 이전 result를 current pass로 사용하지 않아야 한다.

### 시각적 검토와 재현 {#interior-visual-review-reproduction}

실제 3D 장면에서 scale, 공간 관계, ceiling, material, pattern, lighting, clutter, contact, opening와 camera readability를 검토하고 source 수정 뒤 같은 identity와 조건으로 다시 생성할 수 있어야 한다.

Reference, normal·depth·identity pass, clearance overlay, drawing와 beauty frame은 서로 다른 evidence surface로 취급하고 review camera, light, state, phase, alternative, time와 source revision을 기록해야 한다. 수정 뒤 진단이 사라졌다는 사실만으로 quantity, route, visual quality와 다른 rule의 regression이 없다고 결론내리지 않아야 한다.

### 정직한 결과 상태 {#interior-validation-status}

Solved, passed, failed, unsupported, not-run와 unknown을 구분하고 분석이나 시각 검토를 실행하지 않은 범위를 성공으로 표시하지 않아야 한다.

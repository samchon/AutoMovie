# 검증과 반복

## Interior 전체 관계 검증 {#interior-validation-iteration}

Interior는 space graph, host boundary, geometry, assembly, material, pattern, object placement, route, clearance, service, environment, state와 evidence를 같은 resolved design에서 검증할 수 있어야 한다.

### Geometry와 Topology {#interior-geometry-topology-validation}

Gap, overlap, inverted surface, degenerate solid, invalid boundary, impossible opening, unsupported element와 disconnected route를 탐지해야 한다.

### Host와 층별 제약 {#interior-host-storey-validation}

각 층의 floor, ceiling, clear height, wall, shaft, opening와 object가 연결된 exterior footprint, level, slab, roof와 envelope 안에서 성립하는지 확인해야 한다.

### 배치와 사용 가능성 {#interior-placement-usability-validation}

Native와 external asset을 동일한 최종 geometry 기준으로 support, collision, clearance, reach, route, opening sweep와 maintenance access에 대해 검토해야 한다.

### Positive, Negative와 Boundary {#interior-validation-twins}

주요 capability는 성립하는 사례, 한 조건만 깨뜨린 negative twin과 최대 허용 경계에서의 사례를 가져야 하며 눈으로 그럴듯하다는 판단만으로 gate를 대신하지 않아야 한다.

### 시각적 검토와 재현 {#interior-visual-review-reproduction}

실제 3D 장면에서 scale, 공간 관계, ceiling, material, pattern, lighting, clutter, contact, opening와 camera readability를 검토하고 source 수정 뒤 같은 identity와 조건으로 다시 생성할 수 있어야 한다.

### 정직한 결과 상태 {#interior-validation-status}

Solved, passed, failed, unsupported, not-run와 unknown을 구분하고 분석이나 시각 검토를 실행하지 않은 범위를 성공으로 표시하지 않아야 한다.

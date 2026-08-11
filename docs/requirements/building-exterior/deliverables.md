# 외관 산출물

## 동일한 건물에서 나온 외관 자료 {#building-exterior-deliverables}

Site placement, plan, mass axonometric, directional elevation, facade unfolding, roof plan, exterior section, opening·assembly detail, material·panel layout, service interface plan, schedule, quantity, analysis, render와 guide pass는 같은 building identity, revision, coordinate, phase, alternative, representation와 current state를 사용해야 한다.

### View와 Drawing 범위 {#building-exterior-drawing-views}

각 drawing은 projection, cut plane, direction, extent, scale, level, hidden convention, annotation, included identity와 representation을 선언하고 3D source와 관계를 추적할 수 있어야 한다. Exterior-only set의 유효 camera·geometry 범위 밖을 완전한 elevation이나 section으로 채우지 않아야 한다.

### 치수와 Annotation {#building-exterior-dimensions-annotations}

Footprint, overall dimension, grid, control point, level, height, radius, angle, slope, setback, clearance와 element spacing을 measurement basis, unit와 source identity에 연결하여 표시할 수 있어야 한다.

### 표와 수량 {#building-exterior-schedules-quantities}

Building, storey, mass, facade region, opening, material layer, panel, roof, exterior space, service port, equipment와 attachment의 count, area, length, volume, mass 또는 declared property와 waste를 unit, boundary, phase, alternative, representation, exact·approximate basis, rounding와 exclusions와 함께 제공해야 한다. Resolved opening cut, void, pattern exception와 seeded instance를 반영하고 proxy detail을 exact fabrication quantity로 제시하지 않아야 한다.

### Exterior-only Evidence {#building-exterior-only-evidence}

Exterior-only set는 interior가 없음을 명시하면서 authored face, backside·edge, support, placement, representation, valid camera region·distance, reflection·shadow consumer와 render 범위에 대한 evidence를 제공할 수 있어야 한다. Scope 밖의 interior, hidden structure와 site condition을 검증한 것으로 표시하지 않아야 한다.

### Capture Provenance {#building-exterior-capture-provenance}

Render와 capture는 source revision, building, camera, time, map context, weather, phase, alternative, representation, visible set scope와 current dependency digest를 기록해야 한다.

### 산출물 Freshness {#building-exterior-deliverable-freshness}

Exterior, linked interior, map placement, external asset, phase나 representation source가 바뀌면 affected drawing, schedule, quantity, analysis, render와 review를 stale로 표시해야 한다. 서로 다른 stale 결과 중 하나를 임의로 정본으로 고르지 않고 재생성, unsupported 또는 not-run 상태를 보고해야 한다.

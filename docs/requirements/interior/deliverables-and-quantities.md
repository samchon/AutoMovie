# 산출물과 수량

## 동일한 Interior에서 나온 자료 {#interior-deliverables-quantities}

Plan, reflected ceiling plan, elevation, section, finish plan, furniture layout, lighting plan, service plan, detail, schedule, quantity, render와 guide pass는 같은 space, element, phase와 resolved state를 읽어야 한다.

### Drawing View {#interior-drawing-views}

각 view는 cut plane, direction, extent, scale, level, hidden·overhead convention, annotation와 included state를 선언하여 3D source와 관계를 추적할 수 있어야 한다.

### Schedule {#interior-schedules}

Room, door, window, finish, furniture, fixture, equipment, light와 service terminal schedule은 stable identity, type, count, location, state와 relevant property를 제공해야 한다.

### Quantity와 Waste {#interior-quantities-waste}

Area, length, volume, count, module, cut, package와 waste를 source geometry, unit, scope, rounding와 exclusions와 함께 산출해야 한다.

### Capture Provenance {#interior-capture-provenance}

Render와 capture는 source revision, building, storey, space, camera, time, light, phase, alternative와 current state를 기록해야 한다.

### 산출물 정합 {#interior-deliverable-consistency}

Drawing, schedule, quantity와 render가 서로 다른 stale state를 사용하면 하나를 정본으로 임의 선택하지 않고 dependency와 freshness failure를 보고해야 한다.

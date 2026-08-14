# 산출물과 수량

## 동일한 Interior에서 나온 자료 {#interior-deliverables-quantities}

Plan, reflected ceiling plan, elevation, section, finish plan, furniture layout, lighting plan, service plan, detail, schedule, quantity, render와 guide pass는 같은 space, element, phase와 resolved state를 읽어야 한다.

### Drawing View {#interior-drawing-views}

각 view는 cut plane, direction, extent, scale, level, hidden·overhead convention, annotation와 included state를 선언하여 3D source와 관계를 추적할 수 있어야 한다.

Dimension과 annotation은 표시 문자열이 아니라 측정 대상, 기준 point·line·surface, 방향, 실제 값, unit, precision, rounding와 tolerance를 가져야 한다. Source가 바뀌면 다시 계산하거나 stale로 표시하고 수동 문자로 정본과의 차이를 숨기지 않아야 한다.

### Schedule {#interior-schedules}

Room, door, window, finish, furniture, fixture, equipment, light와 service terminal schedule은 stable identity, type, count, location, state와 relevant property를 제공해야 한다.

Room schedule의 location은 선언된 cell과 실제 content extent를 함께 제공하고 둘을 같은 값으로 합치지 않아야 한다. Zone에 무엇이 있는지는 element와 population이 선언한 space membership으로 답해야 하며 id 이름 매칭이나 model 옆의 별도 목록으로 대체하지 않아야 한다. Schedule이 다루지 못하는 subject, 측정하지 못한 extent와 아직 산출하지 않은 location은 빈 값이나 0이 아니라 gap으로 남겨야 한다.

### Quantity와 Waste {#interior-quantities-waste}

Area, length, volume, count, module, cut, package와 waste를 source geometry, unit, scope, rounding와 exclusions와 함께 산출해야 한다.

Net과 gross area, nominal과 resolved seeded layout, full과 cut module, actual waste와 allowance를 구분해야 한다. 누락된 material property, unresolved pattern 또는 invalid geometry 때문에 계산하지 못한 항목을 수량 0으로 표시하지 않아야 한다.

### Capture Provenance {#interior-capture-provenance}

Render와 capture는 source revision, building, storey, space, camera, time, light, phase, alternative와 current state를 기록해야 한다.

### 산출물 정합 {#interior-deliverable-consistency}

Drawing, schedule, quantity와 render가 서로 다른 stale state를 사용하면 하나를 정본으로 임의 선택하지 않고 dependency와 freshness failure를 보고해야 한다.

각 산출물은 source identity와 revision, 생성 조건, dependency digest, 생성 시각과 사용한 profile을 다시 찾을 수 있어야 한다. AutoMovie의 source-native project와 현재 render·drawing 산출물은 전달할 수 있지만, 이를 수정 가능한 glTF·USD·Alembic scene export가 제공된다는 약속으로 확대하지 않아야 한다.

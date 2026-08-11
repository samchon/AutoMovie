# Terrain과 Route

## 실제 Surface 위의 Formation {#formation-terrain-routes}

각 member의 position, ground contact와 slope는 map terrain, interior floor, stair 또는 declared traversable surface에서 sample되어야 한다.

### Group Path {#formation-group-path}

Formation origin 또는 unit path를 road, field, corridor, bridge, slope와 project-defined route에 연결하고 width, clearance, direction와 current state를 사용해야 한다.

### Relief Adaptation {#formation-relief-adaptation}

Member별 ground height와 normal을 적용하면서 formation shape와 upright rule을 유지하고 급경사, cliff, water와 gap을 단일 평균 elevation으로 숨기지 않아야 한다.

### Route Interior {#formation-route-interior}

Cue boundary뿐 아니라 이동과 reform interval 안의 member position을 검사하여 양 끝만 안전한 path를 통과시키지 않아야 한다.

### Terrain Refusal {#formation-terrain-refusal}

Surface 밖 slot, excessive slope, bridge width 초과, flooded route, disconnected path와 unsupported terrain sample을 거부해야 한다.

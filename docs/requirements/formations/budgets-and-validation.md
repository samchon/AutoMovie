# Budget와 검증

## 집단 규모의 명시적 Bound {#formation-budgets-validation}

Authored count, logical slot count, expanded member, visible model, animated rig, collider, neighbor pair, terrain sample, event, audio source와 evidence sample의 worst-case bound를 단계별로 계산하고 report해야 한다.

### Budget Policy 선택 {#formation-budget-policy-selection}

사용자와 저작 에이전트는 population과 shot마다 expand, instance, animate, collide, sample, proxy 또는 cull할 bound와 초과 시 fail, split, lower representation 또는 다른 authored response를 선택해야 하며 runtime이 규모를 몰래 줄이지 않아야 한다.

### Complexity와 Worst Case {#formation-complexity-worst-case}

Nested layout expansion, neighbor search, route와 terrain sample, constraint, reform, avoidance와 evidence의 complexity를 population과 hierarchy depth에 대한 finite upper bound로 보여 주고 평균 장면만으로 budget을 통과시키지 않아야 한다.

### Geometry와 Layout {#formation-layout-validation}

Slot uniqueness, extent, spacing, group transform, prototype bounds, terrain contact와 route relation을 같은 resolved member positions에서 검증해야 한다.

### Resolution별 Validation {#formation-resolution-validation}

Logical population, expanded geometry, selected proxy와 visible result를 구분하여 identity, count, extent, silhouette, contact와 story event 중 각 resolution이 보존해야 할 조건을 검증해야 한다.

### Motion과 Event {#formation-motion-validation}

Group path, turn, reform, member motion, hero override와 semantic event가 fixed clock에서 같은 state를 읽고 시작·내부·종료 sample을 통과해야 한다.

### Determinism {#formation-determinism}

같은 source와 version, seed, count, layout, hierarchy, route, resolution policy와 cue에서 enumeration, seek order와 platform에 관계없이 같은 member identity, transform, event와 digest를 만들어야 한다.

### Failure 상태 {#formation-failure-status}

Budget exceeded, unsupported avoidance, invalid layout, overlap, terrain failure와 not-run visual review를 구분하고 member를 몰래 drop하여 성공으로 보고하지 않아야 한다.

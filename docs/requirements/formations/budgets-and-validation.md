# Budget와 검증

## 집단 규모의 명시적 Bound {#formation-budgets-validation}

Authored count, expanded member, visible model, animated rig, collider, neighbor pair, terrain sample, event와 evidence sample의 worst-case bound를 계산하고 report해야 한다.

### Geometry와 Layout {#formation-layout-validation}

Slot uniqueness, extent, spacing, group transform, prototype bounds, terrain contact와 route relation을 같은 resolved member positions에서 검증해야 한다.

### Motion과 Event {#formation-motion-validation}

Group path, turn, reform, member motion, hero override와 semantic event가 fixed clock에서 같은 state를 읽고 시작·내부·종료 sample을 통과해야 한다.

### Determinism {#formation-determinism}

같은 seed, count, layout, source와 cue에서 enumeration, seek order와 platform에 관계없이 같은 member identity, transform와 digest를 만들어야 한다.

### Failure 상태 {#formation-failure-status}

Budget exceeded, unsupported avoidance, invalid layout, overlap, terrain failure와 not-run visual review를 구분하고 member를 몰래 drop하여 성공으로 보고하지 않아야 한다.

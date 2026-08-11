# Secondary Motion

## Primary Action에 종속된 Bounded 변화 {#motion-secondary-motion}

Spring, sway, cloth, hair proxy, foliage, hanging prop, recoil와 follow-through를 primary motion, anchor, material, collider와 fixed clock에 연결할 수 있어야 한다.

### Author와 Solver 책임 {#motion-secondary-author-solver}

사용자는 rest state, anchor, stiffness 또는 authored control, budget와 required interaction을 선언하고 solver는 그 범위 밖 물리 사실을 추정하지 않아야 한다.

### Moving Boundary {#motion-secondary-moving-boundary}

Actor bone, object joint와 platform에 붙은 anchor와 collider는 각 fixed-step boundary에서 primary performance와 같은 sample을 읽어야 한다.

### Legacy Static Path {#motion-secondary-static-compatibility}

Moving boundary를 사용하지 않는 기존 static secondary motion은 새 경로 때문에 state, byte와 arithmetic order가 바뀌지 않아야 한다.

### Simulation Claim 경계 {#motion-secondary-claim-boundary}

Bounded visual dynamics, collision proxy와 production-grade cloth, hair, destruction 또는 fluid fidelity를 구분하고 수행하지 않은 수준을 주장하지 않아야 한다.

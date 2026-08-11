# Secondary Motion

## Primary Action에 종속된 Bounded 변화 {#motion-secondary-motion}

Spring, sway, cloth, hair proxy, foliage, hanging prop, recoil와 follow-through를 primary motion, anchor, material, collider와 fixed clock에 연결할 수 있어야 한다.

### Author와 Solver 책임 {#motion-secondary-author-solver}

사용자는 rest state, anchor, stiffness 또는 authored control, budget와 required interaction을 선언하고 solver는 그 범위 밖 물리 사실을 추정하지 않아야 한다.

### 사용 여부와 Bake 선택 {#motion-secondary-adoption-choice}

사용자와 저작 에이전트는 secondary motion을 authored channel, deterministic runtime solve, imported bake 또는 omission 중에서 선택하고, solver availability나 render tier가 선택을 몰래 바꾸지 않게 해야 한다.

### Moving Boundary {#motion-secondary-moving-boundary}

Actor bone, object joint와 platform에 붙은 anchor와 collider는 각 fixed-step boundary에서 primary performance와 같은 sample을 읽어야 한다.

### Legacy Static Path {#motion-secondary-static-compatibility}

Moving boundary를 사용하지 않는 기존 static secondary motion은 새 경로 때문에 state, byte와 arithmetic order가 바뀌지 않아야 한다.

### Simulation Claim 경계 {#motion-secondary-claim-boundary}

Bounded visual dynamics, collision proxy와 production-grade cloth, detailed hair, destruction 또는 fluid fidelity를 구분하고 수행하지 않은 수준을 주장하지 않아야 한다. Actor의 crude proxy 경계는 coarse secondary cue를 허용하지만 사실적인 외형을 직접 생성한다는 약속으로 넓어지지 않는다.

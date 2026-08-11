# Fluid와 Water

## Bounded Domain의 액체 State {#effects-fluids-water}

Standing volume, free surface, stream, pour, spray, waterfall, wave, ripple, wake, leak와 project-defined liquid behavior를 container 또는 world domain, source, sink, level와 time state로 표현할 수 있어야 한다.

### 수량과 Boundary {#effects-fluid-volume-boundary}

Initial volume, inflow, outflow, storage, overflow, shoreline, bank, container와 drain을 실제 단위로 연결하고 screen plane만으로 mass balance를 대신하지 않아야 한다.

### Conservation Account {#effects-fluid-conservation-account}

Bounded solver가 volume 또는 mass conservation을 주장한다면 initial quantity, cumulative source와 sink, retained quantity, out-of-domain loss와 numeric tolerance를 같은 단위로 보고해야 한다. Authored surface와 particle spray는 보존 계산에 참여하는지 명시해야 한다.

### Surface와 Flow Tier {#effects-fluid-surface-flow-tier}

Authored surface, analytic wave, particle spray, bounded solver와 external cache를 구분하고 수행한 tier의 interaction과 evidence만 주장해야 한다.

### Moving Object Interaction {#effects-fluid-object-interaction}

Actor, boat, prop, terrain와 container의 contact, displacement, wake와 wetness를 지원 범위에서 같은 fixed clock과 geometry로 연결할 수 있어야 한다.

### Fluid Seek State {#effects-fluid-seek-state}

Wave phase, source accumulation, moving boundary, displaced volume와 wetness consequence는 arbitrary seek에서 declared initial state 또는 검증된 cache로 재생성되고 이전 재생 방향이나 chunk 경계에 의존하지 않아야 한다.

### Fluid Refusal {#effects-fluid-refusal}

Negative depth, source 없는 volume 증가, boundary 밖 initial state, invalid flow direction, mass violation와 unbounded domain을 거부해야 한다.

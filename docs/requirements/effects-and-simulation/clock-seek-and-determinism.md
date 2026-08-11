# Clock, Seek와 Determinism

## Fixed-step Effect Evaluation {#effects-clock-seek-determinism}

Simulation과 procedural effect는 declared time step, sample boundary, initial state, authored order와 stable seed를 사용하여 같은 time에 같은 state를 만들어야 한다.

### Step Boundary {#effects-step-boundary}

State step와 driver sample time의 관계를 명시하고 moving anchor, collider, emitter와 environment가 같은 boundary time을 읽어야 한다.

### Arbitrary Seek {#effects-arbitrary-seek}

순차 재생, 임의 seek, 반복 seek와 fresh evaluation이 같은 result를 내고 숨은 previous-frame state가 truth를 바꾸지 않아야 한다.

### Cache Identity {#effects-cache-identity}

Cache를 사용하는 경우 source, solver version, parameters, clock, initial state와 result digest를 identity에 포함하고 stale cache를 자동 재사용하지 않아야 한다.

### Platform Determinism {#effects-platform-determinism}

Iteration, comparison, reduction, random sequence, float serialization와 output order를 고정하고 platform 차이가 artifact identity를 바꾸면 명시적으로 보고해야 한다.

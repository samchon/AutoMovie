# 범위와 Simulation Tier

## 저작 가능한 Bounded Effect {#effects-scope-simulation-tiers}

Effect는 stable identity, source event, spatial domain, start·end time, initial state, controls, interaction subset, budget와 expected observable result를 가져야 한다.

### Authored와 Solved {#effects-authored-solved}

직접 저작된 animation, procedural effect, bounded solver와 external cached result를 구분하고 어느 state가 author input이고 어느 값이 derived인지 추적해야 한다.

### 저작 Control {#effects-authoring-control}

사용자와 저작 에이전트는 effect의 tier, source, rule, parameter, seed, domain과 observable consequence를 선택할 수 있어야 하며 AutoMovie가 미신고 preset, 공급자 또는 품질 tier를 대신 선택하지 않아야 한다.

### Tier 선언 {#effects-simulation-tier}

Guide-only, deterministic approximation, bounded simulation, external result와 unsupported production-grade analysis를 구분하여 한 tier의 성공을 다른 tier로 확대하지 않아야 한다.

### Story Binding {#effects-story-binding}

Effect는 explosion, impact, rain, spill, cloth motion와 같은 semantic event와 consequence에 연결되고 장식적 preset가 사건 timing을 결정하지 않아야 한다.

### Scope Refusal {#effects-scope-refusal}

Domain, duration, population, step와 interaction bound가 없는 effect를 무한 world simulation으로 실행하지 않아야 한다.

### Prototype Fidelity 경계 {#effects-prototype-fidelity-boundary}

Effect 결과는 사건의 위치, 방향, 규모, 접촉, 변화와 timing을 판단할 수 있는 blocking evidence여야 한다. Photoreal volumetric detail, engineering accuracy, hazard prediction과 production-grade material behavior는 별도 검증 없이 성공 조건이 아니다.

### External Provider Neutrality {#effects-external-provider-neutrality}

사용자는 자신이 선택한 simulation, generation 또는 cache 제작 도구의 결과를 채택할 수 있어야 하며 특정 provider, solver 또는 remote service가 필수값이나 묵시적 기본값이 되어서는 안 된다. 채택 결과는 provider가 아니라 고정된 bytes, format, units, clock, parameters, digest와 provenance로 소비해야 한다.

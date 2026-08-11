# 범위와 Simulation Tier

## 저작 가능한 Bounded Effect {#effects-scope-simulation-tiers}

Effect는 stable identity, source event, spatial domain, start·end time, initial state, controls, interaction subset, budget와 expected observable result를 가져야 한다.

### Authored와 Solved {#effects-authored-solved}

직접 저작된 animation, procedural effect, bounded solver와 external cached result를 구분하고 어느 state가 author input이고 어느 값이 derived인지 추적해야 한다.

### Tier 선언 {#effects-simulation-tier}

Guide-only, deterministic approximation, bounded simulation, external result와 unsupported production-grade analysis를 구분하여 한 tier의 성공을 다른 tier로 확대하지 않아야 한다.

### Story Binding {#effects-story-binding}

Effect는 explosion, impact, rain, spill, cloth motion와 같은 semantic event와 consequence에 연결되고 장식적 preset가 사건 timing을 결정하지 않아야 한다.

### Scope Refusal {#effects-scope-refusal}

Domain, duration, population, step와 interaction bound가 없는 effect를 무한 world simulation으로 실행하지 않아야 한다.

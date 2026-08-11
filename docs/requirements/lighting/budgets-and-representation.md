# Budget와 Representation

## Bounded Light Population {#lighting-budgets-representation}

Authored light, active light, shadow caster, probe, environment, filter, sample와 render-pass contribution의 worst-case bound를 선언하고 report해야 한다.

### Prototype과 Instance {#lighting-prototype-instances}

Street light, ceiling fixture, window와 repeated practical을 prototype과 instance로 구성하면서 transform, state, variation와 story-relevant exception을 유지해야 한다.

### Representation Tier {#lighting-representation-tier}

Distant emissive, local non-shadow light, shadowed hero light, baked-like authored field와 full supported source를 목적에 따라 선택하고 approximation을 명시해야 한다.

### Culling과 영향 범위 {#lighting-culling-influence}

Distance, region, portal, linking와 influence bounds로 계산 범위를 줄일 수 있으나 reflection, shadow와 off-screen story source를 단순 frame 밖이라고 제거하지 않아야 한다.

### Budget Refusal {#lighting-budget-refusal}

초과 light를 nondeterministic order로 drop하거나 shadow를 몰래 끄지 않고 affected source와 budget을 diagnostic으로 보고해야 한다.

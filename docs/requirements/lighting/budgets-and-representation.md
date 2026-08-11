# Budget와 Representation

## Bounded Light Population {#lighting-budgets-representation}

Authored light, active light, shadow caster, probe, environment, filter, sample와 render-pass contribution의 worst-case bound를 선언하고 report해야 한다.

### Cost Model {#lighting-budget-cost-model}

Source kind, shadow map 또는 analytic shadow, reflection update, transmission, filter, link target, temporal sample와 output pass가 소비하는 bounded cost와 counting scope를 구분하여 light count 하나로 전체 비용을 대신하지 않아야 한다.

### Prototype과 Instance {#lighting-prototype-instances}

Street light, ceiling fixture, window와 repeated practical을 prototype과 instance로 구성하면서 transform, state, variation와 story-relevant exception을 유지해야 한다.

### Representation Tier {#lighting-representation-tier}

Distant emissive, local non-shadow light, shadowed hero light, baked-like authored field와 full supported source를 목적에 따라 선택하고 approximation을 명시해야 한다.

### Story Quality Floor {#lighting-budget-quality-floor}

Budget tier는 필수 subject readability, motivated practical, story shadow·reflection, continuity와 analysis acceptance 중 보존할 항목을 선언하고 비용 초과를 이유로 핵심 delivery를 조용히 낮추지 않아야 한다.

### Culling과 영향 범위 {#lighting-culling-influence}

Distance, region, portal, linking와 influence bounds로 계산 범위를 줄일 수 있으나 reflection, shadow와 off-screen story source를 단순 frame 밖이라고 제거하지 않아야 한다.

### Deterministic Selection {#lighting-budget-deterministic-selection}

Active source, shadow caster, probe, reflection와 sample selection은 stable identity와 declared priority로 결정되고 traversal order, thread completion와 이전 frame visibility에 따라 달라지지 않아야 한다.

### Budget Validation {#lighting-budget-validation}

Budget report는 scene·shot·take, design revision, geometry revision, film interval, worst sample, requested·active·culled·refused population과 approximation을 식별하고 실제 render 조건과 대조할 수 있어야 한다.

### Budget Refusal {#lighting-budget-refusal}

초과 light를 nondeterministic order로 drop하거나 shadow를 몰래 끄지 않고 affected source와 budget을 diagnostic으로 보고해야 한다.

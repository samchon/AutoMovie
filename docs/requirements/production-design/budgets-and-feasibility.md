# Budget와 제작 가능성

## 저작 전에 보이는 Production Bound {#production-design-budgets-feasibility}

Subject count, unique model, instance, triangle, material, texture memory, light, collider, simulation, frame, render time와 output storage의 최대 범위를 project가 선언하고 report할 수 있어야 한다.

### Story와 Budget의 연결 {#production-design-story-budget}

Budget 절감은 어떤 scene, event, hero, camera distance와 acceptance에 영향을 주는지 추적되어야 하며 핵심 story promise를 조용히 제거하지 않아야 한다.

### 대체 Representation {#production-design-budget-representation}

Instance, LOD, proxy, culling, reuse와 bounded variation을 선택할 수 있으나 목적별 identity, silhouette, interaction와 evidence를 유지해야 한다.

### Worst-case 보고 {#production-design-worst-case-budget}

Average만이 아니라 한 shot과 한 frame에서의 worst-case visible, sampled, collidable, simulated와 rendered population을 계산하고 숨은 expansion을 포함해야 한다.

### 초과의 거부 {#production-design-budget-refusal}

Budget을 넘는 plan은 runtime degradation이나 무작위 누락으로 진행하지 않고 어느 owner와 scope가 초과했는지 deterministic diagnostic으로 거부해야 한다.

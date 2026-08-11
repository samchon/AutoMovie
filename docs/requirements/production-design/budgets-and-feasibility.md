# Budget와 제작 가능성

## 저작 전에 보이는 Production Bound {#production-design-budgets-feasibility}

Subject count, unique model, instance, triangle, material, texture memory, light, collider, simulation, frame, render time와 output storage의 최대 범위를 project가 선언하고 report할 수 있어야 한다.

Budget은 target deliverable 또는 tier, unit, inclusive limit, measurement basis, safety margin, owner와 적용 scope를 가질 수 있어야 한다. 현재 scene 비용에서 limit를 자동 산출하여 모든 회귀를 통과시키지 않아야 한다.

### Story와 Budget의 연결 {#production-design-story-budget}

Budget 절감은 어떤 scene, event, hero, camera distance와 acceptance에 영향을 주는지 추적되어야 하며 핵심 story promise를 조용히 제거하지 않아야 한다.

Budget 초과를 해결하는 scope, representation, shot, asset 또는 delivery 변경은 선택지와 consequence로 제시되어야 한다. 시스템이 중요도를 추측해 subject나 frame을 임의로 누락하지 않아야 한다.

### 대체 Representation {#production-design-budget-representation}

Instance, LOD, proxy, culling, reuse와 bounded variation을 선택할 수 있으나 목적별 identity, silhouette, interaction와 evidence를 유지해야 한다.

대체 전후의 cost, preserved capability, lost detail, transition distance, hero exception와 review requirement를 비교할 수 있어야 한다. Culling과 proxy가 보이지 않아야 할 것을 숨기는지 current view에서 검토해야 한다.

### Worst-case 보고 {#production-design-worst-case-budget}

Average만이 아니라 한 shot과 한 frame에서의 worst-case visible, sampled, collidable, simulated와 rendered population을 계산하고 숨은 expansion을 포함해야 한다.

Worst case는 해당 scene, frame 또는 interval, camera, active state, representation tier와 계산에 포함하거나 제외한 범위를 식별할 수 있어야 한다. Upper bound와 실제 측정값을 같은 숫자처럼 제시하지 않아야 한다.

### 초과의 거부 {#production-design-budget-refusal}

Budget을 넘는 plan은 runtime degradation이나 무작위 누락으로 진행하지 않고 어느 owner와 scope가 초과했는지 deterministic diagnostic으로 거부해야 한다.

### 제작 자원과 일정 Budget {#production-design-resource-schedule-budget}

Project는 unique asset, external license, authoring, conversion, review, capture, render와 revision에 필요한 비용 또는 effort와 milestone을 계획할 수 있어야 한다. 금액이나 작업 시간이 알려지지 않은 항목은 zero가 아니라 estimate, unknown 또는 not-run으로 표시해야 한다.

### 측정, 추정과 미지원 {#production-design-budget-measurement-status}

Budget report는 exact, measured, estimated, upper-bound, unsupported와 not-run을 구분하고 각 값의 source와 freshness를 보여야 한다. 입력을 제공하지 않은 texture cost나 분석하지 못한 simulation cost를 zero 또는 within으로 계산하지 않아야 한다.

### Aggregate와 Shared Cost {#production-design-budget-shared-cost}

여러 scene이 공유하는 asset, cache, model, texture와 one-time authoring cost를 중복 합산하지 않으면서 각 scene의 active runtime cost는 별도로 보고할 수 있어야 한다. 공유됐다는 이유로 peak memory와 simultaneous draw cost를 제거하지 않아야 한다.

### Budget Variant 비교 {#production-design-budget-variant-comparison}

서로 다른 design, asset sourcing, fidelity와 delivery variant의 cost와 story consequence를 같은 measurement basis에서 비교할 수 있어야 한다. 측정 범위가 다른 두 report를 순위로 제시하지 않아야 한다.

### Budget Freshness {#production-design-budget-freshness}

Design, asset, renderer setting, population, simulation 또는 delivery 변경 뒤 이전 report는 stale로 표시되어야 한다. 동일한 target fingerprint를 다시 측정한 결과만 current evidence가 될 수 있어야 한다.

### Feasibility 승인 {#production-design-feasibility-approval}

Production은 required scope가 declared budget 안에 있고 unsupported 또는 not-run 필수 cost가 없거나 승인된 risk로 기록되었을 때만 feasible로 판정해야 한다. Runtime이 우연히 한 번 끝났다는 사실을 전체 제작 가능성의 증거로 사용하지 않아야 한다.

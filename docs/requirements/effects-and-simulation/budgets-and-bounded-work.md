# Budget와 Bounded Work

## 모든 비싼 Effect의 상한 {#effects-budgets-bounded-work}

Domain, particle, constraint, collider, pair test, step, emitter, voxel-like cell, sample, cache와 output geometry의 worst-case bound를 계산하고 report해야 한다.

### Budget Identity {#effects-budget-identity}

Budget은 effect identity, simulation tier, clock, domain, population, interaction set와 output tier에 묶여야 하며 parameter나 resolved geometry가 바뀌면 이전 판정을 current로 재사용하지 않아야 한다.

### Per-frame와 Per-shot {#effects-per-frame-shot-budget}

한 frame의 active work, shot 전체의 step·spawn·collision work와 retained state를 구분하여 짧은 peak와 긴 누적 비용을 모두 보이게 해야 한다.

### Population Composition {#effects-budget-composition}

Formation, actor, prop, environment와 여러 effect가 같은 shot에 있을 때 개별 budget뿐 아니라 combined worst case를 계산할 수 있어야 한다.

### External Cache Bound {#effects-external-cache-bound}

External simulation cache의 frame, channel, point, compressed·expanded bytes와 decode time을 제한하고 file size만으로 memory bound를 추정하지 않아야 한다.

### Admission Before Execution {#effects-budget-admission}

실행 전에 declared limit와 계산된 worst case를 비교하고, 계산할 수 없는 항목은 within-budget이 아니라 incomplete 또는 not-run으로 표시해야 한다. 실행 중 peak가 계획을 넘으면 partial result와 마지막 완전 state를 식별하고 partial result를 완전한 simulation으로 사용하지 않아야 한다.

### Budget Refusal {#effects-budget-refusal}

초과 work를 particle drop, step 감소와 solver disable로 몰래 통과시키지 않고 affected effect, computed cost와 limit를 보고해야 한다.

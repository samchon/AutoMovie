# Render Budget

## Frame와 Film의 Worst-case Cost {#rendering-budgets}

Draw call, triangle, vertex, instance, skin joint, morph, material, texture bytes, light, shadow, effect, render target, pass, frame와 output bytes의 worst-case bound를 계산하고 report해야 한다.

### Geometry와 Memory {#rendering-geometry-memory-budget}

Source와 expanded geometry, GPU-like buffer, decoded texture, intermediate target와 retained cache를 구분하여 compressed file size를 runtime memory로 사용하지 않아야 한다.

### Per-frame와 Total {#rendering-frame-total-budget}

한 frame의 peak, chunk의 retained resource, film 전체 frame·pass·encode work와 output storage를 별도 계산해야 한다.

### Purpose별 Tier {#rendering-budget-tiers}

Preview, proxy, evidence, beauty와 final delivery의 resolution, pass, representation와 budget profile을 구분하고 낮은 tier 결과를 높은 tier 검증으로 사용하지 않아야 한다.

### Budget Refusal {#rendering-budget-refusal}

초과 resource를 nondeterministic culling, texture downscale, pass skip와 frame drop으로 몰래 해결하지 않고 exact cost와 limit를 보고해야 한다.

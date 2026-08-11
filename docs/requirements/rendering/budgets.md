# Render Budget

## Frame과 Film의 Worst-case Cost {#rendering-budgets}

Draw submission, triangle, vertex, instance, skin joint, morph, material, decoded texture bytes, light, shadow, effect, render target, pass, frame, encoded bytes와 wall-time-like limit의 worst-case bound를 plan 전에 계산하거나 안전하게 상한화해야 한다. Estimate와 measured actual을 구분해야 한다.

### Geometry와 Memory {#rendering-geometry-memory-budget}

Source bytes, expanded geometry, vertex와 index buffer, decoded texture, acceleration-like data, intermediate target와 retained cache를 별도 항목으로 계산해야 한다. Compressed file size를 runtime peak memory로 사용하거나 shared resource를 매 frame마다 중복 계산해서는 안 된다.

### Per-frame와 Total {#rendering-frame-total-budget}

한 frame의 peak, 한 chunk의 retained resources, concurrent products, 전체 film의 frame-pass work, encode work와 output storage를 구분해야 한다. Average cost가 peak limit을 숨기지 않도록 worst frame과 contributor를 보고해야 한다.

### Purpose별 Tier {#rendering-budget-tiers}

Preview, proxy, evidence, blocking beauty와 final delivery-like project profile은 dimensions, samples, pass, representation과 allowed resources를 각각 선언해야 한다. 낮은 tier의 성공을 높은 tier 검증으로 사용하거나 profile 이름만으로 quality를 추정해서는 안 된다.

### Expansion Bound {#rendering-expansion-bounds}

Instancing, procedural geometry, formations, particles-like bounded effects, image sequences와 archive-like inputs은 materialize되기 전 최대 확장량을 검증해야 한다. Unknown 또는 unbounded count는 실행 중 메모리가 바닥날 때까지 허용해서는 안 된다.

### Budget Decision {#rendering-budget-decision}

Budget evaluation은 limit, estimated value, confidence 또는 exactness, dominant contributors와 requested product를 기록해야 한다. 사용자가 승인한 다른 profile로 다시 계획할 수는 있지만 원 요청을 바꾼 결과를 같은 render 성공으로 보고해서는 안 된다.

### Runtime Enforcement {#rendering-runtime-budget-enforcement}

Plan 후 실제 사용량이 bound를 넘으면 안전한 checkpoint에서 중단하고 완료된 atomic chunks와 measurement를 보존해야 한다. Frame drop, nondeterministic culling, texture downscale, pass skip 또는 quality 변경으로 몰래 계속해서는 안 된다.

### Budget Refusal {#rendering-budget-refusal}

Declared limit 초과, 계산 불가능한 required resource, arithmetic overflow와 profile에 없는 degradation은 실행 전에 거절해야 한다. Diagnostic은 exact 또는 conservative cost, limit, affected product와 더 작은 명시적 재요청에 필요한 사실을 제공해야 한다.

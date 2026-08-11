# Environment Coupling

## 같은 World State를 읽는 Effect {#effects-environment-coupling}

Effect는 terrain, water, building, interior, weather, light, sound, actor와 object의 resolved geometry와 time state를 필요한 범위에서 참조해야 한다.

### Wind와 Gravity-like Input {#effects-wind-gravity-input}

Wind field, gravity direction, reference speed와 region state를 authored input으로 받고 location name에서 임의 값을 생성하지 않아야 한다.

### Surface Consequence {#effects-surface-consequence}

Rain, snow, smoke, fire, impact와 fluid가 wetness, deposit, mark, damage, visibility와 sound에 만드는 supported consequence를 명시해야 한다.

### One-way와 Coupled Model {#effects-coupling-level}

Environment가 effect를 구동하는 one-way input, effect가 authored state를 바꾸는 consequence와 two-way solver를 구분하고 실제 수행한 수준만 주장해야 한다.

### Coupling Refusal {#effects-coupling-refusal}

Missing domain, stale geometry, incompatible clocks, circular dependency와 unsupported two-way interaction을 명시적으로 보고해야 한다.

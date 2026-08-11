# 검증과 Evidence

## Effect State와 관찰 결과의 검증 {#effects-validation-evidence}

Effect는 initial, critical interior, event와 final state에서 numeric invariants, geometry, interaction, budget, determinism와 rendered appearance를 검토해야 한다.

### Hand Math와 Boundary {#effects-hand-math-boundary}

Canonical trajectory, volume, step count, projection, anchor와 collision case를 손계산 가능한 값으로 대조하고 exact maximum의 positive와 one-past negative를 가져야 한다.

### Negative Twin {#effects-negative-twins}

Source 누락, reversed flow, missed collider, moving-boundary freeze, budget overrun, stale cache와 unsupported tier를 각각 의도한 failure로 검증해야 한다.

### Visual Review {#effects-visual-review}

Start, middle, event, end와 relevant camera에서 density, scale, contact, flow, deformation, lighting, occlusion와 story readability를 current viewer로 확인해야 한다.

### Evidence Status {#effects-evidence-status}

Solved, approximate, authored, failed, unsupported와 not-run을 구분하고 numeric state만으로 visual success를, beauty frame만으로 physical success를 주장하지 않아야 한다.

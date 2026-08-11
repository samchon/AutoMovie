# 검증과 Evidence

## Effect State와 관찰 결과의 검증 {#effects-validation-evidence}

Effect는 initial, critical interior, event와 final state에서 numeric invariants, geometry, interaction, budget, determinism와 rendered appearance를 검토해야 한다.

### Evidence Identity와 Freshness {#effects-evidence-identity-freshness}

Evidence는 effect, source event, world revision, tier, parameters, seed, clock, initial state, external bytes와 viewer artifact의 identity를 가져야 하며 하나라도 바뀌면 이전 numeric 또는 visual result를 current로 재사용하지 않아야 한다.

### Hand Math와 Boundary {#effects-hand-math-boundary}

Canonical trajectory, volume, step count, projection, anchor와 collision case를 손계산 가능한 값으로 대조하고 exact maximum의 positive와 one-past negative를 가져야 한다.

### Negative Twin {#effects-negative-twins}

Source 누락, reversed flow, missed collider, moving-boundary freeze, budget overrun, stale cache와 unsupported tier를 각각 의도한 failure로 검증해야 한다.

### Seek Equivalence Evidence {#effects-seek-equivalence-evidence}

같은 target time을 sequential playback, fresh evaluation, forward·backward seek, repeated seek와 서로 다른 chunk boundary에서 평가하여 state digest, semantic event와 observable frame이 허용 tolerance 안에서 일치함을 검증해야 한다.

### Visual Review {#effects-visual-review}

Start, middle, event, end와 relevant camera에서 density, scale, contact, flow, deformation, lighting, occlusion와 story readability를 current viewer로 확인해야 한다.

### Evidence Status {#effects-evidence-status}

Solved, approximate, authored, failed, unsupported와 not-run을 구분하고 numeric state만으로 visual success를, beauty frame만으로 physical success를 주장하지 않아야 한다.

### External Result Evidence {#effects-external-result-evidence}

External result는 provider 응답의 존재가 아니라 채택한 bytes, decoder, mapping, units, clock, source와 result digest, validation range와 consumer를 증명해야 한다. Credential, mutable URL와 provider label은 repeatable evidence를 대신하지 않는다.

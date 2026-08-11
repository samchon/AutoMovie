# Rendition Identity와 Provenance

## 하나의 Output마다 새로운 Identity {#repaint-identity-provenance}

Rendition은 source frame digest, provider, model과 exact version, execution boundary, prompt, seed, controls, references, terms, output bytes와 digest를 포함한 identity를 가져야 한다.

### Derivation Chain {#repaint-derivation-chain}

Deterministic source, uploaded or transformed input, provider request, raw result, processing, selected output와 published rendition의 derivation을 추적해야 한다.

### Nondeterminism 기록 {#repaint-nondeterminism-record}

같은 seed와 prompt라도 provider implementation, scheduler, model, reference processing와 service state가 달라질 수 있으므로 reproducibility를 보장한다고 주장하지 않아야 한다.

### Source Review Freshness {#repaint-source-review-freshness}

Repaint output 변경은 rendition, sequence와 film review를 stale로 만들지만 unchanged deterministic source review와 identity를 바꾸지 않아야 한다.

### Provenance Refusal {#repaint-provenance-refusal}

Missing model version, prompt, source digest, output digest, terms와 execution boundary를 가진 result를 current rendition으로 승인하지 않아야 한다.

# Marker, Effect와 Metadata

## Timeline에 붙는 Annotation과 Presentation {#editorial-markers-effects-metadata}

Story beat, semantic event, review point, chapter, caption cue, music marker, issue와 delivery note는 stable identity, point 또는 time range, category, target relation과 authored text를 가져야 한다. Timeline revision이 바뀌어도 target을 추적할 수 있어야 하며 모호한 절대 시각만 남겨서는 안 된다.

### Marker와 Event {#editorial-marker-event-distinction}

Marker는 source event를 참조하거나 편집 의도를 기록할 수 있지만 actor 또는 world event 자체는 아니다. Clip placement가 이동할 때 source-relative marker의 film time은 따라가되 film-absolute review marker를 임의로 이동해서는 안 된다.

### Marker Scope {#editorial-marker-scope}

Timeline, composition, track, clip, source event와 output version에 붙은 marker를 구분해야 한다. Target이 삭제되거나 대체되면 marker를 새 대상을 향해 추측하여 옮기지 말고 dangling 또는 stale 상태로 보고해야 한다.

### Effect {#editorial-effects}

Supported speed, transform, opacity, color, title과 presentation effect는 parameter, order, time range, affected layer와 source relation을 가져야 한다. Effect 적용은 destructive overwrite가 아니어야 하며 disabled와 unsupported 상태를 구분해야 한다.

### Effect Ordering과 Boundary {#editorial-effect-ordering}

여러 effect가 겹칠 때 evaluation order, input과 output domain, boundary sample과 transition interaction을 고정해야 한다. 같은 우선순위가 다른 결과를 낼 수 있으면 나열 순서에 기대지 말고 충돌을 요구사항 위반으로 보고해야 한다.

### Metadata Provenance {#editorial-metadata-provenance}

Author, source revision, edit version, note, approval, external reference와 생성 시각 같은 provenance를 내용과 구분해 추적해야 한다. Free-form metadata는 검색과 설명에는 사용할 수 있지만 시간, effect 또는 승인 계약을 대신하는 executable field로 해석해서는 안 된다.

### Partial Annotation Result {#editorial-marker-partial-result}

알 수 없는 optional marker category는 보존하여 round-trip할 수 있지만 그 의미를 실행했다고 주장해서는 안 된다. Required review, chapter 또는 delivery marker를 해석할 수 없으면 해당 단계는 incomplete로 남겨야 한다.

### Metadata Refusal {#editorial-metadata-refusal}

Duplicate identity, dangling required target, out-of-range marker, unknown required effect, non-finite parameter, conflicting time transform과 stale approval은 거절해야 한다. 오류는 annotation을 삭제하지 않고 identity와 target을 포함한 canonical diagnostic으로 돌려줘야 한다.

# Marker, Effect와 Metadata

## Timeline에 놓인 의미 Annotation {#editorial-markers-effects-metadata}

Story beat, semantic event, review point, chapter, caption cue, music marker, issue와 delivery note를 identity, time range, color 또는 category와 target relation으로 표현할 수 있어야 한다.

### Marker와 Event {#editorial-marker-event-distinction}

Marker는 event를 참조하거나 편집 의도를 기록하지만 source event 자체가 아니며 marker 이동이 actor performance timing을 자동 변경하지 않아야 한다.

### Effect {#editorial-effects}

Speed, transform, opacity, color, title와 supported presentation effect를 parameter, order, range와 source relation으로 표현하고 destructive overwrite를 피해야 한다.

### Metadata Provenance {#editorial-metadata-provenance}

Author, source revision, edit version, note, approval와 external reference를 추적하고 free-form metadata를 contract field 대신 사용하지 않아야 한다.

### Metadata Refusal {#editorial-metadata-refusal}

Dangling target, out-of-range marker, unknown effect, conflicting time transform와 executable metadata를 거부해야 한다.

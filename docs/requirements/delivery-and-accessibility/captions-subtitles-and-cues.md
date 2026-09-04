# Caption, Subtitle과 Cue

## 시간과 화면 영역을 가지는 Text Alternative {#delivery-captions-subtitles-cues}

Caption 또는 subtitle cue는 stable identity, track role, language, start와 end, text, speaker 또는 sound role, source utterance나 event relation, region, line와 position 및 supported semantic styling을 가져야 한다. Cue timing은 selected edit revision에 연결되어야 한다.

### Caption과 Subtitle {#delivery-caption-subtitle-distinction}

Same-language dialogue caption, dialogue translation subtitle, non-speech sound description, speaker identification, song content, chapter와 metadata cue를 구분해야 한다. 서로 다른 목적을 하나의 text track으로 합쳐 required accessibility coverage를 모호하게 해서는 안 된다.

### Text와 Language Integrity {#delivery-cue-text-language}

Unicode text, language, writing direction, authored line break, emphasis-like semantic과 source relation을 보존해야 한다. CRLF와 CR은 LF presentation으로 canonicalize하고 legal tab은 보존하며, delivery format이 금지하는 control character는 명시적으로 sanitize하거나 거절해야 한다. Invalid encoding, missing glyph 또는 mixed-language cue를 replacement character나 unspecified language로 조용히 publish해서는 안 된다.

### Reading과 Overlap {#delivery-caption-reading-overlap}

Cue duration, text length, reading pace-like profile, overlap, shot cut, speaker change, rapid sequence와 on-screen text collision을 target language와 destination profile에서 검증해야 한다. 자동 timing 조정은 source event나 adjacent cue를 침범하면 별도 candidate revision이어야 한다.

### 가독성 Profile과 Measure-only 상태 {#delivery-caption-readability-profile}

Caption 가독성 profile은 algorithm과 revision, grapheme granularity 및 실제 실행에 참여한 requested·resolved locale 또는 명시적인 locale-neutral 상태를 포함한 complete versioned grapheme segmentation identity, 초당 grapheme 상한, cue당 line 수와 line당 길이 상한, 최소 cue duration과 cue 사이 최소 gap 및 경계값의 포함 여부를 target language별로 선언해야 한다. 측정은 실제 실행 identity를 항상 보고하고, profile의 complete identity와 정확히 일치할 때만 verdict를 계산해야 한다. 적용할 profile이 없거나 identity가 지원되지 않으면 실제 grapheme 수, reading rate, line, duration과 gap을 측정해 보고하되 pass 또는 fail verdict를 만들지 않아야 한다.

### Styling과 Safe Region {#delivery-caption-style-region}

Text color, background, alignment, supported vertical writing, region과 safe area는 readability와 user override 가능성을 표현해야 한다. Beauty composition의 임의 위치에만 의존하거나 text를 picture에 burn-in하여 selectable track 요구를 대신해서는 안 된다.

### Selectable과 Open Presentation {#delivery-caption-presentation-form}

Selectable embedded 또는 sidecar text와 picture에 포함된 open caption 또는 subtitle을 profile에서 구분해야 한다. Open presentation이 필요하면 최종 decoded picture에서 readability를 검토하고, selectable presentation이 필요하면 player가 track을 발견하고 켜고 끄며 올바른 language와 role로 표시할 수 있는지 검증해야 한다.

### Cue Mapping과 Freshness {#delivery-cue-freshness}

Edit trim, retime, shot reorder, dialogue replacement와 language revision이 바뀌면 영향받는 cue를 stale로 만들어야 한다. Unchanged cue를 재사용할 때는 source relation과 film time mapping이 여전히 일치함을 증명해야 한다.

### Coverage와 Gaps {#delivery-caption-coverage}

Required dialogue, meaningful non-speech sound와 speaker change가 cue set에서 covered, intentionally omitted 또는 unresolved인지 보고할 수 있어야 한다. Cue 수나 전체 duration만으로 coverage를 판단해서는 안 된다.

### Cue Refusal {#delivery-caption-refusal}

Reversed 또는 out-of-film time, missing language, duplicate identity, unreadable overlap, empty required text, unsupported glyph, source mismatch와 stale timing은 거절해야 한다. Valid cue subset은 보존할 수 있지만 complete text alternative로 publish해서는 안 된다.

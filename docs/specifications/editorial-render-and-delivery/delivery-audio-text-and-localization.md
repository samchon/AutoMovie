# Delivery audio, text와 localization

## Audio stream, channel과 loudness {#spec-delivery-audio-streams-group}

### Audio stream, channel과 loudness {#spec-delivery-audio-streams}

<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Audible output identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Channel layout semantics를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-mix-versions Mix version identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-downmix Downmix와 adaptation lineage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-loudness-profile Loudness target과 measurement를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-sample-boundary Sample-accurate start와 tail을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-silence Silence와 missing stream을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-refusal Invalid audio stream 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-stem-master-relation Delivery inventory가 stem과 master의 source relation을 보존한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-picture-delivery-join Final media에서 audio와 picture의 실제 join을 probe한다. -->

Audio product는 stable role, language, source mix revision, exact presentation start와 sample count, sample rate·format, channel count·order·labels, loudness target, peak policy와 measured facts를 가진다. Full mix, dialogue, music-and-effects, clean audio, description, commentary와 alternate language는 독립 stream identity이고 temporary monitor mix를 master로 선택하지 않는다. Authored silence, muted interval, silent channel, missing source, failed decode와 not-run은 별도 상태다.

Downmix, normalization, gain과 sample-rate conversion은 input digest, ordered mapping·coefficients 또는 effective policy, processor identity와 output digest를 기록한다. Profile이 integrated loudness, range, peak와 tolerance를 소유하고 requested gain이 아니라 actual decoded stream measurement로 conform을 판단한다. Encode delay나 priming-like behavior는 observed offset과 compensation을 common presentation timeline에 기록한다.

Probe와 audible review는 channel order, language, first sample, programme start, final event, intended tail, clipping, silence classification와 picture sync를 확인한다. Missing required channel, wrong order, rate mismatch, duration drift, clipping, prohibited silence, stale mix, wrong language와 undecodable stream은 거절한다. Independent valid mix는 보존하되 requested language·accessibility set 전체를 complete로 표시하지 않는다.

## Caption, subtitle와 selectable cue {#spec-delivery-caption-cues}

### Caption readability profile {#spec-delivery-caption-readability-profile}

<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-captions-subtitles-cues 시간과 화면 영역을 가진 text alternative를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-subtitle-distinction Caption과 subtitle role을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Text와 language integrity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-reading-overlap Reading pace와 overlap을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-style-region Style과 safe region을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-presentation-form Selectable과 open presentation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness Edit와 cue freshness를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-coverage Dialogue와 sound coverage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-refusal Invalid cue 거절 조건을 정밀화한다. -->

Cue는 stable identity, caption·subtitle·non-speech·speaker·song·chapter role, RFC 5646 well-formed retained language와 ASCII case-insensitive comparison identity, exact start-inclusive·end-exclusive film range, Unicode text, source utterance 또는 sound event, speaker, region, lines, direction과 semantic style을 가진다. Language syntax validation은 extension, private-use와 4자에서 8자 primary language를 허용하고 malformed subtag와 empty subtag를 거절하되 registry membership, Preferred-Value replacement, network lookup 또는 language inference를 수행하지 않는다. 다른 목적을 한 track으로 합치지 않고, missing glyph·invalid encoding·mixed language를 replacement character나 default language로 숨기지 않는다.

Validation은 target language의 text length, duration, reading pace-like profile, overlap, shot cut, speaker change, on-screen text collision과 safe region을 actual presentation에서 검사한다. Readability와 selectable WebVTT는 CRLF와 CR을 LF로 canonicalize한 같은 cue-text presentation을 소비하고, authored LF와 legal tab을 보존하며 prohibited control character를 같은 방식으로 sanitize한다. WebVTT serialization은 cue payload의 줄 경계를 유지한 채 reserved text characters를 escape하고, id·language·speaker의 single-line sanitizer와 cue payload canonicalizer를 분리한다. 자동 line reflow는 수행하지 않는다. Selectable embedded 또는 sidecar track은 player selection, user-visible label, role와 on·off 동작을, open presentation은 final decoded picture의 readability를 검증한다. Burn-in은 selectable 요구를 대신하지 않는다.

<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Grapheme 기반 가독성 한계와 profile 부재 시 measure-only 경계를 정밀화한다. -->

Readability profile은 identity와 version, language와 algorithm·revision·grapheme granularity·requested/resolved locale 또는 locale-neutral discriminant를 포함한 complete grapheme segmentation identity, 초당 grapheme 상한, cue당 line 수와 line당 grapheme 상한, 최소 cue duration, cue 사이 최소 gap 및 각 경계의 inclusive 또는 exclusive 의미를 가진다. Validator는 markup을 제외한 displayed grapheme count와 exact film range에서 effective measurements 및 actual complete segmentation identity를 출력하고, requested identity와 actual identity가 정확히 일치할 때만 verdict를 계산한다. Profile이 없거나 complete identity가 지원되지 않으면 같은 measurements와 `not-run` verdict reason을 반환하며 임의 default threshold나 fallback segmenter로 pass 또는 fail을 만들지 않는다. Report schema version 2만 complete identity를 뜻하며 version 1 결과를 소급 해석하지 않는다.

Edit trim·retime·reorder, dialogue replacement와 language revision은 affected cues와 review를 stale로 만든다. Coverage는 required dialogue, meaningful non-speech와 speaker change를 covered, intentionally omitted 또는 unresolved로 보고한다. Reversed time, duplicate id, unreadable overlap, empty required text, unsupported glyph, stale mapping과 source mismatch는 거절하며 valid subset을 complete alternative로 publish하지 않는다.

## Audio description, transcript와 navigation {#spec-delivery-description-alternatives-group}

### Caption readability measurement {#spec-delivery-caption-readability-measurement}

<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Grapheme segmentation, cue duration, line length, reading rate와 gap measurement를 profile-owned threshold와 결합하게 한다. -->

Readability evaluator는 exact film cue에서 canonical cue-text presentation의 측정값과 actual complete segmentation identity를 항상 반환하고, ASCII case-insensitive identity로 matching language profile을 찾은 뒤 requested identity와 actual identity가 정확히 일치할 때만 verdict를 계산한다. Profile이 없거나 complete identity가 지원되지 않으면 측정값을 유지한 `not-run`을 반환하며 임의 threshold나 segmentation fallback을 채택하지 않는다. Same-language preceding gap lookup도 같은 language comparison identity를 사용한다.

### Audio description, transcript와 navigation {#spec-delivery-description-alternatives}

<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-audio-description-alternatives Visual information의 시간 기반 대체를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-gaps-priority Description gap와 priority를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-modes Standard와 extended mode를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-mix Description mix를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-other-alternatives Other alternative 상태를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-transcript-navigation Transcript와 navigation mapping을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-sign-language-rendition Sign-language rendition을 독립 product로 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-coverage Visual event coverage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-freshness Description asset freshness를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-refusal Incomplete accessible product 거절 조건을 정밀화한다. -->

Audio description cue는 visual target event, narration text, language, voice source, exact range, available gap, priority와 programme mix relation을 가진다. Dialogue, critical sound, music과 authored silence를 분석해 permitted overlap과 ducking relation을 선언하며 required information을 넣기 위해 원 dialogue를 가리거나 selected edit duration을 몰래 늘리지 않는다. Standard, extended와 descriptive transcript는 서로 다른 timeline·product identity와 review를 가진다.

Description mix는 narration bytes, source programme, gain relation, channel layout, loudness, language와 measured audibility를 검증한다. Transcript는 speaker, dialogue, meaningful sound, description과 on-screen text를 reading order와 selectable film time에 연결한다. Navigation target은 stable identity와 label을 가지고, sign-language rendition은 language, performer 또는 source, time mapping, crop·placement, occlusion policy와 independent picture review를 가진다.

Coverage는 각 required visual event를 described, existing sound·dialogue로 conveyed, intentionally omitted 또는 unresolved로 분류한다. Picture edit, on-screen text, mix, language 또는 gap 변경은 script, recording, mix와 review를 stale로 만든다. Missing target, overlap conflict, wrong language, duration overflow, source mix mismatch와 unresolved required cue는 complete accessible delivery를 거절하고 completed cues만 partial asset으로 보존한다.

## Localization과 language-version closure {#spec-delivery-localization-group}

### Localization과 language-version closure {#spec-delivery-localization}

<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-localization-language-versions 언어별 film asset identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-original-translation Original과 translation lineage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-selection Language tag와 selection role을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-dub-timing Dub와 picture timing을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-text-expansion-layout Target-language layout을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-completeness Cross-asset completeness를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-localization-freshness Localization invalidation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-localization-refusal Incomplete language version 거절 조건을 정밀화한다. -->

Language version은 RFC 5646 well-formed retained language tag와 ASCII case-insensitive comparison identity, 필요한 script·region variation, audience·selection role, source content revision, translation·adaptation revision, approval과 fallback policy를 가진다. Case-only tag 차이는 duplicate detection, lookup과 serialization에서 같은 identity이며 display form은 입력대로 보존한다. Syntax validation은 registry membership이나 Preferred-Value canonicalization을 주장하지 않는다. Source text, translator 또는 provider, translated text, terminology, pronunciation, cultural adaptation, reviewer와 approval을 구분하고 translation이 original을 덮어쓰지 않는다. Unknown 또는 mixed language를 default로 자동 분류하지 않는다.

Dub는 voice·performer source, utterance range, final audio timing, visible mouth-like cues와 language-specific mix를 연결한다. Caption, title와 on-screen text는 실제 target language의 expansion, line break, direction, font coverage와 safe region에서 검증한다. Profile은 dialogue, dub, caption, subtitle, description, title와 metadata의 required set을 language별로 닫고 fallback이 있으면 user-visible result와 목적을 선언한다.

Source text, edit timing, speaker, on-screen text 또는 terminology 변경은 affected translation, recording, cue, layout와 review를 stale로 만든다. Missing translation, unsupported glyph, stale cue, wrong voice, unapproved revision, mixed locale와 ambiguous fallback은 해당 language bundle을 거절한다. 독립 valid language는 publish할 수 있으나 실패 language가 포함된 requested set을 complete로 표시하지 않는다.

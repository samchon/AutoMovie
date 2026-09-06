# Localization과 언어 Version

## 언어별로 추적되는 Film 자산 {#delivery-localization-language-versions}

Dialogue, subtitle, caption, audio description, title, on-screen text, metadata와 voice는 canonical language 및 locale-like profile, source content, translation 또는 adaptation revision과 approval에 연결되어야 한다. Fallback language와 intentionally untranslated content를 명시해야 한다.

### Original과 Translation {#delivery-original-translation}

Source text identity, source language, translator 또는 provider, translated text, pronunciation, cultural adaptation, reviewer와 approval을 구분해야 한다. Translation이 원문을 덮어쓰거나 승인되지 않은 최신 text를 current version으로 선택해서는 안 된다.

### Language Tag와 Selection {#delivery-language-selection}

각 stream과 text asset은 RFC 5646 well-formed language tag의 retained display form과 ASCII case-insensitive identity, script 또는 region 차이가 필요한 경우 그 variation, intended audience와 selection role을 가져야 한다. Well-formed 판정은 registry membership이나 Preferred-Value replacement를 뜻하지 않는다. Unknown 또는 mixed language를 default language로 자동 분류해서는 안 된다.

### Dub와 Timing {#delivery-dub-timing}

Dub voice, utterance range, performer identity, performance timing, visible mouth-like cue relation과 mix를 language version마다 연결해야 한다. Source-language duration을 그대로 강제하거나 picture sync를 맞추기 위해 words를 임의로 자르면 안 된다.

### Text Expansion과 Layout {#delivery-text-expansion-layout}

Caption, title와 on-screen text의 길이, line break, writing direction, font coverage와 safe region을 실제 target language에서 검증해야 한다. Source language layout의 성공을 translated layout의 evidence로 사용해서는 안 된다.

### Cross-asset Completeness {#delivery-language-completeness}

한 language version에 필요한 dialogue, caption, subtitle, description, titles와 metadata의 exact set을 profile에서 확인해야 한다. 서로 다른 language revision을 섞거나 missing item을 source-language fallback으로 채울 때는 그 정책과 user-visible result를 명시해야 한다.

### Freshness와 Propagation {#delivery-localization-freshness}

Source text, edit timing, speaker, on-screen text 또는 approved terminology가 바뀌면 영향을 받는 translation, recording, cues, layout와 review를 stale로 만들어야 한다. 영향 없는 translation 재사용은 source identity가 같다는 근거를 가져야 한다.

### Localization Refusal {#delivery-localization-refusal}

Missing translation, mixed locale, unsupported glyph, stale cue timing, wrong voice, unapproved revision, incomplete required set와 ambiguous fallback은 거절해야 한다. Valid language는 독립적으로 publish할 수 있지만 실패 language를 포함한 bundle을 complete로 표시해서는 안 된다.

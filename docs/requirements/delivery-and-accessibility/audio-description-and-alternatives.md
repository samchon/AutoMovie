# Audio Description과 대체 Media

## Visual Information의 시간 기반 대체 {#delivery-audio-description-alternatives}

Audio description은 character, action, setting, state change, on-screen text와 visual-only causal information 중 전달할 대상을 narration cue, language, voice, film range, available gap와 mix relation으로 표현해야 한다. 각 cue는 selected edit와 visual target을 역추적할 수 있어야 한다.

### Gap와 Priority {#delivery-description-gaps-priority}

Dialogue, critical sound, music과 authored silence를 고려하여 description timing, priority와 permitted overlap을 정해야 한다. 설명을 넣기 위해 required dialogue나 중요한 sound event를 무조건 가리거나 film timing을 몰래 늘려서는 안 된다.

### Standard와 Extended {#delivery-description-modes}

기존 film timing 안의 standard description, authored pause 또는 alternate timeline을 사용하는 extended description과 descriptive transcript를 구분해야 한다. Extended version은 원본 cut과의 mapping, added duration과 independent review를 가져야 한다.

### Description Mix {#delivery-description-mix}

Description voice, original programme, gain ducking-like relation, channel layout, loudness와 language를 하나의 accessible mix contract로 검증해야 한다. Narration cue text가 존재한다는 이유만으로 audible description stream이 완성되었다고 보아서는 안 된다.

### Other Alternatives {#delivery-other-alternatives}

Descriptive transcript, sign-language rendition, clean audio, text summary와 project-defined user-selectable alternative를 profile에 포함할 수 있어야 한다. 구현하지 않는 항목은 unsupported 또는 intentionally absent로 명시하고 다른 asset이 그 목적을 대신한다고 추정해서는 안 된다.

### Transcript와 Navigation {#delivery-transcript-navigation}

Transcript를 제공하면 speaker, dialogue, meaningful sound, description text와 on-screen text를 읽기 순서와 선택 가능한 film time에 연결해야 한다. Chapter 또는 semantic navigation을 제공하면 stable target과 label을 가져야 하며 plain script의 존재만으로 synchronized transcript나 navigation을 제공했다고 주장해서는 안 된다.

### Sign-language Rendition {#delivery-sign-language-rendition}

Sign-language rendition을 지원하면 language, performer 또는 source identity, film-time mapping, crop 또는 composition relation, picture-in-picture-like placement와 review를 독립 product로 추적해야 한다. Source picture를 가리거나 timing이 달라진 rendition은 profile에 선언하고 원본 picture review를 그대로 상속해서는 안 된다.

### Visual Coverage {#delivery-description-coverage}

필수 visual event마다 described, conveyed by existing sound or dialogue, intentionally omitted 또는 unresolved 상태를 기록할 수 있어야 한다. 설명의 단어 수가 아니라 관객에게 필요한 정보와 timing relation으로 coverage를 판정해야 한다.

### Version과 Freshness {#delivery-description-freshness}

Picture edit, on-screen text, language, original mix 또는 cue timing이 바뀌면 영향을 받는 description script, recording, mix와 review를 stale로 만들어야 한다. Unchanged cue 재사용은 target event와 available gap이 그대로일 때만 허용해야 한다.

### Description Refusal {#delivery-description-refusal}

Missing visual target, overlapping required dialogue, wrong language, stale edit timing, unhandled required cue, duration overflow와 source mix mismatch는 거절해야 한다. 완성된 일부 cue는 partial asset으로 보존할 수 있지만 accessible delivery complete로 표시해서는 안 된다.

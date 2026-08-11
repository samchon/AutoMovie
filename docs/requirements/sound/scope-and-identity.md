# 음향 범위와 Identity

## Film 안의 추적 가능한 Sound {#sound-scope-identity}

Sound source, cue, utterance, bus, mix, rendered stream와 delivery는 stable identity, source, time basis, owner, state와 provenance를 가져야 한다.

### Fixed Audio Clock {#sound-fixed-audio-clock}

Cue boundary, automation, propagation, mix와 delivery sample은 rational film time에서 declared sample rate로 변환되어야 하며 frame rate, playback speed, seek order와 chunk boundary가 sample identity나 cue population을 바꾸지 않아야 한다.

### Story와 World Binding {#sound-story-world-binding}

Sound는 dialogue, action, object, actor, location, ambience, music intent와 semantic event 중 무엇에 답하는지 연결할 수 있어야 한다.

### Emission과 Presentation {#sound-emission-presentation}

World에서 소리가 발생한 emission time과 listener에 도달하고 film에 배치되는 presentation time을 구분해야 한다.

### Authored Silence {#sound-authored-silence}

소리가 없는 상태, 의도된 silence, missing source와 unsupported simulation을 구분하고 빈 PCM을 항상 성공으로 취급하지 않아야 한다.

### Missing Sound {#sound-missing-refusal}

필수 event와 dialogue에 source나 cue가 없으면 generic effect와 silent fallback으로 완료를 가장하지 않아야 한다.

### Provider Neutrality {#sound-provider-neutrality}

사용자와 저작 에이전트는 recording, library, speech synthesis, music generation와 processing provider를 선택하거나 교체할 수 있어야 하며 특정 service, model 또는 provider connection이 음향 계약의 필수값이나 묵시적 기본값이 되어서는 안 된다.

### Prototype Fidelity 경계 {#sound-prototype-fidelity-boundary}

Soundtrack은 대사, 사건 timing, 공간 관계, 연속성, 우선순위와 의도된 침묵을 판단할 수 있어야 한다. Placeholder와 deterministic proxy는 상태를 드러내는 한 authoring 중 사용할 수 있지만 final recording quality, mastering, 전문 acoustic simulation 또는 상업적 권리 확보를 수행했다고 주장하지 않아야 한다.

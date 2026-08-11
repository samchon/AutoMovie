# 음향 범위와 Identity

## Film 안의 추적 가능한 Sound {#sound-scope-identity}

Sound source, cue, utterance, bus, mix, rendered stream와 delivery는 stable identity, source, time basis, owner, state와 provenance를 가져야 한다.

### Story와 World Binding {#sound-story-world-binding}

Sound는 dialogue, action, object, actor, location, ambience, music intent와 semantic event 중 무엇에 답하는지 연결할 수 있어야 한다.

### Emission과 Presentation {#sound-emission-presentation}

World에서 소리가 발생한 emission time과 listener에 도달하고 film에 배치되는 presentation time을 구분해야 한다.

### Authored Silence {#sound-authored-silence}

소리가 없는 상태, 의도된 silence, missing source와 unsupported simulation을 구분하고 빈 PCM을 항상 성공으로 취급하지 않아야 한다.

### Missing Sound {#sound-missing-refusal}

필수 event와 dialogue에 source나 cue가 없으면 generic effect와 silent fallback으로 완료를 가장하지 않아야 한다.

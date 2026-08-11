# Picture와 Sound Edit

## 서로 다른 경계를 가지는 Picture와 Sound {#editorial-picture-sound-edits}

Picture cut과 dialogue, ambience, effects, Foley-like event와 music의 in과 out point는 독립적으로 편집할 수 있어야 한다. J-cut, L-cut, prelap, tail과 sound bridge는 source event identity와 film presentation range를 보존해야 한다.

### Emission과 Presentation {#editorial-sound-emission-presentation}

World sound의 emission time, listener arrival time과 timeline presentation range를 구분해야 한다. Picture trim이나 sound bridge는 source event의 발생 사실을 바꾸지 않고 관객이 듣는 구간만 선택해야 한다.

### Dialogue Edit {#editorial-dialogue-edits}

Utterance, speaker, word 또는 phrase timing, breath, pause, overlap과 interruption은 actor performance 및 선택된 audio range와 연결되어야 한다. 문장 중간 trim, 반복 syllable, 잘못된 speaker 전환과 picture lip timing drift를 검출할 수 있어야 한다.

### Room Tone과 Ambience {#editorial-room-tone-ambience}

Location과 interior state에 속하는 room tone과 ambience bed는 지속 source, loop 또는 authored segment로 식별되어야 한다. Cut 경계의 의도하지 않은 noise floor 변화, duplicated loop edge와 missing tail을 보고하되 창작적으로 의도된 silence와 혼동해서는 안 된다.

### Effects와 Music {#editorial-effects-music-edits}

Sound effect는 원인이 되는 event와 관계를 유지해야 하고 music은 cue, phrase, beat 또는 free-time range와 edit 결정을 연결할 수 있어야 한다. Picture에 맞춘 이동이 원 event 또는 musical source time을 덮어써서는 안 된다.

### Channel과 Mix Relation {#editorial-channel-mix-relation}

Clip edit는 source channel, film mix role, gain 또는 fade와 routing relation을 보존해야 한다. 필요한 channel이 없는 clip을 다른 channel 복제로 채우거나 임시 monitor mix를 정본으로 취급해서는 안 된다.

### Silence와 Missing Audio {#editorial-silence-missing-audio}

Authored silence, muted clip, inaudible gain, missing media와 아직 mix되지 않은 range는 구분되어야 한다. Partial preview가 silence를 출력할 수는 있지만 그 이유와 범위를 기록하고 complete sound edit로 승인해서는 안 된다.

### Audio Boundary Refusal {#editorial-audio-boundary-refusal}

Truncated required cue, missing tail, duplicated event, stale arrival timing, invalid channel relation과 unsupported time transform은 거절해야 한다. Picture가 유효하더라도 sound 오류를 숨기지 말고 picture-only partial 상태와 필요한 복구 작업을 보고해야 한다.

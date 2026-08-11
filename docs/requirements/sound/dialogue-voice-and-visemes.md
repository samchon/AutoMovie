# Dialogue, Voice와 Viseme

## Actor 발화의 Audio Performance {#sound-dialogue-voice-visemes}

Dialogue는 story utterance, actor voice identity, language, source audio, emission interval, words 또는 timing marks와 optional viseme·expression cue를 연결해야 한다.

### Voice Consistency {#sound-dialogue-voice-consistency}

같은 actor의 voice source와 delivery characteristics를 scene 사이에 유지하고 intentional age, disguise, device와 language variant를 명시해야 한다.

### Word와 Phoneme Timing {#sound-word-phoneme-timing}

지원되는 경우 word, phoneme, viseme와 breath time을 decoded audio duration과 연결하고 synthesis request의 예상 timing을 final bytes의 timing으로 사용하지 않아야 한다.

### Lip-sync Join {#sound-lipsync-join}

Actor performance와 voice timing을 같은 film interval에 배치하고 viseme가 body pose, head orientation, camera visibility와 같은 sample을 읽어야 한다.

### Dialogue Refusal {#sound-dialogue-refusal}

Wrong speaker, stale audio, unsupported language, missing duration, out-of-range mark와 actor가 화면에서 말하는데 cue가 없는 상태를 거부해야 한다.

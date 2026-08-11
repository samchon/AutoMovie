# Dialogue, Voice와 Viseme

## Actor 발화의 Audio Performance {#sound-dialogue-voice-visemes}

Dialogue는 story utterance, actor voice identity, language, source audio, emission interval, words 또는 timing marks와 optional viseme·expression cue를 연결해야 한다.

### Voice Source Adoption {#sound-voice-source-adoption}

Recorded 또는 synthesized voice의 선택은 사용자와 저작 에이전트가 소유하고 특정 provider나 model을 필수로 요구하지 않아야 한다. 채택한 voice는 source bytes, actor relation, language, provider·model·version이 있으면 그 provenance, controls와 digest로 식별해야 한다.

### Voice Consistency {#sound-dialogue-voice-consistency}

같은 actor의 voice source와 delivery characteristics를 scene 사이에 유지하고 intentional age, disguise, device와 language variant를 명시해야 한다.

### Word와 Phoneme Timing {#sound-word-phoneme-timing}

지원되는 경우 word, phoneme, viseme와 breath time을 decoded audio duration과 연결하고 synthesis request의 예상 timing을 final bytes의 timing으로 사용하지 않아야 한다.

### Final Bytes가 Timing Authority {#sound-dialogue-final-bytes-authority}

Trim, resynthesis, rate change 또는 source 교체 뒤 word, phoneme, viseme와 caption timing은 final decoded bytes에 맞게 다시 정렬하고 stale alignment를 유지하지 않아야 한다. Alignment가 없으면 dialogue audio와 구분하여 해당 timing 또는 lip-sync capability를 approximate, unsupported 또는 not-run으로 표시해야 한다.

### Lip-sync Join {#sound-lipsync-join}

Actor performance와 voice timing을 같은 film interval에 배치하고 viseme가 body pose, head orientation, camera visibility와 같은 sample을 읽어야 한다.

### Dialogue Seek Equivalence {#sound-dialogue-seek-equivalence}

Sequential playback, arbitrary seek와 repeated seek는 같은 audio sample, word·phoneme mark, viseme와 expression state를 선택해야 하며 이전 utterance의 breath, tail 또는 mouth state가 숨은 history로 남지 않아야 한다.

### Dialogue Refusal {#sound-dialogue-refusal}

Wrong speaker, stale audio, unsupported language, missing duration, out-of-range mark와 actor가 화면에서 말하는데 cue가 없는 상태를 거부해야 한다.

# Sound Sources, Events, Dialogue, and Foley

## Immutable source adoption {#sound-immutable-source-adoption}

### Decode와 derived-source closure {#sound-decode-and-derived-source-closure}

<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-sources-external-assets 이 절은 project가 실제로 채택한 audio bytes를 source authority로 삼는다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-immutable-adoption 이 절은 source 변경을 새 revision으로 만든다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-provenance 이 절은 origin, license와 receipt를 source에 결합한다. -->

Source 입력은 stable asset identity, immutable bytes, byte digest, media facts, semantic use, origin, license, adoption receipt다. 출력은 source revision과 decode request이며 파일명, URL, provider job, 임시 cache는 identity가 아니다. Bytes 또는 해석 metadata가 바뀌면 새 source revision이고 기존 dialogue timing, cue analysis와 mix cache는 stale이다.

<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract 이 절은 허용 media, sample format, channel과 bounds를 명시하게 한다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure 이 절은 resampleㆍtrimㆍsynthesis 결과도 독립 source로 추적한다. -->

Decode input은 source bytes와 declared/observed media facts이고 output은 정수 sample rate, 유한 channel layout, ordered samples, duration과 decoder revision이다. Derived source는 parent digest, exact transform, transform revision과 output digest를 가진다. Unsupported containerㆍcodec, contradictory facts, nonfinite sample, duration overflow, channel ambiguity는 source identity를 포함한 거절이다.

### Decode contract {#sound-decoder-input-contract}

<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract 지원 container, sample encoding, channel, rate와 decode resource bound를 명시하게 한다. -->

Decoder는 exact input bytes에서 관찰한 source facts와 bounded decoded sample buffer를 분리하고, 지원하지 않거나 손상된 입력을 silence 또는 대체 source로 바꾸지 않고 거절한다.

### Source choice와 provider boundary {#sound-source-choice-provider-and-secret-boundary}
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-choice 이 절은 source 선택의 author authority와 대체 규칙을 고정한다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-provider-adapter-boundary 이 절은 provider metadata를 adoption 경계 밖 runtime 입력으로 쓰지 못하게 한다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-source-secret-remote-boundary 이 절은 credential과 remote availability를 재현 입력에서 제외한다. -->

Author는 source identity 또는 명시된 candidate set과 selection rule을 선언한다. Provider adapter는 결과를 내려받아 검증하고 receipt를 쓰는 데서 끝나며 evaluation은 adopted bytes만 읽는다. Secret은 artifact에 기록하지 않고 remote failure는 missing adopted source로 보고한다. Source를 못 찾았다고 임의 대체하거나 network fetch를 presentation 중 수행하지 않는다.

## Cue identity와 세 시간 {#sound-cue-identity-and-three-times}

### One-shot, sustained, event timing {#sound-cue-kind-and-event-timing}

<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-event-cues-timing 이 절은 cue를 의미 사건에서 파생한다. -->
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-cue-identity-deduplication 이 절은 동일 사건에서 중복 cue가 생기지 않도록 stable identity를 정한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-emission-presentation 이 절은 emission과 presentation을 서로 다른 시간으로 보존한다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload 이 절은 cue의 causal identity가 motion event payload를 그대로 보존하게 한다. -->

Cue identity는 production, event identity, cue role, emitter identity와 stable local ordinal의 합성이다. Cue가 adopted source 또는 procedural layer를 presentation에 놓을 때마다 cue identity, source-layer role과 stable occurrence ordinal에서 presentation source instance identity를 만들고, source revision, source range, presentation rangeㆍtime transform, emitter와 gain state를 그 instance revision에 결속한다. 같은 asset 또는 derived source를 여러 cue나 layer가 재사용해도 presentation instance identity는 서로 달라야 하며 입력 배열 순서, decode cache key와 source digest가 occurrence identity를 대신하지 않는다.

Cue 상태는 emission time, propagation으로 얻은 arrival time, edit/mix가 배치한 presentation time과 duration을 가진다. Deduplication은 cue와 presentation instance의 각 identity equality로만 수행하며 이름, 같은 source bytes 또는 가까운 시간이라는 이유로 다른 occurrence를 합치지 않는다.

<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-one-shot-sustained 이 절은 순간 cue와 lifecycle source의 상태를 분리한다. -->
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing 이 절은 cue emission을 semantic event authority에 묶는다. -->

One-shot은 하나의 emission과 finite source window를 가지며 sustained cue는 start, optional state changes, stop과 tail을 가진다. Event-derived cue는 사건의 film-time과 causal payload를 읽고 임의로 재타이밍하지 않는다. 예술적 offset은 별도 authored field와 reason으로 기록하고 conform 때 같은 transform을 받는다.

### Sample boundary와 arrival {#sound-cue-sample-boundary-and-arrival}
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary 이 절은 cue 시간을 하나의 sample index 규칙으로 환원한다. -->
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time 이 절은 전파 지연이 emission을 덮어쓰지 않고 arrival로 기록되게 한다. -->

Emission과 presentation film-time은 fixed audio clock의 정수 sample index로 한 번만 변환한다. Propagation은 world distance와 declared propagation model에서 nonnegative delay를 구해 arrival sample을 만들고, mix/edit offset이 final presentation sample을 만든다. 각 변환은 입력 time, rounding rule, output index와 dependency revision을 receipt에 남긴다.

### Cue failure {#sound-cue-failure-contract}
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-cue-refusal 이 절은 사건ㆍsourceㆍtime이 불완전한 cue를 실패시킨다. -->

Missing event, 중복 cue 또는 presentation source instance identity, unbounded sustained source, 음수 duration, unresolved emitter, 범위 밖 sample, arrival before emission, source 없는 cue는 거절한다. 실패한 cue를 silence나 zero-length clip으로 만들어 complete mix에 넣지 않는다.

## Dialogue bytes와 timing authority {#dialogue-bytes-and-timing-authority}

### Voice consistency와 phoneme state {#dialogue-voice-consistency-and-phoneme-state}

<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-visemes 이 절은 발화 audio와 lip timing을 하나의 performance record로 연결한다. -->
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-voice-source-adoption 이 절은 합성ㆍ녹음 voice도 immutable source로 채택한다. -->
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority 이 절은 최종 채택 bytes에서 timing을 파생하게 한다. -->

Dialogue performance 입력은 actor, line identity, language, text/script revision, adopted voice source와 take choice다. Output은 decoded samples, presentation range, word/phoneme marks, viseme intervals와 provenance다. Marks와 visemes는 최종 bytes 또는 그 exact derived source에서 다시 분석한 결과여야 하며 합성 전 예상 duration이나 다른 take의 timing을 사용할 수 없다.

<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency 이 절은 actor voice 선택과 의도된 변경을 revision으로 추적한다. -->
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-word-phoneme-timing 이 절은 word와 phoneme 구간을 sample clock에 정렬한다. -->

Actor voice identity, language/locale, take policy와 deliberate voice-change boundaries는 production revision에 속한다. Word와 phoneme interval은 ordered, nonoverlapping 또는 명시적으로 coarticulated, source duration 안의 integer sample ranges다. Unknown phoneme은 named fallback viseme 또는 `unsupported`로 남기며 임의 mouth shape을 성공으로 표시하지 않는다.

### Lip-sync join과 seek {#dialogue-lipsync-join-and-seek}
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join 이 절은 viseme presentation과 audible dialogue를 같은 time transform으로 결합한다. -->
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-seek-equivalence 이 절은 임의 seek에서도 같은 sample과 viseme state를 요구한다. -->

Lip-sync input은 final dialogue presentation sample, shared film/audio transform과 phoneme marks다. Output viseme state는 target film time을 sample index로 바꿔 직접 평가하며 이전 playback cursor에 의존하지 않는다. Trim, slip, rate conform은 audio와 mark 모두에 하나의 transform으로 적용되고 범위 밖 mark는 잘리거나 거절된 이유를 기록한다.

### Dialogue failure {#dialogue-failure-contract}
<!-- @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-refusal 이 절은 bytesㆍtakeㆍtiming 불일치를 명시적으로 거절한다. -->

Missing take, actor/source mismatch, stale mark digest, phoneme range 역전, source 밖 timing, 지원하지 않는 rate transform, dialogue와 viseme의 다른 conform revision은 line identity를 지목한 실패다. 임시 timing이나 예상 duration은 final 상태로 승격할 수 없다.

## Foley와 resolved contact {#foley-and-resolved-contact-binding}

### Variation, layering, procedural bound {#foley-variation-layering-and-bound}

<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-foley-effects 이 절은 물체와 접촉의 audible consequence를 추적한다. -->
<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-foley-material-surface 이 절은 source 선택을 contact material과 surface trait에 묶는다. -->
<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-foley-resolved-contact 이 절은 실제로 해결된 contact만 foley를 방출하게 한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases 이 절은 motion contact phase와 foley emission의 causal boundary를 일치시킨다. -->

Foley input은 resolved contact identity, tick, participants, material/surface traits, point, normal, relative speed/impulse proxy와 cue mapping이다. Output은 causal cue, emitter path, chosen variation과 layer set이다. Authored-only foley는 별도 semantic event를 원인으로 가질 수 있지만 존재하지 않은 simulated contact를 주장하지 않는다.

<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-foley-variation 이 절은 반복 변형을 stable seed와 ordinal에 묶는다. -->
<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-layered-effects 이 절은 여러 layer를 하나의 causal cue 아래 추적한다. -->
<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-procedural-foley-bound 이 절은 procedural 생성의 sampleㆍvoiceㆍwork 상한을 요구한다. -->

Variation choice는 contact/cue identity, seed와 variation ordinal의 순수 함수다. Layer는 role, source, gain, offset, duration을 가지며 stable order로 합성된다. Procedural foley는 최대 samples, layers, voices, generation iterations와 output peak bound를 admission 전에 증명해야 한다.

### Foley claim boundary {#foley-claim-and-failure-boundary}
<!-- @evidence requirements/sound/foley-and-sound-effects.md#sound-effect-claim-boundary 이 절은 prototype foley를 실제 재료 음향의 증거로 오인하지 않게 한다. -->

Missing material mapping, unsupported contact kind, unresolved source, layer budget 초과는 거절 또는 explicit gap이다. 성공은 사건 동기와 coarse material distinction을 뜻하며 실제 물체의 녹음 충실도, 물리 기반 방사, final sound-library 품질을 뜻하지 않는다.

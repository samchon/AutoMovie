# Mix, Stems, Loudness, and A/V Join

## Mix graph와 bus priority {#sound-mix-graph-and-bus-priority}

### Processing chain과 stable summation {#sound-processing-chain-and-stable-summation}

<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-mix-hierarchy-loudness 이 절은 의미 source에서 delivery master까지 추적 가능한 mix를 정의한다. -->
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-bus-priority 이 절은 dialogue, effects, ambience, music 등의 bus와 priority를 명시한다. -->
<!-- @evidence requirements/sound/event-cues-and-timing.md#sound-cue-identity-deduplication 이 절은 같은 source를 재사용하는 cue occurrence와 route를 독립 identity로 보존한다. -->

Mix input은 presentation sample ranges와 stable unique identity를 가진 presentation source instances, stable bus graph, channel layouts, gain/automation, acoustic response와 delivery target이다. 각 directed route는 source instance 또는 upstream bus identity, destination bus 또는 output identity, route role과 stable route ordinal에서 고유한 identity를 만들고 gain, processing split와 active range를 route revision에 결속한다. Graph는 acyclic이고 각 source instance는 하나 이상의 명시 route를 가지며 같은 source instance가 여러 destination에 기여하면 route identity도 각각 달라야 한다. Priority는 sidechain/ducking 또는 author decision에만 사용한다. Output은 bus stems, master, routing receipt와 sample range다.

<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-processing-chain 이 절은 processing의 순서와 parameter revision을 결과 identity로 만든다. -->
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-deterministic-summation 이 절은 worker와 입력 열거 순서가 sample 합에 영향을 주지 않게 한다. -->

각 route는 decode/resample, trim/envelope, spatial/acoustic processing, gain/automation, bus processing, master processing의 선언된 순서를 가진다. 같은 sample에 기여하는 항목의 canonical total-order key는 bus depth, bus identity, role priority, presentation source instance identity, route identity, stable layer ordinal과 stable route-local contribution ordinal을 순서대로 포함한다. Route, layer와 contribution ordinal은 각각의 owning identity 안에서 선언되고 traversal이나 입력 열거 순서에서 다시 부여되지 않는다. Adopted asset identity, source digest, input enumeration position, map iteration과 worker completion order는 tie breaker가 아니다.

서로 다른 contribution이 완전한 canonical key를 공유하면 mix graph는 ambiguous하며 accumulation 전에 충돌한 instance와 route identities를 지목해 거절한다. Parallel execution은 canonical key와 sample interval로 정렬된 partial block만 반환하고 merge도 같은 total order를 사용하므로 worker count, chunk boundary와 completion order가 합산 순서나 mix identity를 바꾸지 않는다.

### Automation sample clock {#sound-mix-automation-sample-clock}
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-mix-automation-clock 이 절은 automation을 fixed sample clock에서 직접 평가하게 한다. -->

Automation input은 rational film-time 또는 integer sample keys, interpolation rule, parameter identity와 bounds다. Target sample의 값은 keys에서 직접 평가하며 block size와 이전 cursor에 의존하지 않는다. Discontinuous change는 정확히 한 sample boundary를 소유하고 out-of-range gainㆍfilterㆍpan 값은 clamp하지 않고 진단한다.

### Stem과 master relation {#sound-stem-master-relation-contract}
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-stem-master-relation 이 절은 stem 합과 master processing의 관계를 재현 가능하게 한다. -->

각 stem은 bus subtree의 pre-master 또는 명시된 post-process sample을 같은 clock, range, channel layout으로 출력한다. Master는 stem의 stable sum 뒤 선언된 master-only chain을 적용한 결과이며 stem 합이 곧 master라고 주장하지 않는다. Receipt는 stem identities, exact ranges, master-only transforms와 digests를 기록한다.

### Loudness, peak, failure {#sound-loudness-peak-and-mix-failure}
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-loudness-peak 이 절은 loudness와 true/sample peak를 delivery profile에 대해 측정한다. -->
<!-- @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-mix-refusal 이 절은 clipping, invalid graph와 target mismatch를 명시적으로 실패시킨다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-loudness-profile 이 절은 측정값을 선택된 delivery loudness profile에 결합한다. -->

Measurement input은 final decoded master samples, sample rate, channel layout와 named delivery profile이고 output은 integrated/segment loudness proxy, sample/true peak, clipping count, measured range와 tool revision이다. Cyclic bus, missing route, nonfinite sample, incompatible layout, unbounded tail, limit violation은 실패다. Limiter나 normalization은 선언된 processing node일 때만 실행하며 검증 단계가 자동 수정하지 않는다.

## Picture edit와 sound conform {#picture-edit-and-sound-conform}

### Event sync와 boundary continuity {#sound-event-sync-and-boundary-continuity}

<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-editing-sync-continuity 이 절은 sound 상태를 picture edit revision에 결합한다. -->
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-time-transform 이 절은 trim, slip, rate와 transition을 하나의 유리 time transform으로 표현한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-sound-emission-presentation 이 절은 edit가 presentation을 바꾸되 emission authority를 보존하게 한다. -->

Conform input은 previous sound timeline, 새 picture edit revision, rational clip transforms, transition ranges와 author sync constraints다. Output은 새 presentation ranges, transformed marks/automation, tails, invalidated dependencies와 conform receipt다. Source/emission time은 보존하고 presentation time만 명시 transform으로 갱신한다.

<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization 이 절은 causal event와 audible presentation의 offset을 검증 가능하게 한다. -->
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-boundary-continuity 이 절은 cut와 transition에서 loop, tail, ambience와 room state를 판정한다. -->

각 sync constraint는 event identity, expected presentation sample, tolerance와 policy를 가진다. Cut boundary는 one-shot truncation/tail, sustained continuation/restart, ambience phase, music transition와 acoustic response change를 명시한다. Crossfade나 room-tone bridge는 authored transition이고 누락을 가리는 implicit repair가 아니다.

### Conform invalidation {#sound-conform-dependency-invalidation}
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-conform-invalidation 이 절은 picture 변경이 dependent timing과 analysis를 stale로 만든다. -->

Picture clip range, rate, transition, shot order 또는 duration이 바뀌면 영향을 받는 cue presentation, dialogue marks/visemes, ambience phase, music grid, automation, spatial/acoustic samples, mix, loudness와 delivery probe가 stale이다. Invalidation은 dependency graph의 identity로 계산하고 영향 없는 adopted source bytes까지 무효화하지 않는다.

### Audio-visual duration join {#audio-visual-duration-and-timebase-join}
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-audiovisual-duration-join 이 절은 picture frame end와 audio sample end의 단일 환산을 정한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-picture-delivery-join 이 절은 sound와 picture evidence를 같은 final artifact revision에 묶는다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-timestamps 이 절은 A/V join의 결과를 실제 media timestamp에 보존한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization 이 절은 final stream들의 origin과 duration 동기를 판정한다. -->
<!-- @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness 이 절은 caption cue를 같은 pictureㆍdialogue revision과 time transform에 묶는다. -->
<!-- @evidence requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-mix 이 절은 audio-description mix를 master와 같은 A/V join으로 검증한다. -->

Join input은 rational picture frame rate와 range, masterㆍalternateㆍaudio-description sample ranges, caption cue ranges, head/tail policy, final container timebase다. 하나의 exact rational mapping이 first/last presented frame, 각 audio stream의 first/last sample과 caption cue를 결정하고 paddingㆍtrimㆍtail은 named policy로만 발생한다. Output은 expected duration, actual stream durations, cue coverage, offset과 tolerance이며 서로 다른 revision의 picture, sound와 accessibility artifact를 결합하지 않는다.

### Sync refusal {#sound-sync-refusal-contract}
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-sync-refusal 이 절은 모순된 transform과 허용 밖 duration 차이를 거절한다. -->

Noninvertible 또는 unsupported rate transform, source 범위 밖 trim, duplicated ownership, stale conform, sync tolerance 초과, A/V duration mismatch는 clipㆍcue와 sample/frame 경계를 지목한 실패다. 자동 sample drop, frame duplication, tail 절단으로 성공 판정을 만들지 않는다.

## Delivery stream과 inventory {#sound-delivery-stream-and-inventory-group}

### Delivery stream과 inventory {#sound-delivery-stream-and-inventory}

<!-- @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe 이 절은 최종 container의 실제 stream facts를 검사하게 한다. -->
<!-- @evidence requirements/sound/validation-and-delivery.md#sound-delivery-inventory 이 절은 master, stems, source와 receipt의 완전한 목록을 요구한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-identity 이 절은 inventory가 실제 container stream identity를 기록하게 한다. -->
<!-- @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-completeness 이 절은 요구 언어별 audio와 text artifact의 누락을 inventory에서 판정한다. -->

Final probe 입력은 실제 delivery bytes이고 output은 container, stream index, codec, language/role, sample rate, channel layout, duration, start time, loudness/peak measurement와 digest다. Inventory는 master, required stems, clean dialogue, alternate-languageㆍaudio-description streams, captions, dialogue/music/effects deliverables, source/provenance receipts, conform revision과 evidence status를 열거한다. Plan이나 filename은 observed stream facts를 대신하지 않는다.

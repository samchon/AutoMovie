# Editorial audiovisual continuity

## Contract units {#spec-editorial-audiovisual-continuity-contract-units}

### Picture와 sound의 독립 edit {#spec-editorial-picture-sound}
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-picture-sound-edits Picture와 sound edit의 독립 clock을 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-sound-emission-presentation Sound emission과 presentation time을 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-dialogue-edits Dialogue trim과 overlap을 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-room-tone-ambience Room tone과 ambience 연속성을 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-effects-music-edits Effect와 music edit를 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-channel-mix-relation Channel과 mix relation을 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-silence-missing-audio Silence와 missing audio를 정밀화한다. -->
<!-- @evidence requirements/editorial/picture-and-sound-edits.md#editorial-audio-boundary-refusal Audio boundary 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-editing-sync-continuity 편집 계약이 sound의 source range와 tail을 같은 film clock에서 소비한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-fixed-audio-clock Sound sample identity는 frame grid와 독립된 fixed clock을 요구한다. -->

Audiovisual edit는 picture lane과 하나 이상의 sound lane을 공통 rational film clock에 배치하되 각각의 source range, boundary, transition과 duration을 독립적으로 소유한다. Sound cue는 source identity, emission time, presentation start, trim, final decoded duration, sample rate, gain, bus, fade와 intended tail을 가지며 picture frame index를 audio sample index로 사용하지 않는다. Dialogue, effect, ambience, music과 authored silence는 구분된 role이고, absence·decode failure·not-run을 silence로 합치지 않는다.

J-cut, L-cut, prelap과 tail은 film range와 clip ownership을 보존하며, picture cut이 sustained audio state를 reset하지 않는다. Dialogue alignment는 final decoded bytes를 authority로 삼고, room tone과 ambience는 boundary 양쪽 environment revision에 맞아야 한다. Mixing 전 result는 cue population, exact sample interval, channel·bus mapping, overlaps와 gap classification을 제공하여 사용자가 실제로 무엇이 들릴 예정인지 확인할 수 있게 한다.

Truncated utterance, missing handle, duplicate exclusive cue, stale alignment, incompatible channel, film 밖 required tail과 undeclared silence는 거절한다. 독립 stem이나 interval은 보존할 수 있지만 required sound가 없는 film range는 partial audiovisual edit이며, picture-only result를 sound-complete로 승인하지 않는다. Picture, cue source, timing 또는 mix revision 변경은 정확히 영향받는 mix, caption, encode와 audible review를 stale로 만든다.

### Marker, effect와 metadata ordering {#spec-editorial-marker-effect-metadata}
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-markers-effects-metadata Marker, effect와 metadata 계약을 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-marker-event-distinction Marker와 semantic event 구분을 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-marker-scope Marker scope를 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-effects Effect의 시간과 적용 범위를 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-effect-ordering Effect ordering을 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-metadata-provenance Metadata provenance를 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-marker-partial-result Partial marker 결과를 정밀화한다. -->
<!-- @evidence requirements/editorial/markers-effects-and-metadata.md#editorial-metadata-refusal Metadata 거절 조건을 정밀화한다. -->

Marker는 stable identity, label, exact film instant 또는 range, scope와 source rationale를 가진 탐색·검토 표식이며, story나 world의 semantic event를 새로 만들지 않는다. Effect는 target track·clip·layer, active range, ordered transform, parameter identity와 supported input/output domain을 가진다. Metadata는 title, role, language, notes, provenance 또는 destination hint처럼 의미가 정의된 field와 source revision을 가지며 free-form 값이 required media fact를 대신하지 않는다.

같은 scope와 order position에서 결과가 달라질 수 있는 effect 충돌은 명시적 precedence 없이는 평가하지 않는다. Marker와 effect는 clip retime, reorder와 conform에 따라 exact mapping으로 이동하거나 stale이 되며, film-global marker와 clip-local marker를 이름만으로 합치지 않는다. Result는 applied, excluded, unresolved와 stale 항목, evaluation order, input·output identity와 observed boundary를 구분한다.

Unknown scope, duplicate identity, out-of-film required marker, cyclic effect order, non-finite parameter, incompatible media domain과 provenance 없는 required metadata는 거절한다. Optional marker의 실패는 독립 결과로 남길 수 있지만 effect가 실패한 picture나 sound interval은 원본으로 몰래 대체하지 않고 candidate 또는 partial로 표시한다.

### Cut continuity와 film grammar {#spec-editorial-continuity-grammar}
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-film-grammar Cut continuity와 grammar 검토 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-match-on-action Action match의 시간 관계를 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar Screen direction과 eyeline 관계를 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-state-continuity Story state 연속성을 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-reaction-information Reaction과 정보 전달을 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation 의도적 grammar 위반의 기록을 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-incomplete 불완전 continuity 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding Continuity finding의 관찰 내용을 정밀화한다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-sequence-surface Cut 양쪽의 sequence 표면이 continuity 판정 범위를 소유한다. -->

Continuity evaluation은 각 cut의 outgoing과 incoming sample window, event phase, actor·prop·costume·damage·environment state, gaze, eyeline, screen direction, spatial relation, light와 ambience를 동일한 selected edit revision에 결속한다. Match on action은 이름이 같은 event가 아니라 양쪽의 realized phase와 direction을 비교하고, reaction과 information cut은 관객이 전후 shot에서 얻는 semantic change와 필요한 hold를 기록한다.

각 relation은 expected state, actual state, observation scope, severity, intentional exception과 evidence identity를 가진 finding을 만든다. Style intent가 낮은 우선순위 규칙의 위반을 허용할 수 있으나 위반 사실과 얻는 narrative 목적을 모두 남기며 자동 pass로 바꾸지 않는다. 한 hero frame은 motion 또는 boundary continuity를 증명하지 못하므로 cut 전후와 semantic event 인접 sample을 포함한다.

필수 sample이나 state가 missing, stale 또는 unsupported이면 finding은 incomplete이며 pass가 아니다. Mismatch가 source 결함이면 source를, edit pairing 결함이면 cut을 수정 대상으로 가리키고 수정 뒤 affected cut과 sequence review를 stale로 만든다. 독립적으로 검증된 cut은 보존하되 sequence 전체 coverage가 닫히지 않으면 partial verdict만 허용한다.

### Pacing과 audiovisual rhythm {#spec-editorial-pacing-rhythm}
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-pacing-rhythm Pacing과 rhythm 분석 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-narrative-priority Narrative priority를 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-duration-pattern Duration pattern을 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-readability-time 정보 readability 시간을 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-audiovisual-rhythm Picture와 sound rhythm 결합을 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-pacing-version-comparison Version 간 pacing 비교를 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-pacing-partial-analysis Partial 분석 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/pacing-and-rhythm.md#editorial-pacing-claim-boundary Pacing claim의 주관적 경계를 정밀화한다. -->

Pacing analysis는 selected revision의 ordered shot·beat ranges, duration, internal motion events, dialogue envelope, sound onset·tail, silence와 transition을 입력으로 받는다. System은 exact duration pattern, cut density, event 간격과 변화 구간을 측정하되 emotion이나 story effectiveness를 수치만으로 판정하지 않는다. Narrative priority, 정보의 등장과 읽을 수 있는 hold, anticipation과 consequence는 author 또는 reviewer가 남긴 실제 관찰에 결속한다.

Version 비교는 공통 story beat와 semantic event mapping을 기준으로 duration delta, reorder, added·removed range와 audiovisual emphasis 변화를 보여준다. 서로 다른 cut의 단순 frame number를 대응시키거나 빠른 cut을 자동으로 좋은 rhythm으로 분류하지 않는다. Analysis 결과는 measured facts, subjective observations, uncovered ranges와 적용 profile을 분리한다.

Missing beat mapping, stale sound envelope, 불완전 film range와 서로 다른 comparison profile은 완전한 pacing 판정을 거절한다. 관찰된 sequence만 partial analysis로 보존하고 film 전체 주장으로 확대하지 않는다. Edit나 sound revision 뒤 affected measures와 review를 다시 계산하되 영향 없는 beat observation은 dependency 근거와 함께 재사용할 수 있다.

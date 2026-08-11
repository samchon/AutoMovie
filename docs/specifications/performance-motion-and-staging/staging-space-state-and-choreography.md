# Staging space, state와 choreography

## Story 사실에서 resolved stage까지 {#performance-staging-story-resolved-stage-boundary}

<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-scope-source scene을 수행 가능한 공간 사건으로 변환하는 경계를 정의한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-story-distinction story 사실과 촬영을 위한 staging 선택을 분리한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-authored-blocking 배치와 행동 관계를 명시적으로 저작한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-upstream-source-trace 모든 staging 결정이 상위 scene·beat·state를 추적하게 한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state 각 time의 배치·동작·event를 resolved state로 산출한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-open-style 연출 양식을 닫힌 preset으로 제한하지 않는다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-plan-alternatives mutually exclusive staging plan을 별도 branch로 보존한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-autofill-refusal story에 없는 object, action과 관계를 임의로 완성하지 않는다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scenes-observable-action scene의 관찰 가능한 action을 staging 입력으로 사용한다. -->

Staging plan은 stable plan identity와 revision, scene·beat evidence, story entry state, participants와 required objects, spatial intent, timed choreography, camera·coverage intent, acceptance target을 가진다. Story는 누가 무엇을 왜 바꾸는지와 scene의 place·time을 소유하고 staging은 그것이 world 안에서 어디에 서고 언제 움직이며 어떤 관계로 보이는지를 선택한다. Staging이 story fact를 새로 만들거나 상위 scene의 삭제된 participant를 계속 사용하지 않는다.

Resolved scene state는 production frame의 time마다 subject·object transform, active pose·motion·attachment, formation state, mark·zone membership, contact·event, camera visibility와 light·effect context를 하나의 current input fingerprint에서 계산한다. Style은 사용자 또는 author가 선택한 framing, spacing, choreography와 exception으로 열려 있지만, 선택은 explicit plan variant와 rationale로 기록한다. 여러 alternative는 동시에 active state로 병합하지 않으며 선택 변경은 downstream shot·review evidence를 stale로 만든다.

필수 story fact를 공간과 시간으로 실현할 수 없거나 source trace가 끊기거나 plan이 story에 없는 사건을 성공 조건으로 추가하면 gap 또는 refusal이다. 시스템은 빈 장면을 generic blocking으로 채우거나 누락 object를 자동 생성하지 않고 story 수정, asset·capability 추가, 다른 staging, 보류 선택지를 반환한다.

### Mark, surface와 zone membership {#performance-staging-mark-surface-zone-membership}

<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-marks-zones-blocking 공간에 고정되는 의미 anchor를 stable record로 둔다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-reference-frame mark의 frame, unit와 revision을 명시한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface mark가 실제 support surface 또는 공간을 참조하게 한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-zones bounded region과 semantic purpose를 정의한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership point가 아닌 current extent로 zone membership을 판정한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-blocking-relations subject 사이의 거리, 방향, 앞뒤와 screen 관계를 기록한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-intentional-spatial-exceptions deliberate spatial break를 typed exception으로 보존한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-refusal stale, off-surface, ambiguous mark를 거부한다. -->

Mark는 stable identity, owning space·surface·route·object frame, local position과 facing, height·clearance policy, intended subject role, revision과 tolerance를 가진다. Zone은 stable identity, geometric region, reference frame, semantic purpose, allowed·required subject kinds, active interval과 membership law를 가진다. World point를 복사해 둘을 연결하지 않고 shared frame identity와 transform으로 resolve한다.

Membership은 subject root뿐 아니라 current conservative extent 또는 명시된 contact feature가 zone에 들어오는지, 완전 포함·교차·중심 포함 중 어떤 법을 쓰는지로 판정한다. Blocking relation은 mark·zone과 participants 사이의 distance, orientation, left·right, foreground·background, line-of-action, protection·keep-out 같은 typed relation과 tolerance를 가진다. 연출상의 axis crossing, intentional overlap 또는 off-mark action은 영향 범위를 제한한 exception과 rationale로만 허용한다.

Reference revision mismatch, missing surface, non-finite transform, mark below·above support tolerance, ambiguous multi-space, invalid zone volume, contradictory membership와 unacknowledged relation break는 실패다. 자동으로 nearest floor나 origin으로 옮기지 않으며 사용자가 다른 mark, surface, alternative plan 또는 exception을 선택하게 한다.

## Subject와 object placement {#performance-staging-subject-object-placement}

<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-subject-object-placement scene 시작의 실제 배치를 명시한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-placement-design-geometry-trace placement가 design identity와 current geometry proxy를 추적하게 한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-rest-active-placement rest placement와 active motion state를 구분한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-placement-support-contact support와 contact를 실제 geometry 관계로 검증한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-external-asset-use 외부 appearance를 deterministic proxy와 함께 배치한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-dressing-story-props background dressing과 story prop의 authority를 구분한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-placement-alternatives 배치 alternative와 선택 근거를 보존한다. -->
<!-- @evidence requirements/staging/subjects-and-object-staging.md#staging-placement-refusal floating, overlap, missing relation과 unsupported placement를 거부한다. -->
<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance prototype과 staged instance identity를 분리한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement external asset 교체가 placement와 proxy lineage를 보존하게 한다. -->

Placement record는 scene-node identity, actor·object·formation·environment design identity, chosen representation, world transform, support surface 또는 parent relation, rest state, active motion binding과 source trace를 가진다. Rest placement는 scene entry의 authored state이고 active placement는 motion·attachment·solver로 시간에 따라 파생되므로 source transform을 덮어써 하나의 값으로 저장하지 않는다. External appearance도 same placement를 따르되 occupancy, support, clearance와 collision 판단은 current deterministic proxy를 사용한다.

Story prop은 event·contact·continuity identity를 가지며 background dressing은 bounded population 또는 set identity와 visual purpose를 가진다. Dressing을 story participant로 자동 승격하거나 story prop을 anonymous instance로 cull하지 않는다. Placement alternative는 mark, orientation, support, representation과 predicted visibility·cost를 비교하고 사용자 또는 authorized author가 하나를 선택한다.

출력은 normalized transform, support·contact result, occupied and keep-out extent, relation resolution, representation and source receipt다. Missing design, duplicate node, unsupported scale, floating·penetrating support, forbidden overlap, dangling parent, external digest mismatch와 relation contradiction은 실패이며 geometry를 origin에 놓거나 collision을 끄는 fallback을 금지한다.

### Interaction choreography와 participant role {#performance-staging-interaction-choreography-role}

<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-interactions-choreography 여러 subject가 공유하는 action을 하나의 choreography로 정의한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-interaction-roles initiator, receiver, object, support와 observer 역할을 명시한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-spatial-synchronization 여러 participant의 공간 상태를 같은 time에서 맞춘다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-interaction-contact-contract choreography phase를 motion contact contract와 연결한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-choreography-phases preparation, action, contact, reaction과 settle을 구분한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-choreography-time-sampling phase endpoint와 interior를 같은 clock에서 검증한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-choreography-alternatives 안전·가독성·capability에 따른 choreography 대안을 보존한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-interaction-refusal role, timing, reach와 contact가 맞지 않는 interaction을 거부한다. -->
<!-- @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction dialogue와 physical interaction의 event 관계를 보존한다. -->

Choreography contract는 stable identity, semantic purpose, participants와 typed roles, target object·mark·zone, ordered phases, phase intervals, causal events, required contact·visibility와 completion state를 가진다. Roles는 initiator, receiver, carrier, object, support, observer처럼 action별로 등록 가능하며, 같은 participant가 여러 role을 가질 때 배타성 또는 compose rule을 명시한다. 여러 subject의 root, limb, object와 formation state는 같은 shot-local time에서 resolve한다.

Preparation, approach, contact·decision, reaction, follow-through와 settle은 필요에 따라 생략 가능하지만 각 semantic event가 어느 phase에 실현되는지 고정한다. Contact phase는 motion layer의 contact identity와 target feature, tolerance를 공유하고, reaction은 authored cue 또는 computed event provenance를 구분한다. Alternative choreography는 동일 story outcome을 다른 route·hand·timing·participants로 실현할 수 있고 capability, safety, readability, cost를 비교해 선택한다.

Validation은 exact event frame뿐 아니라 phase interior, moving target, transition과 shot boundary를 sample한다. Missing role, duplicate authority, unreachable target, impossible timing, contact residual, object ownership conflict, route·zone violation 또는 response event 누락은 실패다. Action이 얼핏 비슷하다는 시각적 인상으로 semantic interaction을 성공 처리하지 않는다.

### Visibility, reveal과 readability {#performance-staging-visibility-reveal-readability}

<!-- @evidence requirements/staging/visibility-and-readability.md#staging-visibility-readability 관객이 사건을 읽을 수 있는 공간·시간 배치를 요구한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-readability-acceptance subject, action과 event를 falsifiable acceptance로 만든다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-occlusion-relations occluder, occluded subject와 의도 관계를 기록한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-reveal-concealment reveal과 concealment를 time-varying event로 정의한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-intentional-unreadability 의도적 비가독성을 제한된 exception으로 표현한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-readable-duration 한 frame이 아니라 필요한 readable duration을 검증한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-visibility-time-sampling visibility 변화 구간의 interior sample을 검증한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-multi-subject-priority 여러 subject의 screen priority와 trade-off를 명시한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance story 변화를 현재 frame·event로 반증 가능하게 한다. -->

Readability contract는 required subject·feature·action·event, camera or take, time window와 minimum readable duration, shot-size or projected contribution expectation, maximum occlusion, contrast·mask or guide-pass need, priority와 acceptance wording을 가진다. Occlusion relation은 occluder, subject, interval, intended reveal·conceal purpose와 tolerance를 기록하고, current moving bounds와 camera state에서 측정한다. Root point가 frame 안에 있다는 사실만으로 limb contact, group extent나 prop action이 읽힌다고 판단하지 않는다.

Reveal은 이전 concealed state, threshold crossing 또는 semantic event와 후속 readable hold를 가져야 하고 concealment도 언제 무엇을 숨기는지 명시한다. 여러 subject가 경쟁하면 priority와 simultaneous requirement를 기록하고, 낮은 priority를 조용히 drop하지 않는다. 의도적 unreadability는 specific subject·interval·reason만 예외로 하며 unrelated required event를 면제하지 않는다.

Output은 sampled extent projection, visibility·occlusion observation, readable interval, acceptance target과 required review frame다. 자동 geometry는 framing과 coarse visibility를 판단하고 pixel-level occlusion, dramatic emphasis와 표정 전달은 current beauty·mask·depth·outline evidence review가 판단한다. Required duration 미달, interior occlusion, stale evidence와 unsupported measurement는 실패 또는 `needs-review`다.

## Shot·scene state handoff {#performance-staging-shot-scene-state-handoff}

<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-handoff-continuity shot과 scene 경계의 state 인계를 명시한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-lineage state 값의 source, cause와 revision lineage를 보존한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-edit-boundary-state outgoing과 incoming boundary를 같은 측정 사실로 비교한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-cross-domain-continuity actor, object, formation, world와 camera state를 함께 검사한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-offscreen-change 화면 밖 state change에도 authored cause를 요구한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-alternatives alternate take의 state를 hero timeline과 섞지 않는다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-authored-discontinuity time jump와 intentional discontinuity를 명시한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-continuity-finding mismatch를 측정값과 recovery가 있는 finding으로 반환한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-state-transition-causes 모든 state 변화가 authored 또는 observed cause를 갖게 한다. -->

Handoff state는 boundary identity와 exact film·shot·story time mapping, actor·object·formation transform과 motion phase, pose·expression·gaze, attachment·ownership, costume·prop, environment·light와 unresolved momentum을 필요한 범위만 포함한다. 각 field는 source, cause, observation·derivation, revision과 tolerance를 가지며 scene-local ephemeral state와 film-persistent state를 구분한다.

Untrimmed continuous cut에서는 outgoing closing과 incoming opening이 동일한 measured fact와 compatible tolerance를 선언해야 한다. Trimmed boundary는 source edge를 재측정할 수 있을 때만 continuity를 주장하고, 새 시간·장소의 scene break는 carry fact를 비워 둘 수 있다. Off-screen change, time jump와 intentional discontinuity는 story or staging cause를 기록하며 unknown gap을 자동 변화로 합리화하지 않는다.

Coverage take와 alternative plan은 같은 opening state에서 독립적으로 수행될 수 있지만 각자 closing state와 evidence branch를 가지며 선택 전에는 canonical timeline을 바꾸지 않는다. Finding은 domain, identity, outgoing·incoming values, time mapping, tolerance, severity와 recovery를 포함한다.

### Staging compatibility와 stale state {#performance-staging-compatibility-stale-state}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-deletion-invalidation upstream scene 또는 participant 삭제가 staging을 stale하게 한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-upstream-source-trace staging revision과 상위 source freshness를 비교한다. -->

새 optional mark, zone, placement relation, choreography role 또는 readability metric을 추가해도 이를 사용하지 않는 기존 plan의 resolved scene은 유지되어야 한다. Reference frame, state retention, membership, contact, time-boundary 의미를 바꾸는 변경은 versioned migration이고, affected shot contracts와 review evidence를 다시 생성한다.

Upstream story, design geometry, external asset bytes, world surface, actor·formation state 또는 frame clock이 바뀌면 그 identity를 참조하는 resolved state와 frame evidence는 stale다. Stale state를 current output에 섞거나 오래된 placement를 새 geometry에 재사용하지 않고 dependency path와 필요한 re-stage 범위를 반환한다.

# 검토 표면과 Sampling

## 독립 검토 표면 {#review-system-independent-surfaces}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-review-surfaces Defines asset, shot, sequence, film and delivery as independent acceptance surfaces. -->
<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-frame-range-whole-work Preserves frame, interval and whole-work reviews as distinct claims. -->

각 검토 표면은 자신의 target identity, required criteria, sampling plan, evidence coverage와 verdict를 가진다. 하위 표면의 current pass는 상위 표면의 입력이 될 수 있지만 상위 표면의 독립 관찰과 판단을 대신하지 않는다.

### Asset 표면 {#review-system-asset-surface}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-asset-surface Defines asset acceptance across identity, silhouette, state, rig and intended use. -->

Asset 표면은 의도한 identity, silhouette, scale, material separation, state, rig, deformation과 attachment를 요구된 angle, distance와 state에서 관찰한다. 한 view에서 보이지 않는 back, depth, hidden collision과 range를 통과로 판정하지 않는다.

### Frame 표면 {#review-system-frame-surface}

<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-frame-inspection Defines exact-frame inspection and location-bound annotation. -->

Frame 표면은 exact artifact, frame index와 time, pass, raster와 view에서 composition, visibility, pose, expression, contact, geometry, material, text와 artifact를 관찰한다. 한 frame verdict는 다른 frame이나 시간 구간의 불변성을 주장하지 않는다.

### Shot과 구간 표면 {#review-system-shot-interval-surface}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-shot-surface Defines shot-level dramatic, staging, performance and continuity acceptance. -->
<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-range-inspection Defines interval-level motion, timing, transition and synchronization review. -->

Shot과 구간 표면은 명시된 시작과 끝 사이에서 dramatic event, staging, performance, camera, lighting, motion, transition, collision, continuity와 picture, sound, caption synchronization을 시간 순서로 판정한다.

### Sequence 표면 {#review-system-sequence-surface}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-sequence-surface Defines cross-shot continuity, rhythm, state and coverage review. -->

Sequence 표면은 ordered shot run과 양쪽 transition context를 가지며 action, pose, gaze, screen direction, 공간, light, sound, story state, rhythm과 coverage를 판정한다. Shot verdict의 합계만으로 sequence verdict를 만들지 않는다.

### Film 표면 {#review-system-film-surface}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-film-surface Defines whole-film story, pacing, synchronization and accessibility review. -->
<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-whole-work-inspection Defines whole-work narrative, pacing, continuity and ending judgment. -->

Film 표면은 작품의 처음부터 끝까지 story promise, causality, character arc, pacing, tone, audiovisual synchronization, accessibility, 장기 continuity와 ending state를 판정한다. 반복되거나 조용한 구간도 명시적 제외가 없으면 표면에 포함한다.

### Delivery 표면 {#review-system-delivery-surface}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-delivery-surface Defines acceptance over actual delivery bytes and package completeness. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-audiovisual-review Requires review of the decoded final audiovisual product rather than an intermediate. -->

Delivery 표면은 실제 candidate 또는 published bytes의 stream, duration, picture, color, audio, caption, language, accessibility, provenance와 package closure를 대상 profile로 판정한다. Source, render intermediate 또는 manifest assertion은 decoded delivery 관찰을 대신하지 않는다.

## 시간 Sampling Plan {#review-system-temporal-sampling-plan}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-temporal-sampling Requires endpoints, events, transitions, state changes and high-risk intervals. -->

시간 sampling plan은 대상 범위, 첫 표본과 마지막 표본, semantic event, transition boundary, state change, 알려진 고위험 구간, 표본 선택 규칙과 완전 재생 여부를 가진다. 같은 입력과 plan은 같은 표본 identity와 순서를 만든다.

### 표본에서 구간으로의 일반화 {#review-system-sample-interval-generalization}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-sample-interval-claim Defines the conditions required to generalize samples to a continuous interval. -->
<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-sampling-full-coverage Separates sampled evidence from full playback and whole-work approval. -->

표본 verdict를 연속 구간으로 일반화하려면 profile이 구간 불변식, 최대 변화율, 표본 간격 또는 완전 재생 의무를 선언해야 한다. 이 근거가 없으면 verdict scope는 실제 관찰한 표본의 합집합이다.

### 공간과 View Sampling {#review-system-spatial-view-sampling}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-spatial-view-sampling Requires views that expose geometry, contact, occlusion and deformation risks. -->

공간과 view sampling plan은 criterion이 다루는 형상, 접촉, occlusion, surface와 deformation을 드러내는 angle, distance, camera, state와 structural view를 식별한다. Sampling plan은 서로 중복되는 view와 아직 관찰하지 않은 영역을 구분한다.

### 직접 관찰과 대체 표현 {#review-system-direct-observation}

<!-- @evidence requirements/review/criteria-and-comparison.md#review-direct-observation-priority Requires the final decision maker to inspect actual frames or playback. -->

최종 판정에 필요한 perceptual surface는 실제 current pixel이나 decoded audio로 관찰해야 한다. Summary, thumbnail, metadata, metric과 다른 사람의 verdict는 보조 evidence이며 직접 관찰을 대체한 경우 그 제한과 미관찰 범위를 남긴다.

### 필수 표본 누락 {#review-system-missing-sample-state}

<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-missing-sample-verdict Prevents missing required samples from becoming a pass. -->

필수 표본이 없거나 읽을 수 없으면 그 표본이 필요한 criterion은 pass가 될 수 없다. 결과는 원인에 따라 not-run, unsupported, indeterminate 또는 partial이며 관찰된 표본의 좁은 결과를 별도로 보존한다.

### 범위 간 영향 전파 {#review-system-cross-scope-propagation}

<!-- @evidence requirements/review/frame-range-and-whole-work.md#review-cross-scope-propagation Reopens adjacent and parent scopes affected by a local defect. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-narrow-revalidation-limit Prevents one narrow recheck from restoring a broader approval. -->

한 표본의 defect가 인접 시간, transition 또는 상위 표면에 영향을 주면 dependency graph는 영향받은 범위를 stale로 표시한다. 좁은 재검토는 실제로 다시 관찰한 범위만 current로 회복한다.

# Alternative, Deviation과 Evidence {#alternatives-deviations-evidence-specification}

## Alternative Branch Model {#clv-alternative-branch-model}

### Camera Continuity와 Intentional Deviation {#clv-camera-continuity-deviation}

<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-alternatives-intentional-deviations Lighting choice의 common source, difference, interval와 acceptance를 정규화한다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-take-lineage Camera take의 common source와 독립 optical·grammar state를 보존한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-take-identity Performance, camera, timing과 staging take identity를 함께 추적한다. -->

Alternative branch는 stable branch identity, common story·staging·design·geometry source closure, parent branch, changed camera·lighting fields, applicable shot·film interval, delivery profile, budget consequence, acceptance와 evidence set을 가진다. Branch는 immutable comparison candidate이며 선택 전 서로 다른 branch의 state, pixels, metrics와 receipts를 결합하지 않는다.

<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-continuity-intentional-violations Shot size, axis, eyeline, movement, lens와 subject scale의 sequence state를 추적한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-match-contrast Match와 contrast를 저작 가능한 continuity operation으로 만든다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-line-cross-motivation Line crossing의 reorientation evidence와 motivation을 요구한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-violation-contract 위반의 reason, scope, cue, consequence와 acceptance를 구조화한다. -->

Sequence camera state는 shot size, axis side, eyeline, screen direction, movement vector, lens character, camera height, projected subject scale와 valid cut boundary를 가진다. Match on action, graphic match, scale progression, angle·lens contrast와 spatial reset은 source event, outgoing·incoming samples와 intended viewer consequence를 선언한다.

Axis, eyeline, screen direction, framing, focus, exposure, stability와 clipping rule의 deviation은 affected rule, shots·takes·intervals, higher story reason, viewer cue, allowed consequence와 falsifiable acceptance를 가진다. Camera move, neutral shot, subject reorientation, reveal 또는 establishing view가 line cross를 설명한다면 그 evidence sample을 직접 식별한다.

### Reset, Alternative와 Silent Suppression Refusal {#clv-camera-reset-alternative-refusal}

<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-alternatives Framing, lens, path와 grammar choice를 독립 candidate로 보존한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-alternative-comparison Camera A/B의 story, staging, design, light, raster와 time 조건을 통제한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-reorientation-reset 이전 relation, reset event와 이후 기준을 추적한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-silent-violation-refusal Threshold 확대나 gate disable을 deviation declaration으로 인정하지 않는다. -->

Neutral view, establishing shot, visible move, subject turn와 time·place change의 reset receipt는 이전 relation, reset event, viewer evidence와 이후 grammar basis를 가진다. Shot boundary만으로 relation을 초기화하지 않는다.

Camera alternative comparison은 같은 story event, staging state, production-design revision, lighting state, delivery raster와 rational review samples를 common basis 또는 explicit difference로 기록한다. Rule check 비활성화, threshold 확대, operand 삭제와 reason 없는 suppression은 `failed`이며 의도된 위반으로 승격하지 않는다.

## Lighting Deviation와 Selection {#clv-lighting-deviation-selection}

### A/B Basis와 Selection Receipt {#clv-lighting-ab-selection-receipt}

<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-intentional-deviations Lighting continuity, source, shadow, reflection와 exposure deviation의 cue를 정밀화한다. -->
<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-alternative-state-branches Environment, source, link, practical, optical와 color state의 branch lineage를 보존한다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-intentional-optical-break Optical deviation을 physical analysis result와 분리한다. -->

Lighting deviation은 affected source·surface·subject·camera·rule·interval, story reason, viewer cue, accepted optical·continuity consequence와 review authority를 가진다. Stylized shadow, selective reflection, practical mismatch와 exposure contrast가 승인돼도 source-state 또는 physical-analysis result를 변경하지 않고 별도 creative acceptance로 남는다.

<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-alternative-comparison-conditions Camera, staging, geometry, material, time, exposure, view와 raster를 통제한다. -->
<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-alternative-selection 선택 이유, acceptance, approximation, continuity와 budget consequence를 기록한다. -->
<!-- @evidence requirements/lighting/alternatives-and-intentional-deviations.md#lighting-alternative-refusal Noncomparable condition, branch mixing과 unsupported claim을 finding으로 만든다. -->

Lighting A/B receipt는 camera, staging, geometry, material, rational sample, exposure, working space, display view와 raster를 고정하거나 difference로 열거한다. Selection receipt는 chosen branch, decision owner, reason, satisfied acceptance, unresolved approximation, continuity·budget consequence와 replaced branches를 가진다.

Common condition이 불명확하거나 semantic event를 대응할 수 없는 후보는 `noncomparable`이다. Branch-state 혼합, unsupported optical claim, 선택되지 않은 source 잔류와 한 candidate의 finding을 다른 candidate에 적용하는 행위는 named failure다.

## Evidence Manifest {#clv-evidence-manifest}

### Multi-time, A/B와 Deterministic Recheck {#clv-evidence-sampling-recheck}

<!-- @evidence requirements/camera/validation.md#camera-validation-manifest Camera evidence가 take, upstream source, revisions, raster, samples와 tolerance를 기록하게 한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-contract Lighting evidence가 question, quantity, operands, samples와 approximation을 기록하게 한다. -->

Evidence manifest는 target production·scene·shot·take·branch identity, exact source and dependency closure, story·staging·design·geometry·material revisions, camera·lighting·exposure·display state, delivery raster, rational sample plan, pass 또는 analysis profile, tolerance, execution identity, artifact digest, method, coverage와 freshness를 가진다. 한 evidence item은 자신이 실제 관찰한 method와 scope만 증명한다.

<!-- @evidence requirements/camera/validation.md#camera-multi-time-capture Start, middle, end와 critical transition sample의 coverage를 요구한다. -->
<!-- @evidence requirements/camera/validation.md#camera-reproducible-capture 같은 source와 sample identity의 capture 결정을 재현한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-ab-multitime Source, material, exposure와 display를 통제한 multi-time 비교를 요구한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-deterministic-recheck 실행 순서와 무관한 metric, finding와 frame decision을 요구한다. -->

Evidence plan은 start, middle, end, semantic event, cue, cut, transition boundary, threshold crossing과 worst-case sample을 포함하고 선택 근거를 기록한다. A/B는 common basis와 one-or-more declared differences를 보존하며 다른 sample이나 presentation condition을 같은 순간처럼 비교하지 않는다.

같은 source digest, revisions, branch, rational clock, sample set, seed, analysis 또는 presentation profile은 direct seek, sequential playback, chunk, retry와 execution order에 관계없이 같은 metric, finding와 deterministic frame decision을 내야 한다. Runtime 또는 supported comparison domain이 다르면 exact equality를 주장하지 않고 compatibility 상태를 기록한다.

### Current Pixel Evidence와 Freshness {#clv-current-pixel-evidence-freshness}

<!-- @evidence requirements/camera/validation.md#camera-current-viewer-evidence Source 변경 뒤 실제 current pixels와 geometry metadata를 함께 검토한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-fresh-visual-evidence Camera, light, material, display와 branch 변경이 capture를 stale로 만든다. -->

Current pixel evidence는 source closure와 artifact digest가 manifest의 expected identity와 일치하고 실제 display 또는 decoded product를 해당 raster·pass·sample에서 관찰한 기록이다. Source, geometry, material, camera, exposure, display, lighting branch 또는 execution identity의 영향받는 변경은 metric, capture와 downstream verdict를 `stale`로 만든다.

Sampled frames는 선언한 sample coverage만 증명하고 전체 interval이나 작품 승인을 자동으로 증명하지 않는다. 이 specification 작성 자체는 visual verification 실행이나 pixel 성공의 evidence가 아니다.

### Result Status와 Review Authority {#clv-result-status-review-authority}

<!-- @evidence requirements/camera/validation.md#camera-validation-status Numeric, frame, sequence grammar, failed, unsupported와 not-run을 구분한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-status Solved metric, rendered review, failed, unsupported와 not-run을 구분한다. -->

Result status는 `planned`, `computed`, `rendered`, `reviewed`, `failed`, `unsupported`, `not-run`, `stale`와 `noncomparable`을 구분하고 method별 scope를 가진다. Numeric geometry pass는 pixel review나 grammar pass가 아니며 beauty image는 photometric analysis가 아니다.

자동 validation은 operand, measurement와 finding을 제공하지만 최종 creative approval, rejection와 waiver는 명시된 사람과 scope의 decision receipt가 소유한다. Required method가 `unsupported`, `not-run` 또는 `stale`이면 이를 pass나 complete로 축약하지 않는다.

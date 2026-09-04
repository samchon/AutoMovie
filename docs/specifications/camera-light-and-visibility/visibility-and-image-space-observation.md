# Visibility와 Image-space Observation {#visibility-image-space-observation-specification}

## Visibility Evaluation Context {#clv-visibility-evaluation-context}

### Clipping와 Camera Clearance {#clv-clipping-clearance-evaluation}

<!-- @evidence requirements/staging/visibility-and-readability.md#staging-visibility-readability 필수 subject와 event를 camera·light가 함께 만드는 image-space delivery로 정밀화한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-readability-acceptance Landmark, screen extent, occlusion, contrast와 duration criterion을 구조화한다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-occlusion-spatial Camera와 resolved geometry의 실제 관계를 판정 경계로 만든다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Observation이 읽은 geometry와 material-opacity revision을 고정한다. -->

Visibility context는 production과 take, story·staging delivery, camera state, light·environment state, material·opacity state, resolved scene geometry revision, delivery gate, pass, rational sample plan과 acceptance profile을 가진다. Required subject, landmark, contact, gesture, prop, reveal와 state change마다 minimum projected extent, screen relation, maximum occlusion, contrast context, readable duration와 failure condition 중 필요한 criterion을 선언한다.

Visibility는 source가 존재하거나 frustum과 교차한다는 사실, image-space에서 일부 pixel이 남는 사실, 관객이 의미를 읽을 수 있다는 acceptance를 서로 다른 observation level로 구분한다.

<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Near·far의 ordered distance와 required depth 범위를 검증한다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Camera body와 path가 wall, terrain, vehicle와 subject를 침범하는지 판정한다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Moving camera와 geometry의 swept interval을 보수적으로 검사한다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Delivery raster와 별개인 crop window를 실제 framing 판정 경계로 사용한다. -->
Clipping evaluation은 camera projection convention, positive ordered near·far distance, optional clipping planes, delivery crop와 current geometry bounds를 사용한다. Boundary inclusion과 tolerance를 선언하고 required subject·environment 범위와 depth precision constraint를 함께 보고한다.


Depth precision은 standard fixed-point perspective projection에서 camera-space metre를 측정한다. `L = 2^bits - 1`, `q(z) = (1/near - 1/z) / (1/near - 1/far)`, `upper = ceil(clamp(q(requiredFar), 0, 1) * L)`, `lower = max(0, upper - 1)`, `z(k) = 1 / (1/near - (k/L) * (1/near - 1/far))`로 두고 `z(upper) - z(lower)`를 required interval의 최대 adjacent depth step으로 보고한다. Perspective spacing은 far 쪽으로 단조 증가하므로 이 far-end cell이 closed interval의 worst step이며, measured step이 authored maximum 이하이면 exact equality를 포함해 통과한다.

각 addressed shot sample은 `requiredSubjects`가 명명한 모든 subject와 environment scene node의 current resolved world bound 여덟 corner를 그 sample의 resolved camera space로 변환해 `requiredNear`와 `requiredFar`를 도출한다. Report는 camera identity, sample time, near·far, required interval, minimum depth bits, maximum step, code pair, measured metre step과 status를 함께 가진다. Interval이 clip 범위를 벗어나거나 operand가 유한하지 않으면 통과시키지 않는다. Viewer는 source와 realized near·far의 exact parity, standard projection mode와 해당 pass에 currently bound인 draw framebuffer의 actual `DEPTH_BITS >= minimumDepthBits`를 draw 전에 검사하며 logarithmic 또는 reversed depth는 다른 metric으로 거부한다.

Delivery crop은 crop 전 gate의 pixel edge를 기준으로 한 top-left-origin normalized 좌표 `{ left, top, right, bottom }`이며 `0 <= left < right <= 1`, `0 <= top < bottom <= 1`을 만족해야 한다. 생략과 `{ 0, 0, 1, 1 }`은 완전한 delivery gate를 뜻하고 projection·pixel 결과를 바꾸지 않는다. 선택한 crop은 output raster 전체로 다시 투영되므로 final, proxy, diagnostic resolution이 달라도 동일한 normalized window를 사용한다. Left·top·right·bottom 경계에 정확히 닿은 geometry는 포함하고, crop 밖의 geometry는 delivery acceptance와 capture에서 제외한다.

Optional clipping plane은 평면 위의 한 점과 제거되는 쪽 unit normal로 주어지고 signed distance `n·(p − p0)`로 평가한다. `0`은 남는 쪽에 포함한다. Bound에 대한 결과는 `kept`, `cut`, `crossed` 셋이며 `cut`은 어느 한 평면이 bound 전체를 제거했다는 뜻이고 `crossed`는 어느 평면도 단독으로 bound 전체를 제거하지 못했다는 뜻일 뿐 남는 점의 존재를 보장하지 않는다. 잘린 단면을 메우는 surface는 evaluation의 산출물이 아니다.

저작된 delivery camera는 plane을 선언하지 않으므로 delivery clipping evaluation의 plane 집합은 항상 비어 있고, required subject의 acceptance는 near·far와 frame bound만으로 결정된다. Plane 집합이 비어 있지 않은 evaluation은 검사 표면의 결과이며 delivery evidence로 계상하지 않는다.

Clearance evaluation은 camera point가 아니라 camera body와 parent rig의 swept volume을 wall, ceiling, floor, furniture, terrain, vehicle, moving subject, opening과 support geometry의 같은 sample state와 비교한다. Discrete sample 사이의 penetration 가능성은 continuous bound, segment crossing 또는 추가 sample로 해소한다.


### Occlusion와 Image-space Metric {#clv-occlusion-image-metrics}

<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-occlusion-metric Required landmark, surface sample와 screen coverage로 visibility를 측정한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-occlusion-relations Architecture, crowd, fog와 frame edge의 occlusion을 resolved scene에서 검사한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-readable-duration 한 frame 노출과 충분한 전달 duration을 구분한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-multi-subject-priority 동시 delivery의 priority와 composition conflict를 finding으로 만든다. -->

Occlusion observation은 required landmark 또는 surface sample set, projected pre-occlusion area, visible area, occluder identity별 coverage, frame-edge crop, fog 또는 transparency treatment와 valid pixel region을 가진다. Center point 하나나 bounding volume의 frustum intersection만으로 subject 전체를 readable로 판정하지 않는다.

Readable duration은 criterion을 연속 충족한 rational interval과 frame count, worst sample과 brief failure span을 보고한다. Multi-subject observation은 primary·secondary·background priority별 extent, overlap, contrast와 competition을 독립적으로 기록한다.

### Intended Obstruction와 Unreadability {#clv-intended-obstruction-unreadability}

<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-intended-obstruction Foreground, over-shoulder, concealment와 wipe를 accidental occlusion과 분리한다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-obstruction-contract Obstructor, affected landmark, region, event와 duration을 정밀화한다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-reveal-concealment Reveal과 concealment를 event와 camera relation으로 묶는다. -->
<!-- @evidence requirements/staging/visibility-and-readability.md#staging-intentional-unreadability Darkness와 obstructed view의 대체 cue와 해제 조건을 요구한다. -->

Intentional obstruction은 occluder identity, affected subject·landmark, target screen region 또는 coverage range, 시작·해제 event, maximum duration, story reason, 관객이 읽을 substitute cue와 acceptance를 가진다. Concealment에서 reveal로 전환하는 순간은 source event와 first-readable sample을 연결한다.

일반 occlusion threshold 확대, contrast criterion 삭제 또는 visibility 검사 비활성화는 intentional unreadability가 아니다. Declaration이 있어도 substitute cue와 release condition을 충족하지 않으면 acceptance는 `failed`다.

### Rational Visibility Sampling {#clv-rational-visibility-sampling}

<!-- @evidence requirements/staging/visibility-and-readability.md#staging-visibility-time-sampling Camera, geometry, fog와 light를 같은 fixed-clock state에서 검사한다. -->
<!-- @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-alternatives Take별 clipping, clearance와 visibility 결과를 분리한다. -->
<!-- @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Frame의 declared sample에서 camera, light, material와 visibility를 함께 resolve한다. -->

Sample plan은 interval start·end, required event, transition boundary, local extrema, threshold crossing과 worst-case 후보를 exact rational identity로 가진다. Camera, subject, opening, crowd, fog, material opacity와 light를 각 sample에서 함께 resolve하고 평균값이 짧은 완전 가림이나 frame exit를 숨기지 않게 한다.

Alternative take는 독립 sample results, worst interval과 acceptance를 가진다. 선택한 clear take의 pass를 occluded take에 적용하거나 다른 geometry·lighting state의 observation을 결합하지 않는다.

## Observation Output와 Status {#clv-observation-output-status}

### Computable Geometry와 Measurable Result {#clv-computable-geometry-results}

<!-- @evidence requirements/camera/validation.md#camera-validation Camera geometry와 current pixel observation을 별도 결과로 함께 검증한다. -->
<!-- @evidence requirements/camera/validation.md#camera-validation-manifest Camera, source, revision, raster, samples와 tolerance를 manifest에 고정한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-visual-validation Source, analysis, pixels, structural pass와 readability를 함께 구분한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-contract Analysis question, operands, domain, samples, solver와 tolerance를 정규화한다. -->

Observation output은 context identity, question, subject·surface·camera·source identities, quantity와 unit, sampling domain, method 또는 approximation, tolerance, measured values, image-space regions, current artifact identity, finding set와 status를 가진다. Numeric geometry, supported light analysis, beauty frame와 structural pass는 서로 다른 method이며 하나의 성공이 다른 method의 실행을 뜻하지 않는다.

<!-- @evidence requirements/camera/validation.md#camera-hand-computable-geometry FOV, depth, projected bounds와 clipping을 독립 계산값과 대조한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-measurable-results 지원 metric의 unit, grid, time와 exclusion을 report한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-form-revealing-review Geometry review가 soft lighting에 의해 가려지지 않게 한다. -->

Canonical geometry case는 projection, depth, clip classification, projected point·bounds와 screen region을 hand-computable operands와 formula로 재현할 수 있어야 한다. Supported illuminance-like, luminance, contrast, shadow extent, clipping와 exposure metric은 unit, sampling grid, direction, film time, exclusions와 valid domain을 가진다.

Geometry 판단용 flat, normal, depth, mask 또는 form-revealing condition은 beauty appearance와 다른 product identity를 가진다. Soft wash나 grade로 shape defect를 숨기지 않으며 structural pass를 final appearance의 증거로 사용하지 않는다.

### Boundary, Negative Twin와 Finding {#clv-observation-validation-cases}

<!-- @evidence requirements/camera/validation.md#camera-boundary-negative Frame edge, clip plane, movement, target loss와 occlusion threshold의 boundary를 검사한다. -->
<!-- @evidence requirements/camera/validation.md#camera-cross-condition-negative-twin 한 camera 조건만 깨뜨린 negative twin으로 rule을 격리한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-validation-twins Light rule의 positive, negative와 exact threshold case를 구분한다. -->

각 critical rule은 positive case, 한 operand만 깨뜨린 negative twin과 exact boundary case를 가진다. Case receipt는 같은 source closure와 context를 공유하고 intentional difference만 열거하여 다른 camera, geometry, material 또는 light failure로 해당 rule을 검증하지 않게 한다.

Finding은 affected frame·interval·region, expected criterion, observed value, tolerance, operands, method, severity와 suggested decision owner를 가진다. 자동 metric은 사실과 후보 결함을 제시하지만 사람의 작품 승인이나 waiver를 대신하지 않는다.

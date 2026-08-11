# Framing, Axis와 Camera Path {#framing-axis-camera-path-specification}

## Framing Delivery State {#clv-framing-delivery-state}

### Landmark, 여백과 Multi-subject 관계 {#clv-framing-landmark-relations}

<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-framing-shot-size Shot size를 subject landmark, occupancy와 story purpose의 상태로 정밀화한다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-framing-source-trace Framing이 읽은 story, staging, design과 raster source를 명시한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-silhouette-acceptance 실제 camera와 delivery 조건의 silhouette acceptance를 연결한다. -->

Framing 입력은 take와 delivery identity, required subject와 priority, story event, staging delivery, production-design landmark와 silhouette, resolved subject geometry, acquisition gate, delivery mapping, valid film interval과 acceptance profile이다. 출력은 subject별 projected extent, landmark position, frame occupancy, screen region, edge distance, overlap, environment context와 pass·fail·unsupported 상태다.

Shot-size label은 계산 결과를 설명하는 intent이며 단독 수치 기준이 아니다. Acceptance는 해당 subject와 action에 필요한 landmark, extent, relation과 duration을 선언하고 실제 delivery raster에서 평가한다.

<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing Generic origin 대신 shot에 필요한 landmark를 관찰 대상으로 만든다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-headroom-lead-room Headroom, look room과 travel room을 subject motion에 연결한다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-multi-subject-composition 여러 subject의 priority, separation과 overlap을 정량화한다. -->

Landmark set은 head, eyes, hands, feet, object surface, formation bounds, contact와 interaction point처럼 delivery에 필요한 identity와 current world position을 가진다. Headroom, look room, travel room, horizon과 edge margin은 delivery pixel 또는 normalized image coordinate의 signed interval로 표현하고 subject orientation와 swept motion range에 연결한다.

Multi-subject composition은 primary·secondary·background priority, required screen region, projected separation, 허용 overlap과 관계 direction을 가진다. 하나의 center point가 region 안에 있다는 사실은 landmark extent나 subject relation의 통과가 아니다.

### Interval Framing과 의도적 Crop {#clv-framing-interval-crop}

<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-framing-range 움직이는 subject와 camera가 shot interval 동안 landmark를 유지하는지 판정한다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-intentional-crop 의도된 crop의 landmark, cue와 acceptance를 별도 계약으로 보존한다. -->

Framing range는 start, end, semantic event, local extrema, threshold crossing과 conservative swept interval을 포함하는 sample plan으로 평가한다. 평균 occupancy나 한 hero frame은 짧은 frame exit, edge collision 또는 subject overlap을 숨길 수 없다.

의도적 crop은 affected landmark, interval, story reason, 관객이 대신 읽을 cue, 허용 image-space consequence와 falsifiable acceptance를 가진 deviation이다. 일반 framing threshold를 넓히거나 landmark를 observation set에서 삭제하는 행위는 deviation declaration이 아니다.

## Screen Grammar State {#clv-screen-grammar-state}

### Line, Eyeline와 Travel 판정 {#clv-line-eyeline-travel-evaluation}

<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-axis-eyeline-screen-direction Interaction axis와 screen relation을 scene-local 상태로 정밀화한다. -->
<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-axis-source-trace Axis가 읽은 participant, mark, path, gaze와 phase를 lineage에 고정한다. -->
<!-- @evidence requirements/staging/marks-zones-and-blocking.md#staging-blocking-relations Staging의 facing, eyeline, concealment와 reveal 관계를 camera grammar가 소비한다. -->

Grammar state는 active interaction 또는 action line, participant roles, camera side, subject screen side, gaze target, entry·exit edge, travel vector, relation phase와 valid interval을 가진다. World axis를 shot마다 새로 정의하지 않고 staging relation과 semantic event가 axis 생성·교체·reset을 소유한다.

<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-180-line Cut 양쪽 camera side와 active line의 관계를 판정한다. -->
<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-eyeline-match Gaze vector와 target의 image-space 위치를 연결한다. -->
<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-entry-exit-direction Frame edge와 location topology 사이의 travel continuity를 보존한다. -->

Line-side 값은 directed scene-local line과 camera sample의 signed relation으로 계산하고 exact-on-line 상태를 별도 boundary로 둔다. Eyeline은 source landmark의 gaze vector, target landmark, camera state와 두 landmark의 projected screen position을 같은 sample에서 비교한다. Travel continuity는 source exit edge, destination entry edge, world path direction과 topology transition을 함께 기록한다.

### Grammar Sampling과 Finding {#clv-grammar-sampling-findings}

<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Cut 양쪽의 정확한 source sample과 transition overlap에서 관계를 평가한다. -->
<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-findings 의도되지 않은 line cross와 방향 반전을 named finding으로 만든다. -->
<!-- @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-alternatives Take별 grammar state와 continuity consequence를 분리한다. -->

Cut 판정은 outgoing last-observable sample, incoming first-observable sample, overlap 또는 transition sample과 대응 semantic event를 사용한다. Shot 시작 transform, 평균 heading이나 edit 배열 위치는 dynamic relation을 대신하지 않는다.

Unmotivated line cross, reversed eyeline, travel flip와 ambiguous orientation은 affected cut, samples, operands, threshold와 observed values를 가진 finding이다. Declared deviation이나 alternative take는 자동 통과가 아니라 별도 acceptance와 review 상태를 가진다.

## Camera Path State {#clv-camera-path-state}

### Bounded Curve와 Direct Sampling {#clv-camera-path-direct-sampling}

<!-- @evidence requirements/camera/position-and-movement.md#camera-position-movement Camera movement를 actual transform과 film-time path로 정밀화한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-rig-local-frame Rig-local movement와 host transform을 같은 clock에서 합성한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-movement-intent Path를 subject, event와 dramatic purpose에 연결한다. -->

Path state는 camera 또는 rig identity, parent relation, local transform curve, host world transform, target relation, movement intent, valid interval과 interpolation model을 가진다. 각 sample의 world transform은 parent hierarchy를 고정된 순서로 합성한 절대 상태이며 이전 frame 적분 결과가 아니다.

<!-- @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Path, target, lens와 stabilization을 rational film time에서 직접 평가한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-speed-easing Duration, velocity, acceleration와 easing을 bounded curve로 선언한다. -->

각 translation, orientation, target와 lens curve는 domain, endpoint inclusion, interpolation, maximum velocity·acceleration·angular rate와 discontinuity event를 선언한다. 같은 rational time을 direct seek, forward playback, reverse playback 또는 chunk retry로 평가해도 같은 transform을 내야 한다.

Orientation interpolation은 rotation을 보존하는 model과 normalization rule을 사용하고 zero direction이나 degenerate look basis를 명시적 failure로 처리한다. Easing 이름만으로 속도 bound를 주장하지 않고 derived extrema와 tolerance를 보고한다.

### Clearance, Instability와 Refusal {#clv-camera-path-constraints-refusal}

<!-- @evidence requirements/camera/position-and-movement.md#camera-movement-constraint-evaluation Camera rig 전체를 current moving geometry와 같은 sample에서 검사한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-authored-instability 불안정 motion을 bounded curve와 seed로 재현한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-movement-alternatives Path alternative의 risk와 readability acceptance를 분리한다. -->
<!-- @evidence requirements/camera/position-and-movement.md#camera-path-refusal Penetration, impossible motion과 subject loss의 refusal을 정의한다. -->

Constraint evaluation은 camera body와 host rig의 swept volume, wall·terrain·opening·vehicle·subject geometry, target visibility, framing tolerance와 motion bound를 같은 geometry revision과 sample plan에서 비교한다. Sample 사이의 penetration 가능성은 conservative continuous bound 또는 추가 crossing sample로 해소한다.

Handheld, vibration, impact와 vehicle shake는 amplitude, frequency band, interval, seed 또는 fixed curve와 stabilization policy를 가진다. Non-finite transform, invalid host, impossible kinematic bound, forbidden penetration, required subject loss와 shot 밖 path는 `failed`이며 다른 take의 clearance 결과를 재사용하지 않는다.

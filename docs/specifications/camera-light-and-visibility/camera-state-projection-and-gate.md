# Camera State, Projection과 Gate {#camera-state-projection-gate-specification}

## Camera 관찰자 상태 {#clv-camera-observer-state}

<!-- @evidence requirements/camera/scope-and-identity.md#camera-scope-identity 이 상태가 camera identity, projection, transform, time과 take의 필수 필드를 정규화한다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-shot-distinction Camera identity와 shot·edit identity를 별도 key와 relation으로 보존한다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-story-design-staging-trace Camera intent가 읽은 story, staging, design과 geometry revision을 상태 lineage에 고정한다. -->

입력은 stable camera identity, owning shot과 take, supported projection kind, optical state, world 또는 rig-local transform, target 또는 intent, valid film interval, upstream story·staging·design identity와 resolved geometry revision이다. 정규화 결과는 camera identity와 edit identity를 분리하고, 한 take 안에서 각 film-time sample이 정확히 하나의 effective camera state를 가리키게 한다.

같은 camera identity에 서로 다른 projection convention이나 coordinate frame이 동시에 current이면 상태는 충돌이다. 필수 delivery를 위한 camera가 없거나 projection을 정규화할 수 없으면 결과는 `failed`이며 임의 원점 camera나 이전 take를 선택하지 않는다.

### 권위와 공간 Binding {#clv-camera-authority-spatial-binding}

<!-- @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding 이 binding이 transform과 geometry를 같은 coordinate frame, revision과 sample에 묶는다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-authored-intent 시스템이 dramatic intent를 추측하지 않고 선언된 선택만 해석하게 한다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-take-lineage Hero와 alternative take의 공통 source와 독립 상태를 보존한다. -->
<!-- @evidence requirements/camera/scope-and-identity.md#camera-missing-refusal 필수 camera나 유효 projection이 없을 때의 refusal을 정의한다. -->

Camera transform, target, clipping, clearance와 occlusion 입력은 하나의 handedness, up·forward axis, length·angle unit, origin, geometry revision, opening·support·moving-obstacle state와 rational film sample을 공유해야 한다. 사용자나 저작자가 선언한 subject, event, shot size, angle, movement, screen relation과 deliberate deviation만 intent가 되며 시스템은 source 이름이나 화면 결과에서 이를 역추정하지 않는다.

Hero와 alternative take는 공통 upstream source를 공유해도 camera identity, projection, transform, focus, exposure, grammar, valid interval과 review receipt를 독립적으로 유지한다. 선택 전 branch의 state나 evidence를 결합한 effective camera는 만들지 않는다.

## Projection Convention {#clv-projection-convention}

<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-projection-lens-sensor 이 계약이 projection kind와 gate가 frame geometry를 결정하는 방식을 정밀화한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions 모든 consumer가 같은 optical axis, unit과 transform 순서를 읽게 한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-orthographic-scale Orthographic projection의 world extent를 perspective lens와 분리한다. -->

각 projection kind는 coordinate handedness, camera forward axis, image origin, horizontal·vertical orientation, angle과 length unit, view-to-clip transform 순서, supported depth convention과 projection center를 선언한다. Perspective는 image aperture와 field angle의 관계를, orthographic은 world-space width·height 또는 scale, center와 aspect relation을 가진다. Project-defined projection은 같은 입력과 출력 필드를 설명하는 versioned model identity와 지원 상태를 가진다.

Projection 계산의 출력은 world point 또는 bounded geometry를 image-plane coordinate, normalized depth, clip-plane classification과 유효성 상태로 변환한 값이다. Orthographic state에 perspective focal parameter를 적용하거나 서로 다른 convention을 하나의 camera state에 합치면 `failed`다.

### Lens Basis와 모순 처리 {#clv-lens-basis-consistency}

<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Focal length, aperture dimension과 field of view의 단일 authoring basis를 정한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-aperture-distinction Image aperture와 lens aperture를 서로 다른 quantity로 유지한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-lens-character 지원 optical model과 단순 metadata를 구분한다. -->

한 perspective state는 focal length와 image-aperture dimension 또는 horizontal·vertical field of view 중 하나의 authoring basis를 가진다. Derived 값은 basis, formula, unit과 rounding policy를 기록하고 중복 authored 값이 tolerance 밖에서 모순되면 precedence 없이 거부한다.

Image aperture는 projection geometry를, lens aperture 또는 f-number는 exposure·focus intent를 설명하는 별도 quantity다. Distortion, anamorphic squeeze, breathing, bokeh와 다른 lens character는 versioned optical model, calibration state, parameter domain과 image-space consequence가 실제 지원될 때만 `supported`이고, metadata만 있으면 `declared-only` 또는 `unsupported`다.

### Sensor, Gate와 Delivery Mapping {#clv-sensor-gate-delivery-mapping}

<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-sensor-gate-fit Acquisition aperture, raster와 crop·fit policy의 mapping을 정밀화한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-gate-offset Off-axis projection center와 lens shift를 camera rotation과 분리한다. -->
<!-- @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate 실제 delivery frame에서 required landmark를 판정할 gate를 확정한다. -->

Gate state는 image-aperture width·height, acquisition aspect, delivery width·height, pixel aspect, fit mode, crop 또는 overscan region, aperture offset, lens shift, projection center와 reserved overlay region을 가진다. Mapping은 acquisition image coordinate를 delivery pixel coordinate로 바꾸는 순서와 crop 경계의 포함 규칙을 명시한다.

Lens shift나 gate offset은 projection center를 바꾸며 camera orientation을 바꾸지 않는다. Delivery variant마다 mapping identity를 분리하고, 같은 acquisition state라도 crop·aspect·overlay가 다르면 별도 observation context와 receipt를 만든다.

### Projection Sampling과 Refusal {#clv-projection-sampling-refusal}

<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-projection-time-sampling 시간에 따라 변하는 optical state와 transform을 같은 sample convention에서 평가한다. -->
<!-- @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-refusal 유효하지 않거나 모순된 optical input의 refusal을 구체화한다. -->

Zoom, gate, shift와 projection parameter는 rational film time에서 bounded curve로 직접 평가하고 camera transform과 동일한 sample identity를 공유한다. Projection kind 전환은 named event, 전후 state, 적용 boundary와 discontinuity acceptance를 가지며 중간값을 임의 생성하지 않는다.

Non-finite parameter, non-positive aperture dimension이나 f-number, zero·invalid aspect, impossible field angle, unrepresentable gate mapping, unsupported projection model과 모순된 lens basis는 해당 sample 또는 take를 `failed`로 만든다. 지원되지 않은 optical appearance는 geometry 결과를 실패시키지 않되 별도 `unsupported` claim으로 남긴다.

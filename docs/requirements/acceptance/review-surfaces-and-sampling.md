# Acceptance 검토 표면과 Sampling

## 독립된 검토 표면 {#acceptance-review-surfaces}

자산, shot, sequence, film과 published delivery는 서로 다른 acceptance 표면이어야 한다. 한 표면의 pass는 필요한 하위 근거가 될 수 있지만 다른 표면의 독립 판단을 대신하지 않아야 한다.

### 자산 표면 {#acceptance-asset-surface}

자산 acceptance는 intended identity, silhouette, scale, material separation, state, rig 또는 deformation, attachment와 사용 목적을 필요한 각도와 상태에서 판정할 수 있어야 한다.

### Shot 표면 {#acceptance-shot-surface}

Shot acceptance는 dramatic beat, staging readability, performance, camera, lighting, sound, required event와 shot 내부 continuity를 실제 시간 범위에서 판정할 수 있어야 한다.

### Sequence 표면 {#acceptance-sequence-surface}

Sequence acceptance는 shot 사이의 action, pose, gaze, screen direction, 공간, 빛, 소리, story state, rhythm과 coverage를 cut 양쪽을 포함해 판정할 수 있어야 한다.

### Film 표면 {#acceptance-film-surface}

Film acceptance는 전체 이야기 약속, pacing, tone, audiovisual synchronization, 접근성, 시작과 ending, 반복되거나 조용한 구간과 모든 sequence 경계를 작품 전체에서 판정할 수 있어야 한다.

### Delivery 표면 {#acceptance-delivery-surface}

Delivery acceptance는 실제 게시 bytes, stream, duration, dimensions, color, audio, caption, language, 접근성 산출물, provenance와 package completeness를 적용 profile로 판정할 수 있어야 한다.

## 시간 Sampling {#acceptance-temporal-sampling}

Sampling plan은 시작, 끝, 의미 event, transition boundary, 상태 변화와 알려진 고위험 구간을 포함해야 한다. 단일 hero frame으로 구간 전체의 motion, continuity, sync 또는 artifact 부재를 주장하지 않아야 한다.

### 표본에서 구간으로의 주장 {#acceptance-sample-interval-claim}

표본 verdict를 연속 구간에 일반화하려면 그 구간의 불변 조건, 최대 변화율, 표본 간격 또는 완전 재생 의무가 profile에 명시되어야 한다. 근거가 없으면 verdict 범위는 관찰한 표본에 한정되어야 한다.

## 공간과 View Sampling {#acceptance-spatial-view-sampling-group}

### 공간과 View Sampling {#acceptance-spatial-view-sampling}

형상, 접촉, occlusion, 표면과 deformation criterion은 문제를 드러내는 각도, 거리, camera와 필요한 구조 view를 포함해야 한다. Front beauty view 하나로 back, depth, outline, hidden collision 또는 joint range를 통과시키지 않아야 한다.

## Presentation 조건 {#acceptance-presentation-conditions-group}

### Presentation 조건 {#acceptance-presentation-conditions}

시각·청각 검토는 target raster, display transform, playback speed, audio channel, language와 접근성 상태를 기록해야 한다. 진단용 축소본이나 대체 channel의 관찰을 최종 presentation 조건의 pass로 일반화하지 않아야 한다.

## 표본 누락의 판정 {#acceptance-missing-sample-verdict-group}

### 표본 누락의 판정 {#acceptance-missing-sample-verdict}

필수 표본이 없으면 해당 범위는 pass가 될 수 없어야 한다. 누락 원인에 따라 not-run, unsupported, indeterminate 또는 partial로 보고하고 관찰된 표본만의 결과를 함께 보존해야 한다.

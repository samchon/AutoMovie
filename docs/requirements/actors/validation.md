# Actor 검증

## Actor 전체 계약 검증 {#actor-validation}

Actor는 story binding, representation tier, scale, rig, pose, motion, expression, voice, costume, attachment, state와 resource bound를 사용 전에 검증할 수 있어야 한다.

### 수치와 Geometry {#actor-numeric-geometry-validation}

Landmark distance, joint angle, bounds, ground contact, self-intersection, attachment offset와 motion continuity를 실제 sample과 resolved geometry에서 측정해야 한다.

### 목적별 검증 {#actor-purpose-validation}

Crowd silhouette, medium performance, prop interaction, dialogue, close framing와 collision은 서로 다른 required capability를 가지며 한 목적의 통과를 다른 목적에 일반화하지 않아야 한다.

### Input와 Binding 검증 {#actor-input-binding-validation}

선택된 model, rig, motion, costume, attachment와 voice의 source digest, adoption mode, mapping, unit, coordinate, required control coverage와 conversion loss를 함께 검사하고 각각 유효해도 조합이 실패하는 경우를 탐지해야 한다.

### Multi-angle Review {#actor-multi-angle-review}

Front, three-quarter, side와 실제 shot distance에서 form-revealing light로 silhouette, proportion, rig deformation, costume, contact와 expression readability를 검토해야 한다.

### A/B와 Current Evidence {#actor-current-evidence}

Representation, rig, motion와 material 변경은 같은 camera와 state의 A/B 또는 current capture로 검토하고 stale render나 설명만으로 개선을 주장하지 않아야 한다.

### 정직한 Ceiling {#actor-validation-ceiling}

Proxy-level 성공, unsupported realistic fidelity와 not-run visual review를 구분하고 “이전보다 나음”을 correct로 보고하지 않아야 한다.

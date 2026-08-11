# Camera Position과 Movement

## 공간 안에서 움직이는 Camera {#camera-position-movement}

Static, pan, tilt, roll, dolly, truck, crane, orbit, follow, handheld-like authored motion와 project-defined path를 actual transform과 film time으로 표현할 수 있어야 한다.

### Rig와 Local Frame {#camera-rig-local-frame}

Camera를 dolly, crane, vehicle, actor와 virtual rig에 parent할 수 있고 local movement와 host world transform을 같은 fixed clock에서 결합해야 한다.

### Deterministic Path Sampling {#camera-path-time-sampling}

Camera path, rig, target, lens와 stabilization은 rational film time에서 직접 sample할 수 있어야 하며 frame traversal direction, dropped preview frame와 previous-frame integration에 따라 transform이 달라지지 않아야 한다.

### Movement Intent {#camera-movement-intent}

Reveal, follow, reframe, emphasize, destabilize와 transition 같은 이유를 subject와 event에 연결하고 움직임 자체를 dramatic 성공으로 취급하지 않아야 한다.

### Speed와 Easing {#camera-speed-easing}

Position, rotation, lens와 target change의 duration, velocity, acceleration와 easing을 bounded curve로 선언해야 한다.

### Constraint Evaluation {#camera-movement-constraint-evaluation}

Clearance, collision volume, maximum speed·acceleration·angular rate, target visibility와 framing tolerance를 resolved moving geometry의 같은 sample에서 평가하고 camera point 하나가 통과한다는 이유로 rig 전체가 통과한다고 간주하지 않아야 한다.

### Authored Instability {#camera-authored-instability}

Handheld, vibration, impact와 vehicle shake는 bounded amplitude·frequency·interval과 explicit seed 또는 fixed curve를 가져야 하며 frame마다 새 random motion을 만들지 않아야 한다.

### Movement Alternative {#camera-movement-alternatives}

Static, moving, stabilized와 intentionally unstable take는 공통 event window와 서로 다른 path·risk·readability acceptance를 보존하여 한 take의 clearance pass로 다른 take를 승인하지 않아야 한다.

### Camera Path Refusal {#camera-path-refusal}

Wall·terrain penetration, non-finite transform, impossible speed, subject loss, invalid host와 shot 밖 path를 거부해야 한다.

# Camera Position과 Movement

## 공간 안에서 움직이는 Camera {#camera-position-movement}

Static, pan, tilt, roll, dolly, truck, crane, orbit, follow, handheld-like authored motion와 project-defined path를 actual transform과 film time으로 표현할 수 있어야 한다.

### Rig와 Local Frame {#camera-rig-local-frame}

Camera를 dolly, crane, vehicle, actor와 virtual rig에 parent할 수 있고 local movement와 host world transform을 같은 fixed clock에서 결합해야 한다.

### Movement Intent {#camera-movement-intent}

Reveal, follow, reframe, emphasize, destabilize와 transition 같은 이유를 subject와 event에 연결하고 움직임 자체를 dramatic 성공으로 취급하지 않아야 한다.

### Speed와 Easing {#camera-speed-easing}

Position, rotation, lens와 target change의 duration, velocity, acceleration와 easing을 bounded curve로 선언해야 한다.

### Camera Path Refusal {#camera-path-refusal}

Wall·terrain penetration, non-finite transform, impossible speed, subject loss, invalid host와 shot 밖 path를 거부해야 한다.

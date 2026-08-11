# Spatialization과 Propagation

## World Source에서 Listener까지의 경로 {#sound-spatialization-propagation}

Emitter와 listener position, orientation, distance, direct path, channel layout, attenuation, delay와 supported environmental effect를 fixed film clock에서 계산할 수 있어야 한다.

### Listener Identity {#sound-listener-identity}

Camera, actor, authored point와 mix listener를 구분하고 shot camera가 바뀌었다는 이유로 story emitter time을 바꾸지 않아야 한다.

### Direct Path {#sound-direct-path}

Declared sound speed, representative source path, distance, optional air-like attenuation와 arrival time을 bounded deterministic model로 계산할 수 있어야 한다.

### Occlusion과 Obstacle {#sound-occlusion-obstacle}

Terrain, wall, door, object와 crowd의 supported occlusion proxy와 state를 사용하고 보지 못한 diffraction와 multi-path를 계산했다고 주장하지 않아야 한다.

### Propagation Refusal {#sound-propagation-refusal}

Missing emitter, invalid listener, non-positive sound speed, unsupported path, film 밖 required arrival와 budget 초과를 거부해야 한다.

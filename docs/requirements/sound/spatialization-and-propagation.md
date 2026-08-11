# Spatialization과 Propagation

## World Source에서 Listener까지의 경로 {#sound-spatialization-propagation}

Emitter와 listener position, orientation, distance, direct path, channel layout, attenuation, delay와 supported environmental effect를 fixed film clock에서 계산할 수 있어야 한다.

### Moving Path Sampling {#sound-moving-path-sampling}

Moving emitter와 listener의 transform은 cue lifecycle 동안 declared audio boundary에서 같은 resolved performance와 camera state를 sample하고 initial position 하나를 전체 cue에 재사용하지 않아야 한다. Arbitrary seek와 chunked mix는 같은 path와 sample을 만들어야 한다.

### Listener Identity {#sound-listener-identity}

Camera, actor, authored point와 mix listener를 구분하고 shot camera가 바뀌었다는 이유로 story emitter time을 바꾸지 않아야 한다.

### Direct Path {#sound-direct-path}

Declared sound speed, representative source path, distance, optional air-like attenuation와 arrival time을 bounded deterministic model로 계산할 수 있어야 한다.

### Spatial Output Mapping {#sound-spatial-output-mapping}

World direction, listener orientation, source spread와 arrival state를 declared mono, stereo 또는 supported multichannel layout에 mapping하고 channel order, coordinate convention과 downmix behavior를 명시해야 한다.

### Occlusion과 Obstacle {#sound-occlusion-obstacle}

Terrain, wall, door, object와 crowd의 supported occlusion proxy와 state를 사용하고 보지 못한 diffraction와 multi-path를 계산했다고 주장하지 않아야 한다.

### Propagation Refusal {#sound-propagation-refusal}

Missing emitter, invalid listener, non-positive sound speed, unsupported path, film 밖 required arrival와 budget 초과를 거부해야 한다.

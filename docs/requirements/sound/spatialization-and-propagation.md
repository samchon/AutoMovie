# Spatialization과 Propagation

## World Source에서 Listener까지의 경로 {#sound-spatialization-propagation}

Emitter와 listener position, orientation, distance, direct path, channel layout, attenuation, delay와 supported environmental effect를 fixed film clock에서 계산할 수 있어야 한다.

### Moving Path Sampling {#sound-moving-path-sampling}

Moving emitter와 listener의 transform은 cue lifecycle 동안 declared audio boundary에서 같은 resolved performance와 camera state를 sample하고 initial position 하나를 전체 cue에 재사용하지 않아야 한다. Arbitrary seek와 chunked mix는 같은 path와 sample을 만들어야 한다.

### Listener Identity {#sound-listener-identity}

Camera, actor, authored point와 mix listener를 구분하고 shot camera가 바뀌었다는 이유로 story emitter time을 바꾸지 않아야 한다.

### Extended Group Source {#sound-extended-group-sources}

Formation 또는 instance set을 하나의 audible source로 사용할 때는 exact current revision의 sounding membership, count, member world positions, spatial extent와 motionㆍreform state에서 acoustic center, stereo 또는 spatial spread, effective listener distance와 aggregate energy를 결정적으로 계산할 수 있어야 한다. 같은 film sample의 group 이동과 reform은 source center, extent, distance와 energy에 함께 반영되어야 한다.

Membership, count, position, extent 또는 revision이 불완전하거나 서로 모순되면 `unsupported` 또는 refusal과 원인 identity를 보고해야 한다. Centroid의 단일 point source나 임의의 population 값으로 조용히 대체해서는 안 된다.

### Direct Path {#sound-direct-path}

Declared sound speed, representative source path, distance, atmospheric condition assumptions, attenuation와 arrival time을 하나의 bounded deterministic propagation model에서 계산할 수 있어야 한다. Atmospheric input은 project가 선언하거나 명시적으로 채택한 environment state여야 하며 시스템이 location 이름이나 provider availability에서 날씨를 임의로 정해서는 안 된다. Spectral propagation을 선택한 경우 거리가 늘수록 고역 에너지가 저역보다 먼저 감소하는 frequency-dependent absorption과 broadband distance gain을 분리해 보고하고, 지원하지 않는 spectral model을 단순 gain으로 대체해 성공이라고 해서는 안 된다.

### Spatial Output Mapping {#sound-spatial-output-mapping}

World direction, listener orientation, source spread와 arrival state를 declared mono, stereo 또는 supported multichannel layout에 mapping하고 channel order, coordinate convention과 downmix behavior를 명시해야 한다.

### Occlusion과 Obstacle {#sound-occlusion-obstacle}

Terrain, wall, door, object와 crowd의 supported occlusion proxy와 state를 사용하고 보지 못한 diffraction와 multi-path를 계산했다고 주장하지 않아야 한다.

### Propagation Refusal {#sound-propagation-refusal}

Missing emitter, invalid listener, non-positive sound speed, unsupported path, film 밖 required arrival와 budget 초과를 거부해야 한다.

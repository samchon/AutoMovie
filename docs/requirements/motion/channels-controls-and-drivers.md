# Channel, Control과 Driver

## 모든 객체와 동작을 위한 Channel {#motion-channels-controls-drivers}

Motion은 humanoid pose에 한정되지 않고 actor, prop, mechanism, vehicle, camera, light, environment control과 project-defined subject의 transform, joint, morph, material, scalar, vector, quaternion, boolean, enum와 event channel을 시간에 따라 바꿀 수 있어야 한다.

### Channel 계약 {#motion-channel-contract}

각 channel은 stable target과 control identity, value kind, unit, coordinate 또는 value space, neutral과 valid range, absolute 또는 additive 의미와 missing-sample behavior를 가져야 한다.

### Driver와 Dependency {#motion-channel-dependencies}

한 channel이 다른 channel, semantic state, path distance 또는 event를 구동할 때 input, output, ratio나 bounded function, evaluation order, delay와 clamp 또는 refusal policy를 선언해야 한다.

### Control Ownership {#motion-channel-control-ownership}

Clip, procedural rule, constraint, interaction, simulation result와 authored override 중 어느 source가 각 time range의 control을 소유하는지 결정할 수 있어야 하며, dependency와 layer를 통해서만 공유해야 한다.

### Additive Extensibility {#motion-channel-extensibility}

Project-defined channel과 driver는 기존 motion의 meaning과 sampling을 바꾸지 않고 추가할 수 있어야 하며, 모르는 channel을 transform이나 generic number로 추측하지 않고 unsupported로 보존하거나 거부해야 한다.

### Driver Refusal {#motion-channel-driver-refusal}

Dependency cycle, missing input, unit 또는 space mismatch, multiple absolute owner, non-finite output, unbounded feedback와 target range 밖 결과를 deterministic finding으로 보고해야 한다.

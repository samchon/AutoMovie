# Retargeting과 Scale

## 다른 Rig에서 Motion 재사용 {#motion-retargeting-scale}

Source motion을 target skeleton과 body proportion에 적용할 때 bone role, rest basis, unit, root, limb scale, contact와 unsupported channel을 명시해야 한다.

### Mapping 선택과 Override {#motion-retarget-mapping-selection}

사용자와 저작 에이전트는 자동 후보 또는 명시적 source-target mapping, per-control mode와 correction을 선택, 수정하거나 거부할 수 있어야 하며 bone 이름 유사성만으로 final mapping을 확정하지 않아야 한다.

### Source Provenance {#motion-retarget-source-provenance}

External glTF animation, recorded motion, authored clip와 generated motion의 source digest, license, frame rate 또는 time basis와 conversion receipt를 추적해야 한다.

### Proportion 보정 {#motion-retarget-proportion}

Stride, reach, root height, hand·foot target와 prop relation을 target body에 맞게 조정하되 translation scale, rotation transfer, end-effector preservation와 unmapped control policy를 기록하고 joint range와 story timing을 임의로 바꾸지 않아야 한다.

### Non-humanoid Retarget {#motion-retarget-non-humanoid}

Project-defined rig 사이의 retarget은 semantic control과 dependency mapping을 사용하고 humanoid role이 없는 articulated object, creature proxy와 mechanism을 unsupported human bone으로 강제하지 않아야 한다.

### Contact 보존 {#motion-retarget-contact-preservation}

Retarget 뒤 foot plant, grasp, seat와 impact event가 target geometry에서 같은 semantic time과 tolerance를 만족하는지 다시 검증해야 한다.

### Retarget Refusal {#motion-retarget-refusal}

Missing required bone, ambiguous mapping, invalid rest pose, unsupported non-uniform scale, broken contact와 topology-dependent channel을 명시적으로 보고해야 한다.

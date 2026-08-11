# Retargeting과 Scale

## 다른 Rig에서 Motion 재사용 {#motion-retargeting-scale}

Source motion을 target skeleton과 body proportion에 적용할 때 bone role, rest basis, unit, root, limb scale, contact와 unsupported channel을 명시해야 한다.

### Source Provenance {#motion-retarget-source-provenance}

External glTF animation, recorded motion, authored clip와 generated motion의 source digest, license, frame rate 또는 time basis와 conversion receipt를 추적해야 한다.

### Proportion 보정 {#motion-retarget-proportion}

Stride, reach, root height, hand·foot target와 prop relation을 target body에 맞게 조정하되 joint range와 story timing을 임의로 바꾸지 않아야 한다.

### Contact 보존 {#motion-retarget-contact-preservation}

Retarget 뒤 foot plant, grasp, seat와 impact event가 target geometry에서 같은 semantic time과 tolerance를 만족하는지 다시 검증해야 한다.

### Retarget Refusal {#motion-retarget-refusal}

Missing required bone, ambiguous mapping, invalid rest pose, unsupported non-uniform scale, broken contact와 topology-dependent channel을 명시적으로 보고해야 한다.

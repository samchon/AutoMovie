# Skeleton, Rig와 Retargeting

## 움직임을 운반하는 Actor Rig {#actor-skeleton-rig-retargeting}

Skeleton은 stable bone identity, hierarchy, rest transform, local axis, joint range와 skin 또는 attached control 관계를 가져야 한다.

### Rest, Bind와 Deformation {#actor-rest-bind-deformation}

Rest pose, bind pose, inverse bind relation, joint order, skin influence와 morph basis를 구분하고 base mesh 또는 rig가 바뀌면 그 기준에서 파생된 skin과 deformation을 stale로 식별해야 한다.

### Humanoid Mapping {#actor-humanoid-mapping}

Humanoid actor는 motion vocabulary가 참조하는 공통 bone role과 model-specific bone의 대응을 명시하고 이름 유사성만으로 retarget하지 않아야 한다.

### Range와 Constraint {#actor-joint-range-constraints}

Joint range, hinge 또는 ball behavior, twist, dependency, IK target와 contact constraint를 선언하고 pose와 motion sampling에서 같은 rule을 적용해야 한다.

### Driver와 Control Dependency {#actor-rig-control-drivers}

한 control이 다른 joint, morph, attachment 또는 material channel을 구동할 때 input, output, ratio 또는 bounded function, evaluation order와 valid range를 선언하고 dependency cycle이나 hidden corrective가 pose를 바꾸지 않아야 한다.

### Retargeting {#actor-motion-retargeting}

외부 또는 다른 body proportion의 motion을 retarget할 때 source skeleton, target mapping, rest basis, scale와 coordinate conversion, root motion, contact, expression와 unsupported channel을 기록해야 한다. 자동 mapping 결과는 사용자가 검토하고 override하거나 거부할 수 있어야 한다.

### Rig Refusal {#actor-rig-refusal}

Cycle, missing bone, detached hierarchy, invalid rest transform, contradictory mapping, unsupported scale와 skin binding mismatch를 origin fallback 없이 거부해야 한다.

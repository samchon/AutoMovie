# 퍼포먼스, 모션과 스테이징 시스템 명세

<!-- @evidence requirements/actors/README.md#actor-요구사항 배우 identity, 표현, 상태와 연기 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/formations/README.md#formation-요구사항 집단 identity, 배치, 이동과 terrain 적응 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/motion/README.md#동작-요구사항 motion source, channel, sampling, composition과 retargeting 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/staging/README.md#장면-연출-요구사항 공간 배치, 사건, 상호작용, coverage와 continuity 약속을 시스템 계약으로 정밀화한다. -->

## 주제별 계약 {#performance-motion-staging-specification-index}


이 디렉터리는 배우와 물체가 무엇인지, 어떤 rig와 motion을 수행하는지, 집단이 어떻게 배치되고 움직이는지, 장면의 mark·zone·event·coverage가 어떻게 검증되는지를 package와 구현 심벌에 독립적인 상태 계약으로 정의한다.

- [배우 정체성, 상태와 fidelity](./actor-identity-state-and-fidelity.md)
- [Rig, deformation과 retargeting](./rig-deformation-and-retargeting.md)
- [Motion sampling과 composition](./motion-sampling-and-composition.md)
- [Kinematics, contact와 interaction](./kinematics-contact-and-interaction.md)
- [Formation identity, layout과 terrain](./formation-identity-layout-and-terrain.md)
- [Formation motion, resolution과 budgets](./formation-motion-resolution-and-budgets.md)
- [Staging space, state와 choreography](./staging-space-state-and-choreography.md)
- [Staging events, coverage와 validation](./staging-events-coverage-and-validation.md)

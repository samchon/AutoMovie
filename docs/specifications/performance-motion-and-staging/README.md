# 퍼포먼스, 모션과 스테이징 시스템 명세

## 주제별 계약 {#performance-motion-staging-specification-index}

<!-- @evidence requirements/actors/scope-and-identity.md#actor-scope-identity 배우를 정체성과 교체 가능한 표현을 가진 공연 주체로 다루는 시스템 계약을 연결한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-scope-identity 모든 주체의 동작을 의미와 시간 상태로 다루는 시스템 계약을 연결한다. -->
<!-- @evidence requirements/formations/scope-and-identity.md#formation-scope-identity 반복 주체의 집단 정체성과 compact 표현 계약을 연결한다. -->
<!-- @evidence requirements/staging/scope-and-source-of-truth.md#staging-scope-source story 사실을 공간과 시간의 촬영 계획으로 해석하는 시스템 계약을 연결한다. -->

이 디렉터리는 배우와 물체가 무엇인지, 어떤 rig와 motion을 수행하는지, 집단이 어떻게 배치되고 움직이는지, 장면의 mark·zone·event·coverage가 어떻게 검증되는지를 package와 구현 심벌에 독립적인 상태 계약으로 정의한다.

- [배우 정체성, 상태와 fidelity](./actor-identity-state-and-fidelity.md)
- [Rig, deformation과 retargeting](./rig-deformation-and-retargeting.md)
- [Motion sampling과 composition](./motion-sampling-and-composition.md)
- [Kinematics, contact와 interaction](./kinematics-contact-and-interaction.md)
- [Formation identity, layout과 terrain](./formation-identity-layout-and-terrain.md)
- [Formation motion, resolution과 budgets](./formation-motion-resolution-and-budgets.md)
- [Staging space, state와 choreography](./staging-space-state-and-choreography.md)
- [Staging events, coverage와 validation](./staging-events-coverage-and-validation.md)

# Effect와 Simulation 요구사항

Effect와 simulation은 story event가 만드는 particle, fire, smoke, fluid, collision, soft deformation와 환경 변화를 bounded deterministic state로 표현한다. 모든 실행 tier는 같은 fixed film clock에서 반복 seek가 가능해야 하며, 사용자가 채택한 외부 solver나 cache의 공급자를 AutoMovie가 대신 선택하지 않는다. 결과는 staging, motion과 timing을 검토하는 prototype이고 저작 가능한 입력과 검증 범위를 벗어난 production-grade 물리나 안전 분석을 주장하지 않는다.

- [범위와 Simulation Tier](./scope-and-simulation-tiers.md)
- [Particle와 Emission](./particles-and-emission.md)
- [Fire, Smoke와 Atmosphere](./fire-smoke-and-atmosphere.md)
- [Fluid와 Water](./fluids-and-water.md)
- [Soft Body와 Deformation](./soft-bodies-and-deformation.md)
- [Rigid Motion, Ballistics와 Collision](./rigid-motion-ballistics-and-collision.md)
- [Damage와 Destruction 경계](./damage-and-destruction-boundary.md)
- [Environment Coupling](./environment-coupling.md)
- [Clock, Seek와 Determinism](./clock-seek-and-determinism.md)
- [Budget와 Bounded Work](./budgets-and-bounded-work.md)
- [검증과 Evidence](./validation-and-evidence.md)

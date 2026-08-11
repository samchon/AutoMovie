# Soft Bodies and Deformation

## Soft domain identity와 state {#soft-domain-identity-and-state}
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-body-deformation 이 절은 anchor와 constraint를 가진 유한 soft domain을 정의한다. -->
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-discretization-identity 이 절은 lattice와 solver 설정을 결과 identity에 포함한다. -->

Soft domain 입력은 stable identity, rest topology, ordered particles, constraints, fixed step, iteration cap, seed, units와 basis다. State는 absolute tick, 모든 particle의 positionㆍprevious position 또는 velocity, constraint revision, active anchors와 digest를 포함한다. Topology나 solver parameter가 바뀌면 새 domain revision이며 이전 checkpoint와 external bake는 호환되지 않는다.

### Static와 moving anchor {#soft-static-moving-anchor-input}
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors 이 절은 anchor의 소유 frame과 시간 평가를 명시하게 한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary 이 절은 moving primary boundary를 soft anchor 입력으로 고정한다. -->

Anchor는 particle identity, static world point 또는 moving subject-local point, weight와 활성 구간을 가진다. Moving pose는 같은 tick의 world snapshot 또는 authored motion phase에서 먼저 평가되고 soft solve는 그 immutable pose를 읽는다. 해결되지 않은 subject, 범위 밖 particle, 두 exclusive anchor의 충돌은 solve 전에 거절한다.

### Collider와 solver transition {#soft-collider-and-solver-transition}
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders 이 절은 soft domain이 읽는 collider를 shared world proxy에 묶는다. -->
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state 이 절은 seek에 필요한 완전 solver state를 보존하게 한다. -->

Collider 입력은 world snapshot revision에 속한 bounded plane, sphere, capsule 또는 box proxy와 friction/response proxy다. 한 tick은 external force, prediction, ordered constraint iterations, ordered collision projection, state finalization 순으로 진행한다. Output은 complete next state, contact summary, bounds와 budget counters다. Partial iteration state는 checkpoint가 아니며 resume 입력으로 사용할 수 없다.

### External deformation adoption {#soft-external-deformation-adoption}
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result 이 절은 외부 deformation을 immutable bake와 receipt로 채택한다. -->

외부 deformation 입력은 source mesh/topology digest, basis, units, sample clock, sample range, interpolation rule, bytes digest와 adoption receipt다. Samples는 stable vertex 또는 control-point correspondence를 증명해야 하며 누락 sample이나 topology mismatch는 거절한다. Provider metadata는 provenance에만 남고 evaluation은 adopted bytes와 metadata만 읽는다.

### Soft failure와 fidelity {#soft-failure-and-fidelity-boundary}
<!-- @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-fidelity-boundary 이 절은 coarse deformation과 engineering truth를 구분한다. -->

Unbounded topology, unsupported collider, unstable declared step, iterationㆍstep budget 초과, invalid anchor, self-collision 요구가 지원 tier 밖이면 `refused`, `not-run` 또는 `unsupported`다. 성공한 state는 cloth-like 또는 soft staging의 coarse motion을 의미하며 재료 응력, 찢김, 생체 조직, 구조 안전, final-quality deformation을 증명하지 않는다.

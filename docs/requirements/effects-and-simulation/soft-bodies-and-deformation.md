# Soft Body와 Deformation

## Anchor와 Constraint를 가진 Soft Domain {#effects-soft-body-deformation}

Curtain, cloth proxy, rope, net, upholstery, flag, foliage와 project-defined deformable surface를 particle 또는 control, constraint, anchor, collider, material-like parameters와 rest state로 표현할 수 있어야 한다.

### Discretization Identity {#effects-soft-discretization-identity}

Control point 또는 particle topology, constraint order, rest lengths, solver tier와 iteration bound는 domain identity의 일부여야 하며 render tessellation이나 camera distance가 solver state를 암묵적으로 바꾸지 않아야 한다.

### Static와 Moving Anchor {#effects-soft-anchors}

World anchor, building·object attachment와 actor bone anchor를 구분하고 moving anchor는 각 fixed-step boundary의 source performance를 읽어야 한다.

### Shared Collider {#effects-soft-colliders}

Plane, sphere, box, capsule와 supported proxy를 body, object와 world collision에서 같은 representation으로 재사용하고 missing target을 origin collider로 만들지 않아야 한다.

### Solver State {#effects-soft-solver-state}

Rest, initial, named state, step, position, velocity와 output surface의 relation을 명시하고 arbitrary seek에서도 same initial state에서 재생성할 수 있어야 한다.

### External Deformation Result {#effects-soft-external-result}

사용자가 외부 cloth 또는 deformation 결과를 채택하면 provider에 종속되지 않은 point·channel mapping, topology, units, sample clock, interpolation, source digest와 conversion loss를 기록하고 native bounded solve와 구분해야 한다.

### Fidelity 경계 {#effects-soft-fidelity-boundary}

Bounded visual deformation과 production-grade garment fit, folding, tearing, hair와 skin simulation을 구분하고 직접 저작 ceiling을 넘어선 품질을 주장하지 않아야 한다.

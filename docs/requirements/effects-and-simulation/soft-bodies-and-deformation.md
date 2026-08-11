# Soft Body와 Deformation

## Anchor와 Constraint를 가진 Soft Domain {#effects-soft-body-deformation}

Curtain, cloth proxy, rope, net, upholstery, flag, foliage와 project-defined deformable surface를 particle 또는 control, constraint, anchor, collider, material-like parameters와 rest state로 표현할 수 있어야 한다.

### Static와 Moving Anchor {#effects-soft-anchors}

World anchor, building·object attachment와 actor bone anchor를 구분하고 moving anchor는 각 fixed-step boundary의 source performance를 읽어야 한다.

### Shared Collider {#effects-soft-colliders}

Plane, sphere, box, capsule와 supported proxy를 body, object와 world collision에서 같은 representation으로 재사용하고 missing target을 origin collider로 만들지 않아야 한다.

### Solver State {#effects-soft-solver-state}

Rest, initial, named state, step, position, velocity와 output surface의 relation을 명시하고 arbitrary seek에서도 same initial state에서 재생성할 수 있어야 한다.

### Fidelity 경계 {#effects-soft-fidelity-boundary}

Bounded visual deformation과 production-grade garment fit, folding, tearing, hair와 skin simulation을 구분하고 직접 저작 ceiling을 넘어선 품질을 주장하지 않아야 한다.

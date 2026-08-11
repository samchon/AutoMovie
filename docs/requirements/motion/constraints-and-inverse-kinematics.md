# Constraint와 IK

## 목표를 따르는 Bounded Solve {#motion-constraints-ik}

Look, reach, plant, aim, hinge, path와 multi-joint target을 named control, chain, limit, weight, precedence와 iteration bound가 있는 constraint로 표현할 수 있어야 한다.

### Target Space {#motion-constraint-target-space}

World, actor, bone, object와 path-local target space를 구분하고 transform chain을 명시하여 같은 target을 consumer마다 다르게 해석하지 않아야 한다.

### Solve Order {#motion-constraint-solve-order}

Base pose, retarget, layer, IK, contact와 secondary correction의 적용 순서를 고정하고 순서가 결과 identity와 digest에 포함되어야 한다.

### Reachability {#motion-constraint-reachability}

Joint range, chain length, obstacle와 required tolerance 안에서 target 도달 가능성을 판정하고 unreachable target을 limb stretch나 origin fallback으로 숨기지 않아야 한다.

### Solve Bound와 Failure {#motion-constraint-solve-failure}

Iteration, tolerance와 worst-case chain count를 선언하고 non-convergence, cycle, conflicting target와 invalid chain을 deterministic failure로 보고해야 한다.

# Root 이동과 Trajectory

## World와 Subject Local 이동의 결합 {#motion-root-trajectories}

Root motion은 position, orientation, path, speed와 actor-local pose의 관계를 명시하여 subject가 제자리 clip과 world translation을 중복 적용하지 않게 해야 한다.

### Path와 Timing {#motion-path-timing}

Line, curve, network route, formation path와 project-defined trajectory를 distance 또는 time parameter로 sample하고 start, end, speed profile와 turn behavior를 선언해야 한다.

### Facing과 Travel {#motion-facing-travel}

Travel direction, body facing, look target와 local gait axis를 분리하여 sidestep, backward motion, turn-in-place와 curved travel을 표현할 수 있어야 한다.

### Ground와 Clearance {#motion-root-ground-clearance}

Trajectory는 terrain, floor, stair, water, obstacle와 opening의 traversable state와 clearance를 사용하고 path center만 통과한다고 성공으로 보지 않아야 한다.

### Trajectory Refusal {#motion-trajectory-refusal}

Disconnected route, impossible speed, teleport, non-finite sample, out-of-scope surface와 end state mismatch를 명시적으로 거부해야 한다.

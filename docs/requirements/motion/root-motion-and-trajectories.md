# Root 이동과 Trajectory

## World와 Subject Local 이동의 결합 {#motion-root-trajectories}

Root motion은 position, orientation, path, speed와 subject-local pose의 관계를 명시하여 subject가 제자리 clip과 world translation을 중복 적용하지 않게 해야 한다.

### Root Authority와 Adoption Mode {#motion-root-authority-mode}

Clip root를 absolute 또는 delta로 사용, in-place로 추출, authored trajectory에 맞춰 bounded warp 또는 무시하는 방식 중 하나를 사용자가 선택하고, vertical motion와 facing을 포함해 어느 channel이 최종 world transform을 소유하는지 기록해야 한다.

### Path와 Timing {#motion-path-timing}

Line, curve, network route, formation path와 project-defined trajectory를 arc distance 또는 time parameter로 sample하고 start, end, speed와 acceleration profile, stop, turn과 extrapolation behavior를 선언해야 한다.

### Path Fit와 Motion Warp {#motion-path-fit-warp}

Source stride와 authored path distance가 다를 때 time scale, stride scale, root warp, slip 또는 refusal 중 허용한 correction과 bound를 선택하고 end mark를 맞추기 위해 contact와 joint range를 무제한 왜곡하지 않아야 한다.

### Facing과 Travel {#motion-facing-travel}

Travel direction, body facing, look target와 local gait axis를 분리하여 sidestep, backward motion, turn-in-place와 curved travel을 표현할 수 있어야 한다.

### Ground와 Clearance {#motion-root-ground-clearance}

Trajectory는 terrain, floor, stair, water, obstacle와 opening의 traversable state와 clearance를 사용하고 path center만 통과한다고 성공으로 보지 않아야 한다.

### Trajectory Refusal {#motion-trajectory-refusal}

Disconnected route, impossible speed, teleport, non-finite sample, out-of-scope surface와 end state mismatch를 명시적으로 거부해야 한다.

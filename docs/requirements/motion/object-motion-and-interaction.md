# Object State와 Interaction

## Actor와 Object가 공유하는 동작 {#motion-object-interaction}

Door, drawer, tool, weapon, vehicle control, machine, furniture와 prop는 named state, joint, motion, actor contact와 semantic event를 연결할 수 있어야 한다.

### State Transition {#motion-object-state-transition}

Open, closed, locked, loaded, folded, damaged와 project-defined state 사이의 valid transition, precondition, duration와 end condition을 선언해야 한다.

### Handoff와 Ownership {#motion-object-handoff}

World support, actor grasp, 다른 actor, container와 attachment 사이의 ownership 변경을 release와 acquire event로 표현하고 한 object가 동시에 여러 owner에 고정되지 않아야 한다.

### Coupled Motion {#motion-coupled-objects}

Handle과 door, wheel과 vehicle, gear, pulley, linked panel와 dependent part를 ratio, axis, phase와 constraint로 연결할 수 있어야 한다.

### Interaction Refusal {#motion-interaction-refusal}

잘못된 start state, missing object, collision, impossible reach, duplicate ownership, detached joint와 end state 미달을 명시적으로 거부해야 한다.

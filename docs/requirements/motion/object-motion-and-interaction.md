# Object State와 Interaction

## Actor와 Object가 공유하는 동작 {#motion-object-interaction}

Door, drawer, tool, weapon, vehicle control, machine, furniture, deformable prop와 project-defined object는 named state, control, joint, motion, participant contact와 semantic event를 연결할 수 있어야 한다.

### User-authored Object Vocabulary {#motion-object-authored-vocabulary}

사용자와 저작 에이전트는 catalogue에 없는 object의 control, valid state, transition, driver와 interaction role을 정의할 수 있어야 하며 filename이나 geometry 모양에서 open, fire, drive 같은 behavior를 추측하지 않아야 한다.

### State Transition {#motion-object-state-transition}

Open, closed, locked, loaded, folded, damaged와 project-defined state 사이의 valid transition, precondition, duration와 end condition을 선언해야 한다.

### Handoff와 Ownership {#motion-object-handoff}

World support, actor grasp, 다른 actor, container와 attachment 사이의 ownership 변경을 release와 acquire event로 표현하고 한 object가 동시에 여러 owner에 고정되지 않아야 한다.

### Coupled Motion {#motion-coupled-objects}

Handle과 door, wheel과 vehicle, gear, pulley, linked panel와 dependent part를 ratio, axis, phase, lag, range와 constraint로 연결할 수 있어야 하며 coupling graph의 evaluation order가 결정적이어야 한다.

### Multi-subject Interaction {#motion-multi-subject-interaction}

두 명 이상의 actor, formation, vehicle와 object가 같은 interaction을 수행할 때 participant role, shared target, ownership, synchronized event와 final state를 하나의 fixed-clock 관계로 검토할 수 있어야 한다.

### Interaction Refusal {#motion-interaction-refusal}

잘못된 start state, missing object, collision, impossible reach, duplicate ownership, detached joint와 end state 미달을 명시적으로 거부해야 한다.

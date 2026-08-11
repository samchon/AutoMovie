# Interaction과 Choreography

## 여러 Subject가 공유하는 Action {#staging-interactions-choreography}

Meet, handoff, fight, dance, carry, operate, open, board, embrace와 project-defined interaction을 participant role, target, contact, event sequence와 state consequence로 표현할 수 있어야 한다.

### Participant Role {#staging-interaction-roles}

Initiator, receiver, target, support, observer와 group role을 명시하고 motion filename에서 누가 무엇을 하는지 추정하지 않아야 한다.

### Spatial Synchronization {#staging-spatial-synchronization}

Participant path, facing, reach, contact, prop, formation와 environment geometry가 같은 time sample에서 성립해야 한다.

### Contact Contract {#staging-interaction-contact-contract}

각 접촉은 participant 또는 prop의 named landmark·surface, 접근 방향, contact 시작·유지·해제 interval, position·orientation tolerance와 접촉 전후 owner state를 가져야 하며 root point 근접만으로 handoff나 impact를 통과시키지 않아야 한다.

### Choreography Phase {#staging-choreography-phases}

Approach, anticipation, action, impact, reaction, release와 recovery를 semantic event와 state change에 연결할 수 있어야 한다.

### Choreography Sampling {#staging-choreography-time-sampling}

각 phase의 경계와 겹침은 fixed film clock에 놓이고 actor motion, prop state, formation, effect, light와 sound가 같은 sample convention에서 결과를 읽어야 하며 evaluation order나 이전 frame cache에 따라 접촉 결과가 달라지지 않아야 한다.

### Choreography Alternative {#staging-choreography-alternatives}

Stunt, dance, crowd와 interaction의 대안은 동일한 story consequence를 실현하는지 또는 다른 consequence를 선택하는지 명시하고 독립 participant assignment, timing, safety state와 acceptance를 가져야 한다.

### Interaction Refusal {#staging-interaction-refusal}

Missing participant, wrong owner, impossible reach, unsynchronized impact, geometry penetration, duplicate prop와 결과 state 미달을 거부해야 한다.

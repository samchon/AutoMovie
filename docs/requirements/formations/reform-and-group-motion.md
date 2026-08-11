# Reform과 Group Motion

## 시간에 따라 바뀌는 집단 Shape {#formation-reform-group-motion}

Formation은 한 layout에서 다른 layout으로 film-time interval 안에 reform하고 group path, facing와 member-local motion을 함께 표현할 수 있어야 한다.

### Group Motion Model 선택 {#formation-group-motion-model-selection}

사용자와 저작 에이전트는 rigid group transform, unit path, leader-follow, slot tracking, vehicle convoy 또는 project-defined bounded motion model을 선택하고 적용 hierarchy, command timing, speed와 local freedom을 선언해야 한다.

### Local Position Blend {#formation-reform-local-blend}

Reform은 source와 target slot의 formation-local position을 bounded easing으로 연결한 뒤 group transform을 적용하여 turn과 terrain movement가 layout 변화에 이중 적용되지 않게 해야 한다.

### Turn과 속도 변화 {#formation-turn-speed-response}

Group path의 curvature, acceleration, stop과 reverse가 안쪽·바깥쪽 member의 travel distance, facing, gait 또는 wheel motion과 command delay에 어떻게 반영되는지 선언하고 모든 member를 같은 world velocity로 미끄러뜨리지 않아야 한다.

### Slot Assignment {#formation-reform-slot-assignment}

Count가 같은 layout 사이의 explicit correspondence 또는 user-selected deterministic assignment, count가 달라지는 join·leave와 hero 고정 slot을 명시하고 member가 중간에 무작위 교체되지 않아야 한다.

### Command와 Response Event {#formation-command-response-events}

명령 발행, unit 수신, movement 시작, target shape 도달과 semantic completion을 서로 다른 event로 표현하여 delayed rank, accordion effect와 intentional disorder를 검토할 수 있어야 한다.

### Interior State {#formation-reform-interior-state}

Reform의 시작과 끝뿐 아니라 내부 sample에서 spacing, overlap, terrain, route, speed와 story readability를 검증해야 한다.

### Reform Refusal {#formation-reform-refusal}

수용 불가능한 target, 겹치는 exclusive reform, member teleport, invalid duration와 end layout 미달을 거부해야 한다.

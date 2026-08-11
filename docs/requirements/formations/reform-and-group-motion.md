# Reform과 Group Motion

## 시간에 따라 바뀌는 집단 Shape {#formation-reform-group-motion}

Formation은 한 layout에서 다른 layout으로 film-time interval 안에 reform하고 group path, facing와 member-local motion을 함께 표현할 수 있어야 한다.

### Local Position Blend {#formation-reform-local-blend}

Reform은 source와 target slot의 formation-local position을 bounded easing으로 연결한 뒤 group transform을 적용하여 turn과 terrain movement가 layout 변화에 이중 적용되지 않게 해야 한다.

### Slot Assignment {#formation-reform-slot-assignment}

Count가 같은 layout 사이의 member correspondence, count가 달라지는 join·leave와 hero 고정 slot을 명시하고 member가 중간에 무작위 교체되지 않아야 한다.

### Interior State {#formation-reform-interior-state}

Reform의 시작과 끝뿐 아니라 내부 sample에서 spacing, overlap, terrain, route, speed와 story readability를 검증해야 한다.

### Reform Refusal {#formation-reform-refusal}

수용 불가능한 target, 겹치는 exclusive reform, member teleport, invalid duration와 end layout 미달을 거부해야 한다.

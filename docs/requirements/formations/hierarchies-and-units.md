# Hierarchy와 Unit

## 여러 Scale의 집단 구성 {#formation-hierarchies-units}

Member, squad, rank, company, audience section, convoy segment와 project-defined unit를 nested hierarchy로 구성하고 각 level의 transform, layout, state와 command를 가질 수 있어야 한다.

### Containment와 Membership {#formation-membership}

Member는 한 시점의 physical formation ownership을 명확히 가지며 logical tag와 temporary subgroup는 물리적 중복 배치를 만들지 않아야 한다.

### Unit-local Variation {#formation-unit-local-variation}

Unit마다 prototype mix, spacing, facing, motion phase, costume와 damage variation을 갖고 상위 group rule과 local exception의 provenance를 유지해야 한다.

### Command Propagation {#formation-command-propagation}

Move, halt, turn, reform와 react command가 어느 hierarchy level과 member에 적용되는지 명시하고 hero override와 delayed response를 표현할 수 있어야 한다.

### Hierarchy Refusal {#formation-hierarchy-refusal}

Cycle, duplicate physical membership, missing prototype, empty required unit와 parent 밖 member를 탐지해야 한다.

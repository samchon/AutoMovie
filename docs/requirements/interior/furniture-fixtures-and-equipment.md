# 가구, Fixture와 Equipment

## 공간에 놓이고 사용되는 대상 {#interior-furniture-fixtures-equipment}

Loose furniture, built-in, sanitary fixture, casework, appliance, equipment, prop, plant와 project-defined object를 공간, host surface, orientation, support와 사용 관계로 배치할 수 있어야 한다.

지원 범위를 미리 심은 catalogue로 제한하지 않고 project-authored geometry, external glTF direct placement, native conversion와 nested group composition을 동일한 placement 계약 아래 사용할 수 있어야 한다. 표현 경로가 달라도 stable object identity, actual size, state, support와 consumer relationship을 보존해야 한다.

### 배치 Anchor와 Support {#interior-object-anchor-support}

Floor-standing, wall-mounted, ceiling-hung, recessed, countertop, rail-mounted와 free placement를 구분하고 실제 anchor와 weight-bearing 또는 visual support 관계를 가져야 한다.

### 사용과 Clearance {#interior-object-use-clearance}

Seat, worktop, storage, door, drawer, appliance, control와 maintenance point는 actor profile과 state별 접근, reach, opening sweep와 service clearance를 선언할 수 있어야 한다.

Physical body, door·drawer·folding motion, installation, removal, service와 temporary work volume을 구분하고 겹침의 종류와 동시에 활성인 state를 보고해야 한다. Reserved volume은 렌더 geometry가 아니더라도 대상과 purpose, priority, state와 시간에 주소 가능해야 한다.

### Built-in과 Loose Object {#interior-built-in-loose-distinction}

Building assembly에 결합된 built-in과 이동 가능한 loose furniture를 구분하여 renovation, phase, quantity, collision와 shot continuity에서 다른 consequence를 가질 수 있어야 한다.

### Story Prop 관계 {#interior-story-prop-relation}

Actor가 들거나 조작하는 prop은 staging과 motion이 소유하는 행위 identity에 연결되며 interior placement는 rest location, support와 공간 clearance를 제공해야 한다.

### 배치 거부 {#interior-object-placement-refusal}

Host 밖 placement, 공중 부양, wall penetration, blocked route, 겹친 reserved clearance와 닫힌 furniture state를 무시하는 점유를 탐지해야 한다.

Finding은 object와 support identity, resolved transform, collision 또는 clearance pair, state, penetration depth나 minimum gap과 사용한 profile을 제공해야 한다. Imported bound만 통과한 결과를 usable placement로 표시하지 않아야 한다.

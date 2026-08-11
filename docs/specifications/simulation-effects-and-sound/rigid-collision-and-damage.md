# Rigid Motion, Collision, and Damage

## Rigid body state와 authority {#rigid-body-state-and-motion-authority}

### Authored, analytic, solved trajectory {#rigid-trajectory-tier-contract}

<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-rigid-ballistics-collision 이 절은 object 물리 관계를 bounded domain으로 정의한다. -->
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-rigid-linear-angular-state 이 절은 linear와 angular 상태의 최소 완전 집합을 정한다. -->

Rigid state는 stable body identity, tick, position, orientation, linearㆍangular velocity, mass/inertia proxy, motion authority와 asleep/active status를 가진다. Input body는 authored transform, analytic ballistic parameters 또는 bounded solve initial state 중 하나만 소유한다. Output은 다음 tick의 완전 상태와 state digest이며 비유한 값, 비양수 mass proxy, 중복 authority는 거절한다.

<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-authored-simulated-trajectory 이 절은 trajectory tier와 authority 전환을 명시하게 한다. -->

Authored trajectory는 key 또는 motion channel이 전체 시간 범위를 소유하고 analytic trajectory는 선언된 가속도와 초기 조건의 닫힌 함수다. Bounded solved trajectory는 fixed tick과 admitted contact domain만 사용한다. Authority transition은 정확한 tick, 이전 final state, 다음 initial state와 continuity rule을 가지며 두 tier가 같은 tick을 동시에 쓰지 않는다.

### Collision proxy와 world contact {#collision-proxy-and-world-contact-output}
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-collision-proxies 이 절은 render geometry와 별개의 측정 가능한 proxy를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence 이 절은 impact를 downstream consequence가 읽을 stable event로 만든다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance 이 절은 motion contact와 simulated contact가 authority와 tolerance를 공유하게 한다. -->

Collision input은 body와 world snapshot에 속한 sphere, capsule, box, plane 또는 명시된 bounded proxy와 collision group이다. Broad phase와 narrow phase 결과는 stable body pair order로 정렬되고 contact는 tick, pair identity, point, normal, penetration proxy, relative velocity와 impulse proxy를 가진다. Output consequence는 authored bounce, stop, attach, damage request, effect spawn, sound emission 중 선언된 것만 허용한다.

### Damage trait와 result state {#damage-trait-result-state-boundary}
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-destruction-boundary 이 절은 damage를 재구성 가능한 상태로 만든다. -->
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-trait-result 이 절은 material trait와 발생한 result를 구분한다. -->

Damage trait는 intact object가 가진 저작 가능 resistance, threshold와 허용 transition이고 damage result는 원인 event 뒤에 생긴 instance state다. Result는 object identity, state name, entered tick, source contact 또는 authored event, persistent modifiers와 presentation bindings를 가진다. Trait만으로 실제 파손을 추론하지 않으며 result 없는 threshold 초과를 성공한 destruction으로 표시하지 않는다.

### Damage transition precedence와 continuity {#damage-transition-precedence-and-continuity}
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-authored-destruction-state 이 절은 허용된 destruction state를 author가 열거하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-transition-precedence 이 절은 동시에 발생한 transition의 결정 순서를 정한다. -->
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-continuity 이 절은 edit와 seek를 건너 damage state를 보존한다. -->

허용 state와 transition graph는 production revision에 속한다. 같은 tick의 request는 causal priority, event time, event identity의 총순서로 처리하며 먼저 확정된 exclusive transition 이후의 불가능 request는 suppressed reason을 남긴다. State는 shot boundary에서 명시적으로 carry, reset 또는 conform되고 seek는 transition log 또는 checkpoint로 같은 결과를 복원한다.

### Destruction ceiling과 evidence {#destruction-solver-ceiling-and-evidence}
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-destruction-solver-ceiling 이 절은 arbitrary fracture 대신 저작 state와 bounded proxy를 한계로 둔다. -->
<!-- @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-destruction-evidence 이 절은 transition과 presentation의 일치를 검증 대상으로 만든다. -->

지원 범위는 authored state swap, bounded fragment set, declared rigid consequence까지다. Evidence는 transition log, before/after state digest, contact 또는 author event, fragment population budget과 presentation binding을 포함한다. 연속체 파괴, 구조 안전, 실제 재료 failure는 unsupported이며 proxy 결과를 그 증거로 사용할 수 없다.

### Rigid와 collision failure {#rigid-collision-failure-contract}
<!-- @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-collision-refusal 이 절은 미지원 proxy와 unbounded collision을 명시적으로 실패시킨다. -->

미해결 body, proxy 없는 solved collision, 동적 topology, 상한 없는 contact pair, dependency cycle, authority 중복, budget 초과는 body와 tick을 지목한 실패다. 실패한 tick 뒤 상태는 생성하지 않고 마지막 complete checkpoint만 재사용 가능하다.

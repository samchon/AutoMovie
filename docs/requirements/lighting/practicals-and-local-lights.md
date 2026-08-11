# Practical과 Local Light

## 화면 속 Source와 실제 방출의 일치 {#lighting-practicals-local}

Lamp, candle, screen, sign, fire, vehicle light, window와 project-defined practical은 visible geometry, emissive appearance, emitted light, control와 current state를 연결할 수 있어야 한다.

### Design과 Staging Trace {#lighting-practical-design-staging-trace}

각 practical은 production design subject·material·state, staging placement·owner·interaction와 story event를 직접 식별하고 같은 fixture의 visible geometry와 emitted source가 어느 revision을 읽는지 추적해야 한다.

### Host와 Attachment {#lighting-practical-host}

Practical은 building, interior, vehicle, prop, actor 또는 map support의 named attachment, local transform와 power 또는 fuel state를 가져야 한다.

### Control State {#lighting-practical-control-state}

Switch, circuit, dimmer, shutter, fuel, ignition와 project-defined control은 stable identity, allowed state, controller와 affected practical을 가져야 하며 한 control change가 어느 visible emission과 local light를 바꾸는지 확인할 수 있어야 한다.

### On-screen Consistency {#lighting-practical-consistency}

Visible bulb나 flame이 off이면 emitted light도 꺼지고, source 밖 light가 필요하면 off-screen 또는 motivated source identity를 따로 가져야 한다.

### Flicker와 Failure {#lighting-flicker-failure}

Flicker, pulse, dim, outage, ignition와 color change를 bounded curve, seed와 event로 표현하고 frame마다 nondeterministic noise를 사용하지 않아야 한다.

### Practical Sampling {#lighting-practical-time-sampling}

Fixture geometry, attachment, emissive appearance, emitted light와 control state는 같은 fixed-clock sample을 읽고 switch event의 first observable frame과 지속 interval을 명시해야 한다.

### Practical Alternative {#lighting-practical-alternatives}

Practical on·off, failure, replacement fixture와 motivated off-screen source의 대안은 독립 state branch와 camera readability consequence를 가져야 하며 선택되지 않은 source를 fill light로 남기지 않아야 한다.

### Practical Refusal {#lighting-practical-refusal}

Host 없는 light, source geometry와 다른 위치, contradictory state, unsupported distribution와 unbounded flicker를 거부해야 한다.

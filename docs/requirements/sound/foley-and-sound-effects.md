# Foley와 Sound Effect

## 물체와 접촉에서 들리는 Sound {#sound-foley-effects}

Footstep, cloth, grasp, impact, door, machine, weapon, vehicle, break와 project-defined effect를 source event, material pair, emitter, intensity와 state에 연결할 수 있어야 한다.

### Material과 Surface {#sound-foley-material-surface}

Foot와 ground, object와 object, fluid와 container 같은 interacting material과 surface state를 cue selection 또는 procedural parameter에 사용할 수 있어야 한다.

### Variation과 Repetition {#sound-foley-variation}

반복 footstep, machine cycle와 crowd event는 bounded source set, seed, phase와 gain variation을 사용하여 재현되고 same event가 무관한 편집으로 바뀌지 않아야 한다.

### Layered Effect {#sound-layered-effects}

Transient, body, debris, tail와 environmental response를 여러 source layer로 구성할 수 있고 각 layer의 event relation과 bus를 유지해야 한다.

### Effect Claim 경계 {#sound-effect-claim-boundary}

Library filename과 material label만으로 실제 물리 음향을 검증했다고 주장하지 않고 creative authored choice와 measured propagation을 구분해야 한다.

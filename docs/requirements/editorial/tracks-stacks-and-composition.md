# Track, Stack과 Composition

## 여러 Media 관계의 Timeline 구성 {#editorial-tracks-stacks-composition}

Picture, dialogue, effects, ambience, music, caption, metadata와 project-defined track을 ordered stack 또는 composition으로 구성하고 role, enabled state와 overlap behavior를 가져야 한다.

### Sequential Track {#editorial-sequential-tracks}

Track 안의 clip, gap와 transition은 explicit order와 duration을 가지며 silent hole과 intentionally empty gap을 구분해야 한다.

### Layered Stack {#editorial-layered-stacks}

여러 picture layer, title, matte, audio bus와 nested sequence를 합성할 수 있고 z-order 또는 mix order를 고정해야 한다.

### Enable와 Alternative {#editorial-enable-alternatives}

Clip과 track을 disabled, muted, alternative media와 temporary offline state로 표현하고 삭제와 동일시하지 않아야 한다.

### Composition Refusal {#editorial-composition-refusal}

Cycle, unknown track role, unsupported overlap, empty required primary picture와 duration mismatch를 거부해야 한다.

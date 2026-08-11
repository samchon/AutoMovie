# Track, Stack과 Composition

## 여러 Media 관계의 Timeline 구성 {#editorial-tracks-stacks-composition}

Picture, dialogue, effects, ambience, music, caption과 metadata는 목적이 명시된 track, ordered stack 또는 nested composition으로 구성되어야 한다. 각 구성 요소는 stable identity, role, enabled state, time range, ordering과 overlap 규칙을 가져야 한다.

### Sequential Track {#editorial-sequential-tracks}

Sequential track 안의 clip, gap과 transition은 명시적 순서와 계산 가능한 duration을 가져야 한다. Media가 없는 silent 또는 transparent gap과 아직 채워지지 않은 missing interval을 구분하여 전자는 재현하고 후자는 incomplete로 보고해야 한다.

### Layered Stack {#editorial-layered-stacks}

여러 picture layer, title, matte, audio layer와 nested sequence는 고정된 z-order 또는 mix order로 합성되어야 한다. 같은 시간과 같은 우선순위의 결과가 모호하면 입력 나열 순서에 의존하지 말고 충돌로 보고해야 한다.

### Picture Composition {#editorial-picture-composition}

Opacity, matte, crop, transform과 supported blend relation은 어떤 layer에 어느 range 동안 적용되는지 나타내야 한다. 숨겨진 layer도 revision과 source relation을 유지하되 최종 picture 기여 여부를 명확히 해야 한다.

### Sound Composition {#editorial-sound-composition}

Audio track은 role, channel 또는 bus relation, gain과 overlap behavior를 보존해야 한다. Mute, solo-like review state, intentionally silent range와 missing audio를 구분하고 임시 청취 상태를 published mix 결정으로 승격해서는 안 된다.

### Enable과 Alternative {#editorial-enable-alternatives}

Clip과 track의 disabled, muted, selected alternative, offline과 deleted 상태는 서로 달라야 한다. 상태 변경은 composition identity나 revision에 반영되어야 하며 비활성 항목이 duration, transition handle 또는 validation을 우연히 충족해서는 안 된다.

### Nested Composition {#editorial-nested-composition}

Nested timeline은 자신의 timebase, duration과 source-to-parent transform을 가져야 하며 parent range 밖의 기여를 명시적으로 잘라내거나 거절해야 한다. 순환 참조는 허용하지 않고 같은 child를 여러 번 배치할 때 각 placement의 identity를 구분해야 한다.

### Composition Refusal {#editorial-composition-refusal}

Cycle, duplicate identity, unknown required role, unsupported overlap, ambiguous order, empty required primary picture와 declared duration mismatch는 거절해야 한다. 실패 시 유효한 track의 분석 결과는 보존할 수 있지만 전체 composition을 conformed 또는 final로 표시해서는 안 된다.

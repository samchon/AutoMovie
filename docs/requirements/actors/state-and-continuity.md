# 상태와 Continuity

## Actor State Ledger {#actor-state-continuity}

Actor의 location, pose, health, knowledge, emotion cue, costume, held prop, attachment, dirt, damage와 voice state를 story와 film time에서 추적할 수 있어야 한다.

### Scene Handoff {#actor-scene-state-handoff}

한 scene의 종료 state가 다음 scene의 시작 state와 이어지고 시간 생략이나 off-screen event가 있으면 그 변화 원인을 기록해야 한다.

### Shot Continuity {#actor-shot-continuity}

같은 scene을 구성하는 shot 사이에 screen direction, eyeline, body orientation, hand occupancy, pose phase와 costume state가 edit intent에 맞게 이어져야 한다.

### State Alternative {#actor-state-alternatives}

서로 다른 performance take, costume, damage와 emotion choice를 alternative로 보존하고 선택 전 receipt와 render를 섞지 않아야 한다.

### Reset Refusal {#actor-state-reset-refusal}

명시적 transition 없이 neutral pose, empty hand, clean costume, default voice와 origin location으로 돌아가는 것을 deterministic failure로 보고해야 한다.

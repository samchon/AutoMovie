# Actor와 Object 배치

## Scene 시작의 실제 배치 {#staging-subject-object-placement}

Actor, formation, prop, vehicle, furniture, effect source와 camera-relevant object는 scene start와 shot interval의 position, orientation, state, support와 owner를 가져야 한다.

### Rest와 Active Placement {#staging-rest-active-placement}

Object의 rest location, actor가 잡은 상태, moving support와 off-screen location을 구분하고 handoff 전후에 두 위치에 동시에 존재하지 않아야 한다.

### External Asset {#staging-external-asset-use}

Directly placed glTF, native-converted asset와 composed group을 다른 subject와 동일한 identity, bounds, state, contact, visibility와 provenance 기준으로 staging할 수 있어야 한다.

### Dressing과 Story Prop {#staging-dressing-story-props}

Background dressing과 story-relevant prop를 구분하고 frame readability를 위해 dressing을 조정하더라도 location continuity와 host clearance를 유지해야 한다.

### Placement Refusal {#staging-placement-refusal}

Unsupported subject, floating object, duplicate identity, blocked route, wall penetration와 actor가 도달할 수 없는 prop를 거부해야 한다.

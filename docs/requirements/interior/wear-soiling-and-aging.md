# 마모, 오염과 노후화

## 사용자가 저작하는 Surface 변화 {#interior-wear-soiling-aging}

Tile, floor, wall, ceiling, furniture와 fixture의 wear, scratch, stain, dirt, dust, soot, rust, efflorescence, discoloration, chip, crack와 repair를 base material identity 위의 bounded state와 layer로 표현할 수 있어야 한다.

### 저작 의도와 자동화 경계 {#interior-aging-authoring-choice}

어떤 surface를 어떤 원인과 정도로 변화시킬지는 사용자와 MCP knowledge and evidence boundary를 통해 계약과 current evidence를 받는 저작 에이전트가 선택해야 한다. 제품은 표현과 검증 수단을 제공하고 이름이나 연식만으로 임의 aging을 적용하지 않아야 한다.

### Source와 Mask {#interior-aging-source-mask}

사용자 image, 외부 또는 generated texture, procedural field, vertex·surface attribute와 geometry damage를 source로 사용할 수 있고 mask coordinate, scale, channel, color space, digest와 provenance를 추적해야 한다.

Generated 또는 scanned source는 prompt 또는 capture condition, tool과 version, seed 제공 여부, edit history와 result digest를 기록하고 seam, lighting baked into pixels, actual scale와 channel range를 확인해야 한다. Base color, roughness, normal, displacement와 removed geometry를 서로 바꿔 쓸 수 있는 표현으로 취급하지 않아야 한다.

### 원인과 공간 관계 {#interior-aging-causal-placement}

Foot traffic, wheel path, hand contact, water flow, drain, sunlight, smoke, impact, maintenance와 time phase에 변화 영역과 direction을 연결할 수 있어야 한다.

### Group과 Instance Variation {#interior-aging-group-variation}

같은 tile lot와 room group은 공통 aging bias를 공유하고 각 instance는 derived seed와 local exposure에 따른 bounded difference를 가질 수 있어야 한다.

Project, room, installation lot, route or exposure zone와 instance로 이어지는 correlation hierarchy, algorithm version와 stable stream key를 명시해야 한다. 한 tile의 교체나 unrelated edit가 남은 field의 stain, scratch와 wear 위치를 다시 섞지 않아야 한다.

### Surface와 Geometry 손상 {#interior-aging-surface-geometry-distinction}

Color·roughness·normal 변화, material loss, chipped edge, cracked tile, detached piece와 structural breach를 구분하고 texture만 바꾼 결과를 geometry damage로 주장하지 않아야 한다.

### Continuity와 Refusal {#interior-aging-continuity-refusal}

Aging state는 story event와 phase 사이에 이어져야 하며 source 없는 random change, unrelated edit에 따른 재배치, negative thickness, unsupported layer와 stale texture를 거부해야 한다.

Cleaning, repair, replacement와 further damage는 base material과 prior state에 대한 named transition으로 보존하고 어느 영역이 제거, retained 또는 superseded 되었는지 추적해야 한다. Visual aging과 actual remaining service, structural, fire, health 또는 maintenance performance를 별도 근거 없이 연결하지 않아야 한다.

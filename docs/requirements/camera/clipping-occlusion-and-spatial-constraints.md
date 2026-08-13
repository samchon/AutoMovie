# Clipping, Occlusion과 공간 제약

## Camera와 Scene Geometry의 실제 관계 {#camera-clipping-occlusion-spatial}

Near·far clipping range, optional clipping plane, camera body clearance, wall·terrain intersection와 subject occlusion을 resolved scene에서 검토할 수 있어야 한다.

### Geometry Revision {#camera-spatial-geometry-revision}

Camera clearance, clipping와 occlusion 결과는 map·exterior·interior·asset geometry, opening, material opacity와 subject placement의 exact revision과 state를 식별하고 proxy 또는 stale bounds의 결과를 current scene에 적용하지 않아야 한다.

### Clipping Range {#camera-clipping-range}

Near와 far는 positive ordered distance를 가지고 required subject, environment와 depth precision 범위에 맞아야 한다.

Resolved scene을 잘라 내부를 드러내는 optional clipping plane은 검사가 소유하며 저작된 camera의 field가 아니어야 한다. 저작된 camera가 납품하는 clipping은 near와 far뿐이고, 단면으로 만든 관찰은 그 camera가 납품할 그림에 대한 evidence가 아니다. 이 배제가 풀리는 조건은 어떤 production이 단면 자체를 shot으로 납품해야 하는 경우이며, 그때 plane은 저작된 field가 되고 잘려나간 required subject는 readable로 셀 수 없다.

Section plane은 평면 위의 한 점과 제거되는 쪽을 가리키는 normal로 선언하고, 평면 위에 정확히 놓인 geometry는 남는 쪽으로 판정해야 한다. 잘린 단면을 메우는 surface는 만들지 않으며, 껍질이 열려 보이는 것이 단면 관찰의 정상 결과임을 밝혀야 한다.

### Camera Clearance {#camera-clearance}

Interior wall, ceiling, floor, furniture, terrain, vehicle와 moving subject에 대한 camera position과 path clearance를 선언할 수 있어야 한다.

### Dynamic Spatial Sampling {#camera-dynamic-spatial-sampling}

Moving opening, vehicle, crowd, actor, effect와 camera rig의 swept interval을 fixed-clock samples와 conservative boundary로 검토하여 sample 사이의 penetration, clipping 또는 완전 가림을 놓치지 않아야 한다.

### Occlusion Metric {#camera-occlusion-metric}

Required landmark, surface sample 또는 screen coverage를 통해 visibility를 측정하고 center point 하나가 보인다는 이유로 subject 전체가 readable하다고 간주하지 않아야 한다.

### Intended Obstruction {#camera-intended-obstruction}

Foreground frame, over-shoulder, concealment, wipe와 reveal을 intentional obstruction으로 명시하여 accidental occlusion과 구분해야 한다.

### Obstruction Contract {#camera-obstruction-contract}

의도된 obstruction은 occluder identity, affected subject·landmark, screen region 또는 coverage range, 시작·해제 event와 최대 duration을 가져야 하며 threshold를 넓히는 것으로 storytelling intent를 대신하지 않아야 한다.

### Spatial Alternative {#camera-spatial-alternatives}

Occluded take, clear take와 다른 path는 독립 clearance·clipping·visibility 결과를 보존하고 선택한 trade-off와 대체 coverage를 기록해야 한다.

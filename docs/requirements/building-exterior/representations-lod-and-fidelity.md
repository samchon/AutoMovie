# Representation, LOD와 Silhouette

## 거리와 목적에 맞는 외관 Representation {#building-exterior-representations-lod-fidelity}

Building, mass, facade, roof, opening, attachment와 repeated population은 camera distance, projected size, interaction, measurement와 delivery 목적에 맞는 proxy, standard, hero 또는 project-defined representation을 가질 수 있어야 한다.

### Fidelity 성공 기준 {#building-exterior-fidelity-success}

각 representation은 해당 거리와 목적에서 staging, scale, silhouette, 구조 관계, state와 material role을 읽고 다시 생성할 수 있는 deterministic prototype이어야 한다. Photorealism, 무제한 근접 detail와 ornate content는 성공 조건이 아니며 프로젝트가 저작하지 않은 detail을 자동 보완했다고 주장하지 않아야 한다.

### Identity와 공간 불변량 {#building-exterior-lod-invariants}

Representation이 바뀌어도 building과 element identity, placement, footprint, extent, major mass, roofline, total height, silhouette, storey datum, story-relevant opening·attachment, map contact와 current state를 보존해야 한다. Detail 전환이 scale, orientation, phase나 exterior·interior relation을 바꾸지 않아야 한다.

### 원거리 Fidelity {#building-exterior-distant-fidelity}

원거리와 skyline representation은 camera가 읽는 major mass, wing·void 관계, roof profile, landmark, negative space, facade rhythm, dominant material·value와 depth cue를 보존해야 한다. 근거리 panel, joint와 hidden assembly를 생략할 수 있으나 생략된 detail을 검증하거나 수량화했다고 주장하지 않아야 한다.

### 근거리 Fidelity {#building-exterior-close-fidelity}

근거리 또는 hero representation은 declared shot와 검토 목적에 필요한 opening depth, facade relief, corner return, material scale, panel·joint·fixing, roof·balcony drainage, support, threshold와 weathering geometry를 실제 scale로 제공해야 한다. Texture noise나 repaint가 필요한 structural detail, silhouette와 contact를 대신하지 않아야 한다.

### Exterior-only Set의 유효 범위 {#building-exterior-set-fidelity-range}

Facade set, street set와 background building은 어떤 camera position, view cone, distance, reflection·shadow consumer와 delivery tier에서 완전한지 선언해야 한다. 유효 범위 밖의 side, backside, rooftop, interior나 close-up을 자동으로 지원한다고 간주하지 않아야 한다.

### 결정론적 전환 {#building-exterior-lod-transition}

LOD 선택과 전환은 declared distance·projected-size rule, hysteresis와 stable input으로 재현되어야 하며 camera 미세 이동이나 병렬 load 순서로 representation이 불안정하게 바뀌지 않아야 한다. 전환 seam, silhouette pop, opening disappearance와 material-role change를 검토할 수 있어야 한다.

### 검증과 수량의 Representation {#building-exterior-lod-validation-quantity}

각 drawing, quantity, collision, daylight, interior coordination와 visual review는 사용한 representation과 허용 fidelity를 기록해야 한다. Proxy나 원거리 mesh로 exact opening, assembly, area, clearance와 fabrication quantity를 통과시키지 않아야 하며 필요한 detail이 없으면 unsupported 또는 not-run으로 보고해야 한다.

### 거리별 시각 검토 {#building-exterior-lod-visual-review}

건물은 front, side, three-quarter와 roof가 읽히는 각도에서 shot의 원거리, 중거리와 근거리 조건을 검토해야 한다. 실제 frame에서 skyline, silhouette, mass proportion, facade depth, opening, attachment, contact와 transition을 확인하고 가장 보기 좋은 한 각도만으로 representation을 승인하지 않아야 한다.

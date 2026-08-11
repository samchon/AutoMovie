# 표현 Tier와 Fidelity 경계

## 목적에 맞는 Actor Representation {#actor-representation-tiers}

Stick proxy, crowd proxy, standard performer, externally supplied performer와 special-purpose representation을 shot distance, silhouette, motion, interaction와 evidence 목적에 따라 구분할 수 있어야 한다.

### 직접 저작 Ceiling {#actor-direct-authoring-ceiling}

AutoMovie가 직접 만드는 actor는 실제 scale, landmark, joint range, contact와 readable expression channel을 가진 blocking-pass proxy이며 realistic human likeness를 자동 생성한다고 주장하지 않아야 한다.

### Fidelity와 Performance Capability {#actor-fidelity-capability-separation}

Silhouette, surface, deformation, face, hair와 cloth fidelity는 rig control, range, contact, expression, gaze와 interaction capability와 별도로 평가해야 한다. 보기 좋은 외부 model이 필요한 control을 가진다고 가정하거나 crude proxy가 수행 가능한 motion까지 제한하지 않아야 한다.

### 외부 Actor Asset {#actor-external-representation}

사용자는 자신이 확보한 glTF, GLB 또는 VRM actor를 지원 subset 안에서 채택하고 skeleton, skin, morph, material와 animation을 direct use, native conversion 또는 다른 project 자산과의 composition으로 사용할 수 있어야 한다. 외부 자산을 사용할 수 있다는 약속과 AutoMovie가 그 fidelity를 직접 생성한다는 약속을 구분해야 한다.

### Shot별 Tier 선택 {#actor-shot-tier-selection}

사용자와 저작 에이전트는 shot distance와 검토 목적에 필요한 representation tier, double과 switching boundary를 선택할 수 있어야 하며, runtime budget이 hero, required expression, contact 또는 silhouette를 더 낮은 tier로 몰래 바꾸지 않아야 한다.

### Tier Compatibility {#actor-tier-compatibility}

Representation을 교체해도 actor identity, body scale, root, skeleton mapping, contact, costume, prop, motion와 story state가 보존되거나 차이가 명시되어야 한다.

### Quality Claim 경계 {#actor-quality-claim-boundary}

Proxy가 story action을 읽히게 한다는 성공과 close-up anatomy, facial likeness, skin, hair와 cloth fidelity를 구분하고 검증하지 않은 품질을 render 한 장으로 주장하지 않아야 한다.

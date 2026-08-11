# Visibility와 Readability

## 관객이 사건을 읽을 수 있는 배치 {#staging-visibility-readability}

필수 subject, contact, gesture, prop, reveal와 state change는 intended camera와 time에서 크기, occlusion, contrast, silhouette와 duration이 acceptance에 충분해야 한다.

### Readability Acceptance {#staging-readability-acceptance}

각 delivery는 required landmark 또는 surface, 최소 screen extent나 구분 가능한 관계, 최대 occlusion, contrast context와 readable duration 중 필요한 criterion과 실패 조건을 선언해야 하며 “보인다”는 단독 평가로 끝나지 않아야 한다.

### Occlusion 관계 {#staging-occlusion-relations}

Actor, object, architecture, terrain, crowd, fog와 frame edge가 subject를 가리는 정도를 resolved scene에서 검사하고 bounding point 하나만 보이면 visible로 간주하지 않아야 한다.

### Reveal과 Concealment {#staging-reveal-concealment}

의도된 숨김, surprise, partial view와 progressive reveal을 event와 camera relation으로 선언하여 occlusion failure와 구분해야 한다.

### 의도적 비가독성 {#staging-intentional-unreadability}

Confusion, withheld identity, silhouette-only, darkness와 obstructed view는 story purpose, affected subject, interval, 관객이 대신 읽어야 할 cue와 해제 조건을 가져야 하며 일반 visibility requirement를 조용히 생략하지 않아야 한다.

### Readable Duration {#staging-readable-duration}

필수 action이 화면에 머무는 시간, motion speed와 edit boundary를 검토하여 한 frame의 우연한 노출을 충분한 전달로 보지 않아야 한다.

### Visibility Sampling {#staging-visibility-time-sampling}

Visibility는 camera, moving subject, geometry opening, crowd, fog와 light의 같은 fixed-clock state에서 시작·최악·event·종료 sample을 평가하고 평균값이 짧은 완전 가림이나 frame 밖 이탈을 숨기지 않아야 한다.

### Multi-subject Priority {#staging-multi-subject-priority}

동시에 여러 사건이 있을 때 primary, secondary와 background delivery를 구분하고 시선과 composition conflict를 finding으로 남길 수 있어야 한다.

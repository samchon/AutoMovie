# Shot 계약과 Delivery

## 촬영 단위의 명시적 약속 {#staging-shot-contracts}

각 shot은 source scene과 revision, film interval, story interval 또는 event, subject delivery, location state, camera intent, sound obligation와 acceptance를 가져야 한다.

### Subject Delivery {#staging-subject-deliveries}

Shot에 나타나거나 영향을 주는 actor, object, environment, light, sound와 effect를 role, required state, visibility 또는 off-screen contribution과 함께 열거해야 한다.

### Delivery와 Acceptance {#staging-delivery-acceptance}

각 필수 delivery는 관객이 어떤 camera, sound 또는 state consequence에서 무엇을 확인하는지와 누락·가림·잘못된 timing 중 어느 조건이 실패인지 연결되어야 하며 존재 목록만으로 전달을 통과시키지 않아야 한다.

### Source Binding {#staging-shot-source-binding}

Shot은 scene의 어느 moment와 event를 표현하는지 직접 연결하고 filename, edit order와 camera 이름만으로 story coverage를 추정하지 않아야 한다.

### Review Time {#staging-shot-review-times}

Start, middle, end, semantic event, transition boundary와 shot-specific critical time을 review sample로 선언할 수 있어야 한다.

### Contract Freshness {#staging-shot-contract-freshness}

Source scene, production design, resolved geometry, performance, camera 또는 acceptance revision이 바뀌면 affected shot contract와 capture를 stale로 식별하고 변경 전 delivery receipt를 current로 제시하지 않아야 한다.

### Contract Refusal {#staging-shot-contract-refusal}

Film range 밖 shot, missing source, 전달되지 않은 필수 subject, 관찰할 camera가 없는 acceptance와 서로 모순된 required state를 거부해야 한다.

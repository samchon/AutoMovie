# 외부 자산 도입

## 외부 자산의 명시적 채택 {#asset-external-adoption}

사용자는 model, motion, image, audio, font와 reference data를 작품 자산으로 채택할 수 있어야 하며, 채택된 bytes와 해석 조건이 project에 고정되어야 한다.

### Provenance와 digest {#asset-external-provenance-digest}

외부 자산은 source, license, digest, format, unit, coordinate convention, version과 consumer identity를 가져야 한다.

### Bounded decoder {#asset-bounded-decoder}

지원하는 format과 feature subset, 최대 크기, count, duration과 resource budget을 명시하고 범위 밖 입력을 부분적으로 추측하여 읽지 않는다.

### Semantic enrichment {#asset-semantic-enrichment}

가져온 bare geometry나 motion은 project가 필요한 identity, material role, rig constraint, scale, ownership과 behavior를 추가할 수 있어야 하며 원본에 없던 의미를 자동으로 사실처럼 만들지 않는다.

### Replacement traceability {#asset-external-replacement}

외부 bytes가 바뀌면 affected model, shot, render와 evidence를 식별하고 이전 receipt를 stale로 처리해야 한다.

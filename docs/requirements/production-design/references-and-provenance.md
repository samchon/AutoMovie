# Reference와 Provenance

## 관찰 가능한 근거로 쓰는 Reference {#production-design-references-provenance}

Image, drawing, scan, model, text, historical source와 generated concept는 source, license 또는 usage permission, digest, observation와 design consumer를 가져야 한다.

### Observation과 Interpretation {#production-design-observation-interpretation}

Reference에서 직접 관찰한 geometry, material, pattern, damage와 context를 project가 해석하거나 창작한 선택과 구분해야 한다.

### Generated Reference {#production-design-generated-reference}

서드파티 생성 서비스의 concept는 provider, model과 version, prompt, controls, source references, terms와 output digest를 기록할 수 있으나 같은 seed만으로 재현성을 보장한다고 주장하지 않아야 한다.

### Credential 경계 {#production-design-reference-secret-boundary}

API key, access token, cookie와 account credential은 provenance가 아니며 reference ledger, prompt, log, source와 evidence에 저장하지 않아야 한다.

### Reference 교체 {#production-design-reference-replacement}

Reference bytes, license 또는 interpretation이 바뀌면 affected design, asset와 review evidence를 식별하고 기존 관찰을 자동으로 current로 간주하지 않아야 한다.

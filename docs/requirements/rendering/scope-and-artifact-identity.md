# Render 범위와 Artifact Identity

## Compiled Truth의 Pixel Projection {#rendering-scope-artifact-identity}

Render artifact는 production과 compiled revision, selected edit, shot 또는 film range, camera, frame schedule, pass, dimensions, color 설정, renderer와 runtime identity, external dependency closure 및 output digest를 가져야 한다. 같은 artifact identity는 하나의 의미와 검증 상태만 가리켜야 한다.

### Compile과 Render 구분 {#rendering-compile-render-distinction}

Compilation은 scene, timeline과 validation contract를 확정하고 rendering은 그 artifact를 소비해야 한다. Render 단계가 missing subject, invalid range, unsupported material 또는 camera를 임의의 object나 default로 구조적으로 보완해서는 안 된다.

### Planned와 Materialized {#rendering-planned-materialized}

Render request, expanded plan, scheduled work, materialized frame bytes, encoded media, probed facts와 reviewed delivery를 별도 상태로 구분해야 한다. Output 경로나 plan receipt가 있다는 이유로 frame이나 media가 존재하고 검증되었다고 주장해서는 안 된다.

### Product Scope {#rendering-product-scope}

Frame sequence, beauty pass, guide pass, structural channel, audio-related timeline product와 encoded derivative는 각자 stable product identity와 expected outputs를 가져야 한다. 하나의 product 성공이 요청된 다른 product의 성공을 대신해서는 안 된다.

### Deterministic Lane {#rendering-deterministic-lane}

Blocking beauty와 guide output은 declared deterministic lane에서 같은 입력과 supported runtime에 대해 재현 가능해야 한다. Optional generative rendition은 별도 source, receipt, review와 artifact identity를 가져야 하며 deterministic frame을 같은 bytes로 대체하거나 그 검증을 상속해서는 안 된다.

### Revision과 Invalidation {#rendering-artifact-invalidation}

Compiled source, edit, camera, schedule, pass, external resource, runtime 또는 setting 변경은 영향을 받는 artifact와 downstream encode, probe와 review를 stale로 만들어야 한다. 실제로 영향받지 않는 artifact를 재사용할 때는 dependency closure와 재사용 범위를 증명해야 한다.

### Partial Artifact {#rendering-partial-artifact}

완료된 frame이나 pass 일부는 isolated partial product로 보존할 수 있지만 expected set, missing set, failure와 retry identity를 함께 가져야 한다. Partial sequence를 complete movie나 current evidence로 노출해서는 안 된다.

### Missing Artifact {#rendering-missing-artifact-refusal}

파일명, 디렉터리 존재, zero-byte file, 이전 receipt 또는 stale cache만으로 current render가 있다고 판단해서는 안 된다. Required identity나 bytes를 확인할 수 없으면 exact missing dependency와 복구 가능 여부를 보고하고 materialized 상태를 거절해야 한다.

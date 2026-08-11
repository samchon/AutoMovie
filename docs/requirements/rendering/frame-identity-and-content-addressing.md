# Frame Identity와 Content Addressing

## Frame를 결정하는 모든 Input {#rendering-frame-identity-content-addressing}

Frame identity는 production revision, compiled artifact, edit version, shot, film time, camera, pass, resolution, renderer, settings와 external resource digest를 포함해야 한다.

### Canonical Fingerprint {#rendering-canonical-fingerprint}

Input order, path normalization, number와 string serialization을 고정하고 의미가 같은 source가 같은 identity를, 다른 source가 다른 identity를 갖게 해야 한다.

### Output Naming {#rendering-output-naming}

Human-readable production·shot·time·pass와 collision-resistant fingerprint를 함께 사용하고 filename만으로 artifact truth를 판단하지 않아야 한다.

### Current와 Stale {#rendering-current-stale}

Source, runtime, external asset, camera와 setting 변경 뒤 이전 frame을 stale로 판정하고 같은 output path가 존재해도 current로 승격하지 않아야 한다.

### Digest Refusal {#rendering-digest-refusal}

Missing dependency digest, mutable remote resource, canonicalization failure와 receipt·bytes mismatch를 거부해야 한다.

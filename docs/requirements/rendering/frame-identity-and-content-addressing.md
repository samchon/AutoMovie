# Frame Identity와 Content Addressing

## Frame을 결정하는 모든 Input {#rendering-frame-identity-content-addressing}

Frame identity는 production과 compiled revision, selected edit, shot 또는 film time, camera와 view, pass, dimensions, sample schedule, renderer와 runtime profile, settings 및 모든 external resource digest를 포함해야 한다. 어떤 pixel 또는 structural value가 달라질 수 있는 입력도 identity closure에서 빠져서는 안 된다.

### Canonical Fingerprint {#rendering-canonical-fingerprint}

Structured input의 property와 collection order, path normalization, rational number, finite scalar, string과 absent value의 canonical representation을 고정해야 한다. 같은 의미의 input은 같은 fingerprint를, 의미가 다른 input은 다른 fingerprint를 가져야 하며 locale이나 serialization 구현 차이에 의존해서는 안 된다.

### Dependency Closure {#rendering-frame-dependency-closure}

Model, texture, font, external media, color transform, authored effect input과 runtime capability처럼 frame에 영향을 주는 dependency는 immutable digest 또는 versioned identity로 닫혀야 한다. Mutable remote resource나 current alias를 digest 없이 사용해서는 안 된다.

### Output Naming {#rendering-output-naming}

Human-readable production, shot, time, view와 pass 부분에 collision-resistant fingerprint를 함께 사용해야 한다. Filename만으로 artifact truth를 판단하지 말고 receipt와 byte digest를 확인해야 하며 Windows와 POSIX에서 같은 logical outputs가 충돌하지 않아야 한다.

### Frame과 Byte Digest {#rendering-frame-byte-digest}

Frame input identity, canonical pixel or channel content identity와 encoded file byte digest를 구분해야 한다. 동일한 frame content를 다른 lossless wrapper로 저장하면 input identity는 같을 수 있지만 byte digest는 다르며, lossy encode output이 source frame digest를 상속해서는 안 된다.

### Current와 Stale {#rendering-current-stale}

Source, edit, runtime, external asset, camera, pass 또는 setting 변경은 dependency relation에 따라 이전 frame을 stale로 판정해야 한다. 같은 output path가 존재해도 current로 취급하지 말고 expected fingerprint와 verified receipt가 일치해야 한다.

### Collision과 Corruption {#rendering-identity-collision-corruption}

같은 identity에 서로 다른 bytes가 연결되거나 서로 다른 identity가 같은 final path를 요구하면 publication을 멈추고 collision을 보고해야 한다. Corrupt cache entry는 삭제 또는 격리 가능한 상태로 표시하되 valid receipt로 재사용해서는 안 된다.

### Digest Refusal {#rendering-digest-refusal}

Missing dependency digest, mutable undeclared resource, canonicalization failure, unsupported numeric value와 receipt 또는 bytes mismatch는 거절해야 한다. 다른 독립 frame의 valid cache는 보존할 수 있지만 실패 frame을 이름이나 크기만으로 current로 복구해서는 안 된다.

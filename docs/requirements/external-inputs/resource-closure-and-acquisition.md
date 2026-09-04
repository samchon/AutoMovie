# Resource Closure와 취득 경계

## 닫힌 외부 입력 집합 {#external-resource-closure}

채택되는 input revision은 해석에 필요한 resource와 dependency의 닫힌 집합을 가져야 한다. Main file만 고정하고 sidecar, linked bytes 또는 remote response가 나중에 바뀌게 두지 않으며, closure 밖 자료가 결과에 영향을 주면 현재 revision은 완전한 입력으로 취급하지 않아야 한다.

### Media별 Dependency Closure {#external-resource-media-dependencies}

glTF buffer와 image, material texture, image profile, video와 audio stream, subtitle와 sidecar, motion skeleton, spatial reference와 tile, text schema와 linked metadata, archive member처럼 선택한 결과가 읽는 dependency를 식별하고 digest로 결속해야 한다. Semantic mask PNG의 palette sidecar와 runtime coverage도 해석에 필요한 required dependency이며 preview bundle과 render chunk가 resident bytes까지 다시 열어 검증해야 한다. Optional dependency와 required dependency를 구분하고 required member 누락을 빈 값으로 채우지 않아야 한다.

### Path, URI와 Redirect 경계 {#external-resource-location-boundary}

Relative path, archive path, symbolic indirection, URI와 redirect가 허용된 source root와 network authority를 벗어나는지 판단할 수 있어야 한다. Path escape, undeclared host 전환, local secret file 참조와 import 이후의 surprise fetch를 거부하고 최종 취득 위치가 최초 표시와 다르면 기록해야 한다.

### Archive와 압축 확장 한도 {#external-resource-archive-bounds}

Compressed bytes뿐 아니라 expanded bytes, member count, nesting, dimensions, duration, points, nodes와 dependency fan-out의 한도를 적용해야 한다. 끝나지 않는 recursion, archive bomb, 지나친 decode allocation과 closure cycle을 작품 검증이나 rendering 전에 거부할 수 있어야 한다.

### 취득된 Bytes의 보존 {#external-resource-original-bytes}

검증이나 변환은 사용자가 채택 여부를 판단할 수 있도록 취득한 원본 revision과 그 digest를 보존해야 한다. Normalization이나 metadata 수정이 원본을 덮어쓰지 않으며 raw source, normalized input과 adopted result를 서로 구분할 수 있어야 한다.

### Network 의존성의 명시 {#external-resource-network-dependency}

사용자는 취득 시점의 network call과 채택 뒤에도 남는 live dependency를 구분할 수 있어야 한다. 채택 뒤 결과가 network 상태에 의존한다면 offline 불가, freshness 조건과 failure behavior를 선언하고 local 자료인 것처럼 표시하지 않아야 한다.

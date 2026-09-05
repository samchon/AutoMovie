# 결정적 사전계산 산출물

## 파생 산출물 경계 {#spec-authoring-precomputed-boundary}

파생 산출물은 tracked generator와 declared input을 소비해 ordinary project script가 만든 tracked bytes다. Generation은 compile 전에 명시적으로 실행되고 compile은 generator를 실행하지 않는다. Shot과 film source의 모듈 평가 및 build 호출에 적용되는 실행 시간 예산은 그대로 유지된다.

### Manifest와 namespace {#spec-authoring-precomputed-manifest}


<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation 별도 원장과 물리 namespace가 project derivation을 외부 provenance 자산과 구분한다. -->
<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact 별도 ledger의 project-owned output record가 거대한 source literal 없이 결과를 공급한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-project-owned-facts Generator, input과 결과 bytes를 사용자 project가 소유하는 검토 가능한 사실로 둔다. -->

Production manifest는 별도 파생 원장 `automovie/derived-artifacts.json`을 선택한다. 그 원장의 output은 `automovie/derived/` 아래에만 놓이며 같은 path를 `automovie/assets.json`이 외부 또는 비결정적 생성 자산으로 등록할 수 없다. 파생 record는 output path와 source-context encoding, generator path와 digest, canonical input path와 digest의 정렬된 목록, basis digest와 output digest를 가진다. Timestamp, host path, process id와 machine metadata는 record에 들어가지 않는다.

### Basis identity {#spec-authoring-precomputed-basis}

<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Product-owned digest closure가 generator와 모든 declared input의 변화를 stale 상태로 만든다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exact source와 input bytes를 output digest에 연결한다. -->

Basis digest는 versioned domain, normalized generator source path와 bytes digest, 그리고 canonical code-unit order의 input path와 exact byte digest를 length-delimited SHA-256 closure로 결합한다. Input 순서는 의미가 아니므로 원장은 path 순으로 정규화하고 중복과 case-insensitive collision을 거부한다. Output digest는 artifact의 exact resident bytes를 별도로 식별한다.

### Generation attempt와 publication {#spec-authoring-precomputed-generation}

<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-explicit-generation 같은 basis의 다른 결과를 게시하지 않는 명시적 generation attempt를 요구한다. -->
<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication 성공 결과만 manifest-last 순서로 보이게 한다. -->

Generator는 declared input bytes만 전달받아 동기적으로 결과 bytes를 반환한다. 한 명시적 attempt는 독립된 input copy로 generator를 두 번 실행하고 exact bytes가 다르면 아무 output도 게시하지 않는다. 성공 시 output을 같은 directory의 temporary regular file에서 atomic rename으로 먼저 게시하고 manifest를 마지막에 같은 방식으로 게시한다. Manifest publish 전에 중단되면 새 output은 이전 record와 digest가 맞지 않아 compile에서 stale로 거부되며 current 상태로 승격되지 않는다. 동일 record와 bytes의 재생성은 파일을 다시 쓰지 않는다.

### Compile freshness matrix {#spec-authoring-precomputed-freshness}

<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Compile이 current 이외의 파생 상태를 구체적으로 거부하게 한다. -->

Compile은 파생 원장을 읽고 각 record를 live filesystem에 대조한다. Manifest 부재 또는 schema·ordering·digest self-inconsistency는 manifest failure, unsafe path나 symlink·junction은 ownership failure, generator나 input 부재·digest 변화는 missing 또는 stale basis, output 부재·digest 변화·declared encoding 위반은 missing, stale 또는 malformed output이다. 모든 record가 current일 때만 exact output을 UTF-8 text 또는 base64 content와 digest로 source context에 넣는다. 한 record라도 실패하면 compile은 current artifact를 게시하지 않으며 generator를 자동 실행하지 않고 명시적 generation command를 지시한다.

### Portable path and write invariant {#spec-authoring-precomputed-portability}

<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication 한 path가 두 운영체제에서 다른 파일이나 project 밖의 파일을 가리키지 못하게 한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring 새 checkout에서 공개 contract와 tracked bytes만으로 같은 경로를 검증하게 한다. -->

Manifest, generator, input과 output path는 slash-separated canonical project-relative path다. Empty segment, dot traversal, backslash, absolute root, Windows drive prefix, reserved device basename, trailing dot·space와 NUL은 거부한다. Read와 publish는 physical project root를 고정하고 모든 existing ancestor와 leaf의 symlink·junction을 거부하며 atomic rename 직전에 root와 directory identity를 다시 확인한다.

### 예산 경계 {#spec-authoring-precomputed-budget-boundary}

<!-- @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-derived-artifact 사전계산이 source 실행 제한을 없애지 않고 정당한 별도 경로를 제공하게 한다. -->

이 계약은 source 실행 예산을 유지하고 output-size 또는 serialization-time 예산을 새로 정하지 않는다. Large artifact는 크기만으로 거부하지 않으며 compile context로 전달하는 비용은 별도 측정과 정책이 필요한 독립 방어선이다. 따라서 이 경로의 존재를 source나 output payload를 무제한으로 허용한다는 주장으로 사용할 수 없다.

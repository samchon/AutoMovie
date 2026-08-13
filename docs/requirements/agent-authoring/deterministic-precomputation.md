# 결정적 사전계산

## Source 밖에 보관하는 파생 산출물 {#agent-precomputed-derived-artifact}

저작자는 compile의 제한된 source 실행 시간 안에 다시 계산하기 어려운 결정적 결과를 거대한 source literal로 옮기지 않고 project-owned bytes로 사전계산할 수 있어야 한다. 이 경로는 source 실행 예산을 늘리거나 compile 중 생성기를 실행하는 우회로가 아니어야 한다.

### 닫힌 생성 basis {#agent-precomputed-closed-basis}

사전계산 결과는 정확한 generator source와 그 실행에 선언된 모든 input bytes를 하나의 basis identity로 가져야 한다. Generator 또는 input이 바뀌면 이전 결과는 current로 사용될 수 없어야 하며, 저작자가 별도 revision 숫자를 올려야만 변화가 보이는 계약이어서는 안 된다.

### 명시적 재생성과 결정론 {#agent-precomputed-explicit-generation}

재생성은 compile과 분리된 명시적 저작 작업이어야 한다. 같은 generator와 input으로 한 generation attempt 안에서 다른 bytes가 나오면 그 결과를 게시하지 않아야 한다.

### Compile-time freshness 거부 {#agent-precomputed-compile-refusal}

Compile은 필요한 파생 산출물의 manifest, generator, input 또는 output이 누락되거나 malformed, stale, digest-mismatched 상태이면 구체적인 원인과 다시 실행할 작업을 반환하고 어떤 stale bytes도 source context에 current 결과로 제공하지 않아야 한다.

### 이식 가능한 원자적 게시 {#agent-precomputed-portable-publication}

파생 산출물의 경로와 게시 방식은 Windows와 POSIX에서 같은 project-relative identity를 가져야 한다. Root escape, absolute·drive-letter path, symlink·junction과 case-insensitive collision을 거부하고, 중단된 쓰기는 완성된 새 결과로 보이지 않아야 한다.

### 외부 provenance와의 분리 {#agent-precomputed-provenance-separation}

Project source가 결정적으로 만든 파생 bytes는 외부에서 취득하거나 비결정적으로 생성한 자산의 provenance, license와 consumer 원장에 섞이지 않아야 한다. 두 경로가 같은 물리 path를 동시에 소유하거나 서로의 freshness 증거를 대신해서는 안 된다.


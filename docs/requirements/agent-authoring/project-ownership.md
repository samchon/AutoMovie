# 프로젝트 소유권

## 사용자 project가 소유하는 사실 {#agent-project-owned-facts}

작품의 script, 자산, 시대·장소 설정, 디자인 reference, texture, pattern, model, motion, sound와 저작 helper는 사용자 project가 소유하며 source review와 version control의 대상이어야 한다.

### 편집 가능한 source의 정본성 {#agent-editable-source-authority}

사용자가 읽고 수정할 수 있는 project source와 명시적으로 채택한 bytes가 작품 사실의 정본이어야 한다. Cache, prompt transcript, remote workspace, render 또는 생성 결과가 명시적 채택 없이 source를 덮어쓰거나 더 높은 권위를 가져서는 안 된다.

### 저장소 능력과의 경계 {#agent-repository-project-boundary}

AutoMovie는 여러 작품이 공유하는 일반 표현, 연산, validation과 rendering을 소유하고, project는 작품에 고유한 사실과 조합을 소유한다.

### Project-owned bytes {#agent-project-owned-bytes}

외부 image, audio, model과 motion은 project가 명시적으로 채택한 bytes와 provenance로 고정되어야 하며 network의 최신 결과를 암묵적으로 다시 가져오지 않는다.

### 이식 가능한 저작 {#agent-portable-authoring}

Project는 문서화된 toolchain과 공개 contract만으로 새 checkout에서 재현할 수 있어야 하며, 개인 machine의 숨은 asset 경로와 editor cache에 의존하지 않는다.

### 저작 도구의 교체 가능성 {#agent-authoring-tool-replaceability}

사용자는 project source와 공개 contract를 유지한 채 코딩 에이전트, 그 client, 외부 service 또는 local tool을 교체할 수 있어야 한다. 특정 session, vendor account 또는 비공개 remote state만이 편집을 이어 갈 수 있는 소유권 잠금을 만들지 않아야 한다.

### 소유권 불명확성의 거부 {#agent-ambiguous-ownership-refusal}

Asset이나 생성 결과의 source, license, digest 또는 consumer가 불명확하면 이를 production input으로 확정하지 않는다.

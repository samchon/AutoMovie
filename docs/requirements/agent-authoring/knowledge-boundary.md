# 지식과 증거 경계

## 저작을 돕는 지식 경계 {#agent-knowledge-boundary}

AutoMovie는 저자 에이전트가 project source에서 올바른 능력을 사용하도록 안내하고 host가 생산한 evidence를 전달해야 하며, 별도의 숨은 저작 저장소나 완성 자산 카탈로그가 되어서는 안 된다.

### 계약과 기법의 전달 {#agent-contract-guidance}

제품은 요구사항, specification, source ownership, 단위, 범위, 거부 조건과 보편 저작 기법을 현재 project 맥락에 맞게 발견할 수 있도록 제공해야 한다.

### 제공자 중립적 안내 {#agent-provider-neutrality}

제품은 외부 능력의 입력, 출력, 한계, provenance와 실패를 안내하되 특정 provider, model, account 또는 catalogue를 사용자에게 필요한 기본 경로로 정해서는 안 된다. Local 실행, 사용자가 채택한 외부 결과와 지원되는 다른 실행 경로는 같은 제품 계약 아래 구분되어야 한다.

### Host-produced evidence {#agent-host-evidence}

Frame capture, 분석, 진단과 검토 입력은 host가 실제 project와 target을 실행하여 생산해야 하며, receipt는 입력 digest와 target identity를 포함해야 한다. Shot mask capture는 host가 같은 frame에서 관찰한 semantic palette와 runtime coverage를 분리하지 않고 반환하며, preview와 render receipt는 sidecar path, resident-byte digest, semantic digest, shot과 coverage를 함께 결속해야 한다.

### 저작 API 중복의 거부 {#agent-authoring-api-refusal}

안내나 진단을 소비하는 것만으로 별도 장면 상태를 만들거나 source 밖에서 asset을 누적 편집하게 하지 않는다. 안내나 진단이 제안한 교정은 코딩 에이전트가 project source 또는 project-owned bytes에 명시적으로 반영한 뒤에만 작품 사실이 되어야 한다.

### 무단 외부 실행의 거부 {#agent-no-surprise-external-effects}

지식 조회, capability 탐색과 deterministic evidence 요청만으로 project 입력을 외부 서비스에 upload하거나 외부 생성을 시작해서는 안 된다. 외부 실행은 선택된 service, 전달할 입력, 결과의 용도와 비용 경계를 가진 별도의 명시적 요청이어야 한다.

### 완성 콘텐츠 공급의 거부 {#agent-content-supply-refusal}

제품은 시대별 건물, 인물, texture, pattern, motion과 음원을 완성품으로 선택해 주지 않는다. 필요한 콘텐츠를 만드는 보편 능력과 검증 경로를 가르쳐야 한다.

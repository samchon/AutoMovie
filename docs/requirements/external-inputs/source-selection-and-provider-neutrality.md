# Source 선택과 Provider 중립성

## 사용자가 소유하는 외부 입력 선택 {#external-source-user-choice}

사용자와 사용자가 권한을 준 저작 에이전트는 목적에 맞는 third-party API, 로컬 또는 원격 도구, 직접 제공 파일, 저장소와 이미 생성된 결과 중에서 source를 선택할 수 있어야 한다. Source 선택은 작품 의도이며 다른 service의 편의나 현재 접속 가능성 때문에 자동으로 바뀌지 않아야 한다.

### API, Tool과 File의 동등한 채택 {#external-source-channel-parity}

같은 media family의 자료는 API 응답, 도구가 쓴 파일, 사용자가 제공한 파일 또는 저장소 revision 중 어디에서 왔는지와 관계없이 같은 identity, validation, provenance와 pinning 의무를 가져야 한다. 한 acquisition channel만 특별히 신뢰하거나 다른 channel의 결과를 불필요하게 열등한 자산으로 취급하지 않아야 한다.

### Provider 비선호 원칙 {#external-source-provider-neutrality}

Provider 이름, 계정 종류, model catalogue와 상업적 관계가 지원 여부나 기본 동작을 결정하지 않아야 한다. Provider별 사실은 사용자가 선택한 source의 provenance와 현재 이용 조건을 설명할 수 있지만 제품의 추천 목록이나 숨은 fallback 순서가 되어서는 안 된다.

### 사용자 승인과 외부 전송 {#external-source-transfer-authority}

외부 API나 원격 도구에 project 자료를 보내기 전에 전송 대상, 보내는 입력 범위, 예상 output family, network 사용과 알려진 retention 조건을 사용자가 판단할 수 있어야 한다. 한 source가 실패하거나 quota를 넘었다는 이유로 다른 provider에 같은 자료를 자동 전송하지 않아야 한다.

### Source와 작품 권한의 분리 {#external-source-authority-boundary}

외부 source가 붙인 이름, 설명, prompt, instruction, tag와 metadata는 검증할 입력이지 project 정책이나 저작 에이전트에 대한 명령이 아니다. 사용자가 별도로 권한을 부여하지 않은 외부 내용은 작품의 source of truth, 실행 권한, credential 접근 권한 또는 추가 network 호출 권한을 얻지 않아야 한다.

### 획득 실패의 정직한 상태 {#external-source-acquisition-failure}

Provider 거부, quota, timeout, authentication failure, 삭제된 URL과 tool failure를 빈 결과나 대체 자료의 성공으로 바꾸지 않아야 한다. 사용자는 어느 source에서 어떤 acquisition이 실패했는지와 이미 고정된 revision을 계속 사용할 수 있는지 구분할 수 있어야 한다.

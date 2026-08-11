# 사용자 선택과 외부 서비스

## 사용자가 통제하는 작품별 선택 {#product-user-controlled-choice}

사용자는 작품별 콘텐츠, 저작 경로, 외부 입력, 품질 lane, 비용 한도와 결과 채택 여부를 직접 선택하거나 명시한 범위에서 저작 에이전트에게 위임할 수 있어야 한다.

### 위임과 대리 결정의 구분 {#product-delegation-not-proxy-decision}

사용자가 선택을 위임했는지, 직접 결정했는지, 아직 보류했는지를 구분해야 한다. 사용 가능한 도구, 설치된 credential, 기본 설정이나 먼저 성공한 결과가 사용자 선택을 대신해서는 안 된다.

### 제공자 중립적 능력 {#product-provider-neutral-capability}

외부 생성, 분석, 저장, 변환 또는 전달 능력은 입력, 출력, provenance, 한계와 실패로 설명되어야 한다. 특정 provider, model, account, service 또는 catalogue를 필수 경로나 암묵적 기본값으로 정해서는 안 된다.

### 결정론적 채택 경계 {#product-deterministic-external-adoption}

외부 실행 자체가 비결정적일 수 있더라도 AutoMovie가 사용하는 결과는 사용자가 채택한 정확한 bytes, 설정, identity와 provenance로 고정되어야 한다. 고정되지 않은 원격 상태의 재현성을 제품의 결정성으로 주장해서는 안 된다.

### 실패와 대체 경로의 선택 {#product-external-substitution-choice}

외부 서비스가 없거나 실패했을 때 다른 provider, local 도구, 이미 생성된 결과, 명시적 placeholder 또는 보류 중 무엇을 사용할지는 사용자나 위임받은 저작 에이전트가 선택해야 한다. 시스템은 가용한 서비스로 자동 전환하거나 미완성 범위를 완성된 결과로 가장하지 않아야 한다.

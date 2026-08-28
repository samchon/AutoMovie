# Provider, Model과 Credential

## User-owned External Execution {#repaint-providers-models-credentials}

사용자는 자신이 선택하고 접근 권한을 가진 external generation provider와 model을 호출하거나 이미 생성한 result를 등록할 수 있어야 하며 제품이 account와 service 선택을 대신하지 않아야 한다.

### Capability Declaration {#repaint-provider-capabilities}

각 execution option은 지원하는 input media, reference role, dimensions, model version, seed와 control 의미, output media와 제한을 선언해야 하며 서로 다른 provider의 비슷한 이름을 같은 기능으로 가장하지 않아야 한다.

### Execution Boundary {#repaint-execution-boundary}

Local adapter, user process, remote service와 pre-generated import 중 어디서 실행되었는지 구분하고 network access와 retention policy를 기록해야 한다.

### Current Terms {#repaint-provider-terms}

Provider rights, model version, input retention, output usage와 region restriction은 acquisition 시점의 current source에서 확인하고 영구 불변으로 가정하지 않아야 한다.

Terms review date는 실제 `YYYY-MM-DD` UTC calendar date이고 generator 실행 또는 기존 output 채택 receipt의 UTC date보다 미래일 수 없다. Configuration preflight는 외부 호출 전 captured clock snapshot으로 이를 거절하고, 저장된 receipt와 재개된 publication도 자신의 immutable 실행·채택 instant에 대해 같은 비교를 반복해야 한다. Canonical content identity는 ambient wall clock을 읽지 않으며 date parsing과 runtime fact 비교를 분리한다. 임의의 만료 기간은 이 규칙에 포함하지 않는다.

### Credential Separation {#repaint-credential-separation}

API key, access token, cookie와 account secret은 source, prompt, request receipt, log, artifact, manifest와 evidence에 기록하지 않아야 한다.

### Credential 사용 경계 {#repaint-credential-use-boundary}

Credential은 사용자가 승인한 execution boundary에서만 주입되고 redacted reference로 선택할 수 있어야 하며, credential의 존재만으로 upload, provider routing 또는 retry를 시작하지 않아야 한다.

### Provider Refusal {#repaint-provider-refusal}

Unknown model version, unavailable terms, leaked credential, undeclared upload, unsupported requested capability와 unverifiable output source를 current rendition으로 채택하지 않아야 한다.

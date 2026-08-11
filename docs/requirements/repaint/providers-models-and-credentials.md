# Provider, Model과 Credential

## User-owned External Execution {#repaint-providers-models-credentials}

사용자는 자신이 선택하고 접근 권한을 가진 external generation provider와 model을 호출하거나 이미 생성한 result를 등록할 수 있어야 하며 AutoMovie가 account와 service 선택을 대신하지 않아야 한다.

### Execution Boundary {#repaint-execution-boundary}

Local adapter, user process, remote service와 pre-generated import 중 어디서 실행되었는지 구분하고 network access와 retention policy를 기록해야 한다.

### Current Terms {#repaint-provider-terms}

Provider rights, model version, input retention, output usage와 region restriction은 acquisition 시점의 current source에서 확인하고 영구 불변으로 가정하지 않아야 한다.

### Credential Separation {#repaint-credential-separation}

API key, access token, cookie와 account secret은 source, prompt, request receipt, log, artifact, manifest와 evidence에 기록하지 않아야 한다.

### Provider Refusal {#repaint-provider-refusal}

Unknown model version, unavailable terms, leaked credential, undeclared upload와 unverifiable output source를 current rendition으로 채택하지 않아야 한다.

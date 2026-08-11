# 외부 입력과 보안 실패

## 외부 경계의 추적 {#diagnostics-external-boundary-trace}

외부 파일, archive, media, model, network response와 사용자가 선택한 생성 결과에서 발생한 진단은 입력의 출처, 고정된 identity, 읽은 시점과 적용 범위를 추적할 수 있어야 한다. 민감 정보를 공개할 수 없을 때에도 같은 입력과 실패를 안전하게 대조할 correlation identity를 제공해야 한다.

### 실패 단계의 구분 {#diagnostics-external-failure-stage}

찾기, 권한 확인, 전송, 무결성 확인, 압축 해제, decode, 구조 확인, 의미 검증과 채택 중 어느 경계에서 실패했는지 구분해야 한다. 읽지 못한 bytes를 잘못된 콘텐츠로, 유효하지 않은 콘텐츠를 단순 네트워크 실패로 보고하지 않아야 한다.

외부 서비스의 인증 실패, 권한 부족, rate limit, timeout, unavailable response와 잘못된 결과를 별도 원인으로 보고해야 한다. 재시도가 안전한지, 사용자 조치가 필요한지, 같은 요청이 외부 비용을 다시 발생시키는지 알려야 한다.

### 보안 거부 {#diagnostics-security-refusal}

허용된 경계를 벗어나는 경로, 선언되지 않은 원격 접근, 무결성 불일치, 예상 밖 실행 가능 콘텐츠, 과도한 확장, 자원 고갈 시도와 신뢰되지 않은 참조는 보안 실패로 명시적으로 거부해야 한다. 정상적인 missing이나 unsupported 상태로 낮추어 계속 처리하지 않아야 한다.

보안 실패는 거부한 대상과 정책 범위, 영향을 받은 요청과 안전한 다음 행동을 제공해야 한다. 공격에 유용한 내부 세부 정보, credential, token, 개인 정보와 원문 secret은 진단에 노출하지 않아야 한다.

### 격리와 채택 상태 {#diagnostics-quarantine-and-adoption}

검증이 끝나지 않았거나 보안 검토에 실패한 외부 결과는 current source 또는 완전한 산출물과 구분된 격리 상태로 남아야 한다. 격리된 bytes가 저작, 렌더, publication과 후속 검증에 사용되었다고 표시하지 않아야 한다.

사용자가 외부 입력을 교체하거나 명시적으로 채택하면 이전 진단과 새 identity의 관계를 추적할 수 있어야 한다. 채택은 검증이나 라이선스 확인을 수행했다는 뜻으로 확대하지 않아야 한다.

### 정보 공개와 Redaction {#diagnostics-redaction}

진단 결과는 조치에 필요한 경로와 context를 제공하면서 공개 범위에 맞게 민감 값을 가려야 한다. 가림 여부와 가려진 값의 종류를 표시하고, 표시용 가림이 기계 판독 identity나 중복 판정을 불안정하게 만들지 않아야 한다.

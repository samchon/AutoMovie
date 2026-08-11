# 대상, 활동, 주체와 계보

## 끊김 없이 읽을 수 있는 계보 {#provenance-readable-lineage}

Provenance는 source와 artifact 같은 entity, 생성과 변환과 검토 같은 activity, 사람과 agent와 tool과 외부 service 같은 actor를 구분하고, 사용, 생성, 파생, revision, 귀속, 인계와 무효화 관계를 통해 사용자가 결과의 계보를 읽을 수 있게 해야 한다.

### 대상과 revision {#provenance-entity-and-revision}

원본, 중간 산출물, 외부 입력, reference, evidence와 최종 전달물은 각각 안정된 identity를 가져야 하며, bytes나 의미를 바꾸는 수정은 새 revision으로 기록하고 이전 revision과의 관계를 보존해야 한다.

### 활동의 입력과 출력 {#provenance-activity-inputs-outputs}

각 activity는 시작과 종료 또는 기록 시점, 사용한 입력, 만든 출력, 설정과 실행 결과를 식별해야 하며, 실패, 취소, 부분 완료와 재시도도 성공한 activity와 구분되는 이력으로 남아야 한다.

### 주체, 역할과 책임 {#provenance-agent-role-responsibility}

기록은 사람, authoring agent, 자동 tool, 조직과 외부 provider의 identity와 version 또는 실행 경계를 가능한 범위에서 식별하고, 실제 실행 주체, 지시자, 승인자와 권리 보유자의 역할을 서로 바꾸어 표시해서는 안 된다.

### 일차 출처와 파생 출처 {#provenance-primary-and-derived-source}

Primary source, mirror, snapshot, 변환본, 편집본과 요약본의 관계를 구분해야 하며, 가까운 사본을 기록했다는 이유로 더 앞선 출처나 알려진 저작자를 생략해서는 안 된다.

### 계보의 공백 {#provenance-lineage-gaps}

Parent, actor, time, 설정 또는 source가 알려지지 않았거나 접근할 수 없으면 그 공백을 명시하고 마지막으로 검증 가능한 지점을 보여야 하며, 추정한 연결을 확인된 derivation처럼 기록해서는 안 된다.

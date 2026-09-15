# 생성 프로젝트 증거 설정 입력

## 프로젝트 소유 선언 {#agent-production-evidence-input}

### 한 파일에서 보이는 완전한 선택 {#agent-production-evidence-visible-selection}

생성 프로젝트는 제작 종류, `complete-production | first-pilot | complete-production-reset` 중 현재 모집단 범위, 저작 분기별 구성 단계, film screenplay 자연스러움 최종화 단계, 절대 프로젝트 위치와 작품 전용 추가 claim을 프로젝트가 소유한 하나의 설정에서 모두 드러내야 한다. 사용자나 위임받은 에이전트는 이 선언만 읽고 어느 구성 분기와 최종화 pass가 비활성·초안·증거 작성·검토 상태인지, 그래프가 완전한 모집단과 첫 수직 pilot 중 무엇을 선택하는지, 통과한 pilot을 완전한 모집단의 초안으로 되돌리는 유일한 reset 중인지 판단하고 바꿀 수 있어야 한다. 구성과 자연스러움은 같은 stage vocabulary를 쓰되 서로 독립적으로 선언해야 한다.

첫 pilot은 실제 분할을 소유한 film의 첫 script·construction screenplay·final screenplay delivery group만 정확히 선택할 수 있어야 한다. Flat treatment 모집단과 library의 기존 design/source 분기에 허구의 분할 selector, file-per-owner 규칙이나 임시 glob을 도입해서는 안 된다. Film reset은 screenplay 자연스러움을 비활성화하고 stale final host를 지워야 한다. Brief와 제작 종류를 아직 선택하지 않은 빈 프로젝트에는 pilot이나 reset을 허용해서는 안 된다.

Reset은 통과한 pilot의 정확한 선행 본문과 증거를 보존했는지 확인하는 전이 체크포인트여야 하며, 본문을 다시 쓰는 장기 상태가 되어서는 안 된다. 검증된 체크포인트에서 완전한 제작의 일반 단계로 복귀할 때는 pilot 원본을 복구 가능한 이력과 비활성 보관본으로 남기고, 아직 부모가 준비되지 않은 후속 초안과 예전 증거가 현재 제작의 완료 사실처럼 선택되지 않게 해야 한다. 보관본은 현재 모집단의 계약을 충족하지 않으며 각 후속 계층의 부모가 검토된 뒤에만 재작성의 입력으로 사용할 수 있다.

재사용 패키지는 검증 동작만 제공한다. 숨은 기본값, 별도 로컬 설정 파일이나 생성된 중간 상태가 프로젝트의 명시적 선택을 보충하거나 덮어써서는 안 된다.

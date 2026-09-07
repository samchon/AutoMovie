# 저술 원문 참조 계약

## 참조 snapshot과 선택 {#spec-reference-navigation}

원문을 변경하지 않는 선택, projection, 예산과 transport 경계를 아래의 개별 계약으로 정한다.

### 파일 및 절 주소 {#spec-reference-selection}

<!-- @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection 실제 저술 모집단과 명시적 heading 주소를 유지하며 하위 절 경계를 원문에서 정한다. -->

허용 계층은 `settings`, `research`, `maps`, `models`, `spaces`, `materials`, `instances`, `motions`, `systems`, `treatments`, `scripts`, `screenplays`, `briefs`다. 계층 인덱스는 slash로 구분한 project-relative 경로를 UTF-16 code-unit 순서로 정렬한다. 파일 인덱스는 원래 H1의 title 또는 `null`, H2/H3/H4의 원래 순서, depth, 가장 가까운 상위 heading의 ordinal, 위치와 explicit anchor를 제공한다. 주소는 `file#anchor`이며 anchor가 없으면 `unaddressable`, 중복이면 `ambiguous`다. Anchor를 생성하지 않는다. H1/H5/H6를 section 주소로 읽으면 depth 오류다. Group index는 H2가 없어도 파일이다.

선택 절은 heading을 metadata로 분리하고 heading 줄의 개행 뒤부터 다음 same-or-shallower heading 시작 직전 또는 EOF까지를 읽는다. Descendant heading은 원문 그대로 남긴다. Heading은 CommonMark 문법의 문서 최상위 heading이며 코드, HTML block이나 blockquote 내부의 예시는 소유 절을 만들지 않는다.

### 손실 없는 projection과 revision {#spec-reference-source}

<!-- @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source 실제 UTF-8 source bytes의 digest와 원문 UTF-16 위치에 결속된 comment 제외 projection을 반환한다. -->

입력 bytes는 fatal UTF-8 decoding으로 읽고 BOM을 포함한 원문 문자를 보존한다. Revision은 원문 bytes의 SHA-256이다. CommonMark가 HTML로 분류한 구간에서 실제 HTML comment만 생략하며 fenced/indented code, inline code, escape와 HTML attribute 및 raw-text element의 literal은 보존한다. 닫히지 않은 block HTML comment는 EOF까지 생략하고 `UNTERMINATED_ANNOTATION`과 위치만 제공한다. CommonMark가 HTML이 아닌 보통 text로 해석하는 불완전한 inline opener는 literal로 유지한다. Parser 실패는 본문 없는 오류다.

Range의 시작은 inclusive, 끝은 exclusive이며 offset과 column은 UTF-16 code unit, line과 column은 1부터 센다. LF, CRLF, CR과 EOF를 보존한다. `detail: true` 읽기에만 `contentRanges`와 `annotationRanges`를 제공하며 원문에서 content range들을 순서대로 이어 붙이면 반환 content와 정확히 같다. 기본 인덱스에는 주석별 range가 없다. Expected digest가 다르면 stale 오류와 재탐색 안내를 반환한다. 모든 파일 결과의 metadata와 content는 한 읽기 snapshot에서 나온다. 계층 revision은 정렬된 파일 identity와 각 파일 revision의 digest이며 여러 파일의 원자적 repository snapshot을 주장하지 않는다.

### 예산, continuation과 실패 {#spec-reference-bounds}

<!-- @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds 응답, source와 모집단 한계를 명시하며 revision에 결속된 페이지와 구분된 오류를 반환한다. -->

요청의 `budgetBytes`는 JSON result의 UTF-8 bytes 상한이며 기본 65,536, 최소 256, 최대 1,048,576이다. 오류 envelope는 이 성공 응답 예산 밖에 있다. 계층 page의 `limit`는 기본 20, 최소 1, 최대 100이며 continuation은 `revision`과 다음 `offset`을 가진다. 작은 예산은 page 항목 수를 줄일 수 있지만 최소 한 항목도 담지 못하면 명시적 budget 오류다. 파일이나 절 읽기는 일부 문자열을 반환하지 않고 더 작은 절 읽기를 안내한다. 파일 인덱스가 너무 크면 budget 증가 또는 알려진 절 주소의 직접 읽기를 안내한다.

한 source 파일은 최대 8,388,608 bytes, 계층은 최대 10,000개 파일과 총 33,554,432 source bytes, 디렉터리 깊이는 계층 root 아래 최대 32다. 한도를 넘으면 resource 오류다. 빈 계층은 정상 빈 페이지지만 요청한 파일 부재는 `MISSING_FILE`이다. 알려지지 않은 계층, request schema, 경로, 절 부재, 모호한 anchor, depth, stale revision, permission, physical identity, malformed UTF-8, parser와 예상하지 못한 I/O 오류는 구별된 code를 가진다. 오류 message는 원문과 외부 I/O의 민감한 내용을 포함하지 않는다.

### Root와 물리 읽기 경계 {#spec-reference-isolation}

<!-- @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation 바인딩된 root, 정규화된 허용 경로와 읽은 handle의 identity를 확인하고 mutation 없는 경로만 제공한다. -->

시작 시 절대 production root와 실제 디렉터리 identity를 바인딩한다. 호출에는 root 변경 입력이 없다. 경로는 정확한 `docs/<layer>/...md`이며 absolute, traversal, backslash, 빈 component, dot component, drive/UNC, ADS, control 문자, Windows 별칭과 예약 이름을 거부한다. 심볼릭 링크와 junction을 따라가지 않으며 파일은 regular single-link file이어야 한다. Root부터 각 ancestor의 identity와 realpath를 열기 전후 확인하고 열린 handle의 identity를 lstat과 비교한다. Bytes를 읽은 뒤 file 및 ancestor identity와 file revision metadata가 유지되었는지 다시 확인한 후에만 반환한다. 경로 교체나 동시 쓰기는 성공 snapshot으로 반환하지 않는다.

목록 및 읽기 adapter는 read-only operation만 갖는다. 숨김 entry는 모집단에서 제외하며 `.gitkeep`가 있는 빈 계층도 빈 정상 인덱스다. Markdown link와 문서 내 명령은 따라가거나 실행하지 않는다. Graph configuration을 읽거나 실행하지 않고 draft를 참조할 수 있다. 플랫폼이 제공하는 identity 관찰의 한계는 실제 OS observation과 구별해서 기록하며 pure unit으로 OS 동작을 인증하지 않는다.

### 공통 provider와 두 transport {#spec-reference-transports}

<!-- @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports 네 요청을 같은 provider로 전달하고 설치된 package의 stdio 및 JSON 경로로 소비한다. -->

공개 operation은 `get_index_of_layer`, `get_index_of_file`, `read_section_without_annotations`, `read_file_without_annotations` 네 개다. MCP는 stdio만 사용하고 stdout은 protocol 메시지 전용이다. 로컬 명령은 같은 request 객체를 JSON으로 받아 같은 결과 envelope 하나만 stdout에 쓴다. Startup diagnostic은 stderr에 쓰며 소스 내용을 포함하지 않는다. Transport는 production 실행, guide gate, graph 판정과 review 승인을 제공하지 않는다. 등록 materialization은 이 설치된 bin을 절대 project root에 결속하고 다른 client 설정을 보존한다.

Client 등록 계획은 기존 `.mcp.json`과 `.codex/config.toml`을 입력으로 받아 publication할 후보만 계산한다. Claude의 `mcpServers.automovie_reference`는 `type: stdio`, 현재 Node executable과 정확한 installed-bin/root 관계만 가진 생성 schema일 때만 갱신한다. 다른 option을 추가하거나 command를 편집한 entry는 충돌이다. Codex의 `mcp_servers.automovie_reference`는 동일한 command/args에 `cwd`를 결속하고 digest가 유지된 managed block만 갱신한다. Marker가 없는 동일한 현재 entry는 원문을 보존하고 충돌하는 entry는 거부한다. 독립적으로 해석한 block과 전체 문서의 소유 entry가 같고 block을 제거하면 그 entry도 사라지는지 확인하여 사용자 문자열 안의 marker를 편집 영역으로 오인하지 않는다. 관련 없는 JSON 값과 TOML 원문 bytes는 보존한다. 유효한 TOML table에 등록을 추가할 수 없는 충돌은 기존 문서의 parse 오류와 구별한다. Node executable 변경이나 소유권 충돌의 해소는 참조 읽기의 부수 효과가 아니다.

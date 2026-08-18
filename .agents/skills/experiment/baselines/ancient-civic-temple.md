# ancient-civic-temple

**진행 중인 실험의 중간 기준선이다.** 이 사이클에서 드라이버가 두 번 죽었기 때문에
(둘 다 전송 계층 손실), 실험이 끝날 때까지 기다리지 않고 확인된 값부터 착지시킨다.
아직 재지 못한 값은 비우지 않고 `unverified`와 그 이유를 적는다.

마지막 갱신: 2026-08-14 14:55, head `64d0ef47`.

---

## 정정 — 2026-08-18 사이클 (`benchmark-four`, #1954)

이 절은 **뒤따르는 다섯 절을 쓴 실행과 다른 실행**이 쓴 것이다. 아래 본문은 그대로
둔다. 정정 대상은 숫자가 아니라 **4절이 그 숫자에서 끌어낸 결론의 근거**다.

정정 시점 head `b545100a`, 세션 `01a01253-ef65-7dc2-8b66-6ae84f5e64b1`
(Codex `codex exec`, `gpt-5.6-sol`, `xhigh`). 전체 기록은 `.wiki/`에 있고
**`.wiki/`는 gitignore된다.** 그래서 다음 실행에 필요한 것만 여기 옮겨 적는다.

### 철회 — T2b의 0은 선호의 증거로 쓸 수 없다

4절은 T2b(exec 셀 23개 전부 셸, 그중 20개가 `node_modules/@automovie/**` 제품 소스,
MCP 0회)를 근거로 **"지목이 없으면 셸로 제품 소스를 직접 읽는다"**고 적었다.

2026-08-18 사이클의 턴 1이 **같은 서명을 한 턴 안에서 재현했다 — 다만 거절 뒤에.**
그 세션은 도구를 스스로 찾아 불렀고, 제품 서버 호출 **3건이 전부**
`{"Err":"user cancelled MCP tool call"}`로 거절됐으며, **같은 턴에**
`node_modules/@automovie/mcp/src/guides/AutoMovieGuideConstant.ts`를 정규식으로 긁어
가이드 본문을 재구성했다. 그 시점 이후를 세면 "MCP 0 + 제품 소스 다수"다.

이 문서는 이미 **구별할 수 없는 두 상태**를 정직하게 적어두었다 — *갖고도 안 썼다*와
*없어서 못 썼다*. 여기에 **세 번째 상태**가 추가된다.

> **갖고 있었고, 불렀고, 거절당했고, 그 뒤로 안 불렀다.**

셋은 **단순 계수에서 완전히 동일하게 보인다.** 그러므로 T2b의 0은 그 결론의 무게를
지지 못한다.

**철회의 범위를 정확히 한다.** 이것은 이전 실행이 거절당했다는 주장이 **아니다.**
그 증거는 없다. 주장은 이것뿐이다 — **그 실행의 증거는 거절과 선호를 구별하지
못한다.** 대체 결론을 세우지 않는다. 근거만 철회한다.

### 원인 확정 — 등록 방식이다 (한 턴 안의 대조군)

**MCP 결과를 `invocation.server`로 그룹핑하면 답이 나온다.** 두 드라이버 모두 처음에는
**합계로만** 세었고, 그래서 둘 다 자기 데이터를 잘못 읽었다.

턴 1, **같은 턴·같은 `approval_policy: "never"`·같은 `approvals_reviewer: "user"`**:

| 서버 | 등록 방식 | ok | err |
| --- | --- | --- | --- |
| `automovie_ancient` (샌드박스 제품 표면) | **호출 단위** (`-c mcp_servers…`) | **0** | **3** |
| `node_repl` | **전역** (`~/.codex/config.toml`) | **27** | **0** |

**다른 것은 등록 방식 하나뿐이다.** 두 머신을 비교한 것이 아니라 한 턴 안의 대조군이다.

형제 세션(`modern-suburban-house`)도 **같은 정정을 독립적으로 냈다** — "MCP 3건 성공"은
`node_repl`이었고 **제품 표면에 대해서는 0/3**이었다. 두 세션이 이제 **일치한다.**
"형제가 재현하지 못했다"는 예외는 **애초에 존재하지 않았고, 합계로 센 탓이었다.**

| 등록 | reviewer | 결과 | 근거 |
| --- | --- | --- | --- |
| 호출 단위 | `user` | **거절** | 턴 1 `automovie_ancient` 3/3, 폐기 세션 A·C |
| 호출 단위 | `auto_review` | **성공** | 폐기 세션 B·E |
| 전역 | `user` | **성공** | 턴 1 `node_repl` 27/27 |

**호출 단위 등록 서버는 승인을 요구하고, 전역 등록 서버는 요구하지 않는다.**
`policy=never` + `reviewer=user`면 그 요청이 자동 거절된다.

**운영 결론.** 격리를 지키려면 호출 단위 등록이 필요하고, 호출 단위 등록은 승인
게이트를 부른다. 따라서 **`-c approvals_reviewer="auto_review"`는 필수다.**

죽은 후보: `approvals_reviewer` 값 차이, `network_access`, 첫 호출 vs resume,
`approval_policy="on-request"`. **`#1992`(모듈 스코프 `os.userInfo()`)도 원인이 아니다** —
세 번째 거절이 저작자의 심 작성 **이후**에 났다. 다만 그 심의 존재 자체가 `#1992`의
독립 증거다.

부수 정정 하나. 아래 4절은 "`--approve-for-me` 모드에서 `npm`이 `PSSecurityException`
으로 막힌다"고 적지만, `auto_review`에서 `npm.cmd --version` → `10.9.4`,
`node --version` → `v22.21.0`이 정상 실행됐다. 그 실패는 승인 모드가 아니라 **`.ps1`
심이 `RemoteSigned`에 막히는 별개 원인**으로 보인다. `npm.cmd`를 부르면 재현되지 않는다.

### 방법 — 0을 읽기 전에

1. **합계로 세지 말고 서버별로 센다.** 전역 서버의 성공이 제품 표면의 실패를 가린다.
   두 드라이버가 같은 방식으로 같은 오독을 했다.
2. **채널의 생존을 먼저 확정한다.** MCP 서버는 codex 프로세스의 **자식**으로 뜬다.
   0이 관측된 그 순간 그 자식이 있었는지가 *죽은 채널*과 *조용한 에이전트*를 가른다.
   2026-08-18 실측: 거절이 나던 턴에 서버는 **살아 있었다** — PID 13648
   (`…/ancient-civic-temple/scripts/mcp.ts`)이 codex PID 10980의 자식이었고,
   `mcp_tool_call_end`의 `duration`은 0초였다. 그래서 "서버 실패"와 "등록 실패"가
   배제되고 **"승인 게이트에서 dispatch 전에 거절"**까지 좁혀졌다.
   `codex mcp list`에 없는 것은 정상이다(호출 단위 등록은 전역에 쓰지 않는다).
3. **로그의 부재는 결함의 부재가 아니다.** 저작 에이전트가 우회하면 신호가 지워진다.
   이 실행에서 `ENOMEM` 로그는 0건이었는데, 산출물에는 그것을 우회하는 심
   `.host/tsx-user-info.cjs`가 있었다.

### 프로세스 귀속 — 문자열이 아니라 계보로

| 측정 | 이 세션 | 형제 세션 |
| --- | --- | --- |
| 계보 폐포 | **19** | 14 |
| 샌드박스 경로로 매칭 | 7 (37%) | 7 (50%) |
| **세션 UUID로 매칭** | **0** | **0** |

UUID 규칙은 **적중률 0%**다. `resume`에 UUID를 인자로 넘겨도 `codex.exe`의
커맨드라인에 나타나지 않는다. 문자열 매칭은 양방향으로 틀린다 — 조회 프로세스를 잡아
과다보고하고, 식별자 없는 자기 자식(저작 에이전트의 `powershell.exe` 포함)을 놓쳐
과소보고한다. **귀속은 계보로 하고, 뿌리는 런처가 아니라 메인 `codex.exe`에 두며,
PID와 `CreationDate`를 함께 적는다**(PID는 재사용된다).

### 그럴듯하게 실패하는 다섯 함정 (전부 실측)

| 함정 | 어떻게 실패하는가 |
| --- | --- |
| 조회가 자기를 매칭 | 믿을 만한 **무언가**를 보고 |
| 괄호 없는 `-and`/`-or` | 믿을 만한 **무언가**를 보고 |
| `UInt32`/`Int32` 키 불일치 | 믿을 만한 **아무것도 없음**을 보고 |
| 한 원소 `$queue[1..0]` | **평범한 느림**(120초 행)으로 나타남 |
| 완료 알림 | **좋은 소식**으로 나타남 — 끝나지 않은 턴의 "완료" |

**어떤 신호 하나도 턴의 종료를 말하지 못한다.** 프로세스(계보)·rollout **크기**(mtime
아님)·디스크, **셋이 일치할 때만** 믿는다.

### 이 사이클이 실제로 바꾼 것 — S1이 턴 1 안에 도착했다

| | 이전 실행 (본문) | 2026-08-18 사이클 |
| --- | --- | --- |
| 두 턴 ~90분 뒤 기하 | **0** | — |
| 턴 1 뒤 | — | `design` exit 0 **스타터 잔재 0**, `compile` exit 0 **revision 43 / 진단 0**, 공간 11·개구부 9·커넥터 8, 시트 6, PNG 96 |

명명된 공간마다 소스 모듈 하나, **네 입면이 각각 독립 소유자**,
`Dimensions`·`Circulation`·`Ownership` 분리. 치수 불변식은 **장식이 아니다** — 세계
모듈 10개 이상이 `civicTempleDimensions`를 import하고, 개구부가 벽 안에 들어가지 않으면
throw한다.

**이전 실행의 두 턴을 통째로 먹은 3계층 전부-아니면-전무 교체가 이번엔 완료됐다.**
사이클이 무엇을 샀는가에 대한 캠페인 자신의 답이다.

### 드라이버 교대 뒤 재확인 — 턴 4 경계와 S2 종료 (2026-08-18 16:08, head `5f79ff38`)

앞 절을 쓴 드라이버가 기록 없이 멈췄고, 후임이 **핸드오프를 받아들이지 않고 다시 쟀다.**
인수 시점에 저작 세션은 살아 있었다 — 턴 4(rollout 다섯 번째 `turn_context`,
04:38:11Z 시작)가 2시간 20분째였고 세 신호가 전부 alive였다: root `codex.exe`
PID 42048이 `CreationDate 13:38:07`로 살아 있고(PID와 생성시각을 **함께** 대조),
rollout이 16,505,960 → 16,513,992로 자라고, 디스크가 초 단위로 바뀌고 있었다.

**16:08:16에 세 신호가 경계로 일치했다** — PID 42048 소멸, rollout **16,698,517이
네 번 연속 동일**, 샌드박스 디스크 3분간 0건. 새 `turn_context`는 생기지 않았다.

#### S1 → S2 실측 (아티팩트에서 직접, 저작자 보고 아님)

| 항목 | S1 종료 | S2 종료 |
| --- | --- | --- |
| revision | 100 | **359** |
| `building:report`의 `roof` | **0건** | `s2-roof-shell`·`civic-temple-s2-roof` 소유자로 등장 |
| 개구부 | 9, `basis: "unmeasured"`, width/height/place 전부 `null` | **16**, `basis: "profile"`, **width·height 실측** |
| 개구부 `place` | `null` | **여전히 `null`** (6개 mark 전부) |
| 공간 / 커넥터 | 11 / 8 | 11 / 8 (변화 없음) |
| 샷 | 4 | **12** (person-height 실내 8개 추가) |
| `src/**/*.ts` | — | 31개, `civicTempleRoof.ts` 신설 |

**저작자의 체크포인트를 중계하지 않고 검증했다.** 보고된 beauty digest 12개를 샷별
**가장 새로운** beauty 프레임(outline 제외, mtime으로 기계적 선택)과 대조: **12/12 MATCH.**
front `b76419fb`, three-quarter `2aef898e`, side `2b6a1d85`, courtyard `e76bd7de`,
entrance `a0b43f6b`, colonnade `8faf6d35`, offering `535dde49`, shrine `26796a8e`,
administration `492fb8a4`, records `c6258b41`, storage `742a10bc`, service-yard `5dfdab9d`.
**체크포인트가 주장이 아니라 읽을 수 있는 산출물이었다** — S1 때와 같다.

**남은 절반을 제품이 스스로 선언한다.** opening 스케줄의 gap `opening-location`,
status `not-run`: *"a opening row states type, size and count but no place, so its
location must still be read from the design rather than from the schedule"*,
remedy: *"resolve the opening's host boundary to the spaces it separates, then fill
the row's place"*. 저작자도 같은 선을 그었다 — *"The authored boundary faces and routes
carry locations, but the schedule schema does not project them. I did not invent a
parallel schedule."* **숨기지 않고 이름과 조치를 함께 내는 성질이 S2 grain에서 다시 성립한다.**

#### 계측기 함정 하나 더 — 긴 경로에서 12/12 "프레임 없음"

digest 대조를 파이썬으로 처음 돌렸을 때 **12개 샷 전부 `NO READABLE FRAMES`**가 나왔다.
렌더 경로가 content-addressed라 digest 두 개가 겹쳐 `MAX_PATH`를 넘고, `\?\` 확장
접두어를 잘못 붙인 탓이다. **12/12 빈 결과는 "렌더가 없다"와 구별되지 않는다.**
글로브는 성공했는데 `exists()`가 전부 False였다는 불일치가 계측기를 의심하게 했고,
경로를 그대로 다루는 도구로 다시 재니 12/12 MATCH였다. 기준선의 다섯 함정에 같은
서명이 하나 더 붙는다 — **믿을 만한 아무것도 없음**, 그리고 **입력 개수를 세는 습관이
그것을 잡았다.**

#### `#1961` probe 1 — 앞 절의 답을 정정한다

앞 드라이버는 **세 번째 층을 저작자에게 알린 것이 `npm run design`의 거절**이라고
적었다. rollout을 시간순으로 세면 그렇지 않다.

| 시각 | 무엇 |
| --- | --- |
| **00:47:41Z** | 저작자가 `scripts/emitDesign.ts` **소스를 읽는다** (턴 1, 세션 시작 3분 뒤) |
| 00:49:59Z | 같은 소스를 다시 읽는다 |
| 01:14:0x–01:14:35Z | 저작자가 자기 `emitDesign.ts`를 **패치한다** |
| **01:22:37Z** | 그 스크립트가 **처음으로 거절한다** (exit 1, 레코드 12개) |

**소스 읽기가 거절보다 35분 앞선다.** 그리고 01:22의 거절문은 제품의 것이 아니다 —
저작자가 문구를 자기 것으로 바꿔 썼다. 스캐폴드는
*"A design record and the typed source that owns it are two representations of one
fact…"* + *"Either derive it above from the source that owns it, or delete the file."*
두 문장인데, 실제로 찍힌 것은 *"Delete each named record or restore the source that
derives it."* 한 문장이다. 샌드박스 `scripts/emitDesign.ts:215`가 그렇게 적혀 있고,
설치된 tarball 스캐폴드와 저장소 스캐폴드는 둘 다 303–307행의 원문을 갖고 있다.

**정정의 범위.** 스캐폴드의 *능력*에 대한 결론은 살아 있다 — 그 검사는 개수·프로젝트
상대 경로·레코드 id·조치를 전부 찍고, `#1961`의 수락 기준이 요구하는 것이 그것이다.
죽는 것은 **이 샌드박스가 그 기준의 증거라는 주장**이다. 이 저작자는 (a) 기제를 소스로
먼저 읽었고 (b) 실제로 본 진단은 자기가 쓴 것이다. **최초 사용자가 진단만으로 안다는
것을 이 실행은 보이지 못한다.** 발견 가능성 축이 여기서도 같은 방식으로 소진됐다 —
지목이 아니라 **관찰 표면**이 먼저 답했다.

#### `#1961`은 이미 착지해 있었고 이 샌드박스가 그것을 실은 첫 실행이다

orphan 검사는 `b545100a` (2026-08-18 09:26:56, `campaign(benchmark-friction) … #1988`)에
들어왔고 이 샌드박스의 tarball은 **3분 뒤 09:29**에 팩됐다. 검사 자신의 JSDoc이
probe 2의 답을 이미 적어두고 있다:

> Measured on a real replacement, five starter records (four models and a formation)
> were restored into a finished production and `compile` returned success with zero
> diagnostics while building them into that production's `generated` output.
> Nothing was wrong with them; they were simply somebody else's film, and no
> diagnostic can say so.

`test/src/features/cli/test_cli_scaffold_design_residue.ts`가 같은 측정을 담고
*"They reference only each other, so no dangling-citation refusal can reach them"*
이라고 적는다. **따라서 「다른 resident 레코드만 참조하는 레코드는 compile이 조용히
통과시킨다」는 미확인 항목은 저장소가 이미 측정해 둔 것이고, emitter의 거절이 그 답으로
만들어진 수정이다.** 남는 조건은 하나뿐이다 — **그 거절은 `design`을 돌려야만 나온다.**

#### 새로운 오염 형태 — 형제 저장소 에이전트가 샌드박스에 손으로 써 넣는다

핸드오프 11절은 공유 checkout의 **브랜치 이동**이 tracked 편집을 지운다고 적었다.
이번에 잡힌 것은 반대 방향이다: **저장소 쪽 에이전트가 자기 진행 중 변경을 내 샌드박스에
복사해 넣었다.**

설치된 tarball 스캐폴드와 다르면서 **저장소 작업 트리와 바이트 동일한** 샌드박스 파일이
정확히 셋이다.

| 파일 | 샌드박스 mtime | 대응 커밋 |
| --- | --- | --- |
| `viewer/src/film.ts` | 14:12:43 | `85888669` #2002 (14:02:44) — 무해 |
| `viewer/src/subject.ts` | **14:42:11** | `f4fd388e` #2009 (15:02:56) |
| `viewer/subject.html` | **14:42:11** | 같은 커밋 |

뒤의 둘은 **32 ms 차이**로 들어왔고 #2009이 바꾼 파일 **정확히 그 둘**이다. 그 변경은
engine `#2005`(`4a2ea0e8`, 14:33)의 세 번째 인자를 요구하는데 **이 샌드박스의 engine
tarball은 09:29 팩이라 그것이 없다.** 결과가 실측됐다 — 06:59:27Z에 `npm run lint:source`가
exit 2로 죽는다.

```
viewer/src/subject.ts:551:61 - error TS2554: Expected 2 arguments, but got 3.
    answer = describeAutoMovieSubject(artifact, compiledId, { memberOffset });
```

**저작자가 쓴 파일이 아니다.** rollout 4,258줄 전체에서 `viewer/` 아래를 겨눈
`apply_patch`가 **0건**이고, 저작자의 유일한 viewer 접촉(03:51:46Z)은 **설치된 tarball
스캐폴드에서 샌드박스로 되돌려 복사**하는 방향 — 즉 2인자 판을 쓰는 쪽이다. 저작자 자신도
06:59:49Z에 *"That file is outside the production source I changed"*라 적었고, 턴 4
체크포인트에서 *"I did not author or overwrite that file"*로 다시 적었다.
**독립적으로 같은 결론에 도달했다.**

**제품 결함이 아니다.** 저장소 CI에 `internals/scaffold-evidence-gate.mjs`가 있고, 그것은
스캐폴드 `tsconfig.json`의 `include`를 **통째로**(`viewer/src` 포함) 빌드된
`packages/*/lib/index.d.ts`에 대고 컴파일하며, 두 커밋이 올바른 순서로 착지했으므로
저장소는 일관됐다. **실행의 조건으로 기록한다** — 그리고 이것이 「샌드박스가 저장소 안에
살면 자기 실험과 무관한 이동을 겪는다」의 **세 번째 형태**다: head 이동, 브랜치 이동,
그리고 **남의 손 패치**.

**교훈이자 값싼 계측.** 샌드박스 파일을 **설치된 tarball 스캐폴드**와 대조하면 이것이
한 번에 보인다. `node_modules/@automovie/cli/scaffold/**`는 그 프로젝트가 무엇으로
태어났는지에 대한 **저장소와 무관한 기준선**이고, 거기서 벗어난 파일은 저작자 아니면
침입자다. 저장소 작업 트리와 대조하는 것으로는 이것을 가릴 수 없다 — 침입자의 출처가
바로 그 작업 트리이기 때문이다.

---

## 1. 정체

| 항목 | 값 |
| --- | --- |
| 샌드박스 | `experimental/ancient-civic-temple` (gitignore됨) |
| 담당 이슈 | AutoMovie #1951, 캠페인 #1954 |
| 생성 시점 head | `214f3a7c` (당시 pre-merge 브랜치 상태) |
| 현재 head | `64d0ef47`, 브랜치 `feat/benchmark-four-buildings-cycle-1` |
| 저작 세션 | Codex `codex exec`, 모델 `gpt-5.6-sol`, reasoning effort `xhigh` |
| 재개 식별자 | 세션 UUID `019ffe98-8555-7162-bbb8-c27a47b03f94` |
| 모드 | `--dangerously-bypass-approvals-and-sandbox` |
| MCP 서버 | `automovie_ancient`, 호출 단위 등록, 공유 `~/.codex/config.toml`에 쓰지 않음 |

체크아웃이 실험 도중 네 번 움직였다: `214f3a7c` → `11b8bdea` (squash merge) →
`feat/modern-suburban-house-s1` (다른 드라이버) → `64d0ef47`. **샌드박스가 저장소
안에 살면 자기 실험과 무관한 head 이동을 겪는다.**

세션 식별은 **내용으로** 했다. 형제 드라이버의 세션이 5초 차이로 생성되었고, 이
파일시스템에서는 rollout의 mtime이 기록 중에도 움직이지 않는다. 판정 근거는
rollout 안 `ancient-civic-temple` 109회 언급, 형제 샌드박스 언급 0회.

## 2. 규모

**현재 지어진 기하는 없다.** 이것이 측정값이다.

| 항목 | 값 |
| --- | --- |
| 주체 총수 / 프로토타입 / element / 공간 / 인스턴스 집합 / 모델 / 부품 | **0** — 컴파일이 통과하지 못했고, 소스에 engine 호출이 하나도 없다 |
| `@automovie/engine` import (`src`, `src/examples` 제외) | **0건**, 실측 |
| 저작된 소스 | `src/world/` 22개 + `temple.ts`, 합계 **664줄** (파일당 20–26줄) |
| 저작된 문서 | 21개 — logline 1, 시퀀스 3, 비트 7, 장면 7(`SCN-A03…G03`), world spec 2, art-direction 1 |
| film | `tracks.video: []` — 빈 영화. 소스가 스스로 "S0 edit boundary"라고 적고 있다 |
| shot contract | 0. `src/shots/survey.ts`는 `{ captureId, scene, surfaces, intent }` 레코드를 내는 **계획**이지 contract가 아니다 |

대조군 (`#1939` 사이클 검증 픽스처): 주체 4,003 / 프로토타입 199 / element 3,474 /
공간 15 / 인스턴스 집합 8 / 모델 197 / 부품 398.

그 대조군의 **형상**도 함께 적어둔다. 루트 하나 아래 2,999개가 전부 깊이 2로 거의
완전히 평평했고, 모델 194개 중 178개가 단일 부품이었다. 이 실험의 브리핑은 그
평평함을 명시적으로 금지했다("건물이 그룹, 각 구획이 그룹, 오브젝트도 그룹, 그 안에
또 그룹"), **API는 주지 않았다.** 그 요구가 실제 계층으로 나타나는지는 기하가 생긴
뒤에야 잴 수 있다 — 현재 `unverified`.

## 3. 비용

**모든 벽시계에 그 시점의 머신 부하를 병기한다.** 이 머신은 AutoMovie 드라이버 넷과
형제 캠페인(`interior-automation-experiment`)이 공유한다.

| 측정 | 벽시계 | 그때의 머신 부하 |
| --- | --- | --- |
| 샌드박스 생성 (8개 패키지 pack + `npm install` 253개) | ~6분 (13:17→13:23) | 형제 드라이버 셋이 같은 `packages/*/lib`에 동시 pack |
| 첫 컴파일 (starter, exit 0) | `unverified` — 별도로 재지 않음 | — |
| 컴파일 (신전 소스, exit 1, 진단 29건) | **10초** | commit free 15,996 MB, node 107, codex 15 |
| 컴파일 (같은 것, 전임 측정) | 13초 | 드라이버 넷 + 형제 캠페인, `xhigh` 턴 1개 구동 중 |
| `npm run lint` | 42초 (전임 측정, exit 1, 48건) | 위와 같음 |
| `npm run capture:doctor` | **18초**, exit 0 | commit free 15,996 MB, node 107, codex 15 |
| `npm run building:report` (starter, 기하 0) | 17초, exit 0 | 드라이버 넷 + 형제 캠페인 |
| `npm run texture:scale` (starter) | 16초, exit 0 | 위와 같음 |
| MCP `initialize` + `tools/list` | **9.1초** / 9.13초 | commit free 15,996 MB, node 107, codex 15 |
| MCP `initialize` (전임 측정, 같은 샌드박스) | **20.5초** | 머신이 더 무거웠을 때 |
| 첫 렌더 | **n/a — 렌더한 적이 없다.** 기하가 없어 렌더할 대상이 없다 |
| 방 스케줄 / 텍스처 축척 (신전 소스 기준) | `unverified` — 기하 0에서는 새로 말할 것이 없어 재실행하지 않았다 |
| 주체 관찰 1건 / 프로토타입 스윕 | **n/a** — 주체가 0개다 |

MCP `initialize`가 같은 샌드박스에서 **20.5초 → 9.1초**로 갈린 것이 부하 병기의
근거다. 부하를 적지 않은 이 수치들은 서로 비교할 수 없었을 것이다.

## 4. 도달

이 절이 실험의 본체다. **저작자가 못 한 것과 제품이 길을 주지 않은 것을 나눈다.**

### 저작 에이전트가 실제로 몬 것

| 도구 | 결과 |
| --- | --- |
| MCP `getGuideDocument` | **9회, 8개 가이드** — `AUTOMOVIE_OVERALL`, `COMPILATION`, `EVIDENCE_GRAPH`, `PRODUCTION_DESIGN`, `SCREENPLAY_WRITING`, `SOURCE_OWNERSHIP`, `WORLD_BUILDING`(2회), `WORLD_DESIGN` |
| MCP `captureFrame` / `repaintShot` / `inspectSubject` / `prepareReview` / `submitReview` | **0회** — 다섯 도구 모두 한 번도 부르지 않았다 |
| `user cancelled MCP tool call` | **0건** (정확한 문자열로 셈) |
| 외부 MCP 서버 호출 | **0건**. 턴 1 동안 `automovie_modern`·`automovie_medieval`·`automovie_future`가 도구 목록에 보였는데도 그렇다 |

**`getGuideDocument` 9회는 깨끗한 증거가 아니다.** 전임 드라이버의 턴 1 메시지가
그 도구를 이름으로 지목하고 `AUTOMOVIE_OVERALL`을 먼저 읽으라고 지시했다.

### 세션 내부 대조군 — 이 실험에서 가장 강한 관측

같은 세션의 두 턴이 서로의 대조군이 된다. rollout의 `turn_context`로 턴 경계를
확정하고 턴별로 셌다.

| 턴 | `approvals_reviewer` | exec 호출 | MCP 호출 | 도구를 지목받았나 |
| --- | --- | --- | --- | --- |
| T1 (04:47Z) | `user` | 56 | **9** (전부 `getGuideDocument`) | **예** |
| T2a (05:27Z) | `auto_review` | 0 | 0 | 아니오 (즉시 전송사) |
| T2b (05:30Z) | `auto_review` | 23 | **0** | 아니오 |
| T3 (05:58Z) | `auto_review` | 진행 중 | — | 아니오 |

턴별로 exec 셀을 분류해 세면 이렇다. (T1의 MCP 셀 7개가 호출 9회인 것은 한 셀이
`["PRODUCTION_DESIGN","WORLD_DESIGN"]`처럼 이름 배열을 돌기 때문이다.)

| 턴 | exec 셀 | MCP를 부른 셀 | `shell_command` 셀 | `node_modules/@automovie` 를 읽은 셀 |
| --- | --- | --- | --- | --- |
| T1 | 56 | **7** (호출 9회) | 39 | **12** |
| T2b | 23 | **0** | 23 | **20** (87 %) |
| T3 (중단 시점) | 32 | **0** | 22 | 8 |

**여기서 이분법을 버려야 한다.** 도구를 9번 쓴 T1조차 같은 턴에
`node_modules/@automovie/**`를 **12번 읽었다.** 즉 가이드 표면은 소스 읽기를
**대체하지 않는다.** 지목받으면 *추가로* 쓰는 채널일 뿐이고, 지목이 없으면 그 채널만
사라지고 소스 읽기는 그대로 남는다.

**T2b의 23개 exec 호출은 전부 `tools.shell_command`였고, 그중 20개가
`node_modules/@automovie/**`의 제품 소스를 읽었다.** 무엇을 읽었는지가 핵심이다 —
`realizeShotContract.ts`, `stageScene.ts`, `blockBeat.ts`,
`AutoMovieProductionCompiler.ts`, `IAutoMovieProductionCompiler.ts`,
`requiredSubjects` 정의, `IAutoMovieVideoEdit` 정의. **전부
`getGuideDocument`의 `SHOT_CONTRACT`·`TYPESCRIPT`·`COMPILATION` 가이드가 답하는
질문이다.** 같은 세션이 바로 전 턴에 그 도구를 9번 성공적으로 불렀는데도 그랬다.

> **[2026-08-18 정정]** 이 문단이 끌어내는 결론의 근거는 위
> 「정정」 절에서 철회됐다. 이 계수는 *갖고도 안 썼다* / *없어서 못 썼다* /
> *불렀는데 거절당했다* 세 상태를 구별하지 못한다.

**다만 T2b 시점에 서버가 실제로 등록돼 있었는지는 `unverified`다.** 등록은 호출
단위 플래그로 들어가는데, 전임의 턴 2 실행은 인라인이었고 그 트랜스크립트가
남지 않았다. rollout의 `world_state`와 `thread_settings_applied` 어디에도 **MCP
서버나 도구 목록이 기록되지 않는다** (확인함: `world_state`의 상태 키는
`agents_md, apps_instructions, environments, host_skills, model, permissions,
personality, plugins_instructions, realtime, skills` — 도구 표면이 없다).

그러므로 T2b의 0건은 **"갖고도 안 썼다"와 "없어서 못 썼다"를 구별할 수 없다.**
로그에서 둘은 똑같이 0으로 보인다. 이것을 기록해 두는 이유가 그것이다.

확실한 것만 남기면 이렇다.

- **도구는 이 세션에 실제로 제공됐고 정상 동작했다** — T1의 9회가 증명한다.
- **호출 단위 등록은 실재하며 서버 프로세스를 띄운다** — T3 실행 중 실측했다.
  `node .../ancient-civic-temple/node_modules/tsx/dist/cli.mjs .../scripts/mcp.ts`가
  codex의 자식으로 살아 있었다.
- **`codex mcp list`에는 이 서버가 처음부터 없다.** 전역 레지스트리에 쓰지 않는 것이
  격리 설계이고, 전역 등록은 다른 캠페인이 소유한 공유 설정을 건드리는 일이다.
  T1이 부른 심볼이 `tools.mcp__automovie_ancient__getGuideDocument`로 **밑줄**
  이름인 것이 그 증거다 — 전역 목록의 이름들은 전부 하이픈이다.
  **전역 목록에 없다는 것을 "사라졌다"로 읽으면 안 된다.**

### 왜 그런가 — Codex가 code mode로 돈다

MCP 도구가 네이티브 도구 호출이 아니라 **실행되는 코드 셀 안의 함수**로 노출된다.

```
tools.mcp__automovie_ancient__getGuideDocument({ name: "WORLD_BUILDING" })
tools.shell_command({ command: "rg -n ... node_modules/@automovie" })
```

**둘이 같은 namespace의 형제다.** 가이드를 부르는 비용과 셸을 부르는 비용이 같다.
마찰 차이가 없으므로 "비싼 크레딧 경로를 피한다"는 설명은 이 데이터로 지지되지
않는다. 지목하면 쓰고, 안 하면 **셸로 제품 소스를 직접 읽는다.**

`approvals_reviewer` 가설도 이 세션은 **지지하지 않는다.** MCP를 실제로 쓴 유일한
턴이 `user`였고 `auto_review` 턴들이 0이다. 상관이 예측과 반대 방향이다. 다만 지목
여부와 등록 여부라는 교란이 겹쳐 있으므로, 옳은 결론은 "`auto_review`가 원인이
아니다"가 아니라 **"이 세션의 데이터로는 구성이 설명이 되지 못한다"**이다.

**T3도 깨끗한 대조군이 아니다.** 후임 드라이버의 턴 3 메시지가 열람 범위를 적으면서
`getGuideDocument`를 이름으로 언급했다. 사용을 지시한 것은 아니지만 이름이 다시
등장했으므로, T3의 결과를 "지목 없는 조건"으로 셀 수 없다. **지목 없는 조건을 재려면
그 이름이 한 번도 나오지 않는 턴이 필요하다.**

**제품에 대한 함의.** 가이드 표면의 가치가 `node_modules`가 통째로 읽힌다는 사실과
경쟁한다. 저작 에이전트는 `SHOT_CONTRACT`를 물어보는 대신 컴파일러 소스를 읽어
같은 지식에 도달했다. 이것이 "관찰 표면 > 배송 표면"이 실제로 무는 지점이다.

### 진행 상태 — 두 턴, 약 90분, 기하 0

- **턴 1** (13:47→14:38, ~50분): 문서 사다리 + 표면 분해. 전송 손실로 중단.
  디스크에 남은 것: 문서 21개, `src/world/` 22개. 컴파일 exit 1, 진단 29.
- **턴 2** (~40분, 418,410 토큰): starter 영화 → 신전 이주. 전송 손실로 중단.
  디스크에 남은 것: starter 소스·문서가 **실제로 삭제**되고 신전 것으로 교체됨.
  컴파일 exit 1, 진단 **29** — 개수가 줄지 않았다.

**두 턴 모두 인프라 손실이다.** `stream disconnected before completion`,
`Reconnecting... 1/5..5/5`. 저작 실패가 아니다. 두 번 다 디스크에서 산출물을 확인한
뒤에야 이 판정을 내렸다 — 로그만 보면 "아무것도 못 냈다"로 잘못 기록된다.

### 막힌 지점과 그때 제품이 준 진단

**제품이 준 것 (긍정).** 컴파일 오류 18건이 **전부 대상·파일·시정 조치를 이름으로**
말했다. 절반만 이주된 상태가 진단만으로 완전히 읽혔다 — 원인을 알기 위해 소스를 읽을
필요가 없었다. 예: `acceptance "opening-pose"가 없는 claim "cue-arm-readable"을
인용합니다. 수정하거나 claim을 추가한 뒤 다시 컴파일하십시오.`

**제품이 길을 주지 않은 것 — 증거 의무의 양방향성.** 스타터 교체가 **전부 아니면
전무**다. 증거 의무가 문서→소스 양방향이라 스타터 문서를 지우면 스타터 소스가
빌드를 깨고(클래스 10개 `cites 0`, `Unresolved evidence target` 약 45건), 그 역도
같다. 결과로 **"문서 전용 단계"를 초록 빌드로 닫는 것이 원리적으로 불가능**하다.
전임의 S0 종료 조건이 그 때문에 성립하지 않아 턴 2에서 정정되었다.

같은 덫이 **세 번째 층에도 걸려 있다.** 턴 2가 `docs`와 `src`를 옮겼는데
`.automovie/design`은 그대로 스타터다 — `shots/{opening,answer}.json`,
`acceptance/{opening,answer}-*.json`, `shared/models/{soloist,chorus-*}.json`,
`shared/formations/chorus.json`. 현재 컴파일이 아직 shot `opening`과 claim
`cue-arm-readable`을 인용하는 이유가 이것이다.

**저작자가 스스로 한 것 (긍정).** `buildingDimensions.ts`에
`assertTempleDimensions`를 두어 **지붕 아래 총면적이 433.5㎡가 아니면 throw**하게
했다. 목표 430㎡ 대비 +0.8%. 외곽 깊이 21.5, 처마 4.2, 용마루 6.4, 주랑 유효폭 2.5,
외벽 0.5 m. 픽셀 비례가 아니라 동선·목재 스팬에서 유도했다고 스스로 적었다.
**기하를 세우기 전에 치수 불변식을 먼저 못 박은 것은 일의 순서가 맞다.**
(턴 1 중간의 25.0 × 22.0 / 426㎡에서 스스로 개정한 값이다.)

### 캠페인이 실측으로 확정한 환경 사실

- `npm`이 아니라 **`npm.cmd`**. `.ps1` 심이 `RemoteSigned` 실행 정책에 막힌다.
- `codex exec resume`에는 `-s/--sandbox`가 없다. 전역이 `sandbox = "elevated"`라
  `-c sandbox="workspace-write"`를 주지 않으면 **턴 중간에 모드가 조용히 바뀐다.**
- `codex exec`에 **`< /dev/null`**. 없으면 `Reading additional input from stdin...`
  에서 멈추고, 그 정지는 "긴 사고 중"과 구별되지 않는다.
- `codex exec resume`은 `-C`를 받지 않는다. `--last`는 서브에이전트 스레드로
  해석되어 실패한다. 프롬프트는 **stdin**으로 — `-i/--image`가 가변 인자라 뒤따르는
  프롬프트 인자를 삼킨다.
- `--approve-for-me`는 bypass 플래그와 상호 배타이고, 그 모드에서는 `npm` 자체가
  `PSSecurityException`으로 막혀 컴파일·렌더·검증이 전부 불가능하다.
- **세션 생존 판단에 mtime을 쓰면 안 된다.** 이 파일시스템에서 rollout이 88 KB
  자라는 동안 스탬프가 고정된 것이 실측되었다. 일차 신호는 프로세스 종료, 교차
  확인은 파일 **크기**.
- `capture:doctor`가 "실행 파일 서술자의 스탬프가 열려 있는 동안 움직였다"며 실패하면
  몇 초 뒤 **`capture:doctor`를 다시** 돌린다. `capture:install`을 재실행하지
  않는다 — 제품 자신의 메시지가 그렇게 말한다.
- codex의 MCP 등록은 **전역이고 전부 enabled**다. 격리하지 않으면 세션이 남의
  샌드박스에 쓰는 도구를 본다. 끌 목록은 손으로 박지 말고 **실행 시점에
  `codex mcp list`에서 센다** — 드라이버가 붙을 때마다 서버가 하나씩 는다.

### 이슈 본문과 실제가 어긋난 것

- `examples/era-reference-images/**`가 **없다.** 레퍼런스 5장은 이슈의 GitHub 자산
  URL에서 직접 받았다.
- `npm run status`, `npm run contribution`, `gltf`, `derive:example` 스크립트가
  **없다.** `status`는 `review:status`로 읽었다. `contribution`은 대체하지 않고
  `unverified`로 남긴다 — 대체하면 다른 것을 재게 된다.
- `internals/scorecard.mjs`가 없다.
- 이슈가 지목한 `renderer-verification` 스킬은 존재하지 않는 이름이다. 실제 스킬은
  `viewer-verification`.
- fal.ai 경로는 **사용자 지시로 취소**되었다. 자산 생성 없이 전부 코드로 짓는
  절차적 기하다. `.env`는 읽지도 넘기지도 않았다.

## 5. 판정

### 제품이 감당한 것

- **진단의 질.** 절반만 이주된 프로덕션의 상태가 진단만으로 완전히 읽혔다. 이것이
  이 실험에서 제품이 보인 가장 강한 성질이다.
- **정직한 거절.** `building:report`가 기하 0에서 "이 프로덕션이 무대에 올린 건축
  환경이 없으므로 그릴 것도, 셀 것도, 연구할 것도 없다"고 exit 0으로 거절했다.
  **알려진 0에서 정직하게 거절하는 것이 나중의 비-0 출력을 믿을 수 있게 만든다.**
- **`texture:scale`의 자기 서술.** starter에서 모델 4·부품 52 중 텍스처 좌표를
  가진 것 0, 검사 가능한 좌표 소스를 선언한 것 0이었고, 도구가 스스로
  "아무것도 측정되지 않았으며 이 실행은 texture-scale 리뷰가 아니다"라고 말했다.
  **exit 0을 초록으로 읽으면 안 되는 상태를 제품이 먼저 말해준다.**
- **결정론적 캡처.** `angle:swiftshader`는 조용한 소프트웨어 폴백이 아니라 제품이
  결정론을 위해 **요청한** 백엔드다. `capture:doctor`가 renderer 문자열과 실행 파일
  digest까지 영수증으로 낸다.

### 제품이 거절한 것과 그 정당성

**증거 의무의 양방향성이 스타터 교체를 전부-아니면-전무로 만든다.** 이 거절은
**정당하다** — 증거 그래프의 목적이 문서와 소스가 서로를 놓치지 않게 하는 것이고,
한쪽만 지우는 것은 정확히 그 그래프가 막아야 할 상태다.

다만 **비용이 스캐폴드 설계에 있다.** 스타터가 완결된 영화 하나로 심겨 있어서, 실제
프로덕션을 시작하려면 첫 걸음이 "전부 교체"가 된다. 저작 에이전트가 두 턴에 걸쳐
그 교체를 하느라 **자기 건물은 한 줄도 짓지 못했다.** 이것이 결함인지 의도된
설계인지는 이 실험이 판정할 것이 아니다 — 관찰로 남긴다.

### 측정 불가로 선언하는 축 (오염)

`HANDOFF.md`가 저작 세션에 **읽혔다.** 실측이다 — 세션 턴 1에서
`Get-Content -Raw -Encoding utf8 -LiteralPath "HANDOFF.md"`와 그 본문이 트랜스크립트에
있다. 원인은 부주의가 아니라 **구조적 충돌**이다: 캠페인이 `HANDOFF.md`를
`experimental/<name>/`에 두라고 요구하는데 그곳이 곧 저작 에이전트의 작업 루트이고,
같은 캠페인이 방법론은 감추라고 요구한다.

이 실행에서 다음 축은 **측정 불가**다.

| 축 | 이유 |
| --- | --- |
| `texture:scale` / `coordinateSource` | 핸드오프가 "exit 0은 아무것도 측정되지 않았다는 뜻"이고 좌표 소스 선언이 0이었다고 이미 적어두었다. 지금 프로덕션이 `coordinateSource`를 선언해도 발견과 상기를 구별할 수 없다 |
| 경계 준수 | `git status --porcelain`이 비어 있고 감시된다는 것을 알게 되었다. `experimental/` 안에 머문 것이 더 이상 독립 증거가 아니다 |
| 캠페인 이슈 결함 발견 | 없는 스크립트 목록·fal.ai 미배선·`scorecard.mjs` 부재를 통보받았다. 독립적으로 재발견할 수 없다 |
| 계측기 함정 인지 | 래퍼 종료 코드 함정과 `capture:doctor` AV 설명을 받았다 |

**회복 수단은 같은 브리핑으로 슬림한 핸드오프를 놓고 다시 도는 것뿐이다.**
14:1x에 `HANDOFF.md`를 운영 사실만 남기고 줄였고, 나머지는 작업 루트 밖으로 옮겼다.

부수 오염 둘.

- 세션이 저장소 SKILL.md 다섯 개(`project`, `evidence-graph`, `documentation`,
  `scaffold`, `development`)를 읽었다. 전임의 턴 1 메시지가 샌드박스 밖 열람을
  허용했기 때문이고, 턴 2에서 철회되었다. 더불어 Codex가 **14개 스킬 색인 전체를
  자동 주입**했다 — 샌드박스가 저장소 안에 있어 Codex가 git 루트에서 `.agents/skills/`를
  발견한다. 이쪽 절반은 요청하지 않은 것이다.
  **`.agents/skills/experiment/**`와 `.wiki/`는 읽히지 않았다.** 실험의 방법론
  문서는 새지 않았고, 저장소의 엔지니어링 관행이 샜다.
- `getGuideDocument` 사용은 전임이 그 도구를 지목했으므로 자발적 도달의 증거가
  아니다 (위 4절).

**저장소 전체가 읽힌다는 사실 자체도 기준선에 남긴다.** `workspace-write`는 쓰기만
제한한다. 따라서 **저작 에이전트가 관찰한 표면은 제품이 배송하는 표면보다 크다.**

### 아직 확인하지 못한 것 — 전부 `unverified`

- **시각적 주장 일체.** 렌더가 없고 이미지가 없다. 외관·절개·중정·제실·기록 구역
  캡처는 이슈의 완료 조건인데 **하나도 수행되지 않았다.**
- 공간 그래프 준수(모든 방이 연속 주랑에 문을 낸다, 단일 storey) — 기하가 없어 잴 수
  없다.
- 그룹 계층의 깊이와 비평평성 — 같은 이유.
- 7개 장면·비트·시퀀스의 극작 품질. 정독하지 않았다.
- `npm run verify`, `npm run contribution` 결과. 전자는 미실행, 후자는 스크립트 부재.

### 결함 (재현 절차 포함)

**D1 — `capture:doctor`가 갓 설치된 브라우저에서 1회 거짓 실패한다.**
재현: `npm run capture:install` 직후 `npm run capture:doctor`. 실행 파일 서술자의
스탬프가 열려 있는 동안 움직였다며 exit 1. 몇 초 뒤 재실행하면 `status: ready`.
AV/인덱서가 새 파일을 만지는 것과 경합한다. **제품 메시지가 재실행을 지시하므로
치명적이지 않으나, 첫 사용자가 만나는 첫 게이트다.**

**D2 — 이슈 본문이 존재하지 않는 명령과 경로를 지시한다.** 위 4절 목록.
재현: `npm run status`, `npm run contribution`, `ls examples/era-reference-images`.

# `@automovie/forge`

automovie의 절차적 지오메트리 제작소. 엔진이 검증한 데이터로 렌더 가능한
메쉬 조각을 만들되, 런타임 플레이어나 LLM 하니스는 이 패키지에 의존하지
않는다.

## 현재 역할

| 영역 | 상태 |
|---|---|
| `hairShell` / `hairTails` / `eyeShells` / `silhouetteBands` | 활성. 절차적 머리·헤어·눈·실루엣 보조 지오메트리. |
| `canonicalFace` / `faceMorphs` / `headMorph` | **Dormant boundary**. 결정 001 이후 face editor는 보류됐지만, 같은 topology의 face/head morph 자산과 테스트는 future revival을 위해 보존한다. |
| `similarity2` / `profileAmplitude` / `taubinSmooth` | 활성 보조 수학·피팅 유틸리티. |

face/head 코드는 삭제하지 않는다. 삭제는 공개 API와 연구 자산을 줄이는
결정이므로 별도 제품 방향 전환이 있을 때 다시 판단한다.

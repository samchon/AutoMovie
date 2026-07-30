# `@automovie/lint`

`@automovie/lint`는 AutoMovie 프로젝트 레코드와 코딩 에이전트의 저작 코드를 검사하는 `@ttsc/lint` contributor다.
엔진이 계산한 물리·문법 사실은 엔진 진단이 소유하고, 이 패키지는 소스와 프로젝트 파일에 이미 존재하는 계약만 판정한다.

## 설정

```ts
import { automovie } from "@automovie/lint";
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  plugins: { automovie },
  rules: {
    "automovie/template-sentinel": "error",
    "automovie/state-presence": [
      "error",
      {
        slots: [
          {
            name: "screenplay-index",
            files: [".automovie/productions/*/screenplay/index.json"],
            requires: [],
          },
          {
            name: "shot-contracts",
            files: [".automovie/productions/*/shots/*.json"],
            requires: ["screenplay-index"],
          },
        ],
      },
    ],
  },
} satisfies ITtscLintConfig;
```

첫 `ttsc check`는 contributor의 Go 소스를 lint 실행 파일에 연결하므로 오래 걸릴 수 있고, 이후 실행은 같은 cache key의 바이너리를 재사용한다.

## 규칙

### `automovie/template-sentinel`

컴파일되는 소스에 정확한 `AUTOMOVIE_IMPLEMENT_ME` 표지가 남아 있으면 실패한다.
표지가 없는 새 프로젝트에는 조용하며, 진단은 남은 사실, downstream이 이를 완성된 구현으로 소비할 수 없는 이유, 구현 후 표지를 제거하고 lint를 다시 실행하라는 복구 행동을 모두 말한다.

### `automovie/state-presence`

설정된 downstream 슬롯의 파일이 하나라도 존재하는데 필요한 upstream 슬롯이 하나도 존재하지 않으면 실패한다.
파일 내용이나 배열 길이는 읽지 않으므로 유효한 빈 레코드도 resident다.
레코드가 전혀 없는 프로젝트에서는 침묵하고, 읽을 수 없는 경로는 그 경로가 숨길 수 있는 의무만 stand-down한다.

## Rule 품질 원칙

모든 AutoMovie rule은 다음 여섯 요구사항을 지킨다.

1. **상주 전 침묵.** 디자인 레코드나 sentinel이 없으면 rule은 조용하다. 빈 배열은 존재하는 레코드이며 길이를 준비 상태로 오해하지 않는다.
2. **사실 범위 stand-down.** 입력을 읽지 못하거나 사실을 결정할 수 없으면 그 불확실성이 숨길 수 있는 의무만 억제하고, 무관한 rule까지 멈추지 않는다.
3. **축소 구조체.** rule option과 decoder에는 판정에 필요한 구조 필드만 둔다. logline, note 같은 산문 필드를 타입에서 제거해 산문 채점을 구조적으로 불가능하게 한다.
4. **복구 가능한 메시지.** 모든 진단은 관측 사실, 그 사실이 깨뜨리는 계약, 사용자가 실행할 정확한 복구 행동과 명령을 이 순서로 말한다. `invalid` 하나로 끝내지 않는다.
5. **checker 심볼 식별.** 엔진·생성 SDK API는 철자가 아니라 checker가 해석한 import symbol로 식별한다. 동명 로컬 변수나 shadow는 해당 API가 아니다.
6. **미러 rule 골든 벡터.** 엔진과 lint가 같은 정준화·지문을 구현하면 양쪽이 같은 벡터 파일을 읽어 결과를 상호 검증한다.

## Rule 작성과 검증

TypeScript의 plugin descriptor는 `src/index.ts`, 실제 rule은 `native/`가 소유한다.
새 rule은 발화·침묵 쌍을 한 줄 차이로 만들고, unit 함수 직접 호출이 아니라 임시 소비자 프로젝트에서 실제 `ttsc check`를 실행해 검증한다.
하네스는 먼저 빈 프로젝트의 성공 상태를 확인하고, 다음 발화 케이스에서 고유 진단 문구를 확인해 “도구가 실행되지 않아 진단이 0개”인 상태를 성공으로 오인하지 않는다.

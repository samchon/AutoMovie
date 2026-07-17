# `@automovie/ingest`

`@automovie/ingest`는 외부 glTF/GLB 자산을 AutoMovie 코어의 노드 그래프와 클립으로 들여오는 헤드리스 수입(ingestion) 패키지다.

이 패키지는 `three.js`를 소유하지 않는다. `@gltf-transform/core`로 glTF/GLB 문서를 읽어, AutoMovie `interface`가 정의한 model AST·skeleton·clip으로 변환하는 결정론적 변환만 다룬다. 실제 렌더는 `viewer`/`playground`가, 계획은 `render`가 맡고, 이 패키지는 같은 입력이 같은 AST를 만들도록 고정한다.

## 공개 표면

- glTF/GLB 문서를 AutoMovie model·skeleton으로 변환하는 수입 함수. 구조적 결함(중복 morph target 이름, 알 수 없는 attachedBone 등)은 던지거나 구조화된 오류로 구분한다.

## 경계

파일 시스템 접근, 브라우저 실행, 자산 다운로드는 host 책임이다. 이 패키지의 역할은 외부 3D 자산과 engine AST 사이의 재현 가능한 수입 seam을 작게 유지하는 것이다.

# 외부 입력 요구사항

외부 입력은 사용자 또는 사용자가 맡긴 저작 에이전트가 AutoMovie 밖의 API, 제작 도구, 저장소와 파일에서 가져와 작품에 채택하는 자료다. 이 주제는 특정 공급자를 제품 경로로 정하지 않으면서 외부 자료를 안전하고 반복 가능하게 작품 입력으로 바꾸는 공통 계약을 정의한다.

## 범위와 사용자 권한 {#external-inputs-scope}

사용자는 자신이 선택한 third-party API, 도구와 파일을 통해 3D scene, image, video, audio, motion, spatial data, text와 metadata를 가져올 수 있어야 한다. AutoMovie는 특정 provider, model, catalogue나 acquisition service를 필수, 기본 또는 권장 선택으로 고정하지 않으며, 사용자가 선택한 source와 채택 방식을 보존해야 한다.

## 입력 수명주기 {#external-inputs-lifecycle}

외부 자료는 발견되었다는 이유만으로 작품 입력이 되지 않는다. 취득한 원본, 검역 상태, 검증 결과, 사용자가 채택한 revision, 변환 결과, 현재 consumer와 refresh 상태를 구분하여 사용자가 어떤 bytes와 해석을 작품이 읽는지 판단할 수 있어야 한다.

## 주제별 계약 {#external-inputs-topics}

- [Source 선택과 provider 중립성](./source-selection-and-provider-neutrality.md)
- [Media family와 선언 사실](./media-families-and-declared-facts.md)
- [채택 방식과 group composition](./adoption-modes-and-composition.md)
- [Import identity, 좌표와 단위](./identity-coordinates-and-units.md)
- [Resource closure와 취득 경계](./resource-closure-and-acquisition.md)
- [검증과 quarantine](./validation-and-quarantine.md)
- [Credential, 권리와 provenance](./credentials-rights-and-provenance.md)
- [Refresh, version pinning과 offline](./refresh-version-pinning-and-offline.md)
- [Conversion receipt와 결정론](./conversion-receipts-and-determinism.md)
- [미지원 입력과 명시적 degradation](./unsupported-and-degradation.md)

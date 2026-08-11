# 재료, 색, Style과 Art

## Material 사실과 분석 경계 {#interior-space-material-facts-analysis-boundary}

<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-properties Requires visual and measured material facts. -->
<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical Requires visible surface and physical substance to remain distinct. -->
<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-units-sources Requires units, source, uncertainty, and applicability. -->
<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-state-aging Requires material properties to vary by state without overwriting history. -->
<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-analysis-boundary Requires unknown or unanalysed performance to remain explicit. -->

Material 입력은 substance identity와 open classification, PBR surface, optional product·batch, 측정된 density·thermal·moisture·acoustic·durability 특성, 단위, source, uncertainty, valid temperature·frequency·phase 범위와 current aging state를 분리한다. 값이 없으면 `unknown` 또는 `null`이며 비슷한 이름의 catalogue 값으로 채우지 않고, visual finish가 physical performance를 증명하지 않는다. 출력은 region별 resolved surface와 분석기에 제공 가능한 measured property set, 누락 gap과 provenance를 제공한다. 단위 불일치, 적용 범위 밖 값, 상반된 source를 조용히 선택하는 행위와 미실행 thermal·moisture·acoustic 검사를 passed로 표시하는 행위는 실패이며 property revision 변경은 해당 analysis와 quantity를 stale로 만든다.

## Texture와 color interpretation {#interior-space-texture-color-interpretation}

<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-color-style-form-art Requires color, style, form, and art to remain authorable without a closed catalogue. -->
<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-color-management-comparison Requires explicit color management for comparisons. -->
<!-- @evidence requirements/interior/textures-patterns-and-variation.md#interior-pattern-source Requires user-selected texture and pattern sources. -->

Texture는 사용자가 선택한 image 또는 generated source의 exact revision, color space, transfer, channel intent, alpha, UV set 또는 projection, transform, sampler, resolution, valid region과 resource closure를 입력으로 받는다. Base color와 emissive는 color interpretation을, metallic·roughness·normal·occlusion·mask는 measurement interpretation을 사용하며 같은 image를 상반된 intent로 조용히 재해석하지 않는다. 색 비교 출력은 scene-linear 또는 명시된 display transform, exposure와 viewing condition을 함께 기록한다. Missing image, digest mismatch, unsupported UV, 상충하는 channel meaning과 화면 캡처만을 material fact로 역추정하는 행위는 failure이고 source refresh는 explicit candidate revision으로만 들어온다.

## Style, form, art와 signage {#interior-space-style-form-art-signage}

<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-style-not-preset Requires style to be an open authored system rather than a fixed preset. -->
<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-style-space-continuity Requires intentional continuity and variation across spaces. -->
<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-art-signage Requires art and signage as placed, legible, attributed elements. -->
<!-- @evidence requirements/interior/color-style-form-and-art.md#interior-style-reference-boundary Requires references to remain evidence rather than hidden design truth. -->

Style은 시대명 preset이나 닫힌 catalogue가 아니라 proportion, silhouette, form, assembly, palette, material, pattern, ornament와 lighting rule의 사용자가 저작한 조합이다. Space·level·zone과 group은 shared style rule을 참조하고 explicit override로 continuity 또는 contrast를 만들며, reference image·mood board·generated concept는 source·scope·confidence를 가진 관측 입력이지 measured geometry나 material truth가 아니다. Art, mural, display와 signage는 stable identity, source·rights, host·support, physical bounds, orientation, readable side·distance, lighting relation, phase와 optional content state를 가져야 한다. Missing rights·source, floating work, unreadable required sign, hidden override와 reference를 exact fact로 승격한 결과는 failure이며 style vocabulary 확장은 기존 open classifications와 source identity를 보존해야 한다.

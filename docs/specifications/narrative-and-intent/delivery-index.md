# Script와 Screenplay Delivery Index

## Group projection {#narrative-intent-delivery-index-boundary}

### Canonical group index {#narrative-intent-delivery-index}

<!-- @evidence requirements/story/delivery-index.md#story-delivery-index index를 사실 owner가 아닌 deterministic ordered projection으로 제한한다. -->

입력은 group index의 exact source와 같은 group에 속한 numbered unit들의 normalized path 및 visible H1이다. Markdown parser는 fenced code, HTML comment와 indented code의 heading을 무시하고 H1이 정확히 하나인 unit만 받아들인다. Label의 Markdown metacharacter는 canonical link text로 escape하고 target path는 project root 안의 portable identity로 정규화한다.

Renderer는 H1 다음의 단일 start/end delimiter 사이에 filename 순서의 links를 만들며 delimiter 밖에는 공백 외 authored body나 별도 link authority를 허용하지 않는다. Planner는 missing index/group/unit, duplicate 또는 unmatched delimiter, stale block과 mirrored script/screenplay inventory 차이를 diagnostic으로 반환한다.

Check 결과도 canonical candidate bytes를 반환한다. Write는 check가 읽은 source와 apply 직전 source가 같은 identity인지 확인한 뒤 candidate를 publish하고, competitor 또는 partial failure에서 authored unit과 predecessor index를 덮어쓰지 않는다.

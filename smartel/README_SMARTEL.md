# SMARTEL 입력양식 (Standalone Deploy)

이 폴더만 GitHub/Netlify에 배포하면 됩니다. (THEONE과 분리)

## 포함 파일
- `index.html` : 현재 안정본(디자인/레이아웃 그대로)
- `img/smartel.png` : 중앙 로고
- `pdf/template_smartel.pdf` : PDF 템플릿(자리표시자, 배포 후 교체하세요)
- `pdf/map_smartel.json` : PDF 매핑 좌표 스켈레톤(값만 수정하면 즉시 반영)

## 교체/수정 포인트
1) `pdf/template_smartel.pdf` → 스마트엘 최종 양식으로 교체
2) `pdf/map_smartel.json` → 실제 좌표로 업데이트
3) `index.html` → 텍스트/옵션 수정이 있으면 이 파일만 교체

> 필드 키 유지사항(출력 엔진 연동): `plan`, `plan_price`, `subscriber_name`, `autopay_holder`, `join_type`, `customer_type`, `autopay_method`, `autopay_org`, `autopay_number`, `autopay_exp`, `addon_intl_block`

## Netlify 배포
- New site from Git → GitHub Repo 선택
- **Base directory**: `smartel`
- **Build command**: (없음)
- **Publish directory**: `smartel`

## 조건 분기(인쇄 규칙) 참고
- `join_type === "new"` → `mvno_name` 절대 인쇄 금지
- `autopay_method === "bank"` → `card_*` 인쇄 금지 / `autopay_method === "card"` → `bank_*` 인쇄 금지
- `autopay_exp`를 `YY/MM` 그대로 쓰거나, 내부에서 `exp_yy`, `exp_mm`로 분리 후 각 좌표에 인쇄

## 다국어
- 현재 파일은 KR 기본. 언어 토글 이슈는 추후 동일 파일에서 스크립트만 보강하면 됩니다. (디자인/레이아웃 영향 없음)

# SMARTEL Starter (Netlify)

배포 방법
1. 이 폴더 그대로 GitHub에 푸시하거나, Netlify **Deploy manually**로 업로드합니다.
2. 배포가 완료되면 사이트에서 **PDF 저장 / 인쇄** 버튼이 동작합니다.

구성
- `index.html`: 기존 입력폼(수정 없음)
- `smartel-pdf-binder.js`: 저장/인쇄 버튼 바인딩 (폼 값을 서버리스로 전송)
- `netlify/functions/generate_top.js`: pdf-lib로 `template.pdf` 위에 텍스트 얹어 PDF 생성
- `netlify/functions/assets/template.pdf`, `font.ttf`: 템플릿과 폰트
- `package.json`: 함수 의존성(pdf-lib) 설치용
- `netlify.toml`: Functions 경로 설정

좌표 매핑
- 현재는 시연용 좌표(가입자명/생년월일/주소/연락처/요금제/USIM)만 배치되어 있습니다.
- 이후 매핑 JSON을 전달 주시면 `generate_top.js`에 반영해 드릴게요.

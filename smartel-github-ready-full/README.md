# SMARTEL – GitHub + Netlify Functions
- `index.html` : 폼 (자유 수정 가능)
- `pdf-client.js` : 저장/인쇄 버튼을 서버리스 함수로 연결
- `mapping.json` : 좌표 정의(원할 때 교체/수정)
- `netlify/functions/generate_pdf.js` : PDF 생성 함수
- `netlify/functions/package.json` : 함수 의존성

**Netlify Build Settings**
- Publish directory: `.`
- Functions directory: `netlify/functions`

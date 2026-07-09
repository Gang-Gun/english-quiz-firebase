# 2학년 4반 영어시험

기존 Google Apps Script HTML의 화면 구조와 색상 흐름을 유지한 GitHub Pages + Firebase 서버 버전입니다. 메인 화면은 GitHub Pages에서 제공하고, Firebase는 Functions/Firestore 서버 역할만 맡습니다.

## 구성

- `src/`: GitHub Pages에 올라갈 React/Vite 학생/관리자 화면
- `functions/`: Firebase Callable Functions 서버
- `firestore.rules`: 클라이언트 직접 읽기/쓰기를 막고 서버 함수 중심으로 운영하는 규칙
- `scripts/`: Google Sheet export를 Firestore import JSON으로 바꾸고 Firestore에 시드하는 도구
- `.github/workflows/deploy-pages.yml`: `main` push 시 GitHub Pages 자동 배포

## 로컬 실행

```bash
npm install
npm test -- --run
npm run build
npm run dev
```

## 실제 시트 데이터 변환

`work/2-4-english-test.xlsx`는 Google Drive에서 내려받은 원본 시트 export입니다. `work/`는 학생 성적 데이터가 들어가므로 git에 올리지 않습니다.

```bash
npm run export:xlsx
npm run migrate:sheet
```

생성 결과:

- `work/sheet-export.json`
- `work/firestore-import.json`

## Firebase 서버

Firebase 프로젝트는 `english-79a0a`를 사용합니다. Firebase Hosting은 사용하지 않습니다.

Firestore 시드는 Firebase 로그인과 프로젝트 설정 뒤 실행합니다.

```bash
copy .firebaserc.example .firebaserc
copy functions/.env.example functions/.env
npx firebase login
npx firebase deploy --only functions,firestore:rules
$env:FIREBASE_PROJECT_ID="english-79a0a"
npm run seed:firestore
```

`functions/.env`의 `ADMIN_ACCESS_CODE`는 브라우저 코드에 넣지 않습니다.
Firebase Functions 배포에는 Firebase Blaze(pay-as-you-go) 플랜이 필요합니다. Spark 플랜에서는 Firestore rules/indexes와 데이터 시드는 가능하지만 Functions 배포는 막힙니다.

## GitHub Pages

GitHub repo를 만들고 `main`에 push하면 `.github/workflows/deploy-pages.yml`이 `npm run build` 후 Pages에 배포합니다.

Firebase 웹 앱 설정값은 GitHub Pages 빌드 환경의 `VITE_FIREBASE_*` 변수로 넣습니다.

# 설정 안내 — 루틴 환경·키·배포·도메인

키·토큰은 채팅에 붙여 넣지 않는다. claude.ai 클라우드 환경의 **네트워크 시크릿**(프록시가 요청 헤더에 넣어 준다)과 **환경변수**로만 넣는다. 컨테이너에는 키가 남지 않는다.

## 1. 클라우드 환경 (claude.ai → 루틴 → 환경)

- 저장소: `gyuhyun21/bbadda`
- 네트워크: 아래 호스트 허용(또는 "전체"). `news.google.com`, `www.googleapis.com`, `dapi.kakao.com`, `graph.facebook.com`, `discoveryengine.googleapis.com`, `registry.npmjs.org`, `github.com`
- 환경변수(공통): `NODE_USE_ENV_PROXY=1` (Node fetch 가 프록시를 쓰게. `npm run collect` 는 `scripts/run.mjs` 가 자동으로 켠다)

## 2. 소스별 키 (필요한 것만)

### YouTube Data API v3
1. Google Cloud 콘솔 → 프로젝트 만들기 → API 및 서비스 → 라이브러리 → "YouTube Data API v3" 사용.
2. 사용자 인증 정보 → API 키 만들기 → 키 제한: API 제한 "YouTube Data API v3".
3. 네트워크 시크릿: 이름 `YOUTUBE_API_KEY` · 허용 호스트 `www.googleapis.com` · 헤더 `X-Goog-Api-Key` · 접두사 없음 · 값 = API 키
4. 환경변수:
   ```
   YOUTUBE_AUTH=proxy
   ```
   하루 무료 할당량 10,000 units. 한 번 실행 상한은 `config/sources.yaml youtube.units_budget`(3000).

### 카카오(다음) 검색
1. developers.kakao.com → 내 애플리케이션 → 앱 만들기 → 앱 키의 **REST API 키**.
2. 네트워크 시크릿: 이름 `KAKAO_REST_KEY` · 허용 호스트 `dapi.kakao.com` · 헤더 `Authorization` · 접두사 `KakaoAK`(Bearer 아님, 뒤에 공백 하나) · 값 = REST API 키
3. 환경변수:
   ```
   KAKAO_AUTH=proxy
   ```

### Instagram (구단 공식 계정 게시물)
1. 본인 인스타그램을 비즈니스(또는 크리에이터) 계정으로 바꾸고 Facebook 페이지에 연결.
2. developers.facebook.com → 앱 만들기 → 이용 사례 "Instagram에서 메시지 및 콘텐츠 관리" → Facebook 로그인 방식에서 권한 추가:
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`
3. 그래프 API 탐색기에서 사용자 토큰 발급 → 액세스 토큰 디버거에서 **장기 토큰(60일)** 으로 연장.
4. 내 IG 비즈니스 계정 ID: 탐색기에서 `me/accounts?fields=instagram_business_account` 결과의 id.
5. 네트워크 시크릿: 이름 `INSTAGRAM_TOKEN` · 허용 호스트 `graph.facebook.com` · 헤더 `Authorization` · 접두사 `Bearer` · 값 = 장기 토큰
6. 환경변수:
   ```
   INSTAGRAM_AUTH=proxy
   INSTAGRAM_USER_ID=<IG 비즈니스 계정 ID>
   ```
   수집 로그에 "오류 190"이 나오면 토큰 만료 → 3번부터 다시. 비즈니스 계정이 아닌 구단 계정은 조회되지 않는다.

### 구글 Vertex AI Search (커뮤니티)
1. Google Cloud 콘솔 → AI Applications(Agent Builder) → 앱 만들기 → **사이트 검색**(Enterprise 기능 켬, 고급 색인 끔).
2. 데이터 저장소에 사이트 등록: `mlbpark.donga.com/*`, `gall.dcinside.com/*`, `theqoo.net/*`, `www.fmkorea.com/*`, `www.reddit.com/r/KBO/*`
3. API 키 만들기(제한: "Discovery Engine API").
4. 앱 ID 와 프로젝트 번호 확인.
5. 네트워크 시크릿: 이름 `VERTEX_API_KEY` · 허용 호스트 `discoveryengine.googleapis.com` · 헤더 `X-Goog-Api-Key` · 접두사 없음 · 값 = API 키
6. 환경변수:
   ```
   VERTEX_AUTH=proxy
   VERTEX_ENGINE=projects/<프로젝트 번호>/locations/global/collections/default_collection/engines/<앱 ID>
   ```
   계정당 매달 10,000회 무료. 한 번 실행 상한 `config/sources.yaml vertex.max_queries`(60) × 하루 2번 ≈ 월 3,720회.

키를 넣은 뒤에는 `npm run collect -- --only=<소스> --dry` 로 실측해 건수·잡음을 확인하고 필터를 조정한다.

## 3. 루틴 등록 (claude.ai)
- 루틴 2개(같은 프롬프트): `docs/routine.md` 의 프롬프트를 그대로 붙여 넣는다.
  - 아침 갱신: 매일 06:37 (Asia/Seoul)
  - 밤 갱신: 매일 22:37 (Asia/Seoul) — 비시즌에는 프롬프트가 스스로 아무것도 하지 않고 끝낸다
- 환경은 `bbadda`, 저장소는 `gyuhyun21/bbadda`. GitHub 저장소 쓰기·PR 권한이 있어야 한다.
- 환경의 설정 스크립트는 비워 둔다(설정 스크립트는 저장소 폴더 밖에서 돌아서 `npm ci` 가 실패한다). 설치는 루틴 안에서 한다.

## 4. Vercel 연결
1. vercel.com → Add New → Project → GitHub 의 `gyuhyun21/bbadda` Import.
2. Framework Preset: Astro(자동 인식). Build Command `npm run build`, Output Directory `dist`, Install Command `npm ci`.
3. Settings → Environment Variables(선택): `SITE_LAYOUT=classic` 를 넣으면 예전 화면, 비우면 `config/site.yaml` 값. Node 버전은 Settings → General 에서 22.x.
4. Deploy. Production Branch = `main` — PR 이 머지될 때마다 자동 배포, PR 마다 미리보기 주소가 생긴다.

## 5. bbadda.com 도메인
1. Vercel 프로젝트 → Settings → Domains → `bbadda.com` 추가, 이어서 `www.bbadda.com` 추가(하나를 다른 하나로 리디렉트하도록 선택).
2. Vercel 이 보여 주는 DNS 레코드를 도메인 등록 업체 DNS 관리 화면에 **그대로** 넣는다(루트 도메인은 A 레코드, www 는 CNAME 으로 안내된다). 값은 Vercel 화면 기준으로 하고 다른 곳의 값을 옮겨 쓰지 않는다.
3. 기존에 같은 이름의 A·CNAME 레코드(주차 페이지 등)가 있으면 지운다.
4. Vercel 화면에 "Valid Configuration"이 뜨면 HTTPS 인증서는 자동 발급된다(수 분~수 시간).

## 승부 예측 투표 저장소 (Upstash Redis, 무료)

`api/vote.ts`(Vercel 함수)가 투표를 Upstash Redis 에 저장한다. 연결 전에는 투표 칸이 화면에 나오지 않는다.

1. Vercel → bbadda 프로젝트 → **Storage** 탭 → **Create Database** → **Upstash for Redis** → 무료 플랜, 지역 `Tokyo (ap-northeast-1)` → 만들기.
2. **Connect Project** 에서 bbadda 연결(Production·Preview). 환경변수 `KV_REST_API_URL`·`KV_REST_API_TOKEN` 이 자동으로 들어간다(값을 채팅에 붙여 넣지 않는다).
3. Deployments → 최신 배포 **Redeploy**.

저장 내용: 경기별 팀 득표 수, 중복 방지용 IP 해시(원문 IP 저장 안 함). 모두 경기 30일 뒤 자동 삭제.

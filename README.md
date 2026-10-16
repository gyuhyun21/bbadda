# BBADDA (빠따닷컴)

KBO 10개 구단 팀별 소식 매거진 — bbadda.com. Astro 정적 사이트 + 저장소 안의 파일(JSON/Markdown/YAML). DB·로그인·유료 API 없음.
작업 규칙은 `CLAUDE.md`.

## 빠른 시작

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro build + Pagefind 검색 색인
npm test
npm run validate
```

Node 22.12+ 필요.

## 설정

| 파일 | 내용 |
|---|---|
| `config/teams.yaml` | 10개 구단: id, 이름, 짧은 이름, 연고지, 팀 컬러(TODO), 공식 사이트·YouTube·인스타그램(확인한 것만), 뉴스 검색어, 별칭 |
| `config/site.yaml` | 화면 스위치: `layout`(magazine/classic), `community_section` |

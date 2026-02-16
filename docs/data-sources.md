# Polichat 데이터 소스 레지스트리

> 주기적 크롤링 & RAG 강화를 위한 API/소스 목록

## 국회 오픈 API (open.assembly.go.kr)

**인증:** 키 없이 접근 가능 (2026-02-16 확인)
**Base URL:** `https://open.assembly.go.kr/portal/openapi/{API_CODE}`
**기본 파라미터:** `?Type=json&pIndex=1&pSize=100`
**주의:** curl 400 에러 → User-Agent 헤더 필요 또는 fetch 사용

| 코드 | API명 | 활용 | 크롤링 주기 |
|------|--------|------|------------|
| `nwvrqwxyaytdsfvhu` | 국회의원 인적사항 | 프로필 자동 갱신 | 월 1회 |
| `nzmimeepazxkubdpn` | 발의법률안 | "어떤 법안?" 답변 | 주 1회 |
| `ojepdqqaweusdfbi` | 본회의 표결정보 | "찬반 기록" 답변 | 주 1회 |
| `nuvypcdgahexhvrjt` | 상임위 활동 | 위원회 발언 RAG | 주 1회 |
| `negnlnyvatsjwocar` | SNS 정보 | 프로필 링크 | 월 1회 |
| `nexgtxtmaamffofof` | 의원이력 | 경력 상세 | 월 1회 |
| `nyzrglyvagmrypezq` | 위원회 경력 | 위원회 이력 | 월 1회 |
| `npeslxqbanwkimebr` | 영상회의록 (발언영상) | 발언 원문 RAG | 주 1회 |
| `numwhtqhavaqssfle` | 연구단체 등록현황 | 관심 분야 파악 | 월 1회 |
| `nbqbmccpamsvwebkn` | 정책 세미나 개최 | 전문 분야 | 월 1회 |
| `npggiwnfaihlruyso` | 정책 자료실 | 정책 문서 RAG | 주 1회 |
| `nmfcjtvmajsbhhckf` | 의정보고서 | 활동 보고 | 월 1회 |
| `nfvmtaqoaldzhobsw` | 소규모 연구용역 보고서 | 연구 활동 | 월 1회 |
| `ncrwiahparxrpodcv` | 연구단체 활동 보고서 | 연구 활동 | 월 1회 |
| `nyioaasianxlkcqxs` | 지역현안 토론회 | 지역 활동 | 월 1회 |
| `nbdlhufiaebnmjfxf` | 보좌직원 채용 | 참고 정보 | 분기 1회 |
| `nepjpxkkabqiqpbvk` | 정당 의석수 현황 | 정당 정보 갱신 | 월 1회 |

## 향후 추가 예정 소스

| 소스 | URL | 용도 | 비고 |
|------|-----|------|------|
| 국회 회의록 | likms.assembly.go.kr | 발언 원문 전문 | 별도 크롤링 필요 |
| 의안정보시스템 | likms.assembly.go.kr/bill | 법안 상세 | HTML 파싱 |
| 중앙선관위 | info.nec.go.kr | 선거 이력/공약 | API 확인 필요 |
| 정치인 SNS | x.com, facebook.com | 최근 발언 | 크롤링 필요 |
| 뉴스 API | 네이버/구글 뉴스 | 최근 이슈 | API 키 필요 |

## 크롤링 스크립트

| 스크립트 | 경로 | 용도 |
|---------|------|------|
| fetch-assembly.ts | `scripts/fetch-assembly.ts` | 국회 API 수집 → Supabase 적재 |
| collect-speeches.ts | `scripts/collect-speeches.ts` | 발언 수집 → 벡터 DB |

## 자동화 계획

```
주 1회 (월요일 새벽)
├─ 발의법률안 갱신
├─ 표결정보 갱신  
├─ 상임위 활동 갱신
└─ 정책 자료실 갱신

월 1회 (1일 새벽)
├─ 인적사항 갱신
├─ SNS 정보 갱신
├─ 의원이력 갱신
└─ 정당 의석수 갱신
```

---
*Created: 2026-02-16 | Last updated: 2026-02-16*

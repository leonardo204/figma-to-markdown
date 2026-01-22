# Figma to Markdown 플러그인 구현 계획

## 개요

Figma에서 선택한 프레임을 Confluence 업로드용 Markdown으로 변환하는 플러그인

### 핵심 요구사항

| 항목 | 내용 |
|------|------|
| 목적 | Figma 기획 문서 → Confluence용 Markdown 변환 |
| 트리거 | 프레임 선택 → 우클릭 → Plugins → "Figma to Markdown" |
| LLM 필수 | LLM 연동 없으면 서비스 차단 |
| 출력 방식 | 클립보드 복사 |
| 다이어그램 | 이미지 대신 Mermaid Chart 사용 |

### 지원 LLM 제공업체

| 제공업체 | 필요 설정 |
|----------|-----------|
| OpenAI | API Key, Model Name |
| Claude (Anthropic) | API Key, Model Name |
| Azure OpenAI | Endpoint, API Key, Deployment Name, API Version |
| Ollama | Endpoint (localhost), Model Name |

---

## 기술 스택

```
figma-to-markdown/
├── manifest.json          # Figma 플러그인 매니페스트
├── package.json
├── tsconfig.json
├── src/
│   ├── code.ts            # 메인 플러그인 코드 (Figma API)
│   ├── ui.tsx             # React 기반 UI
│   ├── types/
│   │   ├── figma.ts       # Figma 데이터 타입
│   │   ├── llm.ts         # LLM 설정 타입
│   │   └── index.ts
│   ├── services/
│   │   ├── figma-extractor.ts    # Figma 프레임 데이터 추출
│   │   ├── llm-client.ts         # LLM API 클라이언트 (통합)
│   │   ├── markdown-converter.ts # Markdown 변환 로직
│   │   └── storage.ts            # 설정 저장 (clientStorage)
│   ├── components/
│   │   ├── App.tsx
│   │   ├── SettingsPanel.tsx     # LLM 설정 UI
│   │   ├── ConversionPanel.tsx   # 변환 옵션 및 결과
│   │   └── ProviderForm.tsx      # 제공업체별 입력 폼
│   └── prompts/
│       ├── markdown-conversion.ts # Markdown 변환 프롬프트
│       ├── mermaid-generation.ts  # Mermaid 생성 프롬프트
│       └── translation.ts         # 번역 프롬프트
├── ui.html                # UI 진입점
└── build/                 # 빌드 출력
```

---

## 구현 단계

### Phase 1: 프로젝트 기반 구축

#### 1.1 프로젝트 초기화
- [ ] package.json 생성 (TypeScript, React, esbuild)
- [ ] tsconfig.json 설정
- [ ] manifest.json 작성 (menu 설정 포함)
- [ ] 빌드 스크립트 구성

#### 1.2 기본 플러그인 구조
- [ ] code.ts: 플러그인 진입점, 메시지 핸들러
- [ ] ui.html: React 앱 마운트
- [ ] 메시지 통신 구조 설계 (code ↔ ui)

### Phase 2: LLM 설정 관리

#### 2.1 설정 저장소
- [ ] figma.clientStorage를 이용한 설정 저장/로드
- [ ] 제공업체별 설정 스키마 정의

#### 2.2 설정 UI
- [ ] 제공업체 선택 드롭다운 (OpenAI, Claude, Azure OpenAI, Ollama)
- [ ] 제공업체별 동적 입력 폼
  - OpenAI: API Key, Model Name (기본값: gpt-4o)
  - Claude: API Key, Model Name (기본값: claude-sonnet-4-20250514)
  - Azure OpenAI: Endpoint, API Key, Deployment Name, API Version
  - Ollama: Endpoint (기본값: http://localhost:11434), Model Name
- [ ] 연결 테스트 버튼
- [ ] 설정 저장/초기화

### Phase 3: Figma 데이터 추출

#### 3.1 프레임 데이터 추출기
- [ ] 선택된 노드 순회 (figma.currentPage.selection)
- [ ] 텍스트 레이어 추출 (TextNode)
- [ ] 프레임 구조/계층 추출 (FrameNode, GroupNode)
- [ ] Auto Layout 정보 추출 (방향, 간격 등)
- [ ] 컴포넌트 인스턴스 정보 추출

#### 3.2 데이터 정규화
- [ ] 추출 데이터를 LLM 입력용 JSON으로 변환
- [ ] 레이어 계층 구조 표현
- [ ] 시각적 관계 정보 포함 (위치, 크기, 순서)

### Phase 4: LLM 통합 클라이언트

#### 4.1 통합 API 클라이언트
- [ ] 공통 인터페이스 정의
- [ ] OpenAI 클라이언트 구현
- [ ] Claude 클라이언트 구현
- [ ] Azure OpenAI 클라이언트 구현
- [ ] Ollama 클라이언트 구현

#### 4.2 에러 처리
- [ ] API 키 오류 처리
- [ ] 네트워크 오류 처리
- [ ] Rate limit 처리
- [ ] 타임아웃 처리

### Phase 5: Markdown 변환 엔진

#### 5.1 프롬프트 설계
- [ ] Figma 구조 → Markdown 변환 프롬프트
- [ ] Mermaid Chart 생성 프롬프트 (flowchart, sequence 등)
- [ ] 번역 프롬프트

#### 5.2 변환 파이프라인
- [ ] Figma 데이터 → LLM 요청 → Markdown 생성
- [ ] 다이어그램 감지 → Mermaid 변환
- [ ] 선택적 번역 적용

### Phase 6: 메인 UI 및 출력

#### 6.1 변환 패널 UI
- [ ] 프레임 선택 상태 표시
- [ ] 변환 옵션 (번역 언어 선택)
- [ ] 변환 진행 상태 표시
- [ ] 결과 미리보기

#### 6.2 출력 기능
- [ ] 클립보드 복사 (navigator.clipboard.writeText)
- [ ] 복사 완료 피드백

### Phase 7: 테스트 및 마무리

#### 7.1 테스트
- [ ] 다양한 프레임 구조 테스트
- [ ] 각 LLM 제공업체 테스트
- [ ] 에러 케이스 테스트

#### 7.2 마무리
- [ ] 코드 정리 및 주석
- [ ] README.md 작성

---

## UI 와이어프레임

```
┌─────────────────────────────────────────┐
│  Figma to Markdown                   ✕  │
├─────────────────────────────────────────┤
│  [⚙️ Settings] [📄 Convert]             │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Settings Tab ─────────────────────┐ │
│  │                                    │ │
│  │  LLM Provider: [OpenAI      ▼]    │ │
│  │                                    │ │
│  │  API Key: [••••••••••••••••••]    │ │
│  │                                    │ │
│  │  Model: [gpt-4o            ▼]     │ │
│  │                                    │ │
│  │  [Test Connection]  [Save]        │ │
│  │                                    │ │
│  │  Status: ✅ Connected              │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ Convert Tab ──────────────────────┐ │
│  │                                    │ │
│  │  Selected: 3 frames                │ │
│  │  • Frame 1: "메인 화면"            │ │
│  │  • Frame 2: "로그인 플로우"        │ │
│  │  • Frame 3: "설정 화면"            │ │
│  │                                    │ │
│  │  Translation: [None        ▼]     │ │
│  │               ├─ None             │ │
│  │               ├─ English          │ │
│  │               ├─ Japanese         │ │
│  │               └─ Chinese          │ │
│  │                                    │ │
│  │  [🔄 Convert to Markdown]          │ │
│  │                                    │ │
│  │  ─────────────────────────────     │ │
│  │  Preview:                          │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │ # 메인 화면                  │  │ │
│  │  │                              │  │ │
│  │  │ ## 개요                      │  │ │
│  │  │ 사용자가 처음 보게 되는...   │  │ │
│  │  │                              │  │ │
│  │  │ ```mermaid                   │  │ │
│  │  │ flowchart TD                 │  │ │
│  │  │   A[시작] --> B[로그인]      │  │ │
│  │  │ ```                          │  │ │
│  │  └──────────────────────────────┘  │ │
│  │                                    │ │
│  │  [📋 Copy to Clipboard]            │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

---

## LLM 프롬프트 전략

### Markdown 변환 프롬프트

```
당신은 Figma 디자인 데이터를 Confluence용 Markdown 문서로 변환하는 전문가입니다.

입력: Figma 프레임의 구조화된 데이터 (JSON)
출력: Confluence에 바로 올릴 수 있는 Markdown 문서

규칙:
1. 프레임 이름을 제목(#)으로 사용
2. 텍스트 레이어의 계층 구조를 헤딩 레벨로 변환
3. 리스트 형태의 요소는 Markdown 리스트로 변환
4. 화면 흐름이나 프로세스가 있으면 Mermaid flowchart로 표현
5. 표 형태의 데이터는 Markdown 테이블로 변환
```

### Mermaid 생성 프롬프트

```
다음 Figma 프레임 데이터에서 시각적 흐름/관계를 분석하여
적절한 Mermaid 다이어그램을 생성하세요.

지원 다이어그램 유형:
- flowchart: 화면 흐름, 프로세스
- sequenceDiagram: 사용자 상호작용, API 흐름
- classDiagram: 데이터 구조, 컴포넌트 관계

화살표나 연결선이 있으면 flowchart로,
시간순 흐름이 있으면 sequenceDiagram으로,
구조적 관계가 있으면 classDiagram으로 표현
```

---

## 주요 고려사항

### 1. Figma 플러그인 제약

| 제약 | 해결 방안 |
|------|-----------|
| code.ts에서 fetch 불가 | UI(iframe)에서 LLM API 호출 |
| clientStorage 용량 제한 | 설정만 저장, 결과는 저장 안 함 |
| 동기 실행 제한 | async/await 활용, 진행 상태 표시 |

### 2. LLM API 호출 최적화

- 프레임 데이터 압축하여 토큰 절약
- 스트리밍 응답으로 UX 개선 (가능한 제공업체에서)
- 실패 시 재시도 로직

### 3. 보안

- API Key는 figma.clientStorage에 암호화 없이 저장 (Figma 제공 보안)
- API Key 입력 시 마스킹 처리
- 외부 전송 데이터 최소화

---

## 예상 산출물

1. **Figma 플러그인 패키지**: 빌드된 플러그인 코드
2. **README.md**: 설치 및 사용 가이드
3. **설정 가이드**: 각 LLM 제공업체별 API Key 발급 방법


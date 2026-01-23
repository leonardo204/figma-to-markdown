# Figma to Markdown

<p align="center">
  <img src="dist/icon.svg" alt="Figma to Markdown" width="128" height="128">
</p>

<p align="center">
  <strong>AI 기반 Figma 디자인 문서화 플러그인</strong><br>
  Figma 프레임을 Confluence 호환 Markdown으로 자동 변환
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-llm-providers">LLM Providers</a> •
  <a href="#development">Development</a>
</p>

---

## Features

### 핵심 기능

- **AI 기반 변환**: LLM을 활용한 지능형 Markdown 문서 생성
- **다중 프레임 지원**: 여러 프레임을 순차 처리하여 하나의 문서로 병합
- **인라인 이미지**: Figma 이미지를 Base64로 추출하여 Markdown에 직접 포함
- **Mermaid 다이어그램**: 화면 흐름, 프로세스를 자동으로 Mermaid 차트로 표현
- **실시간 미리보기**: 변환 결과를 Mermaid 렌더링과 함께 즉시 확인
- **프롬프트 커스터마이징**: 고급 설정에서 LLM 시스템 프롬프트 직접 수정 가능
- **다국어 번역**: 영어, 일본어, 중국어, 스페인어, 프랑스어, 독일어 지원
- **Confluence 최적화**: Confluence wiki 형식에 맞는 Markdown 출력

### 기술적 특징

- **Rate Limit 자동 처리**: API 제한 시 카운트다운과 함께 자동 재시도
- **스마트 이미지 처리**: 아이콘(≤100px)은 48px로, 일반 이미지는 최대 400px로 자동 리사이즈
- **데이터 간소화**: 토큰 사용량 최적화를 위한 프레임 데이터 압축
- **토큰 사용량 추적**: 프레임별 및 전체 토큰 사용량 실시간 모니터링
- **코드 블록 검증**: Markdown/Mermaid 코드 블록 자동 닫힘 검증 및 수정
- **빈 콘텐츠 필터링**: 실제 내용이 없는 프레임은 목차 및 결과에서 자동 제외
- **상태 유지**: 탭 전환, 선택 변경 시에도 변환 작업 유지

---

## Supported LLM Providers

| Provider | 필요 설정 | 비고 |
|----------|-----------|------|
| **OpenAI** | API Key, Model Name | GPT-4o, GPT-4, GPT-3.5-turbo 등 |
| **Claude** | API Key, Model Name | Claude Sonnet 4, Claude 3 Opus 등 |
| **Gemini** | API Key, Model Name | Gemini 2.0 Flash, Gemini Pro 등 |
| **Groq** | API Key, Model Name | Llama 3.3 70B, Mixtral 등 (빠른 추론) |
| **Azure OpenAI** | Endpoint, API Key, Deployment Name, API Version | 기업용 |
| **Ollama** | Endpoint, Model Name | 로컬 LLM (무료) |

---

## Installation

### Figma Community (권장)

1. [Figma Community 페이지](https://www.figma.com/community/plugin/1596085205777675212) 방문
2. **"Install"** 버튼 클릭

### 수동 설치 (개발용)

```bash
# 저장소 클론
git clone https://github.com/leonardo204/figma-to-markdown.git
cd figma-to-markdown

# 의존성 설치
npm install

# 빌드
npm run build
```

Figma Desktop에서:
1. Plugins → Development → **Import plugin from manifest...**
2. 프로젝트의 `manifest.json` 파일 선택

---

## Usage

### 1. LLM 설정

1. Figma에서 플러그인 실행
2. **설정** 탭에서 LLM 제공업체 선택
3. API Key 및 설정 입력
4. **연결 테스트** → **저장**

### 2. Markdown 변환

1. Figma에서 프레임 선택 (단일 또는 다중)
2. **변환** 탭에서 번역 언어 선택 (선택사항)
3. **"Markdown으로 변환"** 클릭
4. 완료 후 **"클립보드에 복사"**
5. Confluence에 붙여넣기

### 3. 프롬프트 커스터마이징 (고급)

1. **변환** 탭에서 **"고급 설정"** 클릭하여 펼침
2. 시스템 프롬프트 직접 수정
3. **"저장"** 클릭하여 다음 변환부터 적용
4. **"초기화"**로 기본 프롬프트 복원

> 💡 커스텀 프롬프트는 Figma에 로컬 저장되어 다음 세션에서도 유지됩니다.

### 지원하는 노드 타입

- **텍스트**: 폰트 크기, 두께 감지하여 헤딩 레벨 자동 결정
- **프레임/컴포넌트**: 계층 구조 분석
- **Auto Layout**: 레이아웃 방향 인식 (HORIZONTAL/VERTICAL)
- **그룹/섹션**: 자식 프레임 자동 펼침
- **도형**: Rectangle, Ellipse, Line, Arrow 등
- **이미지**: Base64 인라인 이미지로 자동 변환 (크기 자동 최적화)

---

## Development

```bash
# 개발 모드 (파일 변경 감지)
npm run dev

# 빌드
npm run build

# 타입 체크
npm run typecheck
```

### 프로젝트 구조

```
figma-to-markdown/
├── manifest.json              # Figma 플러그인 설정
├── package.json
├── build.mjs                  # esbuild 빌드 스크립트
├── src/
│   ├── code.ts                # Figma API (메인 스레드)
│   ├── ui.tsx                 # React UI 진입점
│   ├── types/                 # TypeScript 타입 정의
│   │   ├── index.ts
│   │   ├── figma.ts
│   │   └── llm.ts
│   ├── services/              # 비즈니스 로직
│   │   ├── storage.ts         # 설정 저장소 (clientStorage)
│   │   ├── llm-client.ts      # LLM API 클라이언트
│   │   ├── markdown-converter.ts  # 변환 로직
│   │   └── markdown-merger.ts # 결과 병합
│   ├── components/            # React 컴포넌트
│   │   ├── App.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── ConversionPanel.tsx
│   │   └── MarkdownPreview.tsx  # Mermaid 지원 미리보기
│   └── prompts/               # LLM 프롬프트
│       ├── markdown-conversion.ts
│       └── translation.ts
├── build/                     # 빌드 출력
└── dist/                      # 배포 에셋 (아이콘, 커버)
```

---

## API Key 발급

### OpenAI
1. [platform.openai.com](https://platform.openai.com) → API Keys
2. `sk-`로 시작하는 키 생성

### Claude (Anthropic)
1. [console.anthropic.com](https://console.anthropic.com) → API Keys
2. `sk-ant-`로 시작하는 키 생성

### Gemini (Google)
1. [aistudio.google.com](https://aistudio.google.com/apikey) → Get API Key
2. API 키 생성 및 복사

### Groq
1. [console.groq.com](https://console.groq.com/keys) → API Keys
2. `gsk_`로 시작하는 키 생성

### Azure OpenAI
1. Azure Portal에서 OpenAI 리소스 생성
2. 모델 배포 후 Endpoint, Key, Deployment Name 확인

### Ollama (로컬/무료)
1. [ollama.ai](https://ollama.ai) 에서 설치
2. `ollama run llama3` 로 모델 다운로드
3. Endpoint: `http://localhost:11434`

---

## Privacy

- API 키는 Figma의 로컬 clientStorage에만 저장
- 프레임 데이터는 설정된 LLM 제공업체에만 전송
- 플러그인 자체에서 데이터 수집 없음

---

## License

MIT

---

## Contributing

이슈 및 PR 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

# Figma to Markdown

Figma 프레임을 Confluence용 Markdown으로 변환하는 플러그인

## 기능

- **Figma 프레임 → Markdown 변환**: 선택한 프레임의 텍스트, 구조, 레이아웃을 분석하여 Markdown 문서 생성
- **Mermaid 다이어그램 자동 생성**: 화면 흐름, 프로세스 등을 Mermaid 차트로 표현
- **다국어 번역**: 영어, 한국어, 일본어, 중국어 등 다양한 언어로 번역
- **클립보드 복사**: 생성된 Markdown을 바로 Confluence에 붙여넣기

## 지원 LLM 제공업체

| 제공업체 | 필요 설정 |
|----------|-----------|
| OpenAI | API Key, Model Name |
| Claude (Anthropic) | API Key, Model Name |
| Azure OpenAI | Endpoint, API Key, Deployment Name, API Version |
| Ollama (로컬) | Endpoint, Model Name |

## 설치 방법

### 1. 플러그인 빌드

```bash
# 저장소 클론
git clone <repository-url>
cd figma-to-markdown

# 의존성 설치
npm install

# 빌드
npm run build
```

### 2. Figma에 플러그인 설치

1. Figma Desktop 앱 실행
2. 메뉴 → Plugins → Development → Import plugin from manifest...
3. 이 프로젝트의 `manifest.json` 파일 선택

### 3. LLM 설정

1. Figma에서 플러그인 실행: Plugins → Figma to Markdown
2. Settings 탭에서 LLM 제공업체 선택
3. API Key 및 기타 설정 입력
4. "연결 테스트" 버튼으로 연결 확인
5. "저장" 버튼 클릭

## 사용 방법

1. Figma에서 변환할 프레임 선택 (여러 개 선택 가능)
2. 우클릭 → Plugins → Figma to Markdown → Convert to Markdown
3. 필요시 번역 언어 선택
4. "Markdown으로 변환" 버튼 클릭
5. 결과 확인 후 "클립보드에 복사" 버튼 클릭
6. Confluence에 붙여넣기

## 개발

```bash
# 개발 모드 (파일 변경 감지)
npm run dev

# 또는
npm run watch
```

## 프로젝트 구조

```
figma-to-markdown/
├── manifest.json          # Figma 플러그인 설정
├── package.json
├── tsconfig.json
├── build.mjs              # esbuild 빌드 스크립트
├── src/
│   ├── code.ts            # Figma API 접근 (메인 스레드)
│   ├── ui.tsx             # React UI 진입점
│   ├── types/             # TypeScript 타입 정의
│   ├── services/          # 비즈니스 로직
│   │   ├── storage.ts     # 설정 저장소
│   │   ├── llm-client.ts  # LLM API 클라이언트
│   │   └── markdown-converter.ts
│   ├── components/        # React 컴포넌트
│   │   ├── App.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── ConversionPanel.tsx
│   └── prompts/           # LLM 프롬프트
└── build/                 # 빌드 출력
    ├── code.js
    └── ui.html
```

## API Key 발급 가이드

### OpenAI
1. https://platform.openai.com 접속
2. API Keys 메뉴에서 새 키 생성
3. `sk-` 로 시작하는 키 복사

### Claude (Anthropic)
1. https://console.anthropic.com 접속
2. API Keys 메뉴에서 새 키 생성
3. `sk-ant-` 로 시작하는 키 복사

### Azure OpenAI
1. Azure Portal에서 OpenAI 리소스 생성
2. 모델 배포 후 Endpoint와 Key 확인
3. Deployment Name과 API Version 확인

### Ollama (로컬)
1. https://ollama.ai 에서 Ollama 설치
2. `ollama run llama3` 등으로 모델 다운로드
3. Endpoint는 기본값 `http://localhost:11434` 사용

## 라이선스

MIT

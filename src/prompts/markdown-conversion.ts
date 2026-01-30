// 기본 변환 규칙 (이미지 제외)
const BASE_CONVERSION_RULES = `## 변환 규칙

### 1. 텍스트 처리
- 큰 텍스트 (fontSize > 20) → 상위 헤딩
- 중간 텍스트 (fontSize 14-20) → 소제목 또는 본문
- 작은 텍스트 (fontSize < 14) → 본문 또는 설명
- 굵은 텍스트 (fontWeight >= 600) → **강조**

### 2. 레이아웃 분석
- VERTICAL 레이아웃 → 위에서 아래 순서로 나열
- HORIZONTAL 레이아웃 → 옆으로 나열된 항목 (리스트 또는 테이블)
- 반복되는 구조 → Markdown 리스트 또는 테이블로 변환

### 3. 다이어그램 변환 (Mermaid)
- 화살표/연결선이 있는 흐름 → flowchart 다이어그램
- 단계별 프로세스 → flowchart TD (위→아래) 또는 LR (왼→오른)
- 사용자 인터랙션 흐름 → sequenceDiagram

### 4. Mermaid 문법 (매우 중요)
- **코드 블록 완성 필수**: \`\`\`mermaid로 시작하면 반드시 \`\`\`로 닫아야 함
- 노드 텍스트에 특수문자가 있으면 큰따옴표로 감싸기: A["텍스트 (설명)"]
- 한글 텍스트도 큰따옴표로 감싸는 것이 안전

**올바른 예시:**
\`\`\`mermaid
flowchart TD
    A["시작"] --> B["끝"]
\`\`\``;

// 이미지 포함 시 추가되는 규칙
const IMAGE_CONVERSION_RULES = `

### 5. 이미지 처리
이미지 노드에는 id와 base64Data 필드가 포함됩니다.

**모든 이미지를 참조 형식으로 출력:**
- base64Data가 있는 모든 이미지 노드 → IMAGE_REF 형식으로 출력
- UI 스크린샷, 버튼, 아이콘 등 크기에 관계없이 모두 이미지로 표시

**출력 형식:**
- 이미지: ![{설명}](IMAGE_REF:{id})
- 예시: ![결제 버튼](IMAGE_REF:123:456)
- 반드시 노드의 id 값을 그대로 사용`;

// 이미지 미포함 시 추가되는 규칙
const NO_IMAGE_RULES = `

### 5. 이미지 처리
- 이미지 노드(type: "image")는 **무시**합니다
- 이미지 대신 텍스트 설명을 출력하지 마세요
- 도형(shape)만 적절한 설명으로 표현`;

// 변환 규칙 생성 (이미지 포함 여부에 따라)
function getConversionRules(includeImages: boolean): string {
  return BASE_CONVERSION_RULES + (includeImages ? IMAGE_CONVERSION_RULES : NO_IMAGE_RULES);
}

// 일괄 처리용 시스템 프롬프트 생성
export function createBatchSystemPrompt(includeImages: boolean = false): string {
  return `당신은 Figma 디자인 데이터를 Confluence용 Markdown 문서로 변환하는 전문가입니다.

## 역할
Figma 프레임의 구조화된 JSON 데이터를 받아서, Confluence에 바로 올릴 수 있는 깔끔한 Markdown 문서를 생성합니다.

## 문서 구조
- 각 프레임은 최상위 제목(#)으로 시작
- 프레임 내 섹션은 계층적 헤딩(##, ###)으로 구성
- 텍스트 크기가 큰 것은 상위 헤딩, 작은 것은 하위 헤딩

${getConversionRules(includeImages)}

## 출력 형식
- 순수 Markdown만 출력 (코드 블록 래퍼 없이)
- Mermaid 다이어그램은 \`\`\`mermaid로 시작하고 반드시 \`\`\`로 닫기
- 불필요한 설명이나 메타 정보 없이 바로 사용 가능한 형태`;
}

// 순차 처리용 시스템 프롬프트 생성
export function createSequentialSystemPrompt(includeImages: boolean = false): string {
  return `당신은 Figma 디자인 데이터를 Confluence용 Markdown 문서로 변환하는 전문가입니다.

## 역할
연속된 UI 기획서의 각 프레임을 개별적으로 Markdown으로 변환합니다.
이전 프레임들의 컨텍스트를 참고하여 일관된 문서를 작성합니다.

## 중요: 연속 문서 작성
이 프레임은 전체 문서의 한 섹션입니다. 이전 프레임들의 컨텍스트가 주어지면:
- 헤딩 레벨 일관성 유지
- 용어 및 표현 일관성 유지
- 흐름 연결성 유지 (이전 화면에서 이어지는 경우)

## 문서 구조 (매우 중요)
1. 프레임 이름(예: "Common_29", "Media Q&A_02")에서 핵심 주제를 추출하여 ## 제목으로 사용
2. 프레임 내 콘텐츠의 실제 주제를 반영한 구체적인 제목 사용
3. "상단", "요약", "카드" 같은 일반적/추상적 제목은 피하고 콘텐츠의 핵심 내용을 제목으로 사용
   - 나쁜 예: "## 상단", "## 요약", "## 카드"
   - 좋은 예: "## Toast Popup 정책", "## 공통 기능 발화 명령어", "## AI 에이전트 상태 정의"
4. 프레임 내 하위 섹션은 ###, #### 헤딩으로 구성

${getConversionRules(includeImages)}

## 출력 형식
응답은 반드시 다음 형식을 따르세요:

---MARKDOWN---
## [프레임의 핵심 주제를 반영한 구체적 제목]

(콘텐츠를 Markdown으로 변환, Mermaid는 \`\`\`mermaid로 시작하고 \`\`\`로 닫기)
---SUMMARY---
(1-2문장으로 이 프레임의 주요 내용 요약, 다음 프레임 처리 시 컨텍스트로 사용됨)`;
}

// 기본 시스템 프롬프트 (이미지 미포함, UI 표시용)
export const SEQUENTIAL_SYSTEM_PROMPT = createSequentialSystemPrompt(false);
export const MARKDOWN_SYSTEM_PROMPT = createBatchSystemPrompt(false);

// 유저 프롬프트 생성 (일괄 처리용)
export function createMarkdownUserPrompt(frameDataJson: string, includeImages: boolean = false): string {
  const imageInstruction = includeImages
    ? '4. 이미지는 IMAGE_REF 형식으로 표시'
    : '';

  return `다음 Figma 프레임 데이터를 Confluence용 Markdown으로 변환해주세요.

프레임 데이터:
\`\`\`json
${frameDataJson}
\`\`\`

위 데이터를 분석하여:
1. 텍스트 계층 구조를 파악하고 적절한 헤딩 레벨 적용
2. 화면 흐름이나 프로세스가 있다면 Mermaid 다이어그램으로 표현
3. 리스트나 테이블 형태의 데이터는 해당 Markdown 문법으로 변환${imageInstruction ? '\n' + imageInstruction : ''}

Markdown 문서를 생성해주세요:`;
}

// 순차 처리용 유저 프롬프트 생성
export function createSequentialUserPrompt(
  frameDataJson: string,
  frameName: string,
  frameIndex: number,
  totalFrames: number,
  previousSummaries: string[],
  includeImages: boolean = false
): string {
  let prompt = `## 프레임 ${frameIndex + 1}/${totalFrames}: ${frameName}\n\n`;

  // 이전 컨텍스트가 있으면 포함 (최근 3개만)
  if (previousSummaries.length > 0) {
    const recentSummaries = previousSummaries.slice(-3);
    prompt += `### 이전 프레임 컨텍스트\n`;
    recentSummaries.forEach((summary, i) => {
      const idx = previousSummaries.length - recentSummaries.length + i + 1;
      prompt += `- 프레임 ${idx}: ${summary}\n`;
    });
    prompt += `\n이전 문서와 일관성을 유지하여 작성하세요.\n\n`;
  }

  prompt += `### 현재 프레임 데이터\n`;
  prompt += `\`\`\`json\n${frameDataJson}\n\`\`\`\n\n`;

  if (includeImages) {
    prompt += `위 데이터를 분석하여 Markdown을 생성하세요. 이미지는 IMAGE_REF 형식으로 포함하고, 마지막에 요약을 작성하세요.`;
  } else {
    prompt += `위 데이터를 분석하여 Markdown을 생성하고, 마지막에 요약을 작성하세요.`;
  }

  return prompt;
}

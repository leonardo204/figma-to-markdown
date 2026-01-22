import type { TranslationLanguage } from '../types';

export const TRANSLATION_SYSTEM_PROMPT = `당신은 기술 문서 번역 전문가입니다.

## 역할
Markdown 문서를 지정된 언어로 번역합니다.

## 번역 규칙

### 1. 유지해야 할 요소 (번역하지 않음)
- Markdown 문법 (##, **, \`\`\`, 등)
- Mermaid 다이어그램 코드 블록의 키워드 (flowchart, sequenceDiagram, participant 등)
- 코드 블록 내 프로그래밍 코드
- URL 및 링크
- 기술 용어 및 고유명사 (필요시 괄호 안에 원문 유지)

### 2. 번역해야 할 요소
- 제목 및 본문 텍스트
- Mermaid 다이어그램 내 노드 텍스트 (한글 → 대상 언어)
- 설명문 및 주석

### 3. Mermaid 번역 주의사항
- 노드 텍스트 번역 시 특수문자 주의
- 번역된 텍스트는 큰따옴표로 감싸기: A["Translated Text"]
- 화살표 텍스트도 번역: A -->|"translated label"| B

### 4. 품질 기준
- 자연스러운 대상 언어 표현 사용
- 기술 문서 스타일 유지
- 일관된 용어 사용

## 출력 형식
- 번역된 Markdown만 출력
- 원본과 동일한 구조 유지
- 추가 설명이나 메타 정보 없이 바로 사용 가능한 형태`;

const LANGUAGE_NAMES: Record<TranslationLanguage, string> = {
  none: '',
  en: 'English',
  ko: 'Korean (한국어)',
  ja: 'Japanese (日本語)',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  de: 'German (Deutsch)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
};

export function createTranslationPrompt(
  markdown: string,
  targetLanguage: TranslationLanguage
): string {
  const languageName = LANGUAGE_NAMES[targetLanguage];

  return `다음 Markdown 문서를 ${languageName}로 번역해주세요.

원본 문서:
${markdown}

위 문서를 ${languageName}로 번역해주세요. Markdown 문법과 Mermaid 다이어그램 구조는 유지하고, 텍스트 내용만 번역합니다.`;
}

import type { FrameConversionResult } from '../types';

export interface MergeOptions {
  frameResults: FrameConversionResult[];
  documentTitle?: string;
  addTableOfContents?: boolean;
}

// 프레임별 결과를 하나의 Markdown으로 병합
export function mergeMarkdownResults(options: MergeOptions): string {
  const { frameResults, documentTitle, addTableOfContents = false } = options;

  if (frameResults.length === 0) {
    return '';
  }

  // 단일 프레임이면 그대로 반환
  if (frameResults.length === 1) {
    return frameResults[0].markdown;
  }

  const sections: string[] = [];

  // 1. 문서 제목 (첫 프레임의 첫 번째 헤딩 또는 지정된 제목)
  const title = documentTitle || extractFirstHeading(frameResults[0].markdown);
  if (title) {
    sections.push(`# ${title}\n`);
  }

  // 2. 목차 생성 (4개 이상 프레임일 때)
  if (addTableOfContents && frameResults.length >= 4) {
    sections.push(generateTableOfContents(frameResults));
  }

  // 3. 각 프레임 결과 병합
  for (let i = 0; i < frameResults.length; i++) {
    const result = frameResults[i];
    let markdown = result.markdown.trim();

    // 첫 프레임에서 최상위 헤딩 제거 (문서 제목으로 이미 사용됨)
    if (i === 0 && title) {
      markdown = removeFirstHeading(markdown);
    }

    // 프레임 간 구분선
    if (i > 0) {
      sections.push('\n---\n');
    }

    sections.push(markdown);
  }

  // 연속 빈 줄 정리
  return cleanupMarkdown(sections.join('\n\n'));
}

// 첫 번째 헤딩(# 또는 ##) 텍스트 추출
function extractFirstHeading(markdown: string): string | null {
  const match = markdown.match(/^#{1,2}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// 첫 번째 헤딩 제거
function removeFirstHeading(markdown: string): string {
  return markdown.replace(/^#{1,2}\s+.+\n?/, '').trim();
}

// 목차 생성
function generateTableOfContents(results: FrameConversionResult[]): string {
  let toc = '## 목차\n\n';

  for (const result of results) {
    const title = extractFirstHeading(result.markdown) || result.frameName;
    const anchor = createAnchor(title);
    toc += `- [${title}](#${anchor})\n`;
  }

  return toc;
}

// Markdown 앵커 생성 (GitHub/Confluence 호환)
function createAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// 코드 블록 닫힘 검증 및 수정
function fixUnclosedCodeBlocks(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 코드 블록 시작 감지 (```로 시작, 언어 지정 가능)
    if (trimmed.startsWith('```') && !inCodeBlock) {
      inCodeBlock = true;
      codeBlockLang = trimmed.slice(3).trim();
      result.push(line);
      continue;
    }

    // 코드 블록 종료 감지 (정확히 ```)
    if (trimmed === '```' && inCodeBlock) {
      inCodeBlock = false;
      codeBlockLang = '';
      result.push(line);
      continue;
    }

    // 다음 코드 블록 시작 전에 현재 블록이 닫히지 않은 경우
    if (trimmed.startsWith('```') && inCodeBlock) {
      // 이전 코드 블록 닫기
      result.push('```');
      inCodeBlock = true;
      codeBlockLang = trimmed.slice(3).trim();
      result.push(line);
      continue;
    }

    result.push(line);
  }

  // 파일 끝에 닫히지 않은 코드 블록이 있으면 닫기
  if (inCodeBlock) {
    result.push('```');
  }

  return result.join('\n');
}

// Markdown 정리 (연속 빈 줄 제거 + 코드 블록 검증)
function cleanupMarkdown(markdown: string): string {
  let cleaned = markdown
    .replace(/\n{3,}/g, '\n\n') // 3줄 이상 빈 줄 → 2줄
    .trim();

  // 코드 블록 닫힘 검증 및 수정
  cleaned = fixUnclosedCodeBlocks(cleaned);

  return cleaned;
}

// 토큰 사용량 합산
export function aggregateTokenUsage(
  results: FrameConversionResult[]
): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined {
  const usages = results.filter((r) => r.usage).map((r) => r.usage!);

  if (usages.length === 0) {
    return undefined;
  }

  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      completionTokens: acc.completionTokens + usage.completionTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

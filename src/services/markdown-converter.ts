import type { ExtractedFrame, ExtractedNode, ExtractedImageNode } from '../types/figma';
import type {
  LLMConfig,
  TranslationLanguage,
  FrameConversionResult,
  SequentialProgress,
  SequentialConversionResult,
} from '../types';
import { callLLM } from './llm-client';
import {
  MARKDOWN_SYSTEM_PROMPT,
  SEQUENTIAL_SYSTEM_PROMPT,
  createBatchSystemPrompt,
  createSequentialSystemPrompt,
  createMarkdownUserPrompt,
  createSequentialUserPrompt,
} from '../prompts/markdown-conversion';

// 기본 프롬프트 내보내기 (UI에서 표시용)
export { MARKDOWN_SYSTEM_PROMPT, SEQUENTIAL_SYSTEM_PROMPT };
import { TRANSLATION_SYSTEM_PROMPT, createTranslationPrompt } from '../prompts/translation';
import { mergeMarkdownResults, aggregateTokenUsage, regenerateTableOfContents } from './markdown-merger';

// 요청 간 딜레이 (ms) - Rate limit 회피용
const REQUEST_DELAY_MS = 3000;

// 번역 chunk 크기 (대략적인 문자 수 기준, 토큰 limit 회피용)
// 4000자 정도로 설정 (한글 기준 약 2000~3000 토큰)
const TRANSLATION_CHUNK_SIZE = 4000;

// 이미지 참조 정보
interface ImageRefData {
  id: string;
  fileName: string;
}

// 단일 프레임에서 이미지 참조 수집
function collectImageRefsFromFrame(frame: ExtractedFrame): ImageRefData[] {
  const images: ImageRefData[] = [];

  function collectImages(node: ExtractedNode) {
    if (node.type === 'image') {
      const imageNode = node as ExtractedImageNode;
      if (imageNode.fileName) {
        images.push({
          id: imageNode.id,
          fileName: imageNode.fileName,
        });
      }
    }

    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach(collectImages);
    }
  }

  frame.children.forEach(collectImages);
  return images;
}

// IMAGE_REF:nodeId를 실제 파일 경로로 치환
function replaceImageReferences(markdown: string, images: ImageRefData[]): string {
  let result = markdown;

  // ![설명](IMAGE_REF:nodeId) 패턴 매칭 → 상대 경로로 치환
  result = result.replace(
    /!\[([^\]]*)\]\(IMAGE_REF:([^)]+)\)/g,
    (match, description, nodeId) => {
      const image = images.find((img) => img.id === nodeId);
      if (image) {
        return `![${description}](${image.fileName})`;
      }
      // 이미지 파일이 없으면 그대로 유지 (나중에 매핑 가능)
      return match;
    }
  );

  return result;
}

// 닫히지 않은 Mermaid 코드 블록 수정 (라인 단위 처리)
function fixUnclosedMermaidBlocks(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inMermaidBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // mermaid 코드 블록 시작 감지
    if (trimmed.startsWith('```mermaid') && !inMermaidBlock) {
      inMermaidBlock = true;
      result.push(line);
      continue;
    }

    // 코드 블록 종료 감지 (정확히 ```)
    if (trimmed === '```' && inMermaidBlock) {
      inMermaidBlock = false;
      result.push(line);
      continue;
    }

    // mermaid 블록 안에서 블록을 끝내야 하는 패턴 감지
    if (inMermaidBlock) {
      // ## 또는 # 헤더
      if (/^#{1,6}\s+/.test(trimmed)) {
        result.push('```');
        inMermaidBlock = false;
        result.push(line);
        continue;
      }

      // --- 또는 *** 구분선 (markdown horizontal rule)
      if (/^[-*_]{3,}$/.test(trimmed)) {
        result.push('```');
        inMermaidBlock = false;
        result.push(line);
        continue;
      }

      // 다른 코드 블록 시작
      if (trimmed.startsWith('```') && !trimmed.startsWith('```mermaid')) {
        result.push('```');
        inMermaidBlock = false;
        // 새 코드 블록은 추가하지 않음 (다음 반복에서 처리)
      }
    }

    result.push(line);
  }

  // 파일 끝에 닫히지 않은 블록이 있으면 닫기
  if (inMermaidBlock) {
    result.push('```');
  }

  return result.join('\n');
}

// 딜레이 함수
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Markdown을 섹션별로 분할 (## 제목 기준)
function splitMarkdownIntoChunks(markdown: string): string[] {
  const chunks: string[] = [];

  // ## 헤더로 섹션 분할
  const sectionPattern = /^(## .+)$/gm;
  const sections: { title: string; content: string; startIndex: number }[] = [];

  let match;
  while ((match = sectionPattern.exec(markdown)) !== null) {
    sections.push({
      title: match[1],
      content: '',
      startIndex: match.index,
    });
  }

  // 섹션 내용 추출
  if (sections.length === 0) {
    // 섹션이 없으면 전체를 하나의 chunk로
    if (markdown.length > TRANSLATION_CHUNK_SIZE) {
      // 그래도 너무 크면 강제로 분할
      return splitBySize(markdown, TRANSLATION_CHUNK_SIZE);
    }
    return [markdown];
  }

  // 첫 섹션 이전 내용 (제목, 목차 등)
  const preamble = markdown.slice(0, sections[0].startIndex).trim();

  // 각 섹션 내용 추출
  for (let i = 0; i < sections.length; i++) {
    const endIndex = i < sections.length - 1
      ? sections[i + 1].startIndex
      : markdown.length;
    sections[i].content = markdown.slice(sections[i].startIndex, endIndex);
  }

  // chunk 구성 (크기 기준으로 병합)
  let currentChunk = preamble ? preamble + '\n\n' : '';

  for (const section of sections) {
    // 현재 chunk에 추가했을 때 크기 초과하면 새 chunk 시작
    if (currentChunk.length + section.content.length > TRANSLATION_CHUNK_SIZE) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // 섹션 자체가 너무 크면 강제 분할
      if (section.content.length > TRANSLATION_CHUNK_SIZE) {
        const subChunks = splitBySize(section.content, TRANSLATION_CHUNK_SIZE);
        chunks.push(...subChunks);
        currentChunk = '';
      } else {
        currentChunk = section.content;
      }
    } else {
      currentChunk += section.content;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// 크기 기준으로 텍스트 분할 (줄바꿈 기준)
function splitBySize(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxSize && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// 노드 데이터 간소화 (position, size 제거, 텍스트와 구조만 유지)
function simplifyNode(node: ExtractedNode, includeImages: boolean): Record<string, unknown> | null {
  // 이미지 포함 안 할 때는 이미지 노드 제외
  if (node.type === 'image' && !includeImages) {
    return null;
  }

  const simplified: Record<string, unknown> = {
    type: node.type,
    name: node.name,
  };

  // 텍스트 노드: 텍스트 내용과 스타일 정보만 유지
  if (node.type === 'text') {
    const textNode = node as ExtractedNode & { characters?: string; fontSize?: number; fontWeight?: number };
    simplified.characters = textNode.characters;
    if (textNode.fontSize) simplified.fontSize = textNode.fontSize;
    if (textNode.fontWeight) simplified.fontWeight = textNode.fontWeight;
  }

  // 이미지 노드: id 유지 (후처리에서 파일 경로 치환용)
  if (node.type === 'image') {
    simplified.id = node.id;
    // fileName이 있으면 표시 (이미지 포함됨을 표시)
    const imageNode = node as ExtractedImageNode;
    if (imageNode.fileName) {
      simplified.hasImage = true;
    }
  }

  // 컨테이너 노드: 자식만 재귀적으로 간소화
  if ('children' in node && Array.isArray(node.children)) {
    const simplifiedChildren = node.children
      .map((child) => simplifyNode(child, includeImages))
      .filter((child): child is Record<string, unknown> => child !== null);
    simplified.children = simplifiedChildren;
  }

  // 레이아웃 모드 (구조 파악에 유용)
  if ('layoutMode' in node && node.layoutMode) {
    simplified.layoutMode = node.layoutMode;
  }

  // 도형 타입 (구조 파악에 유용)
  if (node.type === 'shape' && 'shapeType' in node) {
    simplified.shapeType = (node as ExtractedNode & { shapeType: string }).shapeType;
  }

  return simplified;
}

// 프레임 데이터 간소화
function simplifyFrameData(frame: ExtractedFrame, includeImages: boolean): Record<string, unknown> {
  const simplifiedChildren = frame.children
    .map((child) => simplifyNode(child, includeImages))
    .filter((child): child is Record<string, unknown> => child !== null);

  return {
    name: frame.name,
    children: simplifiedChildren,
  };
}

export interface ConversionOptions {
  config: LLMConfig;
  frames: ExtractedFrame[];
  translateTo: TranslationLanguage;
  includeImages?: boolean; // 이미지 포함 여부
  customPrompt?: string; // 사용자 커스텀 프롬프트
  onProgress?: (status: string) => void;
  onRetryWait?: (remainingSeconds: number) => void;
  onFrameProgress?: (progress: SequentialProgress) => void;
}

export interface ConversionResult {
  markdown: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  frameResults?: FrameConversionResult[];
  failedFrames?: Array<{ frameName: string; error: string }>;
}

// LLM 응답에서 코드 블록 래퍼 제거
function stripCodeBlockWrapper(text: string): string {
  let result = text.trim();

  // ```markdown 또는 ```md로 시작하는 경우 제거
  const startPattern = /^```(?:markdown|md)?\s*\n?/i;
  if (startPattern.test(result)) {
    result = result.replace(startPattern, '');
  }

  // 마지막 ```제거
  const endPattern = /\n?```\s*$/;
  if (endPattern.test(result)) {
    result = result.replace(endPattern, '');
  }

  return result.trim();
}

// 순차 처리 임계값 (이 수 이상이면 순차 처리)
// Rate limit 회피를 위해 항상 순차 처리
const SEQUENTIAL_THRESHOLD = 1;

// Figma 프레임 데이터를 Markdown으로 변환 (자동 전환)
export async function convertToMarkdown(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { frames } = options;

  // 프레임 수에 따라 자동 전환
  if (frames.length >= SEQUENTIAL_THRESHOLD) {
    return convertToMarkdownSequential(options);
  }

  return convertToMarkdownBatch(options);
}

// 모든 프레임에서 이미지 참조 수집
function collectAllImageRefs(frames: ExtractedFrame[]): ImageRefData[] {
  const images: ImageRefData[] = [];
  for (const frame of frames) {
    images.push(...collectImageRefsFromFrame(frame));
  }
  return images;
}

// 일괄 처리 (3개 이하 프레임)
async function convertToMarkdownBatch(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { config, frames, translateTo, includeImages = false, customPrompt, onProgress, onRetryWait } = options;

  // 커스텀 프롬프트가 있으면 사용, 없으면 동적 생성
  const systemPrompt = customPrompt || createBatchSystemPrompt(includeImages);

  // 이미지 참조 데이터 수집 (후처리용, 이미지 포함 시에만)
  const images = includeImages ? collectAllImageRefs(frames) : [];

  // 1단계: 프레임 데이터를 JSON으로 직렬화
  onProgress?.('프레임 데이터 분석 중...');
  const frameDataJson = JSON.stringify(frames, null, 2);

  // 2단계: LLM에 Markdown 변환 요청
  onProgress?.('Markdown 변환 중...');
  const markdownResponse = await callLLM(config, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: createMarkdownUserPrompt(frameDataJson, includeImages) },
    ],
    maxTokens: 8192,
    temperature: 0.3,
    onRetryWait,
  });

  let markdown = stripCodeBlockWrapper(markdownResponse.content);

  // 후처리: Mermaid 코드 블록 닫기 수정
  markdown = fixUnclosedMermaidBlocks(markdown);

  // 후처리: 이미지 참조를 실제 파일 경로로 치환 (이미지 포함 시에만)
  if (includeImages) {
    markdown = replaceImageReferences(markdown, images);
  }

  // 목차 재생성 (실제 헤딩 기반으로 일관성 보장)
  markdown = regenerateTableOfContents(markdown);

  let totalUsage = markdownResponse.usage;

  // 3단계: 번역 (필요한 경우) - chunk 처리로 큰 문서도 번역 가능
  if (translateTo !== 'none') {
    const translationChunks = splitMarkdownIntoChunks(markdown);

    if (translationChunks.length === 1) {
      // chunk가 1개면 기존 방식으로 번역
      onProgress?.(`${translateTo}로 번역 중...`);
      const translationResponse = await callLLM(config, {
        messages: [
          { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: createTranslationPrompt(markdown, translateTo) },
        ],
        maxTokens: 8192,
        temperature: 0.3,
        onRetryWait,
      });

      markdown = stripCodeBlockWrapper(translationResponse.content);

      // 토큰 사용량 합산
      if (totalUsage && translationResponse.usage) {
        totalUsage = {
          promptTokens: totalUsage.promptTokens + translationResponse.usage.promptTokens,
          completionTokens:
            totalUsage.completionTokens + translationResponse.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + translationResponse.usage.totalTokens,
        };
      }
    } else {
      // 여러 chunk인 경우 순차 번역
      const translatedChunks: string[] = [];

      for (let i = 0; i < translationChunks.length; i++) {
        const chunk = translationChunks[i];
        onProgress?.(`${translateTo}로 번역 중... (${i + 1}/${translationChunks.length})`);

        const translationResponse = await callLLM(config, {
          messages: [
            { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
            { role: 'user', content: createTranslationPrompt(chunk, translateTo) },
          ],
          maxTokens: 8192,
          temperature: 0.3,
          onRetryWait,
        });

        translatedChunks.push(stripCodeBlockWrapper(translationResponse.content));

        // 토큰 사용량 합산
        if (totalUsage && translationResponse.usage) {
          totalUsage = {
            promptTokens: totalUsage.promptTokens + translationResponse.usage.promptTokens,
            completionTokens:
              totalUsage.completionTokens + translationResponse.usage.completionTokens,
            totalTokens: totalUsage.totalTokens + translationResponse.usage.totalTokens,
          };
        }

        // Rate limit 회피를 위한 딜레이 (마지막 chunk 제외)
        if (i < translationChunks.length - 1) {
          await delay(REQUEST_DELAY_MS);
        }
      }

      // 번역된 chunk들 병합
      markdown = translatedChunks.join('\n\n');
    }

    // 번역 후 목차 재생성 (chunk별 번역으로 인한 제목 불일치 해결)
    markdown = regenerateTableOfContents(markdown);

    // 번역 후 mermaid 블록 수정 (번역 과정에서 코드 블록이 손상될 수 있음)
    markdown = fixUnclosedMermaidBlocks(markdown);
  }

  onProgress?.('완료!');

  return {
    markdown,
    usage: totalUsage,
  };
}

// 순차 처리 응답 파싱
function parseSequentialResponse(response: string): { markdown: string; summary: string } {
  const markdownMatch = response.match(/---MARKDOWN---\s*([\s\S]*?)\s*---SUMMARY---/);
  const summaryMatch = response.match(/---SUMMARY---\s*([\s\S]*)$/);

  if (markdownMatch && summaryMatch) {
    return {
      markdown: stripCodeBlockWrapper(markdownMatch[1].trim()),
      summary: summaryMatch[1].trim(),
    };
  }

  // 형식이 맞지 않으면 전체를 markdown으로 처리
  return {
    markdown: stripCodeBlockWrapper(response),
    summary: '(요약 없음)',
  };
}

// 순차 처리 (4개 이상 프레임)
async function convertToMarkdownSequential(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { config, frames, translateTo, includeImages = false, customPrompt, onProgress, onRetryWait, onFrameProgress } = options;

  // 커스텀 프롬프트가 있으면 사용, 없으면 동적 생성
  const systemPrompt = customPrompt || createSequentialSystemPrompt(includeImages);

  const results: FrameConversionResult[] = [];
  const failedFrames: Array<{ frameName: string; error: string }> = [];
  const summaries: string[] = [];

  // 각 프레임 순차 처리
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // 이 프레임의 이미지 참조 수집 (프레임별 이미지 치환용, 이미지 포함 시에만)
    const frameImages = includeImages ? collectImageRefsFromFrame(frame) : [];

    // 진행률 콜백
    onFrameProgress?.({
      currentFrame: i + 1,
      totalFrames: frames.length,
      frameName: frame.name,
      phase: 'converting',
    });
    onProgress?.(`${i + 1}/${frames.length} 변환 중: ${frame.name}`);

    try {
      // 프레임 데이터 간소화 및 직렬화 (토큰 절약)
      const simplifiedFrame = simplifyFrameData(frame, includeImages);
      const frameDataJson = JSON.stringify(simplifiedFrame, null, 2);

      // LLM 호출
      const response = await callLLM(config, {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: createSequentialUserPrompt(
              frameDataJson,
              frame.name,
              i,
              frames.length,
              summaries,
              includeImages
            ),
          },
        ],
        maxTokens: 4096,
        temperature: 0.3,
        onRetryWait: (seconds) => {
          onFrameProgress?.({
            currentFrame: i + 1,
            totalFrames: frames.length,
            frameName: frame.name,
            phase: 'retrying',
            retryCountdown: seconds,
          });
          onRetryWait?.(seconds);
        },
      });

      // 응답 파싱
      let { markdown, summary } = parseSequentialResponse(response.content);

      // 프레임별 mermaid 블록 수정 (병합 전에 각 프레임의 코드 블록 정리)
      markdown = fixUnclosedMermaidBlocks(markdown);

      // 프레임별 이미지 치환 (병합 전에 각 프레임의 이미지로 치환, 이미지 포함 시에만)
      if (includeImages) {
        markdown = replaceImageReferences(markdown, frameImages);
      }

      // 결과 저장
      results.push({
        frameId: frame.id,
        frameName: frame.name,
        markdown,
        contextSummary: summary,
        usage: response.usage,
      });

      // 다음 프레임을 위한 컨텍스트 저장
      summaries.push(summary);

      // Rate limit 회피를 위한 딜레이 (마지막 프레임 제외)
      if (i < frames.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
    } catch (error) {
      // 개별 프레임 실패 시 기록하고 계속 진행
      failedFrames.push({
        frameName: frame.name,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });

      // 실패한 프레임도 컨텍스트에 기록 (연속성 유지)
      summaries.push(`[변환 실패: ${frame.name}]`);

      // Rate limit 회피를 위한 딜레이 (마지막 프레임 제외)
      if (i < frames.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
    }
  }

  // 결과 병합
  onFrameProgress?.({
    currentFrame: frames.length,
    totalFrames: frames.length,
    frameName: '결과 병합',
    phase: 'merging',
  });
  onProgress?.('결과 병합 중...');

  let markdown = mergeMarkdownResults({
    frameResults: results,
    addTableOfContents: results.length >= 4,
  });

  // 후처리: Mermaid 코드 블록 닫기 수정
  markdown = fixUnclosedMermaidBlocks(markdown);

  // 목차 재생성 (병합 후 실제 헤딩 기반으로 일관성 보장)
  markdown = regenerateTableOfContents(markdown);

  // 이미지는 이미 프레임별로 치환되었으므로 전역 치환 불필요

  // 토큰 사용량 합산
  let totalUsage = aggregateTokenUsage(results);

  // 번역 (필요한 경우) - chunk 처리로 큰 문서도 번역 가능
  if (translateTo !== 'none') {
    const translationChunks = splitMarkdownIntoChunks(markdown);

    if (translationChunks.length === 1) {
      // chunk가 1개면 기존 방식으로 번역
      onFrameProgress?.({
        currentFrame: frames.length,
        totalFrames: frames.length,
        frameName: '번역',
        phase: 'translating',
      });
      onProgress?.(`${translateTo}로 번역 중...`);

      const translationResponse = await callLLM(config, {
        messages: [
          { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: createTranslationPrompt(markdown, translateTo) },
        ],
        maxTokens: 8192,
        temperature: 0.3,
        onRetryWait,
      });

      markdown = stripCodeBlockWrapper(translationResponse.content);

      // 토큰 사용량 합산
      if (totalUsage && translationResponse.usage) {
        totalUsage = {
          promptTokens: totalUsage.promptTokens + translationResponse.usage.promptTokens,
          completionTokens:
            totalUsage.completionTokens + translationResponse.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + translationResponse.usage.totalTokens,
        };
      }
    } else {
      // 여러 chunk인 경우 순차 번역
      const translatedChunks: string[] = [];

      for (let i = 0; i < translationChunks.length; i++) {
        const chunk = translationChunks[i];

        onFrameProgress?.({
          currentFrame: i + 1,
          totalFrames: translationChunks.length,
          frameName: `번역 ${i + 1}/${translationChunks.length}`,
          phase: 'translating',
        });
        onProgress?.(`${translateTo}로 번역 중... (${i + 1}/${translationChunks.length})`);

        const translationResponse = await callLLM(config, {
          messages: [
            { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
            { role: 'user', content: createTranslationPrompt(chunk, translateTo) },
          ],
          maxTokens: 8192,
          temperature: 0.3,
          onRetryWait: (seconds) => {
            onFrameProgress?.({
              currentFrame: i + 1,
              totalFrames: translationChunks.length,
              frameName: `번역 ${i + 1}/${translationChunks.length}`,
              phase: 'retrying',
              retryCountdown: seconds,
            });
            onRetryWait?.(seconds);
          },
        });

        translatedChunks.push(stripCodeBlockWrapper(translationResponse.content));

        // 토큰 사용량 합산
        if (totalUsage && translationResponse.usage) {
          totalUsage = {
            promptTokens: totalUsage.promptTokens + translationResponse.usage.promptTokens,
            completionTokens:
              totalUsage.completionTokens + translationResponse.usage.completionTokens,
            totalTokens: totalUsage.totalTokens + translationResponse.usage.totalTokens,
          };
        }

        // Rate limit 회피를 위한 딜레이 (마지막 chunk 제외)
        if (i < translationChunks.length - 1) {
          await delay(REQUEST_DELAY_MS);
        }
      }

      // 번역된 chunk들 병합
      markdown = translatedChunks.join('\n\n');
    }

    // 번역 후 목차 재생성 (chunk별 번역으로 인한 제목 불일치 해결)
    markdown = regenerateTableOfContents(markdown);

    // 번역 후 mermaid 블록 수정 (번역 과정에서 코드 블록이 손상될 수 있음)
    markdown = fixUnclosedMermaidBlocks(markdown);
  }

  onProgress?.('완료!');

  return {
    markdown,
    usage: totalUsage,
    frameResults: results,
    failedFrames: failedFrames.length > 0 ? failedFrames : undefined,
  };
}

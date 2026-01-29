import type {
  ExtractedFrame,
  ExtractedNode,
  ExtractedTextNode,
  ExtractedFrameNode,
  ExtractedShapeNode,
  ExtractedImageNode,
  SelectedFrameInfo,
  PluginMessage,
  UIMessage,
} from './types/figma';

// 자연 정렬을 위한 숫자 추출 및 비교 함수
// 다양한 패턴 지원: "00", "0-01", "text-01", "text00", "text1" 등
function extractNumberForSort(name: string): { prefix: string; number: number } {
  // 마지막 숫자 부분 추출 (연속된 숫자 패턴)
  const match = name.match(/(\d+)(?!.*\d)/);
  if (match) {
    const numberPart = parseInt(match[1], 10);
    const prefix = name.slice(0, match.index);
    return { prefix, number: numberPart };
  }
  return { prefix: name, number: -1 };
}

// 프레임 이름 자연 정렬 비교 함수
function naturalSortCompare(a: string, b: string): number {
  const aExtracted = extractNumberForSort(a);
  const bExtracted = extractNumberForSort(b);

  // 먼저 prefix 비교 (대소문자 무시)
  const prefixCompare = aExtracted.prefix.toLowerCase().localeCompare(
    bExtracted.prefix.toLowerCase()
  );
  if (prefixCompare !== 0) {
    return prefixCompare;
  }

  // prefix가 같으면 숫자 비교
  return aExtracted.number - bExtracted.number;
}

// 프레임 정보와 layer 이름을 함께 저장하는 인터페이스
interface FrameWithLayerInfo {
  frame: FrameNode | ComponentNode | InstanceNode;
  layerName: string | null;
}

// 이미지 리사이즈 설정
const IMAGE_MAX_WIDTH = 400;      // 일반 이미지 최대 너비
const ICON_MAX_SIZE = 100;        // 아이콘 판정 기준 (이 크기 이하면 아이콘)
const ICON_EXPORT_SIZE = 48;      // 아이콘 export 크기

// UI 크기 설정
const UI_WIDTH = 400;
const UI_HEIGHT = 600;

// 플러그인 시작
figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  themeColors: true,
  title: 'Figma to Markdown',
});

// 현재 명령어 전달
const command = figma.command || 'convert';
sendMessage({ type: 'init', command });

// 초기 선택 상태 전송
updateSelection();

// 선택 변경 이벤트 리스너
figma.on('selectionchange', () => {
  updateSelection();
});

// UI로 메시지 전송
function sendMessage(message: PluginMessage) {
  figma.ui.postMessage(message);
}

// 지원하는 컨테이너 노드 타입
type ContainerNode = FrameNode | ComponentNode | InstanceNode | GroupNode | SectionNode;

function isContainerNode(node: SceneNode): node is ContainerNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  );
}

// Group/Section에서 자식 Frame들 추출 (layer 이름 정보 포함)
function getChildFramesWithLayerInfo(
  container: ContainerNode,
  layerName: string | null = null
): FrameWithLayerInfo[] {
  if (container.type === 'GROUP' || container.type === 'SECTION') {
    // Group/Section의 직접 자식 중 Frame, Component, Instance만 추출
    if ('children' in container) {
      const childFrames = container.children.filter(
        (child): child is FrameNode | ComponentNode | InstanceNode =>
          child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'INSTANCE'
      );
      // layer 이름으로 부모 container 이름 사용
      return childFrames.map((frame) => ({
        frame,
        layerName: container.name,
      }));
    }
    return [];
  }
  // Frame, Component, Instance는 그대로 반환 (layer 이름 없음)
  return [{ frame: container as FrameNode | ComponentNode | InstanceNode, layerName }];
}

// 선택된 모든 프레임 펼치기 (Group/Section → 자식 Frame들) + 정렬
function flattenSelectedFrames(containers: ContainerNode[]): FrameWithLayerInfo[] {
  const frames: FrameWithLayerInfo[] = [];
  for (const container of containers) {
    frames.push(...getChildFramesWithLayerInfo(container));
  }

  // 정렬: layer_name이 있으면 "layerName-frameName", 없으면 "frameName" 기준
  frames.sort((a, b) => {
    const aDisplayName = a.layerName ? `${a.layerName}-${a.frame.name}` : a.frame.name;
    const bDisplayName = b.layerName ? `${b.layerName}-${b.frame.name}` : b.frame.name;
    return naturalSortCompare(aDisplayName, bDisplayName);
  });

  return frames;
}

// 선택 상태 업데이트
function updateSelection() {
  const selection = figma.currentPage.selection;
  const containers = selection.filter(isContainerNode);

  if (containers.length === 0) {
    sendMessage({ type: 'no-selection' });
    return;
  }

  // Group/Section의 자식 Frame들을 펼침 + 정렬
  const framesWithLayerInfo = flattenSelectedFrames(containers);

  if (framesWithLayerInfo.length === 0) {
    sendMessage({ type: 'no-selection' });
    return;
  }

  const frameInfos: SelectedFrameInfo[] = framesWithLayerInfo.map(({ frame, layerName }) => ({
    id: frame.id,
    name: frame.name,
    layerName: layerName || undefined,
    childCount: 'children' in frame ? frame.children.length : 0,
  }));

  sendMessage({ type: 'selection-changed', frames: frameInfos });
}

// 프레임 내 모든 텍스트 노드의 텍스트 수집
function collectTextsFromFrame(node: SceneNode): string[] {
  const texts: string[] = [];

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    if (textNode.characters.trim()) {
      texts.push(textNode.characters.trim());
    }
  }

  if ('children' in node) {
    for (const child of (node as FrameNode).children) {
      texts.push(...collectTextsFromFrame(child));
    }
  }

  return texts;
}

// 이미지 노드에서 Base64 데이터 추출 (리사이즈 포함)
async function extractImageBase64(node: SceneNode): Promise<string | undefined> {
  try {
    // exportAsync가 지원되는 노드인지 확인
    if (!('exportAsync' in node)) {
      return undefined;
    }

    const exportNode = node as FrameNode | ComponentNode | InstanceNode | RectangleNode;

    // 아이콘 여부 판정 (원본 크기가 작으면 아이콘)
    const isIcon = node.width <= ICON_MAX_SIZE && node.height <= ICON_MAX_SIZE;

    let scale: number;
    if (isIcon) {
      // 아이콘: 고정 크기로 export (48px 기준)
      scale = ICON_EXPORT_SIZE / Math.max(node.width, node.height);
    } else {
      // 일반 이미지: 최대 너비 400px로 제한
      scale = Math.min(1, IMAGE_MAX_WIDTH / node.width);
    }

    const bytes = await exportNode.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });

    // Uint8Array를 Base64로 변환
    const base64 = figma.base64Encode(bytes);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('이미지 추출 실패:', error);
    return undefined;
  }
}

// 노드에서 데이터 추출 (비동기)
async function extractNode(
  node: SceneNode,
  parentTexts?: string[]
): Promise<ExtractedNode | null> {
  const position = { x: node.x, y: node.y };
  const size = { width: node.width, height: node.height };

  // 텍스트 노드
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    let fontSize: number | undefined;
    let fontWeight: number | undefined;

    // 폰트 크기 추출 (혼합된 경우 첫 번째 값 사용)
    if (typeof textNode.fontSize === 'number') {
      fontSize = textNode.fontSize;
    }

    // 폰트 두께 추출
    if (textNode.fontWeight !== figma.mixed && typeof textNode.fontWeight === 'number') {
      fontWeight = textNode.fontWeight;
    }

    return {
      type: 'text',
      id: node.id,
      name: node.name,
      characters: textNode.characters,
      fontSize,
      fontWeight,
      position,
      size,
    } as ExtractedTextNode;
  }

  // 프레임, 그룹, 컴포넌트, 섹션 노드
  if (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'SECTION'
  ) {
    const containerNode = node as FrameNode | GroupNode | ComponentNode | InstanceNode | SectionNode;
    const children: ExtractedNode[] = [];

    // 이 컨테이너 내의 텍스트들을 수집 (자식 이미지 노드용)
    const containerTexts = collectTextsFromFrame(node);

    if ('children' in containerNode) {
      for (const child of containerNode.children) {
        const extracted = await extractNode(child, containerTexts);
        if (extracted) {
          children.push(extracted);
        }
      }
    }

    const nodeTypeMap: Record<string, ExtractedFrameNode['type']> = {
      FRAME: 'frame',
      GROUP: 'group',
      COMPONENT: 'component',
      INSTANCE: 'instance',
      SECTION: 'section',
    };

    const frameNode: ExtractedFrameNode = {
      type: nodeTypeMap[node.type] || 'frame',
      id: node.id,
      name: node.name,
      position,
      size,
      children,
    };

    // Auto Layout 정보 추출
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      const frameWithLayout = node as FrameNode | ComponentNode;
      if (frameWithLayout.layoutMode && frameWithLayout.layoutMode !== 'NONE') {
        frameNode.layoutMode = frameWithLayout.layoutMode;
      }
    }

    return frameNode;
  }

  // 이미지가 있는 노드 (fills에 IMAGE가 있는 경우) - 도형보다 먼저 체크!
  if ('fills' in node) {
    const fills = node.fills;
    if (Array.isArray(fills)) {
      const hasImage = fills.some((fill) => fill.type === 'IMAGE');
      if (hasImage) {
        // Base64 데이터 추출
        const base64Data = await extractImageBase64(node);

        // 주변 텍스트 (부모로부터 전달받은 텍스트 또는 노드 이름 기반)
        const surroundingTexts = parentTexts && parentTexts.length > 0
          ? parentTexts.slice(0, 10) // 최대 10개 텍스트만
          : [node.name];

        const imageNode: ExtractedImageNode = {
          type: 'image',
          id: node.id,
          name: node.name,
          position,
          size,
          base64Data,
          surroundingTexts,
        };

        return imageNode;
      }
    }
  }

  // 도형 노드
  if (
    node.type === 'RECTANGLE' ||
    node.type === 'ELLIPSE' ||
    node.type === 'LINE' ||
    node.type === 'POLYGON' ||
    node.type === 'STAR' ||
    node.type === 'VECTOR'
  ) {
    let shapeType: ExtractedShapeNode['shapeType'] = 'vector';

    switch (node.type) {
      case 'RECTANGLE':
        shapeType = 'rectangle';
        break;
      case 'ELLIPSE':
        shapeType = 'ellipse';
        break;
      case 'LINE':
        // 화살표인지 확인 (strokeCap으로 판단)
        const lineNode = node as LineNode;
        if (
          lineNode.strokeCap === 'ARROW_LINES' ||
          lineNode.strokeCap === 'ARROW_EQUILATERAL'
        ) {
          shapeType = 'arrow';
        } else {
          shapeType = 'line';
        }
        break;
      case 'POLYGON':
        shapeType = 'polygon';
        break;
      case 'STAR':
        shapeType = 'star';
        break;
      default:
        shapeType = 'vector';
    }

    return {
      type: 'shape',
      id: node.id,
      name: node.name,
      shapeType,
      position,
      size,
    } as ExtractedShapeNode;
  }

  return null;
}

// 프레임 데이터 추출 (비동기) - 정렬된 순서로 추출
async function extractFrameData(): Promise<ExtractedFrame[]> {
  const selection = figma.currentPage.selection;
  const containers = selection.filter(isContainerNode);

  // Group/Section의 자식 Frame들을 펼침 + 정렬
  const framesWithLayerInfo = flattenSelectedFrames(containers);

  const results: ExtractedFrame[] = [];

  for (const { frame, layerName } of framesWithLayerInfo) {
    const children: ExtractedNode[] = [];

    // 프레임 내 모든 텍스트 수집 (자식 이미지 노드용)
    const frameTexts = collectTextsFromFrame(frame);

    if ('children' in frame) {
      for (const child of frame.children) {
        const extracted = await extractNode(child, frameTexts);
        if (extracted) {
          children.push(extracted);
        }
      }
    }

    // displayName: layerName이 있으면 "layerName-frameName"
    const displayName = layerName ? `${layerName}-${frame.name}` : frame.name;

    results.push({
      id: frame.id,
      name: displayName,
      size: {
        width: frame.width,
        height: frame.height,
      },
      children,
    });
  }

  return results;
}

// UI 메시지 핸들러
figma.ui.onmessage = async (message: UIMessage) => {
  switch (message.type) {
    case 'request-frame-data':
      try {
        sendMessage({ type: 'extraction-started' } as PluginMessage);
        const frameData = await extractFrameData();
        if (frameData.length === 0) {
          sendMessage({ type: 'no-selection' });
        } else {
          sendMessage({ type: 'frame-data', frames: frameData });
        }
      } catch (error) {
        sendMessage({
          type: 'error',
          message: error instanceof Error ? error.message : '데이터 추출 중 오류 발생',
        });
      }
      break;

    case 'copy-complete':
      figma.notify('Markdown이 클립보드에 복사되었습니다!', { timeout: 2000 });
      break;

    case 'close':
      figma.closePlugin();
      break;

    case 'resize':
      figma.ui.resize(message.width, message.height);
      break;

    case 'load-storage':
      figma.clientStorage.getAsync(message.key).then((value) => {
        sendMessage({
          type: 'storage-loaded',
          key: message.key,
          value: value as string | null,
        });
      });
      break;

    case 'save-storage':
      figma.clientStorage.setAsync(message.key, message.value).then(() => {
        sendMessage({ type: 'storage-saved', key: message.key });
      });
      break;
  }
};

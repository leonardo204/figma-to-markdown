import type {
  ExtractedFrame,
  ExtractedNode,
  ExtractedTextNode,
  ExtractedFrameNode,
  ExtractedShapeNode,
  SelectedFrameInfo,
  PluginMessage,
  UIMessage,
} from './types/figma';

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

// 선택 상태 업데이트
function updateSelection() {
  const selection = figma.currentPage.selection;
  const containers = selection.filter(isContainerNode);

  if (containers.length === 0) {
    sendMessage({ type: 'no-selection' });
    return;
  }

  const frameInfos: SelectedFrameInfo[] = containers.map((container) => ({
    id: container.id,
    name: container.name,
    childCount: 'children' in container ? container.children.length : 0,
  }));

  sendMessage({ type: 'selection-changed', frames: frameInfos });
}

// 노드에서 데이터 추출
function extractNode(node: SceneNode): ExtractedNode | null {
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

    if ('children' in containerNode) {
      for (const child of containerNode.children) {
        const extracted = extractNode(child);
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

  // 이미지가 있는 노드 (fills에 IMAGE가 있는 경우)
  if ('fills' in node) {
    const fills = node.fills;
    if (Array.isArray(fills)) {
      const hasImage = fills.some((fill) => fill.type === 'IMAGE');
      if (hasImage) {
        return {
          type: 'image',
          id: node.id,
          name: node.name,
          position,
          size,
        };
      }
    }
  }

  return null;
}

// 프레임 데이터 추출
function extractFrameData(): ExtractedFrame[] {
  const selection = figma.currentPage.selection;
  const containers = selection.filter(isContainerNode);

  return containers.map((container) => {
    const children: ExtractedNode[] = [];

    if ('children' in container) {
      for (const child of container.children) {
        const extracted = extractNode(child);
        if (extracted) {
          children.push(extracted);
        }
      }
    }

    return {
      id: container.id,
      name: container.name,
      size: {
        width: container.width,
        height: container.height,
      },
      children,
    };
  });
}

// UI 메시지 핸들러
figma.ui.onmessage = (message: UIMessage) => {
  switch (message.type) {
    case 'request-frame-data':
      try {
        const frameData = extractFrameData();
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
  }
};

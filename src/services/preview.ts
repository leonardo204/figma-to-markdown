// 마크다운 미리보기 - 플러그인 UI 내에서 표시

// 미리보기용 iframe HTML 생성 (CDN 스크립트 로드)
export function generatePreviewHtml(markdown: string): string {
  // 마크다운 내용을 이스케이프 처리
  const escapedMarkdown = markdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      padding: 16px;
      background: #fff;
    }
    h1, h2, h3, h4 { margin-top: 1.2em; margin-bottom: 0.5em; color: #1a1a1a; }
    h1 { font-size: 1.5em; border-bottom: 2px solid #e1e4e8; padding-bottom: 0.3em; }
    h2 { font-size: 1.3em; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
    h3 { font-size: 1.1em; }
    p { margin: 0.8em 0; }
    ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
    li { margin: 0.3em 0; }
    code {
      background: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.8em 0;
    }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    th { background: #f6f8fa; font-weight: 600; }
    tr:nth-child(even) { background: #fafbfc; }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 0.8em 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    blockquote {
      border-left: 3px solid #ddd;
      margin: 0.8em 0;
      padding-left: 1em;
      color: #666;
    }
    .mermaid { background: #fff; text-align: center; margin: 0.8em 0; }
    hr { border: none; border-top: 1px solid #e1e4e8; margin: 1em 0; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    const rawMarkdown = \`${escapedMarkdown}\`;

    // Mermaid 초기화
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

    // marked 설정
    marked.setOptions({ breaks: true, gfm: true });

    // 커스텀 렌더러로 Mermaid 코드 블록 처리
    const renderer = new marked.Renderer();
    const originalCode = renderer.code;
    renderer.code = function(code, language) {
      if (language === 'mermaid') {
        return '<div class="mermaid">' + code + '</div>';
      }
      return originalCode.call(this, code, language);
    };
    marked.setOptions({ renderer });

    // 마크다운 렌더링
    document.getElementById('content').innerHTML = marked.parse(rawMarkdown);

    // Mermaid 다이어그램 렌더링
    mermaid.run();
  <\/script>
</body>
</html>`;
}

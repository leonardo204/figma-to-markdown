import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');

// 플러그인 코드 빌드 (Figma 샌드박스용)
const codeConfig = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'build/code.js',
  target: 'es2020',
  format: 'iife',
  sourcemap: false,
  minify: !isWatch,
};

// UI 코드 빌드 (React)
const uiConfig = {
  entryPoints: ['src/ui.tsx'],
  bundle: true,
  outfile: 'build/ui.js',
  target: 'es2020',
  format: 'iife',
  sourcemap: false,
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

// UI HTML 생성
function generateHtml() {
  const jsContent = fs.readFileSync('build/ui.js', 'utf-8');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #333;
      background: #fff;
      line-height: 1.4;
    }

    #root {
      padding: 12px;
      min-height: 100vh;
    }

    /* 탭 스타일 */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 8px;
    }

    .tab-button {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #666;
      border-radius: 6px 6px 0 0;
      transition: all 0.2s;
    }

    .tab-button:hover {
      background: #f5f5f5;
      color: #333;
    }

    .tab-button.active {
      background: #18a0fb;
      color: white;
    }

    /* 폼 스타일 */
    .form-group {
      margin-bottom: 12px;
    }

    .form-label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
    }

    .form-input, .form-select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 12px;
      transition: border-color 0.2s;
    }

    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: #18a0fb;
    }

    .form-input::placeholder {
      color: #999;
    }

    /* 버튼 스타일 */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #18a0fb;
      color: white;
    }

    .btn-primary:hover {
      background: #0d8de8;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
    }

    .btn-secondary:hover {
      background: #eee;
    }

    .btn-group {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    /* 상태 표시 */
    .status {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      margin-top: 12px;
    }

    .status-success {
      background: #e6f7e6;
      color: #2e7d32;
    }

    .status-error {
      background: #ffebee;
      color: #c62828;
    }

    .status-warning {
      background: #fff3e0;
      color: #ef6c00;
    }

    /* 선택된 프레임 목록 */
    .frame-list {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .frame-list-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }

    .frame-item {
      padding: 4px 0;
      font-size: 11px;
      color: #666;
    }

    .frame-item::before {
      content: "•";
      margin-right: 8px;
      color: #18a0fb;
    }

    /* 미리보기 영역 */
    .preview-area {
      background: #f5f5f5;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 12px;
      margin-top: 12px;
      max-height: 300px;
      overflow-y: auto;
    }

    .preview-area pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.5;
    }

    /* 로딩 스피너 */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #18a0fb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 경고 메시지 */
    .warning-box {
      background: #fff3e0;
      border: 1px solid #ffcc80;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .warning-box-title {
      font-weight: 600;
      color: #ef6c00;
      margin-bottom: 4px;
    }

    .warning-box-text {
      color: #e65100;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${jsContent}</script>
</body>
</html>`;

  fs.writeFileSync('build/ui.html', html);
  console.log('Generated build/ui.html');
}

async function build() {
  // build 디렉토리 생성
  if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
  }

  if (isWatch) {
    // Watch 모드
    const codeCtx = await esbuild.context(codeConfig);
    const uiCtx = await esbuild.context(uiConfig);

    await codeCtx.watch();
    await uiCtx.watch();

    console.log('Watching for changes...');

    // 초기 빌드 후 HTML 생성
    await codeCtx.rebuild();
    await uiCtx.rebuild();
    generateHtml();

    // 파일 변경 감지하여 HTML 재생성
    fs.watch('build', (eventType, filename) => {
      if (filename === 'ui.js') {
        setTimeout(() => {
          try {
            generateHtml();
          } catch (e) {
            console.error('Error generating HTML:', e);
          }
        }, 100);
      }
    });
  } else {
    // 일반 빌드
    await esbuild.build(codeConfig);
    console.log('Built build/code.js');

    await esbuild.build(uiConfig);
    console.log('Built build/ui.js');

    generateHtml();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

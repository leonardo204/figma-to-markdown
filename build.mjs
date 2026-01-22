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
    :root {
      --color-primary: #6366f1;
      --color-primary-hover: #4f46e5;
      --color-primary-light: #eef2ff;
      --color-success: #10b981;
      --color-success-light: #d1fae5;
      --color-warning: #f59e0b;
      --color-warning-light: #fef3c7;
      --color-error: #ef4444;
      --color-error-light: #fee2e2;
      --color-gray-50: #f9fafb;
      --color-gray-100: #f3f4f6;
      --color-gray-200: #e5e7eb;
      --color-gray-300: #d1d5db;
      --color-gray-400: #9ca3af;
      --color-gray-500: #6b7280;
      --color-gray-600: #4b5563;
      --color-gray-700: #374151;
      --color-gray-800: #1f2937;
      --color-gray-900: #111827;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: var(--color-gray-800);
      background: linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%);
      line-height: 1.5;
      min-height: 100vh;
    }

    #root {
      padding: 16px;
      min-height: 100vh;
    }

    /* 앱 컨테이너 */
    .app {
      max-width: 100%;
    }

    /* 탭 네비게이션 */
    .tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 20px;
      background: var(--color-gray-100);
      padding: 4px;
      border-radius: var(--radius-lg);
    }

    .tab-button {
      flex: 1;
      padding: 10px 16px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-gray-500);
      border-radius: var(--radius-md);
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .tab-button:hover {
      color: var(--color-gray-700);
      background: var(--color-gray-50);
    }

    .tab-button.active {
      background: white;
      color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }

    /* 카드 스타일 */
    .card {
      background: white;
      border-radius: var(--radius-lg);
      padding: 16px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-gray-200);
      margin-bottom: 16px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-gray-800);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-badge {
      background: var(--color-primary-light);
      color: var(--color-primary);
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
    }

    /* 폼 스타일 */
    .form-group {
      margin-bottom: 14px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 12px;
      color: var(--color-gray-600);
    }

    .form-input, .form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md);
      font-size: 13px;
      color: var(--color-gray-800);
      background: white;
      transition: var(--transition);
    }

    .form-input:hover, .form-select:hover {
      border-color: var(--color-gray-300);
    }

    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-light);
    }

    .form-input::placeholder {
      color: var(--color-gray-400);
    }

    /* 버튼 스타일 */
    .btn {
      padding: 10px 18px;
      border: none;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .btn-primary:active {
      transform: translateY(0);
    }

    .btn-primary:disabled {
      background: var(--color-gray-300);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-secondary {
      background: white;
      color: var(--color-gray-700);
      border: 1px solid var(--color-gray-200);
    }

    .btn-secondary:hover {
      background: var(--color-gray-50);
      border-color: var(--color-gray-300);
    }

    .btn-success {
      background: var(--color-success);
      color: white;
    }

    .btn-group {
      display: flex;
      gap: 10px;
      margin-top: 16px;
    }

    /* 상태 메시지 */
    .status {
      padding: 12px 14px;
      border-radius: var(--radius-md);
      font-size: 12px;
      margin-top: 12px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .status-icon {
      font-size: 16px;
      line-height: 1;
    }

    .status-success {
      background: var(--color-success-light);
      color: #065f46;
      border: 1px solid #a7f3d0;
    }

    .status-error {
      background: var(--color-error-light);
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .status-warning {
      background: var(--color-warning-light);
      color: #92400e;
      border: 1px solid #fcd34d;
    }

    /* 프레임 목록 */
    .frame-list {
      background: var(--color-gray-50);
      border-radius: var(--radius-md);
      padding: 14px;
      border: 1px solid var(--color-gray-200);
    }

    .frame-list-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 10px;
      color: var(--color-gray-700);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .frame-list-empty {
      color: var(--color-gray-400);
      font-size: 12px;
      text-align: center;
      padding: 16px;
    }

    .frame-item {
      padding: 8px 10px;
      font-size: 12px;
      color: var(--color-gray-600);
      background: white;
      border-radius: var(--radius-sm);
      margin-bottom: 6px;
      border: 1px solid var(--color-gray-200);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .frame-item:last-child {
      margin-bottom: 0;
    }

    .frame-item-icon {
      color: var(--color-primary);
      font-size: 14px;
    }

    /* Progress Bar */
    .progress-container {
      margin: 16px 0;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .progress-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-gray-600);
    }

    .progress-value {
      font-size: 11px;
      color: var(--color-gray-400);
    }

    .progress-bar {
      height: 6px;
      background: var(--color-gray-200);
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-primary), #818cf8);
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    .progress-fill.indeterminate {
      width: 30%;
      animation: indeterminate 1.5s infinite ease-in-out;
    }

    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    /* Retry 대기 상태 */
    .retry-container {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #fcd34d;
      border-radius: var(--radius-md);
      padding: 16px;
      margin: 16px 0;
      text-align: center;
    }

    .retry-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }

    .retry-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 4px;
    }

    .retry-countdown {
      font-size: 24px;
      font-weight: 700;
      color: #b45309;
      margin: 8px 0;
    }

    .retry-text {
      font-size: 11px;
      color: #a16207;
    }

    /* 토큰 사용량 */
    .token-usage {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 12px;
      background: linear-gradient(135deg, var(--color-primary-light) 0%, #ddd6fe 100%);
      border-radius: var(--radius-md);
      margin-bottom: 12px;
    }

    .token-item {
      text-align: center;
    }

    .token-label {
      font-size: 10px;
      color: var(--color-gray-500);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .token-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-primary);
    }

    /* 결과 텍스트 영역 */
    .result-textarea {
      width: 100%;
      height: 220px;
      padding: 14px;
      border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md);
      font-family: 'SF Mono', 'Fira Code', Monaco, 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      resize: vertical;
      background: var(--color-gray-50);
      color: var(--color-gray-800);
      transition: var(--transition);
    }

    .result-textarea:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-light);
      background: white;
    }

    /* 로딩 스피너 */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 12px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-gray-200);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text {
      color: var(--color-gray-500);
      font-size: 12px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 경고 박스 */
    .warning-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #fcd34d;
      border-radius: var(--radius-md);
      padding: 16px;
      margin-bottom: 16px;
    }

    .warning-box-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .warning-box-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 4px;
    }

    .warning-box-text {
      color: #a16207;
      font-size: 12px;
      line-height: 1.5;
    }

    /* 섹션 타이틀 */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-gray-700);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 힌트 텍스트 */
    .hint-text {
      font-size: 11px;
      color: var(--color-gray-400);
      margin-top: 4px;
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

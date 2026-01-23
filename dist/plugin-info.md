# Figma to Markdown - Plugin Publish Information

## Name
Figma to Markdown

## Tagline (최대 60자)
AI-powered Figma to Markdown converter with inline images & Mermaid diagrams

## Description (Figma Community용)

Transform your Figma designs into professional Markdown documentation instantly with AI.

### ✨ Key Features

**🤖 Multi-LLM Support**
- OpenAI (GPT-4o, GPT-4, GPT-3.5)
- Anthropic Claude (Sonnet 4, Opus)
- Google Gemini (2.0 Flash, Pro)
- Groq (Llama 3.3, Mixtral)
- Azure OpenAI (Enterprise)
- Ollama (Local/Free)

**📄 Smart Conversion**
- Multi-frame sequential processing with context awareness
- Auto-generates Mermaid diagrams for flows & processes
- Inline Base64 images (icons auto-sized to 48px, images to 400px)
- Intelligent heading levels based on font size/weight

**🎨 Advanced Features**
- Real-time Markdown preview with Mermaid rendering
- Customizable LLM prompt (Advanced Settings)
- Multi-language translation (EN, JA, ZH, DE, FR, ES)
- Token usage tracking per frame
- Auto rate-limit handling with countdown

**📋 Confluence-Ready**
- Optimized output for Confluence wiki format
- Clean Markdown without wrapper code blocks
- Table of contents for multi-section documents

### 🚀 How to Use

1. **Setup**: Configure your LLM API key in Settings tab
2. **Select**: Choose frames in Figma (supports multi-select)
3. **Convert**: Click "Convert to Markdown"
4. **Preview**: Check result with Mermaid diagram rendering
5. **Copy**: Paste directly into Confluence

### 🔒 Privacy

- API keys stored locally in Figma client storage only
- Frame data sent only to your configured LLM provider
- No analytics or data collection by this plugin

---

## Tags (최대 5개)
markdown, confluence, documentation, ai, mermaid

## Category
Design tools

## Support URL
https://github.com/leonardo204/figma-to-markdown

## Version
1.1.0

---

# Asset Requirements

## Icon (필수)
- **크기**: 128x128 px
- **포맷**: PNG (권장) 또는 SVG
- **현재 파일**: `dist/icon.png` (128x128)

## Cover Image / Thumbnail (권장)
- **크기**: 1920x960 px (2:1 비율)
- **포맷**: PNG 또는 JPG
- **현재 파일**: `dist/cover.png`
- **내용 권장**:
  - 플러그인 UI 스크린샷
  - 주요 기능 하이라이트
  - Before/After 비교 (Figma → Markdown)

---

# 업데이트 체크리스트

## Description 업데이트 필요 항목
- [x] Gemini, Groq 제공자 추가
- [x] 인라인 이미지 기능
- [x] Mermaid 다이어그램
- [x] 실시간 미리보기
- [x] 프롬프트 커스터마이징
- [x] 다국어 번역

## Icon 업데이트 (선택)
현재 아이콘이 적절하다면 유지, 필요시 업데이트:
- AI/LLM 느낌 추가
- Markdown 심볼 강조

## Thumbnail 업데이트 권장
새 기능 반영한 스크린샷:
1. 변환 결과 + Mermaid 다이어그램 미리보기
2. 인라인 이미지가 포함된 Markdown 출력
3. LLM 제공자 선택 화면 (6개 제공자)

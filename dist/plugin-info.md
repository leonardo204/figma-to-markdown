# Figma to Markdown - Plugin Information

## Name
Figma to Markdown

## Tagline
Convert Figma frames to Confluence-compatible Markdown using AI (OpenAI, Claude, Azure OpenAI, Ollama)

## Description
Transform your Figma designs into well-structured Markdown documentation with the power of AI.

### Features
- **Multi-frame Support**: Convert multiple frames at once with sequential processing
- **AI-Powered**: Intelligent conversion using LLM (Large Language Models)
- **Multiple AI Providers**:
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic Claude
  - Azure OpenAI
  - Ollama (Local LLM)
- **Translation**: Auto-translate to English, Japanese, Chinese, Spanish, French, German
- **Confluence-Ready**: Output optimized for Confluence wiki format
- **Rate Limit Handling**: Automatic retry with countdown for API rate limits
- **Token Usage Tracking**: Monitor your API token consumption

### How to Use
1. Select one or more frames in Figma
2. Configure your LLM API settings (Settings tab)
3. Click "Convert to Markdown"
4. Copy the result to your clipboard

### Supported Node Types
- Text nodes (with font size/weight detection)
- Frames, Components, Instances
- Groups and Sections
- Basic shapes (Rectangle, Ellipse, Line, etc.)
- Images

### Privacy
- Your API keys are stored locally in Figma's client storage
- Frame data is sent only to your configured LLM provider
- No data is collected or stored by this plugin

## Tags
markdown, documentation, confluence, wiki, ai, llm, openai, claude, export, converter

## Support
GitHub: https://github.com/your-repo/figma-to-markdown

## Version
1.0.0

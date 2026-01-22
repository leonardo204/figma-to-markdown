import React, { useState, useEffect } from 'react';
import type { LLMConfig, AppTab, PluginMessage } from '../types';
import { loadConfig, isConfigValid } from '../services/storage';
import { SettingsPanel } from './SettingsPanel';
import { ConversionPanel } from './ConversionPanel';

export function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('convert');
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 설정 로드
  useEffect(() => {
    async function init() {
      const savedConfig = await loadConfig();
      setConfig(savedConfig);

      // 설정이 없으면 설정 탭으로 이동
      if (!savedConfig || !isConfigValid(savedConfig)) {
        setCurrentTab('settings');
      }

      setIsLoading(false);
    }
    init();
  }, []);

  // Figma 메시지 핸들러
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage as PluginMessage;
      if (!message) return;

      if (message.type === 'init') {
        // 명령에 따라 탭 설정
        if (message.command === 'settings') {
          setCurrentTab('settings');
        } else {
          // convert 명령이지만 설정이 없으면 settings로
          if (!config || !isConfigValid(config)) {
            setCurrentTab('settings');
          } else {
            setCurrentTab('convert');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config]);

  const handleConfigChange = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    // 설정 완료 후 변환 탭으로 이동
    if (isConfigValid(newConfig)) {
      setCurrentTab('convert');
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 탭 버튼 */}
      <div className="tabs">
        <button
          className={`tab-button ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentTab('settings')}
        >
          ⚙️ 설정
        </button>
        <button
          className={`tab-button ${currentTab === 'convert' ? 'active' : ''}`}
          onClick={() => setCurrentTab('convert')}
        >
          📄 변환
        </button>
      </div>

      {/* 탭 콘텐츠 - CSS로 숨김 처리 (상태 유지) */}
      <div style={{ display: currentTab === 'settings' ? 'block' : 'none' }}>
        <SettingsPanel config={config} onConfigChange={handleConfigChange} />
      </div>
      <div style={{ display: currentTab === 'convert' ? 'block' : 'none' }}>
        <ConversionPanel
          config={config}
          onSwitchToSettings={() => setCurrentTab('settings')}
        />
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Settings, Database, Brain, Key, CheckCircle,
  AlertTriangle, Info, ChevronDown
} from 'lucide-react';
import apiClient from '@/api/client';

// ── 类型 ─────────────────────────────────────────────────────────
interface ConfigState {
  marketDataProvider: 'mock' | 'tencent' | 'eastmoney' | 'akshare' | 'tushare';
  priceRefreshCron: string;
  aiProvider: 'mock' | 'claude' | 'openai' | 'deepseek' | 'kimi' | 'mimo';
  anthropicApiKey: string;
  openaiApiKey: string;
  deepseekApiKey: string;
  kimiApiKey: string;
  mimoApiKey: string;
  akshareBridgeUrl: string;
  tushareApiToken: string;
}

const DEFAULT: ConfigState = {
  marketDataProvider: 'mock',
  priceRefreshCron: '*/30 * * * *',
  aiProvider: 'mock',
  anthropicApiKey: '',
  openaiApiKey: '',
  deepseekApiKey: '',
  kimiApiKey: '',
  mimoApiKey: '',
  akshareBridgeUrl: '',
  tushareApiToken: '',
};

// ── 子组件：Select ───────────────────────────────────────────────
const Select = ({
  label, value, options, onChange, desc,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; badge?: string }[];
  onChange: (v: string) => void;
  desc?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-stone-400">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-stone-800/60 border border-stone-700/60 text-stone-200 text-sm px-3 py-2.5 pr-8 rounded-xl focus:outline-none focus:border-[rgba(217,119,87,0.5)] transition-colors"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}{o.badge ? ` (${o.badge})` : ''}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
    </div>
    {desc && <p className="text-[11px] text-stone-600">{desc}</p>}
  </div>
);

// ── 子组件：ApiKeyInput ──────────────────────────────────────────
const ApiKeyInput = ({
  label, value, onChange, placeholder, desc,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; desc?: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-stone-400">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '未配置'}
          className="w-full bg-stone-800/60 border border-stone-700/60 text-stone-200 text-sm px-3 py-2.5 pr-16 rounded-xl focus:outline-none focus:border-[rgba(217,119,87,0.5)] transition-colors font-mono placeholder:text-stone-700 placeholder:font-sans"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-500 hover:text-stone-300 px-1.5 py-0.5 bg-stone-700/50 rounded"
        >
          {show ? '隐藏' : '显示'}
        </button>
      </div>
      {desc && <p className="text-[11px] text-stone-600">{desc}</p>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<ConfigState>(DEFAULT);
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  // 加载当前配置
  useEffect(() => {
    apiClient.get('/config').then(res => {
      if (res.data?.data) setConfig({ ...DEFAULT, ...res.data.data });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ConfigState) => (val: string) =>
    setConfig(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaveError('');
    try {
      await apiClient.put('/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveError(e.response?.data?.message || '保存失败，请检查后端是否运行');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700/60 flex items-center justify-center">
          <Settings className="w-4.5 h-4.5 text-stone-400" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-stone-100">系统配置</h2>
          <p className="text-xs text-stone-500">行情 API · AI API · 定时任务</p>
        </div>
      </div>

      {/* ── Clawbot 说明 ─────────────────────────────────────── */}
      <div className="flex gap-2.5 p-3 bg-[rgba(217,119,87,0.06)] border border-[rgba(217,119,87,0.2)] rounded-xl">
        <Info className="w-4 h-4 text-[#D97757] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-stone-400 space-y-1">
          <p className="font-medium text-[#D97757]">Clawbot 配置入口</p>
          <p>前端地址：<code className="text-stone-300 bg-stone-800 px-1 rounded">http://localhost:5174</code> → 左侧边栏底部「系统配置」</p>
          <p>后端接口：<code className="text-stone-300 bg-stone-800 px-1 rounded">PUT /api/v1/config</code>（也可直接调接口）</p>
          <p>服务器 .env 位置：<code className="text-stone-300 bg-stone-800 px-1 rounded">/opt/wealthos/.env</code></p>
        </div>
      </div>

      {/* ── 行情数据 ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-[#D97757]" />
            行情数据 Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-10 bg-stone-800/50 rounded-xl animate-pulse" />
          ) : (
            <>
              <Select
                label="数据源"
                value={config.marketDataProvider}
                onChange={set('marketDataProvider')}
                options={[
                  { value: 'mock',      label: 'Mock（模拟 ±2% 随机波动）', badge: '默认' },
                  { value: 'tencent',   label: '腾讯行情 API' },
                  { value: 'eastmoney', label: '东方财富 API' },
                  { value: 'tushare',   label: 'Tushare Pro API' },
                  { value: 'akshare',   label: 'AKShare（需本地 Python 桥）' },
                ]}
                desc="切换到真实 API 后，取消 server/src/services/marketDataService.js 中对应注释即可"
              />
              <Select
                label="刷新频率（Cron）"
                value={config.priceRefreshCron}
                onChange={set('priceRefreshCron')}
                options={[
                  { value: '*/15 * * * *',        label: '每 15 分钟' },
                  { value: '*/30 * * * *',        label: '每 30 分钟', badge: '默认' },
                  { value: '0 * * * *',           label: '每小时' },
                  { value: '0 9,12,15 * * 1-5',   label: '工作日 9/12/15 点' },
                ]}
              />
              {config.marketDataProvider === 'tushare' && (
                <ApiKeyInput
                  label="Tushare API Token"
                  value={config.tushareApiToken}
                  onChange={set('tushareApiToken')}
                  placeholder="在 tushare.pro 注册后获取"
                  desc="前往 tushare.pro 注册并在个人中心获取 Token"
                />
              )}
              {config.marketDataProvider === 'akshare' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-400">AKShare Bridge URL</label>
                  <input
                    value={config.akshareBridgeUrl}
                    onChange={e => set('akshareBridgeUrl')(e.target.value)}
                    placeholder="http://localhost:8001"
                    className="w-full bg-stone-800/60 border border-stone-700/60 text-stone-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-[rgba(217,119,87,0.5)] transition-colors"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── AI Provider ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#D97757]" />
            AI 分析 Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-10 bg-stone-800/50 rounded-xl animate-pulse" />
          ) : (
            <>
              <Select
                label="AI 模型"
                value={config.aiProvider}
                onChange={set('aiProvider')}
                options={[
                  { value: 'mock',     label: 'Mock（确定性模拟分析）', badge: '默认' },
                  { value: 'deepseek', label: 'DeepSeek (V3 / R1)' },
                  { value: 'kimi',     label: 'Kimi (Moonshot AI)' },
                  { value: 'mimo',     label: 'Xiaomi MiMo (OpenRouter)' },
                  { value: 'claude',   label: 'Claude (Anthropic)' },
                  { value: 'openai',   label: 'OpenAI (GPT-4)' },
                ]}
                desc="切换后填写对应 API Key 并保存即可生效"
              />

              {config.aiProvider === 'deepseek' && (
                <ApiKeyInput
                  label="DeepSeek API Key"
                  value={config.deepseekApiKey}
                  onChange={set('deepseekApiKey')}
                  placeholder="sk-..."
                  desc="前往 platform.deepseek.com 获取 API Key，支持 deepseek-chat (V3) 和 deepseek-reasoner (R1)"
                />
              )}
              {config.aiProvider === 'kimi' && (
                <ApiKeyInput
                  label="Kimi API Key"
                  value={config.kimiApiKey}
                  onChange={set('kimiApiKey')}
                  placeholder="sk-..."
                  desc="前往 platform.moonshot.cn 获取 API Key，默认模型 moonshot-v1-8k"
                />
              )}
              {config.aiProvider === 'mimo' && (
                <ApiKeyInput
                  label="MiMo / OpenRouter API Key"
                  value={config.mimoApiKey}
                  onChange={set('mimoApiKey')}
                  placeholder="sk-or-v1-..."
                  desc="默认走 OpenRouter 的 OpenAI 兼容接口，模型为 xiaomi/mimo-v2-flash"
                />
              )}
              {config.aiProvider === 'claude' && (
                <ApiKeyInput
                  label="Anthropic API Key"
                  value={config.anthropicApiKey}
                  onChange={set('anthropicApiKey')}
                  placeholder="sk-ant-..."
                  desc="格式：sk-ant-api03-xxxxx"
                />
              )}
              {config.aiProvider === 'openai' && (
                <ApiKeyInput
                  label="OpenAI API Key"
                  value={config.openaiApiKey}
                  onChange={set('openaiApiKey')}
                  placeholder="sk-..."
                  desc="格式：sk-proj-xxxxx 或 sk-xxxxx"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 当前配置摘要（供 Clawbot 读取）──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-stone-500" />
            当前状态摘要
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: '行情来源',      value: config.marketDataProvider,                              active: config.marketDataProvider !== 'mock' },
              { label: 'AI 来源',       value: config.aiProvider,                                      active: config.aiProvider !== 'mock' },
              { label: '刷新频率',      value: config.priceRefreshCron,                                active: true },
              { label: 'DeepSeek Key',  value: config.deepseekApiKey  ? '已配置 ✓' : '未配置',        active: !!config.deepseekApiKey },
              { label: 'Kimi Key',      value: config.kimiApiKey      ? '已配置 ✓' : '未配置',        active: !!config.kimiApiKey },
              { label: 'MiMo Key',      value: config.mimoApiKey      ? '已配置 ✓' : '未配置',        active: !!config.mimoApiKey },
              { label: 'Claude Key',    value: config.anthropicApiKey ? '已配置 ✓' : '未配置',        active: !!config.anthropicApiKey },
              { label: 'OpenAI Key',    value: config.openaiApiKey    ? '已配置 ✓' : '未配置',        active: !!config.openaiApiKey },
              { label: 'Tushare Token', value: config.tushareApiToken ? '已配置 ✓' : '未配置',        active: !!config.tushareApiToken },
            ].map(({ label, value, active }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-stone-800/60 last:border-0">
                <span className="text-xs text-stone-500">{label}</span>
                <span className={`text-xs font-mono font-medium ${active ? 'text-[#D97757]' : 'text-stone-600'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 保存 ──────────────────────────────────────────────── */}
      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{saveError}</p>
        </div>
      )}
      <Button onClick={handleSave} isLoading={loading} className="w-full">
        {saved
          ? <><CheckCircle className="w-4 h-4 mr-2" />已保存</>
          : '保存配置'}
      </Button>

      <p className="text-center text-[11px] text-stone-700">
        配置保存到服务器内存，重启后需重新设置。持久化请直接编辑 <code className="text-stone-600">/opt/wealthos/.env</code>
      </p>
    </div>
  );
};

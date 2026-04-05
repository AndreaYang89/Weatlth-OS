import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { holdingsApi } from '@/api/services';
import { usePortfolioStore } from '@/store';
import type { ImportHoldingError } from '@/types';

// ── 支持的列映射（兼容券商导出格式）─────────────────────────────
const COL_MAP: Record<string, string> = {
  // 名称
  '名称': 'name', '证券名称': 'name', '股票名称': 'name', 'name': 'name',
  // 代码
  '代码': 'symbol', '证券代码': 'symbol', '股票代码': 'symbol', 'symbol': 'symbol', 'code': 'symbol',
  // 股数/数量
  '持有数量': 'shares', '股数': 'shares', '数量': 'shares', '持仓数量': 'shares',
  '可用数量': 'shares', '持股数量': 'shares', '持有股数': 'shares', '股份余额': 'shares', 'shares': 'shares',
  // 成本/均价
  '单位成本': 'avgCost', '成本价': 'avgCost', '均价': 'avgCost', '持仓成本': 'avgCost',
  '买入均价': 'avgCost', 'avgCost': 'avgCost', 'avg_cost': 'avgCost',
  // 现价
  '最新价': 'currentPrice', '现价': 'currentPrice', '当前价': 'currentPrice',
  '市价': 'currentPrice', 'currentPrice': 'currentPrice',
  // 持仓金额（可在缺失股数时反推）
  '持有金额': 'marketValue', '持仓市值': 'marketValue', '持仓金额': 'marketValue', '最新市值': 'marketValue',
  // 类别
  '类别': 'category', '板块': 'category', 'category': 'category',
  // 备注（其余字段忽略：盈亏、涨幅等为计算字段）
  '备注': 'notes', 'notes': 'notes',
};

const CATEGORY_OPTIONS = ['消费', '新能源', '海外', '互联网', '科技', '金融', '医药', '其他'];

// ── 规则引擎：按代码 + 名称关键词推断板块 ──────────────────────
function guessCategory(symbol: string, name: string): string {
  const s = symbol.trim();
  const n = name.trim();
  // 纯字母 = 海外股（美股/港股 ADR 等）
  if (/^[A-Za-z]+$/.test(s)) return '海外';
  // 港股代码（4-5位纯数字）
  if (/^\d{4,5}$/.test(s)) return '海外';
  // 金融
  if (/银行|证券|保险|信托|期货|基金|券商|资产管理|投资控股|租赁/.test(n)) return '金融';
  // 医药
  if (/医药|医疗|生物|制药|药业|健康|医院|基因|疫苗|诊断|试剂|医械/.test(n)) return '医药';
  // 新能源
  if (/新能源|光伏|风电|储能|锂电|电池|氢能|充电|太阳能|风能|绿电/.test(n)) return '新能源';
  // 消费
  if (/消费|食品|饮料|白酒|啤酒|零售|百货|超市|家居|服装|餐饮|日化|酿酒|乳业/.test(n)) return '消费';
  // 互联网
  if (/互联网|网络|游戏|电商|直播|社交|在线|云|SaaS/.test(n)) return '互联网';
  // 科技
  if (/科技|芯片|半导体|通信|电子|软件|数字|智能|机器人|航天|卫星|激光|雷达|仪器/.test(n)) return '科技';
  return '其他';
}

interface ParsedRow {
  name: string;
  symbol: string;
  category: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
  notes?: string;
  _error?: string;
}

type ImportStatus = 'idle' | 'preview' | 'importing' | 'done' | 'error';

interface ImportPageProps { onImportDone?: () => void; }

// ── CSV 模板下载（使用券商常见列名）──────────────────────────────
const downloadTemplate = () => {
  const csv = '代码,名称,类别,持有数量,单位成本,最新价,备注\n600519,贵州茅台,消费,10,1800,1850,白酒龙头\nAAPL,苹果,海外,50,170,180,美股科技\n';
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'holdings_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

function normalizeSymbol(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  return raw
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^=/, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/[,\uFF0C]/g, '')
    .replace(/[%￥¥元股份天]/g, '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── 解析任意行为标准对象 ───────────────────────────────────────
const normalizeRow = (raw: Record<string, string>): ParsedRow => {
  const mapped: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COL_MAP[k.trim()] ?? k.trim();
    mapped[key] = String(v ?? '').trim();
  }
  const symbol = normalizeSymbol(mapped.symbol);
  const shares = parseNumber(mapped.shares);
  const avgCost = parseNumber(mapped.avgCost);
  const currentPrice = parseNumber(mapped.currentPrice);
  const marketValue = parseNumber(mapped.marketValue);
  const inferredShares = shares > 0 ? shares : (marketValue > 0 && currentPrice > 0 ? marketValue / currentPrice : 0);

  const row: ParsedRow = {
    name:         mapped.name         || '',
    symbol,
    // 优先取文件中已有的类别；否则用规则引擎推断
    category:     CATEGORY_OPTIONS.includes(mapped.category)
                    ? mapped.category
                    : guessCategory(symbol || '', mapped.name || ''),
    shares:       inferredShares,
    avgCost,
    currentPrice: currentPrice || undefined,
    notes:        mapped.notes || undefined,
  };
  if (!row.name)          row._error = '缺少名称';
  else if (!row.symbol)   row._error = '缺少代码';
  else if (row.shares<=0) row._error = '股数无效';
  else if (row.avgCost<=0)row._error = '均价无效';
  return row;
};

// ── 跳过汇总行（券商导出中的合计/汇总行）──────────────────────
const SKIP_KEYWORDS = ['合计', '汇总', '小计', '总计', '合并', 'Total', 'total'];
const isSummaryRow = (raw: Record<string, string>): boolean => {
  return Object.values(raw).some(v =>
    SKIP_KEYWORDS.some(kw => String(v ?? '').trim().includes(kw))
  );
};

// ── 解析 CSV ──────────────────────────────────────────────────
const parseCSV = (file: File): Promise<ParsedRow[]> =>
  new Promise(resolve => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: r => resolve(
        (r.data as Record<string,string>[])
          .filter(row => !isSummaryRow(row))
          .map(normalizeRow)
      ),
    });
  });

// ── 解析 XLSX ─────────────────────────────────────────────────
const parseXLSX = async (file: File): Promise<ParsedRow[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string,string>>(ws, { defval: '' });
  return rows.filter(row => !isSummaryRow(row)).map(normalizeRow);
};

// ═══════════════════════════════════════════════════════════════
export const ImportPage: React.FC<ImportPageProps> = ({ onImportDone }) => {
  const { fetchPortfolio, fetchHoldings } = usePortfolioStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [status, setStatus]   = useState<ImportStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult]   = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const [importErrors, setImportErrors] = useState<ImportHoldingError[]>([]);
  const [dragging, setDragging] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    let parsed: ParsedRow[] = [];
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      parsed = await parseCSV(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      parsed = await parseXLSX(file);
    } else {
      setStatus('error'); return;
    }
    setRows(parsed);
    setStatus('preview');
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const validRows = rows.filter(r => !r._error);
  const invalidRows = rows.filter(r => r._error);

  const doImport = async () => {
    setStatus('importing');
    setImportErrors([]);
    let importedCount = 0;
    try {
      const res = await holdingsApi.importHoldings(validRows.map(row => ({
        name: row.name, symbol: row.symbol, category: row.category,
        shares: row.shares, avgCost: row.avgCost,
        currentPrice: row.currentPrice, notes: row.notes,
      })));
      const { created = 0, updated = 0, failed = 0, errors = [] } = res.data.data ?? {};
      importedCount = created + updated;
      setResult({ ok: importedCount, fail: failed });
      setImportErrors(errors);
    } catch {
      setResult({ ok: 0, fail: validRows.length });
      setImportErrors([]);
    }
    setStatus('done');
    // 刷新数据
    await fetchPortfolio();
    await fetchHoldings();
    // 3 秒后自动跳回资产配置页
    if (importedCount > 0) setTimeout(() => onImportDone?.(), 2500);
  };

  const reset = () => { setStatus('idle'); setRows([]); setFileName(''); setImportErrors([]); };

  // AI 重新识别所有"其他"类别的条目
  const handleClassify = async () => {
    setClassifying(true);
    try {
      const res = await holdingsApi.classifyHoldings(
        rows.filter(r => !r._error).map(r => ({ symbol: r.symbol, name: r.name }))
      );
      const map: Record<string, string> = {};
      for (const item of (res.data.data ?? [])) map[item.symbol] = item.category;
      setRows(prev => prev.map(r => map[r.symbol] ? { ...r, category: map[r.symbol] } : r));
    } catch {
      // 静默失败，保留规则引擎结果
    }
    setClassifying(false);
  };

  // ── 渲染 ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-stone-100">导入资产</h2>
        <p className="text-sm text-stone-500 mt-0.5">支持 CSV / Excel 批量导入，或手动填写快照</p>
      </div>

      {/* ── 上传区 ── */}
      {status === 'idle' && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-[#D97757] bg-[rgba(217,119,87,0.08)]'
                  : 'border-stone-700 hover:border-[rgba(217,119,87,0.4)] hover:bg-stone-800/30'
              }`}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
              <FileSpreadsheet className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-600">拖入文件或点击选择</p>
              <p className="text-xs text-stone-400 mt-1">支持 .csv · .xlsx · .xls</p>
            </div>

            {/* Template download */}
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-stone-500 hover:text-[#D97757] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              下载 CSV 模板
            </button>

            {/* Format guide */}
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <p className="text-xs font-medium text-stone-500 mb-2">支持的列格式</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ['名称 / 证券名称', '必填'],
                  ['代码 / 证券代码', '必填'],
                  ['持有数量 / 数量', '必填'],
                  ['单位成本 / 均价', '必填'],
                  ['最新价 / 现价',   '可选'],
                  ['类别 / 板块',     '可选'],
                ].map(([col, req]) => (
                  <div key={col} className="flex items-center justify-between">
                    <span className="text-xs text-stone-500 font-mono">{col}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${req === '必填' ? 'bg-[rgba(217,119,87,0.15)] text-[#D97757]' : 'bg-stone-200 text-stone-500'}`}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 预览表格 ── */}
      {status === 'preview' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-300">{fileName}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                共 {rows.length} 行 · <span className="text-emerald-400">{validRows.length} 有效</span>
                {invalidRows.length > 0 && <> · <span className="text-red-400">{invalidRows.length} 错误</span></>}
              </p>
            </div>
            <button onClick={reset} className="text-stone-600 hover:text-stone-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Valid rows */}
          {validRows.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm text-stone-300">待导入 ({validRows.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-500 border-b border-stone-700/50">
                        {['名称', '代码', '类别', '股数', '均价', '现价'].map(h => (
                          <th key={h} className="pb-2 text-left font-medium pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/50">
                      {validRows.map((r, i) => (
                        <tr key={i} className="text-stone-300">
                          <td className="py-2 pr-4 font-medium">{r.name}</td>
                          <td className="py-2 pr-4 font-mono text-stone-400">{r.symbol}</td>
                          <td className="py-2 pr-4">
                            <select
                              value={r.category}
                              onChange={e => {
                                const next = [...rows];
                                const idx = next.findIndex(x => x === r);
                                if (idx !== -1) { next[idx] = { ...next[idx], category: e.target.value }; setRows(next); }
                              }}
                              className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[rgba(217,119,87,0.5)]"
                            >
                              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4 font-mono-number">{r.shares}</td>
                          <td className="py-2 pr-4 font-mono-number">{r.avgCost.toFixed(2)}</td>
                          <td className="py-2 pr-4 font-mono-number">{r.currentPrice?.toFixed(2) ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error rows */}
          {invalidRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> 错误行 ({invalidRows.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {invalidRows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 bg-red-500/5 border border-red-500/15 rounded-lg">
                      <span className="text-red-400 font-medium">{r._error}</span>
                      <span className="text-stone-500">{r.name || r.symbol || `行${i+1}`}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} className="flex-1">取消</Button>
            <Button
              variant="secondary"
              onClick={handleClassify}
              isLoading={classifying}
              disabled={classifying || validRows.length === 0}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI 识别类别
            </Button>
            <Button onClick={doImport} disabled={validRows.length === 0} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              导入 {validRows.length} 条
            </Button>
          </div>
        </>
      )}

      {/* ── 导入中 ── */}
      {status === 'importing' && (
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-stone-400">正在导入，请稍候…</p>
          </CardContent>
        </Card>
      )}

      {/* ── 完成 ── */}
      {status === 'done' && (
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
            <div className="text-center">
              <p className="text-base font-semibold text-stone-100">导入完成</p>
              <p className="text-sm text-stone-400 mt-1">
                成功 <span className="text-emerald-400 font-medium">{result.ok}</span> 条
                {result.fail > 0 && <>，失败 <span className="text-red-400 font-medium">{result.fail}</span> 条</>}
              </p>
            </div>
            {importErrors.length > 0 && (
              <div className="w-full max-w-xl space-y-2">
                {importErrors.slice(0, 8).map((item, idx) => (
                  <div key={`${item.index}-${idx}`} className="text-xs py-2 px-3 bg-red-500/5 border border-red-500/15 rounded-lg">
                    <span className="text-red-400 font-medium">{item.reason}</span>
                    <span className="text-stone-500 ml-2">
                      {item.name || item.symbol || `第 ${item.index + 1} 行`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" onClick={reset}>继续导入</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

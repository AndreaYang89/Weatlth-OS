import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { holdingsApi } from '@/api/services';

// ── 支持的列映射（中英文兼容）────────────────────────────────────
const COL_MAP: Record<string, string> = {
  '名称': 'name', 'name': 'name', 'Name': 'name',
  '代码': 'symbol', 'symbol': 'symbol', 'Symbol': 'symbol', 'code': 'symbol',
  '类别': 'category', 'category': 'category', 'Category': 'category',
  '股数': 'shares', 'shares': 'shares', 'Shares': 'shares', '数量': 'shares',
  '均价': 'avgCost', 'avgCost': 'avgCost', '成本': 'avgCost', 'avg_cost': 'avgCost',
  '现价': 'currentPrice', 'currentPrice': 'currentPrice', '当前价': 'currentPrice',
  '备注': 'notes', 'notes': 'notes',
};

const CATEGORY_OPTIONS = ['消费', '新能源', '海外', '互联网', '科技', '金融', '医药', '其他'];

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

// ── CSV 模板下载 ────────────────────────────────────────────────
const downloadTemplate = () => {
  const csv = '名称,代码,类别,股数,均价,现价,备注\n贵州茅台,600519,消费,10,1800,1850,白酒龙头\n苹果,AAPL,海外,50,170,180,美股科技\n';
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'holdings_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ── 解析任意行为标准对象 ───────────────────────────────────────
const normalizeRow = (raw: Record<string, string>): ParsedRow => {
  const mapped: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COL_MAP[k.trim()] ?? k.trim();
    mapped[key] = String(v ?? '').trim();
  }
  const row: ParsedRow = {
    name:         mapped.name         || '',
    symbol:       mapped.symbol       || '',
    category:     CATEGORY_OPTIONS.includes(mapped.category) ? mapped.category : '其他',
    shares:       parseFloat(mapped.shares)       || 0,
    avgCost:      parseFloat(mapped.avgCost)      || 0,
    currentPrice: mapped.currentPrice ? parseFloat(mapped.currentPrice) : undefined,
    notes:        mapped.notes || undefined,
  };
  if (!row.name)          row._error = '缺少名称';
  else if (!row.symbol)   row._error = '缺少代码';
  else if (row.shares<=0) row._error = '股数无效';
  else if (row.avgCost<=0)row._error = '均价无效';
  return row;
};

// ── 解析 CSV ──────────────────────────────────────────────────
const parseCSV = (file: File): Promise<ParsedRow[]> =>
  new Promise(resolve => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: r => resolve((r.data as Record<string,string>[]).map(normalizeRow)),
    });
  });

// ── 解析 XLSX ─────────────────────────────────────────────────
const parseXLSX = async (file: File): Promise<ParsedRow[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string,string>>(ws, { defval: '' });
  return rows.map(normalizeRow);
};

// ═══════════════════════════════════════════════════════════════
export const ImportPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [status, setStatus]   = useState<ImportStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult]   = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const [dragging, setDragging] = useState(false);

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
    let ok = 0, fail = 0;
    for (const row of validRows) {
      try {
        await holdingsApi.createHolding({
          name: row.name, symbol: row.symbol, category: row.category,
          shares: row.shares, avgCost: row.avgCost,
          currentPrice: row.currentPrice, notes: row.notes,
        });
        ok++;
      } catch { fail++; }
    }
    setResult({ ok, fail });
    setStatus('done');
  };

  const reset = () => { setStatus('idle'); setRows([]); setFileName(''); };

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
              <FileSpreadsheet className="w-10 h-10 text-stone-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-300">拖入文件或点击选择</p>
              <p className="text-xs text-stone-600 mt-1">支持 .csv · .xlsx · .xls</p>
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
            <div className="p-3 bg-stone-800/40 rounded-lg border border-stone-700/50">
              <p className="text-xs font-medium text-stone-400 mb-2">支持的列格式</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ['名称 / name', '必填'],
                  ['代码 / symbol', '必填'],
                  ['股数 / shares', '必填'],
                  ['均价 / avgCost', '必填'],
                  ['类别 / category', '可选'],
                  ['现价 / currentPrice', '可选'],
                ].map(([col, req]) => (
                  <div key={col} className="flex items-center justify-between">
                    <span className="text-xs text-stone-500 font-mono">{col}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${req === '必填' ? 'bg-[rgba(217,119,87,0.15)] text-[#D97757]' : 'bg-stone-800 text-stone-600'}`}>{req}</span>
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
                            <span className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">{r.category}</span>
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
            <Button variant="secondary" onClick={reset}>继续导入</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

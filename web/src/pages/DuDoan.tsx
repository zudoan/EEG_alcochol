import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'
import { apiAnalyze, apiModels, apiPredict, apiPredictAll } from '../lib/api'
import {
  EEG_BAND_KNOWLEDGE,
  citationById,
  parseBandFromFeature,
  parseChannelFromFeature,
  type BandKey,
} from '../lib/eeg_knowledge'

function Heatmap({ z, x, y }: { z: number[][]; x?: number[]; y?: number[] }) {
  if (!z || z.length === 0) return null
  const flat = z.flat()
  const zmin = Math.min(...flat)
  const zmax = Math.max(...flat)

  const color = (v: number) => {
    const t = (v - zmin) / (zmax - zmin + 1e-9)
    const r = Math.round(99 + t * (236 - 99))
    const g = Math.round(102 + t * (72 - 102))
    const b = Math.round(241 + t * (153 - 241))
    return `rgb(${r},${g},${b})`
  }

  const xticks = useMemo(() => {
    if (!x || x.length === 0) return [] as { pos: number; label: string }[]
    const idx = [0, Math.floor((x.length - 1) * 0.25), Math.floor((x.length - 1) * 0.5), Math.floor((x.length - 1) * 0.75), x.length - 1]
    const uniq = Array.from(new Set(idx)).filter((i) => i >= 0 && i < x.length)
    return uniq.map((i) => ({ pos: i, label: String(Number(x[i]).toFixed(2)) }))
  }, [x])

  const yticks = useMemo(() => {
    if (!y || y.length === 0) return [] as { pos: number; label: string }[]
    const idx = [0, Math.floor((y.length - 1) * 0.25), Math.floor((y.length - 1) * 0.5), Math.floor((y.length - 1) * 0.75), y.length - 1]
    const uniq = Array.from(new Set(idx)).filter((i) => i >= 0 && i < y.length)
    return uniq.map((i) => ({ pos: i, label: String(Number(y[i]).toFixed(1)) }))
  }, [y])

  return (
    <div className="overflow-auto">
      <div className="inline-block rounded-xl bg-white/5 p-2">
        {(y && y.length > 0) || (x && x.length > 0) ? (
          <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: '56px 1fr' }}>
            <div className="text-xs text-white/60">Tần số (Hz)</div>
            <div className="text-xs text-white/60 text-right">Thời gian (s)</div>
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: '56px 1fr' }}>
          <div className="relative">
            {yticks.map((t) => (
              <div
                key={t.pos}
                className="absolute left-0 -translate-y-1/2 text-[11px] text-white/60"
                style={{ top: `${(t.pos / Math.max(1, (z.length - 1))) * 100}%` }}
              >
                {t.label}
              </div>
            ))}
          </div>

          <div>
        {z.map((row, i) => (
          <div key={i} className="flex">
            {row.map((v, j) => (
              <div
                key={j}
                title={`(${i},${j})=${v.toFixed(3)}`}
                style={{ background: color(v) }}
                className="h-3 w-3 rounded-[2px]"
              />
            ))}
          </div>
        ))}

            {xticks.length > 0 && (
              <div className="relative mt-2 h-4">
                {xticks.map((t) => (
                  <div
                    key={t.pos}
                    className="absolute -translate-x-1/2 text-[11px] text-white/60"
                    style={{ left: `${(t.pos / Math.max(1, (z[0]?.length || 1) - 1)) * 100}%` }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-white/60">Heatmap spectrogram (màu đậm = năng lượng cao).</div>
    </div>
  )
}

export default function DuDoan() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pred, setPred] = useState<any>(null)
  const [predAll, setPredAll] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedChannel, setSelectedChannel] = useState<string>('')

  useEffect(() => {
    apiModels()
      .then((x) => {
        const ms = (x.models || []) as string[]
        setModels(ms)
        if (!selectedModel && ms.length > 0) setSelectedModel(ms[0])
      })
      .catch(() => {})
  }, [])

  const onPredict = async () => {
    if (!file) return
    setErr(null)
    setLoading(true)
    try {
      const [p, a] = await Promise.all([apiPredict(file, selectedModel || undefined), apiAnalyze(file)])
      setPred(p)
      setPredAll(null)
      setAnalysis(a)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const onPredictAll = async () => {
    if (!file) return
    setErr(null)
    setLoading(true)
    try {
      const [pall, a] = await Promise.all([apiPredictAll(file), apiAnalyze(file)])
      setPred(null)
      setPredAll(pall)
      setAnalysis(a)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const labelText = pred?.pred_label === 1 ? 'Alcoholic (a=1)' : 'Control (c=0)'
  const charts = analysis?.charts

  const predAllSorted = useMemo(() => {
    const items = (predAll?.results || []) as any[]
    return [...items].sort((a, b) => {
      const pa = typeof a?.pred_prob === 'number' ? a.pred_prob : Number.NEGATIVE_INFINITY
      const pb = typeof b?.pred_prob === 'number' ? b.pred_prob : Number.NEGATIVE_INFINITY
      return pb - pa
    })
  }, [predAll])

  useEffect(() => {
    const first = charts?.channel_used_for_timeseries || charts?.channels?.[0] || analysis?.channel_used_for_timeseries || ''
    if (analysis && first && !selectedChannel) setSelectedChannel(String(first))
  }, [analysis, charts, selectedChannel])

  const tsData = useMemo(() => {
    if (!charts) return []
    const by = charts.timeseries_by_channel
    if (by && selectedChannel && by[selectedChannel]) return by[selectedChannel]
    return charts.timeseries || []
  }, [charts, selectedChannel])

  const explain = useMemo(() => {
    if (!pred || !analysis) return null
    const prob = Number(pred.pred_prob)
    const top = (analysis?.charts?.bandpower_top10 || []) as any[]
    const topText = top.slice(0, 5).map((x) => `${x.feature}=${Number(x.value).toFixed(3)}`).join(' • ')

    const bands = new Map<BandKey, { count: number; examples: string[] }>()
    for (const x of top.slice(0, 10)) {
      const f = String(x?.feature || '')
      const band = parseBandFromFeature(f)
      if (!band) continue
      const ch = parseChannelFromFeature(f)
      const ex = ch ? `${EEG_BAND_KNOWLEDGE[band].label_vi}@${ch}` : EEG_BAND_KNOWLEDGE[band].label_vi
      const cur = bands.get(band) || { count: 0, examples: [] }
      cur.count += 1
      if (cur.examples.length < 3) cur.examples.push(ex)
      bands.set(band, cur)
    }

    const bandSummaries = Array.from(bands.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([band, info]) => {
        const kb = EEG_BAND_KNOWLEDGE[band]
        const citations = kb.citations
          .map((id) => citationById(id))
          .filter(Boolean)
          .map((c) => c!)
        return {
          band,
          label: `${kb.label_vi} (${kb.range_hz[0]}–${kb.range_hz[1]}Hz)`,
          examples: info.examples,
          meaning: kb.meaning_vi,
          caution: kb.caution_vi,
          citations,
        }
      })

    const uniqueCitations = new Map<string, { title: string; url: string; accessed: string }>()
    for (const bs of bandSummaries) {
      for (const c of bs.citations) {
        uniqueCitations.set(c.id, { title: c.title, url: c.url, accessed: c.accessed })
      }
    }

    return {
      prob,
      topText,
      bandSummaries,
      sources: Array.from(uniqueCitations.values()),
      note:
        'Mô hình đang dùng đặc trưng bandpower (năng lượng theo dải tần) để phân loại. Mục này giải thích ý nghĩa phổ biến của các dải tần xuất hiện trong top feature và kèm nguồn tham khảo; không thay thế chẩn đoán y khoa.'
    }
  }, [pred, analysis])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Dự đoán</h2>
        <p className="text-sm text-white/60">
          Tải lên 1 file CSV EEG để dự đoán. Bạn có thể chọn 1 trong 7 model của nhóm.
        </p>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-sm font-semibold">Model hiện có</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {models.length === 0 ? (
            <span className="text-sm text-white/60">(Chưa thấy model / API chưa chạy)</span>
          ) : (
            models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModel(m)}
                className={
                  (selectedModel === m
                    ? 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40'
                    : 'bg-white/10 text-white/70 hover:bg-white/15') +
                  ' rounded-full px-3 py-1 text-xs transition'
                }
                title="Chọn model"
              >
                {m}
              </button>
            ))
          )}
        </div>
        {selectedModel ? (
          <div className="mt-2 text-xs text-white/60">
            Đang chọn: <span className="text-white/80">{selectedModel}</span>
          </div>
        ) : null}
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white/80 hover:file:bg-white/15"
          />
          <div className="flex gap-2">
            <button
              onClick={onPredict}
              disabled={!file || loading || !selectedModel}
              className="rounded-xl bg-emerald-500/25 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-glow disabled:opacity-50"
            >
              {loading ? 'Đang dự đoán...' : 'Dự đoán'}
            </button>
            <button
              onClick={onPredictAll}
              disabled={!file || loading}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? 'Đang chạy...' : 'Chạy tất cả model'}
            </button>
          </div>
        </div>
        {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
      </div>

      {pred && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs text-white/60">Kết quả</div>
            <div className="mt-1 text-2xl font-bold">{labelText}</div>
            <div className="mt-2 text-sm text-white/70">Xác suất (prob=1): {Number(pred.pred_prob).toFixed(4)}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs text-white/60">Model sử dụng</div>
            <div className="mt-1 text-sm text-white/80 break-all">{pred.model_path}</div>
          </div>
        </div>
      )}

      {predAll && (
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold">So sánh kết quả theo tất cả model</div>
          <div className="mt-1 text-xs text-white/60">Sắp xếp theo prob(1) giảm dần. Model lỗi sẽ hiển thị error.</div>
          <div className="mt-3 overflow-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="text-xs text-white/60">
                <tr>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">pred_label</th>
                  <th className="py-2 pr-3">prob(1)</th>
                  <th className="py-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {predAllSorted.map((r: any, idx: number) => (
                  <tr key={r.model_name || r.model_path || idx} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-white/80 break-all">{r.model_name || r.model_path}</td>
                    <td className="py-2 pr-3 text-white/80">{typeof r.pred_label === 'number' ? r.pred_label : '-'}</td>
                    <td className="py-2 pr-3 text-white/80">
                      {typeof r.pred_prob === 'number' ? Number(r.pred_prob).toFixed(4) : '-'}
                    </td>
                    <td className="py-2 pr-3 text-red-300 break-all">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analysis && (
        <>
          <div className="glass rounded-2xl p-5 space-y-2">
            <div className="text-sm font-semibold">Phân tích file bạn đã tải lên</div>
            <div className="text-sm text-white/75 leading-relaxed space-y-1">
              <div>- Tần số lấy mẫu: <b>{analysis.preprocessing_summary.fs_hz} Hz</b></div>
              <div>- Số điểm thời gian: <b>{analysis.preprocessing_summary.n_samples}</b></div>
              <div>- Số kênh sau lọc: <b>{analysis.preprocessing_summary.channels_used}</b></div>
              <div>- Xử lý thiếu: {analysis.preprocessing_summary.missing_policy}</div>
              <div>- Đặc trưng trích xuất: {analysis.preprocessing_summary.features.join(' • ')}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">1) Time-series (chọn kênh)</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="text-xs text-white/60">Kênh:</div>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80"
                >
                  {(charts.channels || []).map((c: string) => (
                    <option key={c} value={c} className="bg-bg text-white">
                      {c}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-white/60">(đổi kênh để xem tín hiệu theo thời gian)</div>
              </div>
              <div className="mt-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="t" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Line type="monotone" dataKey="v" stroke="#a5b4fc" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">2) PSD</div>
              <div className="mt-1 text-xs text-white/60">Năng lượng theo tần số (trung bình qua kênh).</div>
              <div className="mt-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.psd}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="f" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Line type="monotone" dataKey="p" stroke="#34d399" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">3) Bandpower theo dải</div>
              <div className="mt-1 text-xs text-white/60">Đặc trưng chính (trung bình qua kênh).</div>
              <div className="mt-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(charts.bandpower_by_band || []).map((x: any) => {
                      const k = String(x.band).toLowerCase() as BandKey
                      const kb = (EEG_BAND_KNOWLEDGE as any)[k]
                      const bandLabel = kb ? `${x.band} (${kb.range_hz[0]}–${kb.range_hz[1]}Hz)` : String(x.band)
                      return { ...x, bandLabel }
                    })}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="bandLabel" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
                      formatter={(v: any) => [`${Number(v).toFixed(4)} (bandpower)`, 'Giá trị']}
                    />
                    <Bar dataKey="value" fill="#a5b4fc" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 text-xs text-white/60">
                Lưu ý: con số trong tooltip là <b>bandpower</b> (năng lượng trong dải), không phải “beta = 7Hz”.
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">4) Spectrogram</div>
              <div className="mt-2 text-sm text-white/75 leading-relaxed">
                Spectrogram là “PSD theo thời gian”: trục dọc là <b>tần số</b>, trục ngang là <b>thời gian</b>, màu đậm là <b>năng lượng cao</b>.
              </div>
              <div className="mt-3">
                <Heatmap z={charts.spectrogram.z} x={charts.spectrogram.t} y={charts.spectrogram.f} />
                <div className="mt-2 text-sm text-white/75 leading-relaxed">
                  <div><b>Cách đọc nhanh:</b></div>
                  <div>- Nếu thấy một vùng màu đậm <b>kéo dài</b> ở khoảng <b>8–13Hz</b> thì dải <b>alpha</b> đang nổi bật trong khoảng thời gian đó.</div>
                  <div>- Nếu vùng đậm tập trung ở <b>13–30Hz</b> (beta) hoặc <b>30–45Hz</b> (gamma), hãy kiểm tra thêm khả năng nhiễu cơ (EMG) bằng time-series.</div>
                  <div>- Đừng so sánh tuyệt đối “màu đậm” giữa các file khác nhau nếu pipeline/chuẩn hoá khác nhau; nên so sánh tương đối trong cùng file.</div>
                </div>
              </div>
            </div>

            <div className="glass md:col-span-2 rounded-2xl p-5">
              <div className="text-sm font-semibold">5) Top đặc trưng nổi bật (bandpower theo kênh/dải)</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {charts.bandpower_top10.map((x: any) => (
                  <div key={x.feature} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-sm text-white/80">{x.feature}</div>
                    <div className="text-sm font-semibold text-indigo-200">{Number(x.value).toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {explain && (
            <div className="glass rounded-2xl p-5 space-y-2">
              <div className="text-sm font-semibold">Vì sao mô hình dự đoán như vậy?</div>
              <div className="text-sm text-white/75 leading-relaxed space-y-2">
                <div>- Xác suất dự đoán (a=1): <b>{explain.prob.toFixed(4)}</b> (ngưỡng phân loại mặc định: 0.5).</div>
                <div>- Một số feature nổi bật (top 5): {explain.topText || '(không có)'}.</div>
                <div>- {explain.note}</div>
              </div>

              {Array.isArray(explain.bandSummaries) && explain.bandSummaries.length > 0 && (
                <div className="mt-3 space-y-3">
                  <div className="text-sm font-semibold">Giải thích theo dải tần (có nguồn)</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {explain.bandSummaries.map((bs: any) => (
                      <div key={bs.band} className="rounded-2xl bg-white/5 p-4 border border-white/10">
                        <div className="text-sm font-semibold">{bs.label}</div>
                        {bs.examples?.length > 0 && (
                          <div className="mt-1 text-xs text-white/60">Ví dụ feature: {bs.examples.join(' • ')}</div>
                        )}
                        <div className="mt-2 text-sm text-white/80">- Ý nghĩa: {bs.meaning}</div>
                        <div className="mt-1 text-sm text-white/80">- Lưu ý: {bs.caution}</div>
                      </div>
                    ))}
                  </div>

                  {Array.isArray(explain.sources) && explain.sources.length > 0 && (
                    <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <div className="text-sm font-semibold">Nguồn tham khảo</div>
                      <div className="mt-2 space-y-1 text-sm text-white/75">
                        {explain.sources.map((s: any, idx: number) => (
                          <div key={idx} className="break-words">
                            - <a className="underline text-indigo-200" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                            {' '}({s.accessed})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="glass rounded-2xl p-5 space-y-2">
        <div className="text-sm font-semibold">Giải thích nhanh</div>
        <div className="text-sm text-white/75 leading-relaxed space-y-2">
          <div>- <b>pred_label=1</b> tương ứng nhãn <b>a</b> (Alcoholic).</div>
          <div>- <b>pred_label=0</b> tương ứng nhãn <b>c</b> (Control).</div>
          <div>- Đây là dự đoán từ mô hình học máy trên đặc trưng bandpower (và scaler đã lưu).</div>
        </div>
      </div>
    </div>
  )
}

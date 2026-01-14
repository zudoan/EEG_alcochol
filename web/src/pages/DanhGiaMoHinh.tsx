import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { apiMetrics } from '../lib/api'

function ConfusionMatrix({ cm }: { cm: number[][] }) {
  const a = cm?.[0]?.[0] ?? 0
  const b = cm?.[0]?.[1] ?? 0
  const c = cm?.[1]?.[0] ?? 0
  const d = cm?.[1]?.[1] ?? 0

  const cells = [
    { r: 0, c: 0, v: a, label: 'TN' },
    { r: 0, c: 1, v: b, label: 'FP' },
    { r: 1, c: 0, v: c, label: 'FN' },
    { r: 1, c: 1, v: d, label: 'TP' },
  ]

  const maxV = Math.max(...cells.map((x) => x.v), 1)

  const bg = (v: number) => {
    const t = v / maxV
    const r = Math.round(99 + t * (236 - 99))
    const g = Math.round(102 + t * (72 - 102))
    const b = Math.round(241 + t * (153 - 241))
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((x) => (
        <div
          key={`${x.r}-${x.c}`}
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: bg(x.v) }}
        >
          <div className="text-xs text-black/70">{x.label}</div>
          <div className="mt-1 text-2xl font-bold text-black/90">{x.v}</div>
        </div>
      ))}
    </div>
  )
}

export default function DanhGiaMoHinh() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [raw, setRaw] = useState<any>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiMetrics()
      .then((x) => {
        setRaw(x)
        const first = x?.metrics?.[0]?.name
        if (first) setSelected(first)
      })
      .catch((e: any) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const metrics = (raw?.metrics || []) as any[]
  const note = raw?.note

  const rows = useMemo(() => {
    return metrics
      .map((m) => {
        const rep = m.report || {}
        const wa = rep['weighted avg'] || {}
        return {
          name: m.name,
          accuracy: Number(m.accuracy ?? 0),
          roc_auc: m.roc_auc == null ? 0 : Number(m.roc_auc),
          precision: Number(wa.precision ?? 0),
          recall: Number(wa.recall ?? 0),
          f1: Number(wa['f1-score'] ?? 0),
        }
      })
  }, [metrics])

  const picked = useMemo(() => metrics.find((m) => m.name === selected) || null, [metrics, selected])
  const pickedRep = picked?.report || null
  const pickedWeighted = pickedRep?.['weighted avg'] || null
  const pickedMacro = pickedRep?.['macro avg'] || null
  const pickedC0 = pickedRep?.['0'] || null
  const pickedC1 = pickedRep?.['1'] || null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Đánh giá & so sánh mô hình</h2>
        <p className="mt-2 text-sm text-white/60">
          Trang này tổng hợp các metric từ lần train gần nhất (file <b>saved_models/metrics.json</b>).
        </p>
      </div>

      {loading && <div className="text-sm text-white/70">Đang tải metrics...</div>}
      {err && <div className="text-sm text-red-300">{err}</div>}
      {note && <div className="glass rounded-2xl p-4 text-sm text-white/70">{note}</div>}

      {rows.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold">So sánh các chỉ số tổng hợp</div>
          <div className="mt-1 text-xs text-white/60">
            Các chỉ số precision/recall/f1 dùng <b>weighted avg</b> (trung bình có trọng số theo support). AUC càng cao càng tốt.
          </div>
          <div className="mt-4 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} interval={0} height={80} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                <Legend />
                <Bar dataKey="accuracy" name="Accuracy" fill="#a5b4fc" radius={[10, 10, 0, 0]} />
                <Bar dataKey="precision" name="Precision (weighted)" fill="#fbbf24" radius={[10, 10, 0, 0]} />
                <Bar dataKey="recall" name="Recall (weighted)" fill="#60a5fa" radius={[10, 10, 0, 0]} />
                <Bar dataKey="f1" name="F1 (weighted)" fill="#f472b6" radius={[10, 10, 0, 0]} />
                <Bar dataKey="roc_auc" name="ROC-AUC" fill="#34d399" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="text-sm font-semibold">Chọn mô hình</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {metrics.map((m) => (
                <button
                  key={m.name}
                  onClick={() => setSelected(m.name)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selected === m.name ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="text-sm font-semibold">Confusion matrix (0=c, 1=a)</div>
            <div className="mt-3">
              {picked?.confusion_matrix ? (
                <ConfusionMatrix cm={picked.confusion_matrix} />
              ) : (
                <div className="text-sm text-white/60">Không có dữ liệu confusion matrix.</div>
              )}
            </div>
          </div>

          <div className="glass md:col-span-2 rounded-2xl p-5">
            <div className="text-sm font-semibold">Chi tiết chỉ số (classification report)</div>
            {!pickedRep ? (
              <div className="mt-2 text-sm text-white/60">Không có report.</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/70">
                      <th className="py-2">Nhóm</th>
                      <th className="py-2">Precision</th>
                      <th className="py-2">Recall</th>
                      <th className="py-2">F1</th>
                      <th className="py-2">Support</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/85">
                    {[
                      { k: 'Class 0 (c)', v: pickedC0 },
                      { k: 'Class 1 (a)', v: pickedC1 },
                      { k: 'Macro avg', v: pickedMacro },
                      { k: 'Weighted avg', v: pickedWeighted },
                    ].map((row) => (
                      <tr key={row.k} className="border-t border-white/10">
                        <td className="py-2 pr-3 font-medium">{row.k}</td>
                        <td className="py-2">{row.v ? Number(row.v.precision).toFixed(4) : '-'}</td>
                        <td className="py-2">{row.v ? Number(row.v.recall).toFixed(4) : '-'}</td>
                        <td className="py-2">{row.v ? Number(row.v['f1-score']).toFixed(4) : '-'}</td>
                        <td className="py-2">{row.v ? Number(row.v.support).toFixed(0) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-xs text-white/60">
                  Gợi ý: nếu dữ liệu cân bằng, macro avg và weighted avg sẽ gần nhau; nếu lệch lớp, weighted avg phản ánh đúng hơn theo số mẫu.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

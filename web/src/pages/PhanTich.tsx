import { useEffect, useMemo, useState } from 'react'
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'

import { apiEda } from '../lib/api'
import { EEG_BAND_KNOWLEDGE, type BandKey } from '../lib/eeg_knowledge'

type Pt = { x: number; y: number; split: 'train' | 'test' }

function ElectrodeHeat({ points }: { points: { name: string; value: number; band: string }[] }) {
  // Simple top-view 2D montage (same spirit as the 3D montage): x left(-) right(+), y back(-) front(+)
  const pos: Record<string, { x: number; y: number }> = {
    FP1: { x: -0.55, y: 0.95 }, FPZ: { x: 0.0, y: 0.98 }, FP2: { x: 0.55, y: 0.95 },
    AF3: { x: -0.30, y: 0.88 }, AF4: { x: 0.30, y: 0.88 },
    F7: { x: -0.92, y: 0.70 }, F5: { x: -0.62, y: 0.72 }, F3: { x: -0.36, y: 0.74 }, F1: { x: -0.14, y: 0.76 }, FZ: { x: 0.0, y: 0.78 }, F2: { x: 0.14, y: 0.76 }, F4: { x: 0.36, y: 0.74 }, F6: { x: 0.62, y: 0.72 }, F8: { x: 0.92, y: 0.70 },
    FT7: { x: -1.03, y: 0.46 }, FC5: { x: -0.66, y: 0.46 }, FC3: { x: -0.38, y: 0.48 }, FC1: { x: -0.16, y: 0.50 }, FCZ: { x: 0.0, y: 0.52 }, FC2: { x: 0.16, y: 0.50 }, FC4: { x: 0.38, y: 0.48 }, FC6: { x: 0.66, y: 0.46 }, FT8: { x: 1.03, y: 0.46 },
    T7: { x: -1.08, y: 0.12 }, C5: { x: -0.70, y: 0.14 }, C3: { x: -0.40, y: 0.16 }, C1: { x: -0.18, y: 0.18 }, CZ: { x: 0.0, y: 0.20 }, C2: { x: 0.18, y: 0.18 }, C4: { x: 0.40, y: 0.16 }, C6: { x: 0.70, y: 0.14 }, T8: { x: 1.08, y: 0.12 },
    TP7: { x: -1.03, y: -0.18 }, CP5: { x: -0.66, y: -0.18 }, CP3: { x: -0.38, y: -0.16 }, CP1: { x: -0.16, y: -0.14 }, CPZ: { x: 0.0, y: -0.12 }, CP2: { x: 0.16, y: -0.14 }, CP4: { x: 0.38, y: -0.16 }, CP6: { x: 0.66, y: -0.18 }, TP8: { x: 1.03, y: -0.18 },
    P7: { x: -0.92, y: -0.44 }, P5: { x: -0.62, y: -0.44 }, P3: { x: -0.36, y: -0.42 }, P1: { x: -0.14, y: -0.40 }, PZ: { x: 0.0, y: -0.38 }, P2: { x: 0.14, y: -0.40 }, P4: { x: 0.36, y: -0.42 }, P6: { x: 0.62, y: -0.44 }, P8: { x: 0.92, y: -0.44 },
    PO7: { x: -0.62, y: -0.68 }, PO5: { x: -0.36, y: -0.66 }, PO3: { x: -0.18, y: -0.64 }, POZ: { x: 0.0, y: -0.62 }, PO4: { x: 0.18, y: -0.64 }, PO6: { x: 0.36, y: -0.66 }, PO8: { x: 0.62, y: -0.68 },
    O1: { x: -0.38, y: -0.90 }, OZ: { x: 0.0, y: -0.94 }, O2: { x: 0.38, y: -0.90 },
  }

  const pts = points
    .map((p) => {
      const key = p.name.toUpperCase()
      const xy = pos[key]
      if (!xy) return null
      return { name: key, x: xy.x, y: xy.y, value: p.value }
    })
    .filter(Boolean) as any[]

  const vals = pts.map((p) => p.value)
  const vmin = Math.min(...vals, 0)
  const vmax = Math.max(...vals, 1)
  const color = (v: number) => {
    const t = (v - vmin) / (vmax - vmin + 1e-9)
    const r = Math.round(99 + t * (236 - 99))
    const g = Math.round(102 + t * (72 - 102))
    const b = Math.round(241 + t * (153 - 241))
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pts.slice(0, 64).map((p) => (
        <div
          key={p.name}
          title={`${p.name}: ${Number(p.value).toFixed(4)}`}
          className="rounded-full px-2 py-1 text-xs border border-white/10"
          style={{ background: color(p.value) }}
        >
          <span className="text-black/90 font-semibold">{p.name}</span>
        </div>
      ))}
      <div className="w-full text-xs text-white/60 mt-2">
        Bản đồ nhiệt da đầu hiển thị theo vị trí điện cực (bản rút gọn dạng điểm màu). Màu đậm hơn = giá trị mean bandpower cao hơn.
      </div>
    </div>
  )
}

export default function PhanTich() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [raw, setRaw] = useState<any>(null)
  const [band, setBand] = useState<BandKey>('beta')
  const [modelName, setModelName] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiEda()
      .then((x) => {
        setRaw(x)
        const firstModel = Object.keys(x?.eda?.feature_importance || {})[0]
        if (firstModel) setModelName(firstModel)
      })
      .catch((e: any) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const eda = raw?.eda
  const note = raw?.note

  const labelRows = useMemo(() => {
    const tr = eda?.label_summary?.train_counts || [0, 0]
    const te = eda?.label_summary?.test_counts || [0, 0]
    return [
      { split: 'Train', c0: Number(tr[0] || 0), c1: Number(tr[1] || 0) },
      { split: 'Test', c0: Number(te[0] || 0), c1: Number(te[1] || 0) },
    ]
  }, [eda])

  const pca = (eda?.distribution_shift?.pca_points || []) as Pt[]
  const pcaTrain = pca.filter((p) => p.split === 'train')
  const pcaTest = pca.filter((p) => p.split === 'test')

  const eog = raw?.runtime?.eog_clean

  const dq = eda?.data_quality?.bandpower_train
  const dqOutlier = useMemo(() => {
    const iqr = dq?.iqr_outlier_top_features || []
    const z = dq?.z_outlier_top_features || []
    const skew = dq?.skew_abs_top_features || []
    return { iqr, z, skew }
  }, [dq])

  const featImpAll = eda?.feature_importance || {}
  const featImpModels = Object.keys(featImpAll)
  const featImp = modelName ? (featImpAll[modelName] || []) : []

  const scalpPoints = useMemo(() => {
    const items = (eda?.scalp_bandpower?.[band] || []) as any[]
    return items.map((x) => ({ name: String(x.channel), value: Number(x.value), band }))
  }, [eda, band])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Phân tích dữ liệu (EDA trên tập train/test)</h2>
        <p className="mt-2 text-sm text-white/60">
          Trang này hiển thị các biểu đồ kiểm tra chất lượng dữ liệu và đặc trưng giống như khi chạy code: lệch nhãn, rò rỉ train/test,
          chênh phân phối, outlier, feature quan trọng và bản đồ nhiệt da đầu.
        </p>
      </div>

      {loading && <div className="text-sm text-white/70">Đang tải EDA...</div>}
      {err && <div className="text-sm text-red-300">{err}</div>}
      {note && <div className="glass rounded-2xl p-4 text-sm text-white/70">{note}</div>}

      {eda && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">1) Kiểm tra lệch nhãn (class imbalance)</div>
              <div className="mt-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={labelRows}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="split" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Bar dataKey="c0" name="Class 0 (c)" fill="#60a5fa" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="c1" name="Class 1 (a)" fill="#f472b6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-white/60">
                Mục tiêu: đảm bảo train/test không lệch nhãn quá mạnh (nếu lệch, cân nhắc stratified split hoặc reweight).
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">2) Rò rỉ train/test (leakage)</div>
              <div className="mt-2 text-sm text-white/75 leading-relaxed space-y-1">
                <div>- Train files: <b>{eda.leakage?.train_n}</b> • Test files: <b>{eda.leakage?.test_n}</b></div>
                <div>- Trùng basename: <b>{eda.leakage?.basename_overlap_count}</b></div>
                <div>- Trùng nội dung (MD5): <b>{eda.leakage?.md5_overlap_count}</b></div>
              </div>
              <div className="mt-3 text-xs text-white/60">
                Cách xử lý: loại file test trùng nội dung với train (nếu bật REMOVE_TEST_DUPLICATES).
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">3) Chênh phân phối train/test (PCA trực quan)</div>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" dataKey="x" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                    <ZAxis type="number" dataKey="z" range={[60, 60]} />
                    <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Scatter name="Train" data={pcaTrain} fill="#a5b4fc" />
                    <Scatter name="Test" data={pcaTest} fill="#34d399" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-white/60">
                Nếu 2 cụm train/test tách biệt mạnh → có thể có shift (khác phân phối). Khi đó đánh giá model dễ “ảo”.
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">4) Nâng cấp đã làm: khử nhiễu EOG (ICA)</div>
              <div className="mt-2 text-sm text-white/75 leading-relaxed space-y-1">
                <div>- Trạng thái: <b>{eog?.enabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}</b></div>
                <div className="text-xs text-white/60">{eog?.method || 'highpass + FastICA'}</div>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                  <div className="text-xs text-white/60">High-pass (Hz)</div>
                  <div className="text-sm font-semibold text-white/85">{Number(eog?.highpass_hz ?? 1.0).toFixed(2)}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                  <div className="text-xs text-white/60">ICA components</div>
                  <div className="text-sm font-semibold text-white/85">{Number(eog?.ica_n_components ?? 12)}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                  <div className="text-xs text-white/60">Corr threshold</div>
                  <div className="text-sm font-semibold text-white/85">{Number(eog?.corr_threshold ?? 0.35).toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/60">
                Mục tiêu: giảm artefact nháy mắt/chuyển động mắt bằng cách loại các ICA component có tương quan cao với tín hiệu vùng trán (FP1/FP2/FZ...).
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">5) Kiểm tra outlier / skew trên feature (train)</div>
              <div className="mt-2 text-xs text-white/60">
                Đây là các feature có dấu hiệu bất thường (top theo skew, IQR-outlier, Z-outlier). Dùng để quyết định chuẩn hoá/loại feature.
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="text-xs font-semibold text-white/70">Skew |top|</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dqOutlier.skew.slice(0, 8).map((f: string) => (
                      <span key={f} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/75 border border-white/10">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70">Outlier theo IQR</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dqOutlier.iqr.slice(0, 8).map((f: string) => (
                      <span key={f} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/75 border border-white/10">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70">Outlier theo Z-score</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dqOutlier.z.slice(0, 8).map((f: string) => (
                      <span key={f} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/75 border border-white/10">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/60">Cách xử lý: dùng RobustScaler cho bandpower để giảm ảnh hưởng outlier.</div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">6) Feature quan trọng (theo model)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {featImpModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModelName(m)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      modelName === m ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {featImp.slice(0, 10).map((x: any) => (
                  <div key={x.feature} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/10">
                    <div className="text-sm text-white/80">{x.feature}</div>
                    <div className="text-sm font-semibold text-indigo-200">{Number(x.importance).toFixed(6)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-white/60">
                Ghi chú: với Logistic Regression dùng |coef|; với Random Forest dùng feature_importances_.
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">7) Bản đồ nhiệt da đầu (mean bandpower theo kênh)</div>
                <div className="mt-1 text-xs text-white/60">Chọn dải tần để xem vùng nào có năng lượng nổi bật trên train.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EEG_BAND_KNOWLEDGE) as BandKey[]).map((k) => {
                  const kb = (EEG_BAND_KNOWLEDGE as any)[k]
                  const lbl = kb ? `${k} (${kb.range_hz[0]}–${kb.range_hz[1]}Hz)` : k
                  return (
                    <button
                      key={k}
                      onClick={() => setBand(k)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        band === k ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {lbl}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-4">
              <ElectrodeHeat points={scalpPoints.map((p) => ({ name: p.name, value: p.value, band: p.band }))} />
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="text-sm font-semibold">Cách giải quyết đã làm</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(eda.actions_taken || []).map((x: any) => (
                <div key={x.topic} className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <div className="text-sm font-semibold">{x.topic}</div>
                  <div className="mt-2 text-sm text-white/75 leading-relaxed">{x.how}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

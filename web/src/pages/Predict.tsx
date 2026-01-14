import { useEffect, useState } from 'react'
import { apiModels, apiPredict } from '../lib/api'

export default function Predict() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pred, setPred] = useState<any>(null)
  const [models, setModels] = useState<string[]>([])

  useEffect(() => {
    apiModels().then((x) => setModels(x.models || [])).catch(() => {})
  }, [])

  const onPredict = async () => {
    if (!file) return
    setErr(null)
    setLoading(true)
    try {
      const res = await apiPredict(file)
      setPred(res)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const labelText = pred?.pred_label === 1 ? 'Alcoholic (a=1)' : 'Control (c=0)'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Predict</h2>
        <p className="text-sm text-white/60">Upload 1 file CSV để dự đoán bằng model tốt nhất trong saved_models.</p>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-sm font-semibold">Available models</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {models.length === 0 ? (
            <span className="text-sm text-white/60">(none / API not running)</span>
          ) : (
            models.map((m) => (
              <span key={m} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {m}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white/80 hover:file:bg-white/15"
          />
          <button
            onClick={onPredict}
            disabled={!file || loading}
            className="rounded-xl bg-emerald-500/25 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-glow disabled:opacity-50"
          >
            {loading ? 'Predicting...' : 'Predict'}
          </button>
        </div>
        {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
      </div>

      {pred && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs text-white/60">Prediction</div>
            <div className="mt-1 text-2xl font-bold">{labelText}</div>
            <div className="mt-2 text-sm text-white/70">prob(1): {Number(pred.pred_prob).toFixed(4)}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs text-white/60">Model used</div>
            <div className="mt-1 text-sm text-white/80 break-all">{pred.model_path}</div>
          </div>
        </div>
      )}
    </div>
  )
}

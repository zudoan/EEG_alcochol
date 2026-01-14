import { useMemo, useState } from 'react'
import { apiAnalyze, apiModels } from '../lib/api'

export default function Analysis() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  const onAnalyze = async () => {
    if (!file) return
    setErr(null)
    setLoading(true)
    try {
      const res = await apiAnalyze(file)
      setData(res)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Analysis</h2>
          <p className="text-sm text-white/60">Upload 1 file CSV để xem thống kê nhanh.</p>
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
            onClick={onAnalyze}
            disabled={!file || loading}
            className="rounded-xl bg-indigo-500/30 px-4 py-2 text-sm font-semibold text-indigo-100 shadow-glow disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
      </div>

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-semibold">Info</div>
            <div className="mt-2 text-sm text-white/70">
              <div>trial_number: {data.trial_number}</div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-semibold">Spectrogram stats</div>
            <div className="mt-2 text-sm text-white/70">
              <div>shape: {JSON.stringify(data.spectrogram.shape)}</div>
              <div>min/max: {data.spectrogram.min.toFixed(3)} / {data.spectrogram.max.toFixed(3)}</div>
              <div>mean/std: {data.spectrogram.mean.toFixed(3)} / {data.spectrogram.std.toFixed(3)}</div>
            </div>
          </div>

          <div className="glass md:col-span-2 rounded-2xl p-4">
            <div className="text-sm font-semibold">Top bandpower features</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {data.bandpower_top10.map((x: any) => (
                <div key={x.feature} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-sm text-white/80">{x.feature}</div>
                  <div className="text-sm font-semibold text-indigo-200">{Number(x.value).toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

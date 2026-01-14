const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export async function apiHealth() {
  const r = await fetch(`${API_BASE}/health`)
  if (!r.ok) throw new Error('API health failed')
  return r.json()
}

export async function apiModels() {
  const r = await fetch(`${API_BASE}/models`)
  if (!r.ok) throw new Error('API models failed')
  return r.json()
}

export async function apiMetrics() {
  const r = await fetch(`${API_BASE}/metrics`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function apiEda() {
  const r = await fetch(`${API_BASE}/eda`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function apiAnalyze(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function apiPredict(file: File, modelName?: string) {
  const fd = new FormData()
  fd.append('file', file)
  const q = modelName ? `?model_name=${encodeURIComponent(modelName)}` : ''
  const r = await fetch(`${API_BASE}/predict${q}`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function apiPredictAll(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API_BASE}/predict_all`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

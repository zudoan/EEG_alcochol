export default function About() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">About</h2>
      <div className="glass rounded-2xl p-5 text-sm text-white/70 space-y-2">
        <div>
          Web này dùng API FastAPI để:
        </div>
        <div>
          - Upload CSV → trích xuất bandpower + spectrogram stats
        </div>
        <div>
          - Upload CSV → predict bằng model đã lưu trong `saved_models/`
        </div>
        <div className="pt-2 text-white/60">
          Lưu ý: label mapping trong dataset: 1=a (alcoholic), 0=c (control).
        </div>
      </div>
    </div>
  )
}

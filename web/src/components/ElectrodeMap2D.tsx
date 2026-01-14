import { useMemo, useState } from 'react'

type ElectrodeInfo = {
  name: string
  summary_vi: string
  increase_vi: string
  decrease_vi: string
  sources: { title: string; url: string; accessed: string }[]
}

type Point = { name: string; x: number; y: number }

type RegionKey = 'frontal' | 'central' | 'parietal' | 'temporal' | 'occipital' | 'other'

const REGION_META: Record<RegionKey, { label: string; fill: string }> = {
  frontal: { label: 'Frontal', fill: 'rgba(59,130,246,0.9)' },
  central: { label: 'Central', fill: 'rgba(16,185,129,0.9)' },
  parietal: { label: 'Parietal', fill: 'rgba(168,85,247,0.9)' },
  temporal: { label: 'Temporal', fill: 'rgba(245,158,11,0.9)' },
  occipital: { label: 'Occipital', fill: 'rgba(236,72,153,0.9)' },
  other: { label: 'Other', fill: 'rgba(148,163,184,0.9)' },
}

function regionOfElectrode(name: string): RegionKey {
  const k = String(name || '').toUpperCase()
  if (k.startsWith('FP') || k.startsWith('AF') || k.startsWith('F')) return 'frontal'
  if (k.startsWith('FC') || k.startsWith('C')) return 'central'
  if (k.startsWith('CP') || k.startsWith('P')) return 'parietal'
  if (k.startsWith('PO') || k.startsWith('O')) return 'occipital'
  if (k.startsWith('FT') || k.startsWith('T') || k.startsWith('TP')) return 'temporal'
  return 'other'
}

const MONTAGE: Point[] = [
  { name: 'FP1', x: -0.55, y: 0.95 },
  { name: 'FPZ', x: 0.0, y: 0.98 },
  { name: 'FP2', x: 0.55, y: 0.95 },
  { name: 'AF3', x: -0.30, y: 0.88 },
  { name: 'AF4', x: 0.30, y: 0.88 },
  { name: 'F7', x: -0.92, y: 0.70 },
  { name: 'F5', x: -0.62, y: 0.72 },
  { name: 'F3', x: -0.36, y: 0.74 },
  { name: 'F1', x: -0.14, y: 0.76 },
  { name: 'FZ', x: 0.0, y: 0.78 },
  { name: 'F2', x: 0.14, y: 0.76 },
  { name: 'F4', x: 0.36, y: 0.74 },
  { name: 'F6', x: 0.62, y: 0.72 },
  { name: 'F8', x: 0.92, y: 0.70 },
  { name: 'FT7', x: -1.03, y: 0.46 },
  { name: 'FC5', x: -0.66, y: 0.46 },
  { name: 'FC3', x: -0.38, y: 0.48 },
  { name: 'FC1', x: -0.16, y: 0.50 },
  { name: 'FCZ', x: 0.0, y: 0.52 },
  { name: 'FC2', x: 0.16, y: 0.50 },
  { name: 'FC4', x: 0.38, y: 0.48 },
  { name: 'FC6', x: 0.66, y: 0.46 },
  { name: 'FT8', x: 1.03, y: 0.46 },
  { name: 'T7', x: -1.08, y: 0.12 },
  { name: 'C5', x: -0.70, y: 0.14 },
  { name: 'C3', x: -0.40, y: 0.16 },
  { name: 'C1', x: -0.18, y: 0.18 },
  { name: 'CZ', x: 0.0, y: 0.20 },
  { name: 'C2', x: 0.18, y: 0.18 },
  { name: 'C4', x: 0.40, y: 0.16 },
  { name: 'C6', x: 0.70, y: 0.14 },
  { name: 'T8', x: 1.08, y: 0.12 },
  { name: 'TP7', x: -1.03, y: -0.18 },
  { name: 'CP5', x: -0.66, y: -0.18 },
  { name: 'CP3', x: -0.38, y: -0.16 },
  { name: 'CP1', x: -0.16, y: -0.14 },
  { name: 'CPZ', x: 0.0, y: -0.12 },
  { name: 'CP2', x: 0.16, y: -0.14 },
  { name: 'CP4', x: 0.38, y: -0.16 },
  { name: 'CP6', x: 0.66, y: -0.18 },
  { name: 'TP8', x: 1.03, y: -0.18 },
  { name: 'P7', x: -0.92, y: -0.44 },
  { name: 'P5', x: -0.62, y: -0.44 },
  { name: 'P3', x: -0.36, y: -0.42 },
  { name: 'P1', x: -0.14, y: -0.40 },
  { name: 'PZ', x: 0.0, y: -0.38 },
  { name: 'P2', x: 0.14, y: -0.40 },
  { name: 'P4', x: 0.36, y: -0.42 },
  { name: 'P6', x: 0.62, y: -0.44 },
  { name: 'P8', x: 0.92, y: -0.44 },
  { name: 'PO7', x: -0.62, y: -0.68 },
  { name: 'PO5', x: -0.36, y: -0.66 },
  { name: 'PO3', x: -0.18, y: -0.64 },
  { name: 'POZ', x: 0.0, y: -0.62 },
  { name: 'PO4', x: 0.18, y: -0.64 },
  { name: 'PO6', x: 0.36, y: -0.66 },
  { name: 'PO8', x: 0.62, y: -0.68 },
  { name: 'O1', x: -0.38, y: -0.90 },
  { name: 'OZ', x: 0.0, y: -0.94 },
  { name: 'O2', x: 0.38, y: -0.90 },

  // Dataset-specific channels (not standard 10-20 electrode locations)
  { name: 'X', x: -0.85, y: -1.03 },
  { name: 'ND', x: 0.0, y: -1.06 },
  { name: 'Y', x: 0.85, y: -1.03 },
]

function toSvg(p: Point) {
  const w = 520
  const h = 520
  const pad = 50
  const x = ((p.x + 1.15) / (2.3)) * (w - 2 * pad) + pad
  const y = ((1.05 - p.y) / (2.1)) * (h - 2 * pad) + pad
  return { x, y }
}

export default function ElectrodeMap2D({ title, subtitle, infoByName }: { title: string; subtitle: string; infoByName: Record<string, ElectrodeInfo> }) {
  const [selected, setSelected] = useState<string>('FZ')

  const items = useMemo(() => {
    return MONTAGE.map((m) => {
      const s = toSvg(m)
      return { ...m, ...s }
    })
  }, [])

  const info = infoByName[selected] || null

  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{subtitle}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(REGION_META) as RegionKey[]).filter((k) => k !== 'other').map((k) => (
          <div key={k} className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: REGION_META[k].fill }} />
            <span className="text-xs text-white/70">{REGION_META[k].label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 overflow-hidden">
          <svg viewBox="0 0 520 520" className="w-full h-auto">
            <ellipse cx="260" cy="260" rx="210" ry="240" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <circle cx="260" cy="70" r="10" fill="rgba(255,255,255,0.08)" />
            <path d="M 250 35 Q 260 10 270 35" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
            {items.map((p) => {
              const isSel = p.name === selected
              const region = regionOfElectrode(p.name)
              const fill = REGION_META[region]?.fill || REGION_META.other.fill
              return (
                <g key={p.name} onClick={() => setSelected(p.name)} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSel ? 9 : 7}
                    fill={isSel ? 'rgba(165,180,252,0.95)' : fill}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={1}
                  />
                  <text x={p.x + 10} y={p.y + 4} fontSize={11} fill="rgba(255,255,255,0.75)">{p.name}</text>
                </g>
              )
            })}
          </svg>
          <div className="mt-2 text-xs text-white/60">Click 1 điện cực để xem mô tả.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Điện cực</div>
          <div className="mt-1 text-lg font-semibold">{selected}</div>

          {!info ? (
            <div className="mt-2 text-sm text-white/70">Chưa có dữ liệu kiến thức cho điện cực này.</div>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-white/80 leading-relaxed">
              <div><b>Tóm tắt:</b> {info.summary_vi}</div>
              <div><b>Khi tăng (mang tính tổng quát):</b> {info.increase_vi}</div>
              <div><b>Khi giảm (mang tính tổng quát):</b> {info.decrease_vi}</div>

              {info.sources?.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-xs text-white/60">Nguồn</div>
                  <div className="mt-1 space-y-1">
                    {info.sources.map((s) => (
                      <div key={s.url} className="text-xs break-words">
                        - <a className="underline text-indigo-200" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> ({s.accessed})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

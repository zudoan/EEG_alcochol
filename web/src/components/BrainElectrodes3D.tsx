import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

type Electrode = {
  name: string
  pos: [number, number, number]
  region: string
  note: string
}

function normalize(v: [number, number, number], r: number): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [(v[0] / len) * r, (v[1] / len) * r, (v[2] / len) * r]
}

function useElectrodes(): Electrode[] {
  return useMemo(() => {
    const r = 1.12
    const raw: Electrode[] = [
      { name: 'Fp1', pos: [-0.55, 0.88, 0.55], region: 'Trán trước (trái)', note: 'Liên quan chú ý/điều hành; dễ nhiễu chớp mắt.' },
      { name: 'Fp2', pos: [0.55, 0.88, 0.55], region: 'Trán trước (phải)', note: 'Tương tự Fp1; thường thấy nhiễu mắt.' },
      { name: 'F7', pos: [-0.92, 0.52, 0.35], region: 'Trán thái dương (trái)', note: 'Gần vùng thái dương; đôi khi nhạy với hoạt động cơ mặt.' },
      { name: 'F3', pos: [-0.45, 0.55, 0.65], region: 'Trán (trái)', note: 'Liên quan hoạt động điều hành và chú ý.' },
      { name: 'Fz', pos: [0, 0.62, 0.78], region: 'Trán giữa', note: 'Thường dùng theo dõi hoạt động trán trung tâm.' },
      { name: 'F4', pos: [0.45, 0.55, 0.65], region: 'Trán (phải)', note: 'So sánh đối xứng với F3.' },
      { name: 'F8', pos: [0.92, 0.52, 0.35], region: 'Trán thái dương (phải)', note: 'Gần vùng thái dương; dễ nhiễu cơ.' },

      { name: 'T3', pos: [-1.05, 0.05, 0.2], region: 'Thái dương (trái)', note: 'Liên quan xử lý thính giác/ngôn ngữ (tuỳ bối cảnh).' },
      { name: 'C3', pos: [-0.6, 0.1, 0.75], region: 'Trung tâm (trái)', note: 'Liên quan vận động; thường nhìn thay đổi alpha/beta.' },
      { name: 'Cz', pos: [0, 0.12, 0.92], region: 'Trung tâm giữa', note: 'Kênh trung tâm quan trọng cho hoạt động vận động.' },
      { name: 'C4', pos: [0.6, 0.1, 0.75], region: 'Trung tâm (phải)', note: 'So sánh đối xứng với C3.' },
      { name: 'T4', pos: [1.05, 0.05, 0.2], region: 'Thái dương (phải)', note: 'So sánh đối xứng với T3.' },

      { name: 'T5', pos: [-0.98, -0.38, 0.25], region: 'Thái dương sau (trái)', note: 'Gần vùng sau thái dương; liên quan xử lý thị-đỉnh.' },
      { name: 'P3', pos: [-0.48, -0.4, 0.7], region: 'Đỉnh (trái)', note: 'Liên quan tích hợp cảm giác, chú ý không gian.' },
      { name: 'Pz', pos: [0, -0.42, 0.82], region: 'Đỉnh giữa', note: 'Hay dùng quan sát đáp ứng nhận thức.' },
      { name: 'P4', pos: [0.48, -0.4, 0.7], region: 'Đỉnh (phải)', note: 'So sánh đối xứng với P3.' },
      { name: 'T6', pos: [0.98, -0.38, 0.25], region: 'Thái dương sau (phải)', note: 'So sánh đối xứng với T5.' },

      { name: 'O1', pos: [-0.38, -0.86, 0.45], region: 'Chẩm (trái)', note: 'Thường mạnh alpha khi nhắm mắt.' },
      { name: 'Oz', pos: [0, -0.95, 0.38], region: 'Chẩm giữa', note: 'Kênh tốt để xem alpha liên quan thị giác.' },
      { name: 'O2', pos: [0.38, -0.86, 0.45], region: 'Chẩm (phải)', note: 'So sánh đối xứng với O1.' },
    ]

    return raw.map((e) => ({ ...e, pos: normalize(e.pos, r) }))
  }, [])
}

function BrainMesh() {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.05, 4), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#a5b4fc',
        roughness: 0.35,
        metalness: 0.55,
        transparent: true,
        opacity: 0.6,
        emissive: new THREE.Color('#1d4ed8'),
        emissiveIntensity: 0.12,
      }),
    []
  )

  return <mesh geometry={geo} material={mat} />
}

function ElectrodeMarker({
  e,
  selected,
  onSelect,
  onHover,
  onUnhover,
}: {
  e: Electrode
  selected: boolean
  onSelect: (e: Electrode) => void
  onHover: (e: Electrode) => void
  onUnhover: () => void
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: selected ? '#34d399' : '#ec4899',
        roughness: 0.3,
        metalness: 0.25,
        emissive: new THREE.Color(selected ? '#10b981' : '#db2777'),
        emissiveIntensity: selected ? 0.35 : 0.22,
      }),
    [selected]
  )

  return (
    <group position={e.pos}>
      <mesh
        material={mat}
        geometry={new THREE.SphereGeometry(selected ? 0.055 : 0.045, 24, 24)}
        onPointerOver={(ev) => {
          ev.stopPropagation()
          onHover(e)
        }}
        onPointerOut={(ev) => {
          ev.stopPropagation()
          onUnhover()
        }}
        onClick={(ev) => {
          ev.stopPropagation()
          onSelect(e)
        }}
      />
    </group>
  )
}

export default function BrainElectrodes3D({
  title,
  subtitle,
  heightClassName = 'h-[360px]',
}: {
  title?: string
  subtitle?: string
  heightClassName?: string
}) {
  const electrodes = useElectrodes()
  const [hovered, setHovered] = useState<Electrode | null>(null)
  const [selected, setSelected] = useState<Electrode | null>(null)

  return (
    <div className={`glass relative overflow-hidden rounded-3xl ${heightClassName}`}>
      <Canvas camera={{ position: [0, 0.2, 3.2], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 2, 2]} intensity={1.15} />
        <pointLight position={[-2, -2, -2]} intensity={0.55} color="#ec4899" />

        <BrainMesh />

        {electrodes.map((e) => (
          <ElectrodeMarker
            key={e.name}
            e={e}
            selected={selected?.name === e.name}
            onSelect={(x) => setSelected(x)}
            onHover={(x) => setHovered(x)}
            onUnhover={() => setHovered(null)}
          />
        ))}

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.1} maxDistance={4.2} />

        {(hovered || selected) && (
          <Html position={[0, -1.35, 0]} center>
            <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/85 shadow-glow">
              <div className="font-semibold">{(selected || hovered)!.name}</div>
              <div className="text-white/70">{(selected || hovered)!.region}</div>
            </div>
          </Html>
        )}
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/12 via-transparent to-pink-500/10" />

      {(title || subtitle) && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[80%]">
          {title && <div className="text-sm font-semibold text-white/90">{title}</div>}
          {subtitle && <div className="mt-1 text-xs text-white/60">{subtitle}</div>}
        </div>
      )}

      <div className="absolute right-4 top-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          <div className="font-semibold text-white/80">Tương tác</div>
          <div>Drag: xoay • Wheel: zoom • Click: chọn điểm</div>
        </div>
      </div>

      {selected && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[420px]">
          <div className="rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{selected.name}</div>
                <div className="text-xs text-white/60">{selected.region}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/15"
              >
                Đóng
              </button>
            </div>
            <div className="mt-3 text-sm text-white/75 leading-relaxed">{selected.note}</div>
          </div>
        </div>
      )}
    </div>
  )
}

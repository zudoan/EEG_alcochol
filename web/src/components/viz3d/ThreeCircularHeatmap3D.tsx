import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function colorRamp(t: number) {
  const x = clamp01(t)
  const r = Math.round(99 + x * (236 - 99))
  const g = Math.round(102 + x * (72 - 102))
  const b = Math.round(241 + x * (153 - 241))
  return `rgb(${r},${g},${b})`
}

function Wedge({
  r0,
  r1,
  a0,
  a1,
  h,
  color,
}: {
  r0: number
  r1: number
  a0: number
  a1: number
  h: number
  color: string
}) {
  const x0 = Math.cos(a0)
  const z0 = Math.sin(a0)
  const x1 = Math.cos(a1)
  const z1 = Math.sin(a1)
  const midA = (a0 + a1) / 2
  const midR = (r0 + r1) / 2

  // approximate wedge with a thin box oriented to mid angle
  const len = r1 - r0
  const arc = Math.max(0.12, (a1 - a0) * midR)

  return (
    <mesh position={[Math.cos(midA) * midR, h / 2, Math.sin(midA) * midR]} rotation={[0, -midA, 0]}>
      <boxGeometry args={[len, h, arc]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.12} />
    </mesh>
  )
}

function Circular({ values }: { values: number[] }) {
  const n = values.length
  const vmin = Math.min(...values)
  const vmax = Math.max(...values)

  const r0 = 0.7
  const r1 = 1.6

  return (
    <group>
      {values.map((v, i) => {
        const t = (v - vmin) / (vmax - vmin + 1e-9)
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        const h = 0.06 + t * 0.75
        return <Wedge key={i} r0={r0} r1={r1} a0={a0} a1={a1} h={h} color={colorRamp(t)} />
      })}
    </group>
  )
}

export default function ThreeCircularHeatmap3D({
  title,
  values,
  heightClassName = 'h-[360px]',
}: {
  title: string
  values: number[]
  heightClassName?: string
}) {
  return (
    <div className={`glass relative overflow-hidden rounded-3xl ${heightClassName}`}>
      <Canvas camera={{ position: [0, 2.8, 3.9], fov: 45 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 3, 2]} intensity={1.15} />
        <pointLight position={[-3, -2, -2]} intensity={0.55} color="#ec4899" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#0b1020" roughness={1} />
        </mesh>

        <Circular values={values} />

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.7} maxDistance={7.0} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-pink-500/10" />
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-xs text-white/60">Circular heatmap (A) • Drag để xoay • Wheel để zoom</div>
      </div>
    </div>
  )
}

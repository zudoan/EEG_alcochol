import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function colorRamp(t: number) {
  const x = clamp01(t)
  // indigo -> pink
  const r = Math.round(99 + x * (236 - 99))
  const g = Math.round(102 + x * (72 - 102))
  const b = Math.round(241 + x * (153 - 241))
  return `rgb(${r},${g},${b})`
}

function Heatmap({ z }: { z: number[][] }) {
  const rows = z.length
  const cols = rows ? z[0].length : 0
  const flat = z.flat()
  const zmin = Math.min(...flat)
  const zmax = Math.max(...flat)

  const cell = 0.16
  const offsetX = -((cols - 1) * cell) / 2
  const offsetZ = -((rows - 1) * cell) / 2

  return (
    <group>
      {z.map((row, r) =>
        row.map((v, c) => {
          const t = (v - zmin) / (zmax - zmin + 1e-9)
          const y = 0.03 + t * 0.6
          return (
            <mesh key={`${r}-${c}`} position={[offsetX + c * cell, y / 2, offsetZ + r * cell]}>
              <boxGeometry args={[cell * 0.92, y, cell * 0.92]} />
              <meshStandardMaterial color={colorRamp(t)} roughness={0.45} metalness={0.15} />
            </mesh>
          )
        })
      )}
    </group>
  )
}

export default function ThreeHeatmap3D({
  title,
  z,
  heightClassName = 'h-[360px]',
}: {
  title: string
  z: number[][]
  heightClassName?: string
}) {
  return (
    <div className={`glass relative overflow-hidden rounded-3xl ${heightClassName}`}>
      <Canvas camera={{ position: [0, 2.8, 4.6], fov: 45 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 3, 2]} intensity={1.15} />
        <pointLight position={[-3, -2, -2]} intensity={0.55} color="#ec4899" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#0b1020" roughness={1} />
        </mesh>

        <Heatmap z={z} />

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={7.5} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-pink-500/10" />
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-xs text-white/60">Ma trận tần số (minh hoạ) • Drag để xoay • Wheel để zoom</div>
      </div>
    </div>
  )
}

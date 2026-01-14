import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

type Item = { label: string; value: number; color?: string }

function Bars({ data }: { data: Item[] }) {
  const maxV = Math.max(...data.map((d) => d.value), 1)

  return (
    <group>
      {data.map((d, i) => {
        const h = 0.2 + (d.value / maxV) * 1.8
        const x = (i - (data.length - 1) / 2) * 0.55
        return (
          <group key={d.label} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.38, h, 0.38]} />
              <meshStandardMaterial color={d.color || '#a5b4fc'} metalness={0.25} roughness={0.35} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export default function ThreeBarChart3D({
  title,
  data,
  heightClassName = 'h-[320px]',
}: {
  title: string
  data: Item[]
  heightClassName?: string
}) {
  return (
    <div className={`glass relative overflow-hidden rounded-3xl ${heightClassName}`}>
      <Canvas camera={{ position: [0, 2.3, 4.2], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 2]} intensity={1.1} />
        <pointLight position={[-3, -2, -2]} intensity={0.55} color="#ec4899" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#0b1020" roughness={1} />
        </mesh>

        <Bars data={data} />

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={7.0} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-pink-500/10" />
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-xs text-white/60">Drag để xoay • Wheel để zoom</div>
      </div>
    </div>
  )
}

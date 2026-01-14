import { Canvas } from '@react-three/fiber'
import { Float, OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

function BrainOrb() {
  const geo = new THREE.IcosahedronGeometry(1.1, 3)
  const mat = new THREE.MeshStandardMaterial({
    color: '#a5b4fc',
    roughness: 0.25,
    metalness: 0.65,
    emissive: new THREE.Color('#1d4ed8'),
    emissiveIntensity: 0.22,
  })

  return (
    <Float speed={1.2} rotationIntensity={0.8} floatIntensity={0.6}>
      <mesh geometry={geo} material={mat} />
    </Float>
  )
}

export default function ThreeHero() {
  return (
    <div className="glass relative h-[360px] overflow-hidden rounded-3xl">
      <Canvas camera={{ position: [0, 0, 3.6], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 2, 2]} intensity={1.2} />
        <pointLight position={[-2, -2, -2]} intensity={0.6} color="#ec4899" />
        <Sparkles count={120} speed={0.4} scale={6} size={1.2} color="#a5b4fc" />
        <BrainOrb />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/15 via-transparent to-pink-500/10" />
    </div>
  )
}

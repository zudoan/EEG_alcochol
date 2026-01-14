import { Component, Suspense, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

type Electrode = {
  name: string
  pos: [number, number, number]
}

function normalize(v: [number, number, number], r: number): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [(v[0] / len) * r, (v[1] / len) * r, (v[2] / len) * r]
}

type MontagePoint = { name: string; x: number; y: number }

function montage64(): MontagePoint[] {
  // Rough 64ch 10-10 style layout (top view)
  // x: left(-) -> right(+)
  // y: back(-) -> front(+)
  // This is a visual montage to match the expected pattern, then projected onto head mesh by raycast.
  return [
    // front pole / prefrontal
    { name: 'FP1', x: -0.55, y: 0.95 },
    { name: 'FPZ', x: 0.0, y: 0.98 },
    { name: 'FP2', x: 0.55, y: 0.95 },

    // frontal
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

    // fronto-central / temporal
    { name: 'FT7', x: -1.03, y: 0.46 },
    { name: 'FC5', x: -0.66, y: 0.46 },
    { name: 'FC3', x: -0.38, y: 0.48 },
    { name: 'FC1', x: -0.16, y: 0.50 },
    { name: 'FCZ', x: 0.0, y: 0.52 },
    { name: 'FC2', x: 0.16, y: 0.50 },
    { name: 'FC4', x: 0.38, y: 0.48 },
    { name: 'FC6', x: 0.66, y: 0.46 },
    { name: 'FT8', x: 1.03, y: 0.46 },

    // central / temporal
    { name: 'T7', x: -1.08, y: 0.12 },
    { name: 'C5', x: -0.70, y: 0.14 },
    { name: 'C3', x: -0.40, y: 0.16 },
    { name: 'C1', x: -0.18, y: 0.18 },
    { name: 'CZ', x: 0.0, y: 0.20 },
    { name: 'C2', x: 0.18, y: 0.18 },
    { name: 'C4', x: 0.40, y: 0.16 },
    { name: 'C6', x: 0.70, y: 0.14 },
    { name: 'T8', x: 1.08, y: 0.12 },

    // centro-parietal / temporal posterior
    { name: 'TP7', x: -1.03, y: -0.18 },
    { name: 'CP5', x: -0.66, y: -0.18 },
    { name: 'CP3', x: -0.38, y: -0.16 },
    { name: 'CP1', x: -0.16, y: -0.14 },
    { name: 'CPZ', x: 0.0, y: -0.12 },
    { name: 'CP2', x: 0.16, y: -0.14 },
    { name: 'CP4', x: 0.38, y: -0.16 },
    { name: 'CP6', x: 0.66, y: -0.18 },
    { name: 'TP8', x: 1.03, y: -0.18 },

    // parietal
    { name: 'P7', x: -0.92, y: -0.44 },
    { name: 'P5', x: -0.62, y: -0.44 },
    { name: 'P3', x: -0.36, y: -0.42 },
    { name: 'P1', x: -0.14, y: -0.40 },
    { name: 'PZ', x: 0.0, y: -0.38 },
    { name: 'P2', x: 0.14, y: -0.40 },
    { name: 'P4', x: 0.36, y: -0.42 },
    { name: 'P6', x: 0.62, y: -0.44 },
    { name: 'P8', x: 0.92, y: -0.44 },

    // parieto-occipital
    { name: 'PO7', x: -0.62, y: -0.68 },
    { name: 'PO5', x: -0.36, y: -0.66 },
    { name: 'PO3', x: -0.18, y: -0.64 },
    { name: 'POZ', x: 0.0, y: -0.62 },
    { name: 'PO4', x: 0.18, y: -0.64 },
    { name: 'PO6', x: 0.36, y: -0.66 },
    { name: 'PO8', x: 0.62, y: -0.68 },

    // occipital
    { name: 'O1', x: -0.38, y: -0.90 },
    { name: 'OZ', x: 0.0, y: -0.94 },
    { name: 'O2', x: 0.38, y: -0.90 },
  ]
}

function asDirectionFromTopMap(x: number, y: number): [number, number, number] {
  // Map top-view coords to a ray direction.
  // Put points on upper hemisphere: yAxis is up.
  // We treat (x,y) as (left-right, front-back) and add a constant up component.
  const v: [number, number, number] = [x, 1.0, y]
  return normalize(v, 1.0)
}

function genElectrodes(names: string[], count = 64): Electrode[] {
  const montage = montage64()
  const byName = new Map(montage.map((p) => [p.name, p]))

  const picked: Electrode[] = []
  const used = new Set<string>()

  const wanted = names && names.length ? names : montage.map((m) => m.name)
  for (const rawName of wanted) {
    if (picked.length >= count) break
    const name = String(rawName).toUpperCase()
    const p = byName.get(name)
    if (!p) continue
    used.add(name)
    picked.push({ name, pos: asDirectionFromTopMap(p.x, p.y) })
  }

  // fill missing with remaining montage points so we always show the montage pattern
  for (const p of montage) {
    if (picked.length >= count) break
    if (used.has(p.name)) continue
    picked.push({ name: p.name, pos: asDirectionFromTopMap(p.x, p.y) })
  }

  // final fallback: if still not enough (rare), add generic evenly-spaced points near top
  if (picked.length < count) {
    const remain = count - picked.length
    for (let i = 0; i < remain; i++) {
      const t = i / Math.max(1, remain - 1)
      const angle = t * Math.PI * 2
      const x = Math.cos(angle) * 0.85
      const z = Math.sin(angle) * 0.45
      picked.push({ name: `CH${picked.length + 1}`, pos: asDirectionFromTopMap(x, z) })
    }
  }

  return picked.slice(0, count)
}

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function GlbHeadWithMarkers({
  electrodes,
  selected,
  setSelected,
  setHovered,
}: {
  electrodes: Electrode[]
  selected: Electrode | null
  setSelected: (e: Electrode | null) => void
  setHovered: (e: Electrode | null) => void
}) {
  const gltf = useGLTF('/head.glb') as any
  const scene: THREE.Object3D = gltf.scene

  const groupRef = useRef<THREE.Group>(null)
  const [projected, setProjected] = useState<Electrode[] | null>(null)

  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    // normalize to a consistent visual size
    const target = 2.2
    const s = target / maxDim
    const off: [number, number, number] = [-center.x * s, -center.y * s, -center.z * s]
    return { scale: s, offset: off }
  }, [scene])

  useEffect(() => {
    if (!groupRef.current) return

    // collect meshes to raycast against
    const meshes: THREE.Object3D[] = []
    // IMPORTANT: only raycast against the head model meshes (not markers)
    scene.traverse((obj) => {
      const anyObj = obj as any
      if (anyObj && anyObj.isMesh) meshes.push(obj)
    })

    // Ensure matrices are up-to-date for raycasting
    groupRef.current.updateMatrixWorld(true)

    const raycaster = new THREE.Raycaster()
    const tmpDir = new THREE.Vector3()
    const tmpPos = new THREE.Vector3()
    const tmpNormal = new THREE.Vector3()
    const normalMatrix = new THREE.Matrix3()
    const out: Electrode[] = []

    // cast rays from outside toward the head center for each direction
    const R_OUT = 6
    const N_OFFSET = 0.035

    // scalp constraints in normalized group space
    // (tune these if your GLB has different proportions)
    const MIN_Y = 0.25
    const MAX_FRONT_Z = 0.18

    const castOnce = (dir: THREE.Vector3) => {
      const origin = dir.clone().multiplyScalar(R_OUT)
      const direction = dir.clone().multiplyScalar(-1)
      raycaster.set(origin, direction)
      const hits = raycaster.intersectObjects(meshes, true)
      if (!hits.length) return null
      return hits[0]
    }

    for (const e of electrodes) {
      const base = tmpDir.set(e.pos[0], e.pos[1], e.pos[2]).normalize().clone()

      // initial direction: prefer upward to avoid neck
      if (base.y < 0.45) base.y = 0.45
      base.normalize()

      // iterative recast: if it lands on face/neck area, bias direction upward/backward
      const candidates = [
        base,
        base.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize(),
        base.clone().add(new THREE.Vector3(0, 0.55, -0.25)).normalize(),
        base.clone().add(new THREE.Vector3(0, 0.35, -0.45)).normalize(),
      ]

      let hit: any = null
      let best: any = null
      let bestScore = -Infinity
      for (const d of candidates) {
        const h = castOnce(d)
        if (!h) continue
        // check in local group space to reject face/neck hits
        const local = groupRef.current.worldToLocal(h.point.clone())
        const score = local.y * 2.0 - Math.max(0, local.z) * 3.0
        if (score > bestScore) {
          bestScore = score
          best = h
        }
        if (local.y < MIN_Y) continue
        if (local.z > MAX_FRONT_Z) continue
        hit = h
        break
      }

      if (!hit) {
        if (best) {
          hit = best
        } else {
          out.push(e)
          continue
        }
      }

      tmpPos.copy(hit.point)

      // compute world normal
      if (hit.face && hit.object) {
        normalMatrix.getNormalMatrix((hit.object as any).matrixWorld)
        tmpNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize()
      } else {
        tmpNormal.set(0, 1, 0)
      }

      // push marker slightly outside the surface
      tmpPos.add(tmpNormal.multiplyScalar(N_OFFSET))

      // convert world position back to local group space
      const local = groupRef.current.worldToLocal(tmpPos.clone())
      out.push({ name: e.name, pos: [local.x, local.y, local.z] })
    }

    setProjected(out)
  }, [electrodes, scale, offset, scene])

  return (
    <group ref={groupRef} scale={scale} position={offset}>
      <primitive object={scene} />
      {(projected || electrodes).map((e) => (
        <ElectrodeMarker
          key={e.name}
          e={e}
          active={selected?.name === e.name}
          onPick={(x) => setSelected(x)}
          onHover={(x) => setHovered(x)}
          onLeave={() => setHovered(null)}
        />
      ))}
    </group>
  )
}

function FallbackHead() {
  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#a5b4fc',
        roughness: 0.5,
        metalness: 0.15,
        transparent: true,
        opacity: 0.55,
      }),
    []
  )
  const noseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ec4899',
        roughness: 0.4,
        metalness: 0.2,
        emissive: new THREE.Color('#db2777'),
        emissiveIntensity: 0.22,
      }),
    []
  )

  return (
    <group>
      <mesh material={headMat}>
        <sphereGeometry args={[1.05, 48, 48]} />
      </mesh>
      <mesh material={noseMat} position={[0, 0.05, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.28, 24]} />
      </mesh>
    </group>
  )
}

function ElectrodeMarker({
  e,
  active,
  onPick,
  onHover,
  onLeave,
}: {
  e: Electrode
  active: boolean
  onPick: (e: Electrode) => void
  onHover: (e: Electrode) => void
  onLeave: () => void
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: active ? '#34d399' : '#ec4899',
        roughness: 0.3,
        metalness: 0.2,
        emissive: new THREE.Color(active ? '#10b981' : '#db2777'),
        emissiveIntensity: active ? 0.35 : 0.22,
      }),
    [active]
  )

  return (
    <group position={e.pos}>
      <mesh
        material={mat}
        geometry={new THREE.SphereGeometry(active ? 0.05 : 0.042, 24, 24)}
        onPointerOver={(ev) => {
          ev.stopPropagation()
          onHover(e)
        }}
        onPointerOut={(ev) => {
          ev.stopPropagation()
          onLeave()
        }}
        onClick={(ev) => {
          ev.stopPropagation()
          onPick(e)
        }}
      />
    </group>
  )
}

export default function HeadElectrodes3D({
  title,
  subtitle,
  channelNames,
  heightClassName = 'h-[420px]',
}: {
  title?: string
  subtitle?: string
  channelNames?: string[]
  heightClassName?: string
}) {
  const names = channelNames && channelNames.length ? channelNames : Array.from({ length: 64 }).map((_, i) => `Ch${i + 1}`)
  const electrodes = useMemo(() => genElectrodes(names, 64), [names])

  const [hovered, setHovered] = useState<Electrode | null>(null)
  const [selected, setSelected] = useState<Electrode | null>(null)
  const [hasGlb, setHasGlb] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/head.glb', { method: 'HEAD' })
      .then((r) => {
        if (!alive) return
        setHasGlb(r.ok)
      })
      .catch(() => {
        if (!alive) return
        setHasGlb(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className={`glass relative overflow-hidden rounded-3xl ${heightClassName}`}>
      <Canvas camera={{ position: [0, 0.35, 3.2], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.5, 2, 2]} intensity={1.2} />
        <pointLight position={[-2, -2, -2]} intensity={0.6} color="#ec4899" />

        {hasGlb ? (
          <ModelErrorBoundary fallback={<FallbackHead />}>
            <Suspense fallback={<FallbackHead />}>
              <GlbHeadWithMarkers
                electrodes={electrodes}
                selected={selected}
                setSelected={setSelected}
                setHovered={setHovered}
              />
            </Suspense>
          </ModelErrorBoundary>
        ) : (
          <group>
            <FallbackHead />
            {electrodes.map((e) => (
              <ElectrodeMarker
                key={e.name}
                e={e}
                active={selected?.name === e.name}
                onPick={(x) => setSelected(x)}
                onHover={(x) => setHovered(x)}
                onLeave={() => setHovered(null)}
              />
            ))}
          </group>
        )}

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.1} maxDistance={4.8} />

        {(hovered || selected) && (
          <Html position={[0, -1.45, 0]} center>
            <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/85 shadow-glow">
              <div className="font-semibold">{(selected || hovered)!.name}</div>
              <div className="text-white/70">64 electrodes (hover/click)</div>
            </div>
          </Html>
        )}
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/12 via-transparent to-pink-500/12" />

      {(title || subtitle) && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[80%]">
          {title && <div className="text-sm font-semibold text-white/90">{title}</div>}
          {subtitle && <div className="mt-1 text-xs text-white/60">{subtitle}</div>}
        </div>
      )}

      <div className="absolute right-4 top-4">
        <div className="space-y-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <div className="font-semibold text-white/80">Tương tác</div>
            <div>Drag: xoay • Wheel: zoom • Click: chọn điểm</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/70">
            <div className="font-semibold text-white/80">Trạng thái model</div>
            <div>
              {hasGlb === null
                ? 'Đang kiểm tra /head.glb...'
                : hasGlb
                  ? 'Đang dùng head.glb (mặt người 3D)'
                  : 'Chưa có head.glb → đang dùng fallback'}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[420px]">
          <div className="rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{selected.name}</div>
                <div className="text-xs text-white/60">Điện cực (minh hoạ)</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/15"
              >
                Đóng
              </button>
            </div>
            <div className="mt-3 text-sm text-white/75 leading-relaxed">
              Nếu bạn đặt file <b>web/public/head.glb</b> thì sẽ hiện đầu người 3D thật. Nếu chưa có file đó, hệ thống sẽ dùng hình thay thế.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

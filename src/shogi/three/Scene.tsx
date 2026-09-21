import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { createMaterials } from './materials'
import { Board } from './Board'
import { Pieces } from './Pieces'
import { Highlights } from './Highlights'
import { Hands } from './Hands'
import { useGame } from '../game/store'
import { BLACK } from '../game/position.ts'
import { playSound } from '../game/sound'
import { expose } from '../../debug'

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const TARGET = new THREE.Vector3(0, 0.16, 0)
/** How the board is framed from 先手's seat, and from 後手's. */
const EYE = new THREE.Vector3(0.4, 9.4, 8.6)

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as { update: () => void } | null
  const viewSide = useGame((s) => s.viewSide)
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null)
  const mounted = useRef(false)

  useEffect(() => expose('__camera', camera), [camera])
  useEffect(() => expose('__scene', scene), [scene])

  // swinging the view to the other seat is a fly-around, never a jump cut
  useEffect(() => {
    if (!mounted.current) return
    const p = camera.position
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return
    anim.current = { from: p.clone(), to: new THREE.Vector3(-p.x, p.y, -p.z), t: 0 }
  }, [viewSide, camera])

  // keep the whole board framed for the current aspect ratio
  useEffect(() => {
    const aspect = size.width / size.height
    if (!Number.isFinite(aspect) || aspect <= 0 || size.width === 0 || size.height === 0) return

    const persp = camera as THREE.PerspectiveCamera
    const vFov = (persp.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const portrait = aspect < 1.1
    const eyeDir = (portrait
      ? new THREE.Vector3(0.2, 13.5, 9.4)
      : EYE.clone()
    )
      .sub(TARGET)
      .normalize()

    // the board plus a stand on either side is about 14 units across
    const fitWidth = 14.6 / 2 / Math.tan(hFov / 2)
    const fitHeight = (portrait ? 12.4 : 11.4) / 2 / Math.tan(vFov / 2)
    const dist = Math.min(52, Math.max(11, Math.max(fitWidth, fitHeight) * 1.03))
    if (!Number.isFinite(dist)) return

    const to = TARGET.clone().add(eyeDir.multiplyScalar(dist))
    if (!Number.isFinite(to.x) || !Number.isFinite(to.y) || !Number.isFinite(to.z)) return
    if (!mounted.current) {
      mounted.current = true
      camera.position.copy(to)
      camera.lookAt(TARGET)
      controls?.update()
      return
    }
    anim.current = { from: camera.position.clone(), to, t: 0 }
  }, [size.width, size.height, camera, controls])

  useFrame((_, rawDt) => {
    const a = anim.current
    if (!a) return
    const dt = Math.min(rawDt, 0.05)
    a.t = Math.min(1, a.t + dt / 0.9)
    camera.position.lerpVectors(a.from, a.to, easeInOut(a.t))
    camera.lookAt(TARGET)
    controls?.update()
    if (a.t >= 1) anim.current = null
  })

  return null
}

function Lights() {
  const quality = useGame((s) => s.settings.quality)
  const size = quality === 'high' ? 2048 : 1024
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[6, 13, 7]}
        intensity={2.35}
        color="#fff3e0"
        castShadow
        shadow-mapSize-width={size}
        shadow-mapSize-height={size}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-blurSamples={16}
      />
      <directionalLight position={[-7, 8, -6]} intensity={0.5} color="#9fb6d8" />
      <spotLight position={[0, 12, -10]} angle={0.7} penumbra={1} intensity={24} distance={38} color="#ffd7a3" />
    </>
  )
}

function Table() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.92, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <MeshReflectorMaterial
        resolution={512}
        blur={[420, 120]}
        mixBlur={1}
        mixStrength={0.14}
        depthScale={0.7}
        minDepthThreshold={0.5}
        maxDepthThreshold={1.4}
        color="#0a0b0d"
        metalness={0.72}
        roughness={0.74}
        mirror={0.32}
      />
    </mesh>
  )
}

function SoundDriver() {
  const pending = useGame((s) => s.pendingSound)
  const consume = useGame((s) => s.consumeSound)
  const enabled = useGame((s) => s.settings.sound)
  useEffect(() => {
    if (!pending) return
    if (enabled) playSound(pending as Parameters<typeof playSound>[0])
    consume()
  }, [pending, enabled, consume])
  return null
}

export function ShogiScene() {
  const theme = useGame((s) => s.settings.board)
  const finish = useGame((s) => s.settings.finish)
  const quality = useGame((s) => s.settings.quality)
  const viewSide = useGame((s) => s.viewSide)

  const materials = useMemo(() => createMaterials(theme, finish), [theme, finish])
  useEffect(() => () => materials.dispose(), [materials])

  // the pieces face their owner, so the camera starts behind whichever seat the
  // player is in
  const start = useMemo(
    () => (viewSide === BLACK ? [0.4, 9.4, 8.6] : [-0.4, 9.4, -8.6]),
    [viewSide],
  )

  return (
    <Canvas
      shadows="variance"
      dpr={quality === 'high' ? [1, 2] : [1, 1.4]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 34, position: start as [number, number, number], near: 0.5, far: 160 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.03
      }}
    >
      <color attach="background" args={['#0b0c0e']} />
      <fog attach="fog" args={['#0b0c0e', 38, 130]} />

      <SoundDriver />
      <CameraRig />
      <Lights />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0d0e11']} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 10, 3]} scale={[16, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#ffd9ab" position={[-10, 5, 5]} scale={[8, 10, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.65} color="#9dc0ff" position={[10, 6, -5]} scale={[8, 10, 1]} target={[0, 0, 0]} />
      </Environment>

      <group>
        <Board materials={materials} />
        <Pieces materials={materials} />
        <Highlights />
        <Hands materials={materials} />
      </group>

      <Table />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        minDistance={8}
        maxDistance={52}
        minPolarAngle={0.12}
        maxPolarAngle={1.32}
        target={[TARGET.x, TARGET.y, TARGET.z]}
      />
    </Canvas>
  )
}

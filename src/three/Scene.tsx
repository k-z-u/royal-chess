import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { createMaterials, type BoardTheme, type PieceFinish } from './materials'
import { Board } from './Board'
import { CaptureFx, Pieces } from './Pieces'
import { Highlights } from './Highlights'
import { useGame } from '../game/store'
import { playSound } from '../game/sound'
import { expose } from '../debug'

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const TARGET = new THREE.Vector3(0, 0.32, 0)

function CameraRig() {
  const camera = useThree((s) => s.camera)
  useEffect(() => expose('__camera', camera), [camera])
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as { update: () => void } | null
  const viewFrom = useGame((s) => s.viewFrom)
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null)
  const mounted = useRef(false)

  // flip the viewpoint to the other side of the board (never on first mount)
  useEffect(() => {
    if (!mounted.current) return
    const p = camera.position
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return
    anim.current = {
      from: p.clone(),
      to: new THREE.Vector3(-p.x, p.y, -p.z),
      t: 0,
    }
  }, [viewFrom, camera])

  // keep the board nicely framed for the current aspect ratio
  useEffect(() => {
    const aspect = size.width / size.height
    if (!Number.isFinite(aspect) || aspect <= 0 || size.width === 0 || size.height === 0) return
    const persp = camera as THREE.PerspectiveCamera
    const vFov = (persp.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)

    // portrait screens get a steeper, more diagram-like view of the board
    const portrait = aspect < 1.15
    const eyeDir = portrait
      ? new THREE.Vector3(0, 11.6, 7.4).sub(TARGET).normalize()
      : new THREE.Vector3(0, 8.8, 9.4).sub(TARGET).normalize()

    const fitWidth = 10.1 / 2 / Math.tan(hFov / 2)
    const fitHeight = (portrait ? 8.4 : 7.6) / 2 / Math.tan(vFov / 2)
    const dist = Math.min(44, Math.max(9.6, Math.max(fitWidth, fitHeight) * 1.03))
    if (!Number.isFinite(dist)) return

    const to = TARGET.clone().add(eyeDir.clone().multiplyScalar(dist))
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
    a.t = Math.min(1, a.t + dt / 0.85)
    camera.position.lerpVectors(a.from, a.to, easeInOut(a.t))
    camera.lookAt(TARGET)
    controls?.update()
    if (a.t >= 1) anim.current = null
  })

  return null
}

function KeyLight() {
  const quality = useGame((s) => s.settings.quality)
  return (
    <directionalLight
      position={[5.5, 11.5, 6]}
      intensity={2.5}
      color="#fff3e0"
      castShadow
      shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
      shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
      shadow-camera-left={-7.5}
      shadow-camera-right={7.5}
      shadow-camera-top={7.5}
      shadow-camera-bottom={-7.5}
      shadow-camera-near={1}
      shadow-camera-far={32}
      shadow-bias={-0.0006}
      shadow-normalBias={0.02}
      shadow-radius={3.5}
      shadow-blurSamples={16}
    />
  )
}

function Table() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0]} receiveShadow>
      <planeGeometry args={[90, 90]} />
      <MeshReflectorMaterial
        resolution={512}
        blur={[420, 120]}
        mixBlur={1}
        mixStrength={0.16}
        depthScale={0.7}
        minDepthThreshold={0.5}
        maxDepthThreshold={1.4}
        color="#0a0b0d"
        metalness={0.7}
        roughness={0.72}
        mirror={0.35}
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
    if (enabled) playSound(pending)
    consume()
  }, [pending, enabled, consume])
  return null
}

export function ChessScene() {
  const theme = useGame((s) => s.settings.theme)
  const finish = useGame((s) => s.settings.finish)
  const coordinates = useGame((s) => s.settings.coordinates)
  const speed = useGame((s) => s.settings.speed)
  const quality = useGame((s) => s.settings.quality)

  const materials = useMemo(
    () => createMaterials(theme as BoardTheme, finish as PieceFinish),
    [theme, finish],
  )
  useEffect(() => () => materials.dispose(), [materials])

  return (
    <Canvas
      shadows="variance"
      dpr={quality === 'high' ? [1, 2] : [1, 1.4]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 34, position: [0, 8.8, 9.4], near: 0.5, far: 140 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.02
      }}
    >
      <color attach="background" args={['#0b0c0e']} />
      <fog attach="fog" args={['#0b0c0e', 34, 120]} />

      <SoundDriver />
      <CameraRig />

      <ambientLight intensity={0.22} />
      <KeyLight />
      <directionalLight position={[-6, 7, -5.5]} intensity={0.55} color="#93a8c4" />
      <spotLight
        position={[0, 10, -9]}
        angle={0.72}
        penumbra={1}
        intensity={26}
        distance={34}
        color="#ffd7a3"
      />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0d0e11']} />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#ffffff"
          position={[0, 9, 2.5]}
          scale={[14, 7, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.85}
          color="#ffd9ab"
          position={[-9, 4, 4]}
          scale={[7, 9, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#9dc0ff"
          position={[9, 5, -4]}
          scale={[7, 9, 1]}
          target={[0, 0, 0]}
        />
      </Environment>

      <group>
        <Board materials={materials} showCoordinates={coordinates} />
        <Pieces materials={materials} speed={speed} />
        <Highlights />
        <CaptureFx materials={materials} />
      </group>

      <Table />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.72}
        zoomSpeed={0.8}
        minDistance={7.5}
        maxDistance={46}
        minPolarAngle={0.14}
        maxPolarAngle={1.33}
        target={[TARGET.x, TARGET.y, TARGET.z]}
      />
    </Canvas>
  )
}
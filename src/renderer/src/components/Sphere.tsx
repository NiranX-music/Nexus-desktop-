import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import type { AssistantVisualState } from '@renderer/IndexRoot'

const readAnalyserVolume = (dataArray: Uint8Array<ArrayBuffer>) => {
  if (!nexusService.analyser) return 0

  nexusService.analyser.getByteFrequencyData(dataArray)

  let sum = 0
  const len = dataArray.length
  for (let i = 0; i < len; i++) {
    sum += dataArray[i]
  }

  return sum / len / 128
}

const getStateFloor = (
  elapsedTime: number,
  visualState: AssistantVisualState,
  isSystemActive: boolean
) => {
  if (visualState === 'speaking') {
    return 0.48 + (Math.sin(elapsedTime * 8.5) + 1) * 0.08
  }

  if (visualState === 'running') {
    return 0.14 + (Math.sin(elapsedTime * 2.6) + 1) * 0.035
  }

  if (isSystemActive) {
    return 0.08 + (Math.sin(elapsedTime * 1.6) + 1) * 0.02
  }

  return 0
}

type SphereVisualProps = {
  visualState: AssistantVisualState
  isSystemActive: boolean
}

const CustomParticleSphere = ({
  count = 3400,
  visualState,
  isSystemActive
}: SphereVisualProps & { count?: number }) => {
  const mesh = useRef<THREE.Points>(null)
  const smoothedVolume = useRef(0)

  const dataArray = useMemo(() => new Uint8Array(new ArrayBuffer(128)), [])

  const colorStart = useMemo(() => new THREE.Color('#6dff9d'), [])
  const colorEnd = useMemo(() => new THREE.Color('#f8ffff'), [])
  const colorTarget = useMemo(() => new THREE.Color(), [])

  const { positions, originalPositions, spreadFactors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const orig = new Float32Array(count * 3)
    const spread = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1
      const z = Math.random() * 2 - 1

      const radius = 1.42 + Math.pow(Math.random(), 0.52) * 0.62
      const vector = new THREE.Vector3(x, y, z)
      vector.normalize().multiplyScalar(radius)

      pos[i * 3] = vector.x
      pos[i * 3 + 1] = vector.y
      pos[i * 3 + 2] = vector.z

      orig[i * 3] = vector.x
      orig[i * 3 + 1] = vector.y
      orig[i * 3 + 2] = vector.z

      spread[i] = Math.random()
    }
    return { positions: pos, originalPositions: orig, spreadFactors: spread }
  }, [count])

  useFrame((state, delta) => {
    if (!state.clock.running || !mesh.current) return

    const analyserVolume = readAnalyserVolume(dataArray)
    const stateFloor = getStateFloor(state.clock.elapsedTime, visualState, isSystemActive)
    const volume = Math.max(analyserVolume, stateFloor)
    smoothedVolume.current = THREE.MathUtils.lerp(smoothedVolume.current, volume, 0.18)
    const pulse = smoothedVolume.current
    const breath = Math.sin(state.clock.elapsedTime * (1.8 + pulse * 3.5))

    mesh.current.rotation.y += delta * (0.055 + pulse * 0.72)
    mesh.current.rotation.z += delta * (0.04 + pulse * 0.48)
    mesh.current.scale.setScalar(1 + pulse * 0.07 + Math.max(0, breath) * pulse * 0.025)

    colorTarget.lerpColors(colorStart, colorEnd, pulse)
    const material = mesh.current.material as THREE.PointsMaterial
    material.color.copy(colorTarget)
    material.size = 0.014 + pulse * 0.026
    material.opacity = 0.84 + Math.min(pulse * 0.38, 0.16)

    const currentPos = mesh.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2

      const ripple =
        Math.sin(state.clock.elapsedTime * (2.8 + pulse * 9) + spreadFactors[i] * 7) *
        pulse *
        0.045
      const expansion = 1 + pulse * spreadFactors[i] * 0.74 + ripple

      currentPos[ix] = originalPositions[ix] * expansion
      currentPos[iy] = originalPositions[iy] * expansion
      currentPos[iz] = originalPositions[iz] * expansion
    }

    mesh.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9effc5"
        size={0.014}
        transparent={true}
        opacity={0.96}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const SpeakingHalo = ({ visualState, isSystemActive }: SphereVisualProps) => {
  const group = useRef<THREE.Group>(null)
  const innerRing = useRef<THREE.Mesh>(null)
  const outerRing = useRef<THREE.Mesh>(null)
  const smoothedVolume = useRef(0)
  const dataArray = useMemo(() => new Uint8Array(new ArrayBuffer(128)), [])

  useFrame((state, delta) => {
    const analyserVolume = readAnalyserVolume(dataArray)
    const stateFloor = getStateFloor(state.clock.elapsedTime, visualState, isSystemActive)
    const volume = Math.max(analyserVolume, stateFloor)
    smoothedVolume.current = THREE.MathUtils.lerp(smoothedVolume.current, volume, 0.16)
    const pulse = smoothedVolume.current
    const idleGlow = nexusService.isConnected ? 0.04 : 0.012
    const energy = Math.max(pulse, idleGlow)

    if (group.current) {
      group.current.rotation.z += delta * (0.16 + energy * 1.35)
      group.current.scale.setScalar(1 + energy * 0.28)
    }

    const innerMaterial = innerRing.current?.material as THREE.MeshBasicMaterial | undefined
    if (innerMaterial) {
      innerMaterial.opacity = 0.16 + Math.min(energy * 0.62, 0.44)
      innerMaterial.color.set(pulse > 0.08 ? '#a5f3fc' : '#34d399')
    }

    const outerMaterial = outerRing.current?.material as THREE.MeshBasicMaterial | undefined
    if (outerMaterial) {
      outerMaterial.opacity =
        0.08 + Math.min(energy * 0.34, 0.26) + Math.max(0, Math.sin(state.clock.elapsedTime * 3)) * pulse * 0.12
      outerMaterial.color.set(pulse > 0.1 ? '#ffffff' : '#86efac')
    }
  })

  return (
    <group ref={group}>
      <mesh ref={innerRing}>
        <torusGeometry args={[2.24, 0.009, 12, 160]} />
        <meshBasicMaterial
          color="#10b981"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={outerRing}>
        <torusGeometry args={[2.55, 0.006, 12, 160]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

const VoiceCore = ({ visualState, isSystemActive }: SphereVisualProps) => {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const shell = useRef<THREE.Mesh>(null)
  const coreLight = useRef<THREE.PointLight>(null)
  const smoothedVolume = useRef(0)
  const dataArray = useMemo(() => new Uint8Array(new ArrayBuffer(128)), [])

  useFrame((state, delta) => {
    const analyserVolume = readAnalyserVolume(dataArray)
    const stateFloor = getStateFloor(state.clock.elapsedTime, visualState, isSystemActive)
    const energy = THREE.MathUtils.lerp(
      smoothedVolume.current,
      Math.max(analyserVolume, stateFloor),
      0.18
    )
    smoothedVolume.current = energy

    const microPulse = (Math.sin(state.clock.elapsedTime * (7 + energy * 12)) + 1) * 0.5
    const strongPulse = (Math.sin(state.clock.elapsedTime * (3.2 + energy * 4.4)) + 1) * 0.5

    if (group.current) {
      group.current.rotation.y += delta * (0.18 + energy * 0.6)
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.14
    }

    if (core.current) {
      core.current.scale.setScalar(0.92 + energy * 0.22 + microPulse * 0.04)
      const material = core.current.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 1.35 + energy * 2.6
      material.color.set(visualState === 'speaking' ? '#ffffff' : '#ddfff0')
      material.emissive.set(visualState === 'speaking' ? '#67e8f9' : '#34d399')
    }

    if (glow.current) {
      glow.current.scale.setScalar(1.18 + energy * 0.52 + strongPulse * 0.16)
      const material = glow.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.18 + Math.min(energy * 0.34, 0.24)
      material.color.set(visualState === 'speaking' ? '#bae6fd' : '#5cffb1')
    }

    if (shell.current) {
      shell.current.rotation.z += delta * (0.22 + energy * 0.95)
      shell.current.rotation.x -= delta * (0.14 + energy * 0.45)
      shell.current.scale.setScalar(1.02 + energy * 0.1)
      const material = shell.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.2 + Math.min(energy * 0.28, 0.24)
      material.color.set(visualState === 'speaking' ? '#cffafe' : '#86efac')
    }

    if (coreLight.current) {
      coreLight.current.intensity = 1.1 + energy * 2.4 + strongPulse * 0.4
      coreLight.current.color.set(visualState === 'speaking' ? '#a5f3fc' : '#bbf7d0')
    }
  })

  return (
    <group ref={group}>
      <pointLight ref={coreLight} position={[0, 0, 0.3]} intensity={1.3} distance={4.6} color="#bbf7d0" />
      <mesh ref={glow}>
        <sphereGeometry args={[1.08, 64, 64]} />
        <meshBasicMaterial
          color="#5cffb1"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.02, 4]} />
        <meshBasicMaterial
          color="#86efac"
          wireframe
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI * 0.5, 0, 0]}>
        <torusGeometry args={[1.08, 0.007, 10, 180]} />
        <meshBasicMaterial
          color="#a7f3d0"
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI * 0.64, Math.PI * 0.1, Math.PI * 0.18]}>
        <torusGeometry args={[1.18, 0.006, 10, 180]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.52, 64, 64]} />
        <meshPhysicalMaterial
          color="#ddfff0"
          emissive="#34d399"
          emissiveIntensity={1.7}
          roughness={0.12}
          metalness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.96}
        />
      </mesh>
      <mesh position={[-0.18, 0.2, 0.48]}>
        <sphereGeometry args={[0.09, 24, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.78}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

type SphereProps = {
  visualState?: AssistantVisualState
  isSystemActive?: boolean
}

const Sphere = ({ visualState = 'offline', isSystemActive = false }: SphereProps) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 43 }}
      dpr={[1, 1.8]}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#effff8', '#061c14', 1.1]} />
      <directionalLight position={[3.4, 2.8, 4.6]} intensity={1.35} color="#f8ffff" />
      <pointLight position={[0, 0.15, 2.6]} intensity={2.2} color="#c6ffe2" />
      <pointLight position={[-2.25, 1.65, 2.8]} intensity={1.35} color="#67e8f9" />
      <pointLight position={[2.1, -1.25, 2.1]} intensity={0.72} color="#fbbf24" />
      <VoiceCore visualState={visualState} isSystemActive={isSystemActive} />
      <SpeakingHalo visualState={visualState} isSystemActive={isSystemActive} />
      <CustomParticleSphere visualState={visualState} isSystemActive={isSystemActive} />
    </Canvas>
  )
}

export default Sphere

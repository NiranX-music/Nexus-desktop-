import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { nexusService } from '@renderer/services/nexus-voice-ai'

const createAudioArray = (length: number): Uint8Array<ArrayBufferLike> =>
  new Uint8Array(new ArrayBuffer(length))

const getAudioVolume = (dataArray: Uint8Array<ArrayBufferLike>) => {
  if (!nexusService.analyser) return 0

  nexusService.analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>)

  let weightedSum = 0
  let totalWeight = 0

  for (let i = 0; i < dataArray.length; i++) {
    const weight = i < 28 ? 1.55 : i < 70 ? 1.05 : 0.65
    weightedSum += dataArray[i] * weight
    totalWeight += weight
  }

  return Math.min(1, weightedSum / totalWeight / 132)
}

const getUserAudioVolume = (dataArray: Uint8Array<ArrayBufferLike>) => {
  if (!nexusService.inputAnalyser || !nexusService.isConnected || (nexusService as any).isMicMuted)
    return 0

  nexusService.inputAnalyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>)

  let weightedSum = 0
  let totalWeight = 0

  for (let i = 0; i < dataArray.length; i++) {
    const weight = i < 28 ? 1.6 : i < 70 ? 1.1 : 0.65
    weightedSum += dataArray[i] * weight
    totalWeight += weight
  }

  const normalized = weightedSum / totalWeight / 128
  return normalized > 0.032 ? Math.min(1, (normalized - 0.032) * 1.65) : 0
}

type ParticleShellProps = {
  count?: number
  radius?: number
  size?: number
  baseColor?: string
  activeColor?: string
  userSpeakingColor?: string
  opacity?: number
  speed?: number
  turbulence?: number
  audioScale?: number
}

const ParticleShell = ({
  count = 5200,
  radius = 1.82,
  size = 0.011,
  baseColor = '#24f7ba',
  activeColor = '#ffffff',
  userSpeakingColor = '#00f5ff',
  opacity = 0.88,
  speed = 0.052,
  turbulence = 0.055,
  audioScale = 0.34
}: ParticleShellProps) => {
  const pointsRef = useRef<THREE.Points>(null)
  const dataArray = useMemo(() => createAudioArray(160), [])
  const userDataArray = useMemo(() => createAudioArray(160), [])
  const idleColor = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const peakColor = useMemo(() => new THREE.Color(activeColor), [activeColor])
  const userPeakColor = useMemo(
    () => new THREE.Color(userSpeakingColor || '#00f5ff'),
    [userSpeakingColor]
  )
  const mixedColor = useMemo(() => new THREE.Color(baseColor), [baseColor])

  const { positions, originals, phases, weights } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const orig = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const weight = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const u = Math.random()
      const v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const radiusJitter = radius + (Math.random() - 0.5) * 0.18

      const x = Math.sin(phi) * Math.cos(theta) * radiusJitter
      const y = Math.cos(phi) * radiusJitter
      const z = Math.sin(phi) * Math.sin(theta) * radiusJitter
      const index = i * 3

      pos[index] = x
      pos[index + 1] = y
      pos[index + 2] = z
      orig[index] = x
      orig[index + 1] = y
      orig[index + 2] = z
      phase[i] = Math.random() * Math.PI * 2
      weight[i] = 0.35 + Math.random() * 0.95
    }

    return { positions: pos, originals: orig, phases: phase, weights: weight }
  }, [count, radius])

  useFrame((state, delta) => {
    const points = pointsRef.current
    if (!points) return

    const time = state.clock.elapsedTime
    const aiVolume = getAudioVolume(dataArray)
    const userVolume = getUserAudioVolume(userDataArray)
    const isUserVoice = userVolume > 0.02
    const totalVolume = Math.max(aiVolume, userVolume)
    const material = points.material as THREE.PointsMaterial

    points.rotation.y += delta * (speed + totalVolume * 0.16)
    points.rotation.x = Math.sin(time * 0.17) * 0.1
    points.rotation.z = Math.cos(time * 0.13) * 0.07

    if (isUserVoice) {
      mixedColor.lerpColors(idleColor, userPeakColor, 0.2 + userVolume * 0.8)
    } else {
      mixedColor.lerpColors(idleColor, peakColor, 0.12 + aiVolume * 0.82)
    }
    material.color.copy(mixedColor)
    material.size = THREE.MathUtils.lerp(material.size, size * (1 + totalVolume * 2.2), 0.12)
    material.opacity = THREE.MathUtils.lerp(
      material.opacity,
      opacity + totalVolume * 0.1,
      0.08
    )

    // Adaptive Zero-CPU Idle: when quiet, skip heavy per-vertex math and use smooth transform breathing
    if (totalVolume > 0.015) {
      const positionAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute
      const current = positionAttr.array as Float32Array

      for (let i = 0; i < count; i++) {
        const index = i * 3
        const pulse = Math.sin(time * (isUserVoice ? 2.3 : 1.45) + phases[i]) * turbulence
        const ripple =
          Math.sin(time * 2.35 + originals[index + 1] * 3.1 + phases[i]) * 0.018
        const expansion = 1 + pulse + ripple + totalVolume * audioScale * weights[i]

        current[index] = originals[index] * expansion
        current[index + 1] = originals[index + 1] * expansion
        current[index + 2] = originals[index + 2] * expansion
      }

      positionAttr.needsUpdate = true
    } else {
      const idleBreathing = 1 + Math.sin(time * 1.2) * 0.012
      points.scale.setScalar(idleBreathing)
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={baseColor}
        size={size}
        transparent
        opacity={opacity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const EnergyCore = () => {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const dataArray = useMemo(() => createAudioArray(128), [])
  const userDataArray = useMemo(() => createAudioArray(128), [])
  const idleColor = useMemo(() => new THREE.Color('#00f5b8'), [])
  const peakColor = useMemo(() => new THREE.Color('#e8fff9'), [])
  const userSpeakingColor = useMemo(() => new THREE.Color('#00f5ff'), [])
  const activeColor = useMemo(() => new THREE.Color('#00f5b8'), [])

  useFrame((state, delta) => {
    const group = groupRef.current
    const core = coreRef.current
    const halo = haloRef.current
    if (!group || !core || !halo) return

    const time = state.clock.elapsedTime
    const aiVolume = getAudioVolume(dataArray)
    const userVolume = getUserAudioVolume(userDataArray)
    const isUserVoice = userVolume > 0.02
    const totalVolume = Math.max(aiVolume, userVolume)

    group.rotation.y -= delta * (0.16 + totalVolume * 0.35)
    group.rotation.z += delta * 0.07

    if (isUserVoice) {
      activeColor.lerpColors(idleColor, userSpeakingColor, 0.25 + userVolume * 0.75)
    } else {
      activeColor.lerpColors(idleColor, peakColor, 0.18 + aiVolume * 0.72)
    }

    const coreMaterial = core.material as THREE.MeshStandardMaterial
    coreMaterial.color.copy(activeColor)
    coreMaterial.emissive.copy(activeColor)
    coreMaterial.emissiveIntensity = 0.85 + totalVolume * (isUserVoice ? 3.4 : 2.8)
    coreMaterial.opacity = 0.24 + totalVolume * 0.22

    const coreScale = 0.72 + Math.sin(time * 2.2) * 0.018 + totalVolume * 0.2
    core.scale.setScalar(coreScale)

    const haloMaterial = halo.material as THREE.MeshBasicMaterial
    haloMaterial.color.copy(activeColor)
    haloMaterial.opacity = 0.075 + totalVolume * (isUserVoice ? 0.16 : 0.13)
    halo.scale.setScalar(1.02 + Math.sin(time * 1.4) * 0.03 + totalVolume * 0.25)
  })

  return (
    <group ref={groupRef}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.96, 64, 64]} />
        <meshBasicMaterial
          color="#00f5b8"
          transparent
          opacity={0.09}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.7, 5]} />
        <meshStandardMaterial
          color="#00f5b8"
          emissive="#00f5b8"
          emissiveIntensity={1.1}
          metalness={0.08}
          roughness={0.36}
          transparent
          opacity={0.28}
          wireframe
        />
      </mesh>
    </group>
  )
}

const OrbitRings = () => {
  const groupRef = useRef<THREE.Group>(null)
  const dataArray = useMemo(() => createAudioArray(96), [])
  const userDataArray = useMemo(() => createAudioArray(96), [])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const aiVolume = getAudioVolume(dataArray)
    const userVolume = getUserAudioVolume(userDataArray)
    const totalVolume = Math.max(aiVolume, userVolume)

    group.rotation.y += delta * (0.18 + totalVolume * 0.38)
    group.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.2
    group.scale.setScalar(1 + totalVolume * 0.1)
  })

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.12, 0.006, 12, 220]} />
        <meshBasicMaterial
          color="#63ffe2"
          transparent
          opacity={0.36}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[1.04, 0.34, 0.2]}>
        <torusGeometry args={[2.22, 0.004, 12, 220]} />
        <meshBasicMaterial
          color="#21d4ff"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[0.42, 1.18, 0.82]}>
        <torusGeometry args={[1.58, 0.0035, 10, 180]} />
        <meshBasicMaterial
          color="#b6fff1"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

const ConstellationThreads = ({ count = 72 }) => {
  const linesRef = useRef<THREE.LineSegments>(null)
  const dataArray = useMemo(() => createAudioArray(96), [])
  const geometry = useMemo(() => {
    const vertices: number[] = []
    const radius = 1.96

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const theta2 = theta + (Math.random() - 0.5) * 0.34
      const phi2 = phi + (Math.random() - 0.5) * 0.22

      vertices.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.sin(phi2) * Math.cos(theta2) * radius,
        Math.cos(phi2) * radius,
        Math.sin(phi2) * Math.sin(theta2) * radius
      )
    }

    const bufferGeometry = new THREE.BufferGeometry()
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return bufferGeometry
  }, [count])

  useFrame((state, delta) => {
    const lines = linesRef.current
    if (!lines) return

    const volume = getAudioVolume(dataArray)
    lines.rotation.y -= delta * (0.035 + volume * 0.08)
    lines.rotation.z += delta * 0.025

    const material = lines.material as THREE.LineBasicMaterial
    material.opacity = 0.14 + volume * 0.22 + Math.sin(state.clock.elapsedTime * 1.7) * 0.025
  })

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        color="#aaffee"
        transparent
        opacity={0.16}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

const BackgroundDust = () => {
  const pointsRef = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const count = 700
    const pos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const index = i * 3
      pos[index] = (Math.random() - 0.5) * 7
      pos[index + 1] = (Math.random() - 0.5) * 7
      pos[index + 2] = (Math.random() - 0.5) * 3.8 - 1.2
    }

    return pos
  }, [])

  useFrame((_state, delta) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += delta * 0.012
    pointsRef.current.rotation.x -= delta * 0.006
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#6fffe2"
        size={0.008}
        transparent
        opacity={0.18}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const UserVoiceSonicRings = () => {
  const groupRef = useRef<THREE.Group>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const userDataArray = useMemo(() => createAudioArray(64), [])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const userVol = getUserAudioVolume(userDataArray)
    const time = state.clock.elapsedTime
    const isSpeaking = userVol > 0.025

    group.rotation.z += delta * (0.22 + userVol * 0.85)
    group.rotation.x = Math.sin(time * 0.5) * 0.18

    const targetScale = isSpeaking ? 1 + userVol * 0.35 : 0.8
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14)

    if (ring1Ref.current) {
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, isSpeaking ? 0.38 + userVol * 0.42 : 0, 0.18)
      ring1Ref.current.scale.setScalar(1 + (Math.sin(time * 5.5) * 0.07 + userVol * 0.22))
    }
    if (ring2Ref.current) {
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, isSpeaking ? 0.28 + userVol * 0.35 : 0, 0.18)
      ring2Ref.current.scale.setScalar(1.22 + (Math.cos(time * 4.8) * 0.08 + userVol * 0.25))
    }
    if (ring3Ref.current) {
      const mat = ring3Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, isSpeaking ? 0.18 + userVol * 0.25 : 0, 0.18)
      ring3Ref.current.scale.setScalar(1.48 + (Math.sin(time * 4.2) * 0.09 + userVol * 0.3))
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={ring1Ref}>
        <ringGeometry args={[1.72, 1.76, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ring2Ref} rotation={[0.42, 0.35, 0]}>
        <ringGeometry args={[1.86, 1.89, 64]} />
        <meshBasicMaterial
          color="#38ef7d"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ring3Ref} rotation={[-0.32, 0.48, 0]}>
        <ringGeometry args={[2.02, 2.05, 64]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

const Sphere = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 45 }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#020807']} />
      <ambientLight intensity={0.28} />
      <pointLight position={[2.8, 2.5, 3]} color="#87ffe8" intensity={5.2} />
      <pointLight position={[-3.5, -2.4, 2.4]} color="#1a88ff" intensity={1.9} />
      <BackgroundDust />
      <EnergyCore />
      <ParticleShell />
      <ParticleShell
        count={2400}
        radius={1.34}
        size={0.007}
        baseColor="#1bd6ff"
        activeColor="#d7ffff"
        userSpeakingColor="#00e5ff"
        opacity={0.44}
        speed={-0.07}
        turbulence={0.034}
        audioScale={0.2}
      />
      <ConstellationThreads />
      <OrbitRings />
      <UserVoiceSonicRings />
    </Canvas>
  )
}

export default Sphere

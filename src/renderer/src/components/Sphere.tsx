import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { nexusService } from '@renderer/services/nexus-voice-ai'

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

const CustomParticleSphere = ({ count = 1800 }) => {
  const mesh = useRef<THREE.Points>(null)
  const smoothedVolume = useRef(0)

  const dataArray = useMemo(() => new Uint8Array(new ArrayBuffer(128)), [])

  const colorStart = useMemo(() => new THREE.Color('#33db12'), [])
  const colorEnd = useMemo(() => new THREE.Color('#FFFFFF'), [])
  const colorTarget = useMemo(() => new THREE.Color(), [])

  const { positions, originalPositions, spreadFactors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const orig = new Float32Array(count * 3)
    const spread = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1
      const z = Math.random() * 2 - 1

      const vector = new THREE.Vector3(x, y, z)
      vector.normalize().multiplyScalar(2)

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

    const volume = readAnalyserVolume(dataArray)
    smoothedVolume.current = THREE.MathUtils.lerp(smoothedVolume.current, volume, 0.18)
    const pulse = smoothedVolume.current
    const breath = Math.sin(state.clock.elapsedTime * (1.8 + pulse * 3.5))

    mesh.current.rotation.y += delta * (0.055 + pulse * 0.72)
    mesh.current.rotation.z += delta * (0.04 + pulse * 0.48)
    mesh.current.scale.setScalar(1 + pulse * 0.07 + Math.max(0, breath) * pulse * 0.025)

    colorTarget.lerpColors(colorStart, colorEnd, pulse)
    const material = mesh.current.material as THREE.PointsMaterial
    material.color.copy(colorTarget)
    material.size = 0.011 + pulse * 0.02
    material.opacity = 0.72 + Math.min(pulse * 0.42, 0.28)

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
        color="#00F0FF"
        size={0.012}
        transparent={true}
        opacity={0.9}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const SpeakingHalo = () => {
  const group = useRef<THREE.Group>(null)
  const innerRing = useRef<THREE.Mesh>(null)
  const outerRing = useRef<THREE.Mesh>(null)
  const smoothedVolume = useRef(0)
  const dataArray = useMemo(() => new Uint8Array(new ArrayBuffer(128)), [])

  useFrame((state, delta) => {
    const volume = readAnalyserVolume(dataArray)
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
      innerMaterial.opacity = 0.08 + Math.min(energy * 0.54, 0.38)
      innerMaterial.color.set(pulse > 0.08 ? '#67e8f9' : '#10b981')
    }

    const outerMaterial = outerRing.current?.material as THREE.MeshBasicMaterial | undefined
    if (outerMaterial) {
      outerMaterial.opacity =
        0.035 + Math.min(energy * 0.3, 0.22) + Math.max(0, Math.sin(state.clock.elapsedTime * 3)) * pulse * 0.12
      outerMaterial.color.set(pulse > 0.1 ? '#ffffff' : '#34d399')
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

const Sphere = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5] }}
      dpr={[1, 1.2]}
      performance={{ min: 0.5 }}
      gl={{ antialias: false, powerPreference: 'default' }}
    >
      <ambientLight intensity={0.6} />
      <SpeakingHalo />
      <CustomParticleSphere />
    </Canvas>
  )
}

export default Sphere

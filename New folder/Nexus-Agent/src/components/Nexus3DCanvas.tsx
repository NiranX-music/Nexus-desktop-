import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Eye, Layers, Shield, Zap, Sparkles, Activity, Maximize2, RotateCcw } from 'lucide-react'

export type Simulation3DMode = 'neural' | 'spatial' | 'shield' | 'ghost'

interface Nexus3DCanvasProps {
  initialMode?: Simulation3DMode
  isAudioActive?: boolean
}

export const Nexus3DCanvas: React.FC<Nexus3DCanvasProps> = ({
  initialMode = 'neural',
  isAudioActive = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [currentMode, setCurrentMode] = useState<Simulation3DMode>(initialMode)
  const [fps, setFps] = useState<number>(60)
  const [interactiveRotation, setInteractiveRotation] = useState(true)

  const modeRef = useRef<Simulation3DMode>(initialMode)
  modeRef.current = currentMode

  const audioActiveRef = useRef<boolean>(isAudioActive)
  audioActiveRef.current = isAudioActive

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x030712, 0.02)

    const width = container.clientWidth
    const height = container.clientHeight
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 0, 22)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const cyanLight = new THREE.PointLight(0x00f0ff, 3, 50)
    cyanLight.position.set(10, 10, 10)
    scene.add(cyanLight)

    const purpleLight = new THREE.PointLight(0xa855f7, 3, 50)
    purpleLight.position.set(-10, -10, -5)
    scene.add(purpleLight)

    // ==========================================
    // 1. NEURAL CORE OBJECTS
    // ==========================================
    const coreGroup = new THREE.Group()
    scene.add(coreGroup)

    // Central Wireframe Icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(4, 2)
    const icoMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    })
    const icosahedron = new THREE.Mesh(icoGeo, icoMat)
    coreGroup.add(icosahedron)

    // Inner Glowing Core Sphere
    const innerGeo = new THREE.SphereGeometry(2.4, 32, 32)
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.75
    })
    const innerSphere = new THREE.Mesh(innerGeo, innerMat)
    coreGroup.add(innerSphere)

    // Orbiting Rings
    const ringGeo1 = new THREE.TorusGeometry(6.2, 0.04, 16, 100)
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 })
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1)
    ring1.rotation.x = Math.PI / 3
    coreGroup.add(ring1)

    const ringGeo2 = new THREE.TorusGeometry(7.2, 0.03, 16, 100)
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.4 })
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2)
    ring2.rotation.y = Math.PI / 4
    coreGroup.add(ring2)

    // Orbiting Quantum Particle Swarm
    const particleCount = 1400
    const particleGeo = new THREE.BufferGeometry()
    const particlePos = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const radius = 5 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)

      particlePos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      particlePos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      particlePos[i * 3 + 2] = radius * Math.cos(phi)

      const isCyan = Math.random() > 0.4
      particleColors[i * 3] = isCyan ? 0.0 : 0.75
      particleColors[i * 3 + 1] = isCyan ? 0.94 : 0.35
      particleColors[i * 3 + 2] = isCyan ? 1.0 : 0.98
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    })
    const particlePoints = new THREE.Points(particleGeo, particleMat)
    coreGroup.add(particlePoints)

    // ==========================================
    // 2. SPATIAL WINDOWS OBJECTS (Mode: spatial)
    // ==========================================
    const spatialGroup = new THREE.Group()
    scene.add(spatialGroup)
    spatialGroup.visible = false

    const createPlaneWindow = (w: number, h: number, color: number, x: number, y: number, z: number, rx: number, ry: number) => {
      const pGroup = new THREE.Group()
      const geo = new THREE.PlaneGeometry(w, h)
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.25,
        roughness: 0.1,
        metalness: 0.5,
        side: THREE.DoubleSide
      })
      const plane = new THREE.Mesh(geo, mat)
      pGroup.add(plane)

      // Border outline
      const edges = new THREE.EdgesGeometry(geo)
      const edgeMat = new THREE.LineBasicMaterial({ color, linewidth: 2 })
      const line = new THREE.LineSegments(edges, edgeMat)
      pGroup.add(line)

      pGroup.position.set(x, y, z)
      pGroup.rotation.set(rx, ry, 0)
      return pGroup
    }

    const winTerminal = createPlaneWindow(7, 4.5, 0x00f0ff, -4.5, 1, 0, 0.1, 0.25)
    const winEditor = createPlaneWindow(8, 5.2, 0xa855f7, 4.5, 0.5, -2, -0.05, -0.3)
    const winPreview = createPlaneWindow(6, 3.8, 0x10b981, 0, -3.5, 2, -0.2, 0)

    spatialGroup.add(winTerminal)
    spatialGroup.add(winEditor)
    spatialGroup.add(winPreview)

    // ==========================================
    // 3. SHIELD FORCEFIELD (Mode: shield)
    // ==========================================
    const shieldGroup = new THREE.Group()
    scene.add(shieldGroup)
    shieldGroup.visible = false

    const shieldGeo = new THREE.IcosahedronGeometry(7.5, 3)
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    })
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat)
    shieldGroup.add(shieldMesh)

    // Repelled distraction debris
    const debrisGroup = new THREE.Group()
    for (let i = 0; i < 35; i++) {
      const dGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4)
      const dMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true })
      const dMesh = new THREE.Mesh(dGeo, dMat)
      const r = 9 + Math.random() * 4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      dMesh.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
      debrisGroup.add(dMesh)
    }
    shieldGroup.add(debrisGroup)

    // ==========================================
    // 4. GHOST PIPELINE (Mode: ghost)
    // ==========================================
    const ghostGroup = new THREE.Group()
    scene.add(ghostGroup)
    ghostGroup.visible = false

    // Cyber Laser Spline Curve
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9, -4, 0),
      new THREE.Vector3(-5, 3, 2),
      new THREE.Vector3(0, -2, -1),
      new THREE.Vector3(5, 4, 3),
      new THREE.Vector3(9, -1, 0)
    ])
    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.12, 8, false)
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.6 })
    const tube = new THREE.Mesh(tubeGeo, tubeMat)
    ghostGroup.add(tube)

    // Nodes along curve
    const points = curve.getPoints(5)
    points.forEach((p, idx) => {
      const nGeo = new THREE.OctahedronGeometry(0.7)
      const nMat = new THREE.MeshBasicMaterial({ color: idx % 2 === 0 ? 0x00f0ff : 0xa855f7, wireframe: true })
      const nodeMesh = new THREE.Mesh(nGeo, nMat)
      nodeMesh.position.copy(p)
      ghostGroup.add(nodeMesh)
    })

    // Mouse Interaction
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((event.clientX - rect.left) / width) * 2 - 1
      mouseY = -(((event.clientY - rect.top) / height) * 2 - 1)
    }

    container.addEventListener('mousemove', onMouseMove)

    // Resize Handler
    const handleResize = () => {
      if (!container) return
      const newW = container.clientWidth
      const newH = container.clientHeight
      camera.aspect = newW / newH
      camera.updateProjectionMatrix()
      renderer.setSize(newW, newH)
    }

    window.addEventListener('resize', handleResize)

    // Animation Loop
    let clock = new THREE.Clock()
    let frameCount = 0
    let lastFpsUpdate = 0
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      frameCount++
      if (time - lastFpsUpdate >= 1) {
        setFps(frameCount)
        frameCount = 0
        lastFpsUpdate = time
      }

      // Smooth mouse follow
      targetX += (mouseX * 2.5 - targetX) * 0.05
      targetY += (mouseY * 2.5 - targetY) * 0.05

      // Mode visibility & transitions
      const mode = modeRef.current
      coreGroup.visible = mode === 'neural' || mode === 'shield'
      spatialGroup.visible = mode === 'spatial'
      shieldGroup.visible = mode === 'shield'
      ghostGroup.visible = mode === 'ghost'

      // Audio reactive multiplier
      const audioPulse = audioActiveRef.current ? Math.sin(time * 12) * 0.25 + 1.15 : 1.0

      if (coreGroup.visible) {
        coreGroup.rotation.y += 0.008
        coreGroup.rotation.x = targetY * 0.2
        coreGroup.rotation.z = -targetX * 0.2

        icosahedron.rotation.y -= 0.012
        icosahedron.rotation.x += 0.006
        icosahedron.scale.setScalar(audioPulse)

        ring1.rotation.z += 0.015
        ring2.rotation.z -= 0.012

        innerSphere.scale.setScalar(audioPulse * (0.95 + Math.sin(time * 3) * 0.05))
        particlePoints.rotation.y += 0.003
      }

      if (spatialGroup.visible) {
        spatialGroup.rotation.y = targetX * 0.4
        spatialGroup.rotation.x = -targetY * 0.4
        winTerminal.position.y = 1 + Math.sin(time * 1.5) * 0.3
        winEditor.position.y = 0.5 + Math.cos(time * 1.8) * 0.3
        winPreview.position.y = -3.5 + Math.sin(time * 2) * 0.2
      }

      if (shieldGroup.visible) {
        shieldMesh.rotation.y += 0.005
        shieldMesh.rotation.x -= 0.003
        debrisGroup.rotation.y -= 0.01
      }

      if (ghostGroup.visible) {
        ghostGroup.rotation.y = time * 0.2 + targetX * 0.3
        ghostGroup.rotation.x = targetY * 0.3
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', onMouseMove)
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div className="relative w-full h-[520px] rounded-3xl bg-[#030611] border border-cyan-500/30 overflow-hidden shadow-2xl shadow-cyan-950/60 flex flex-col justify-between">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {/* Top HUD Telemetry Bar */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-bold">3D SPATIAL ENGINE</span>
            <span className="text-slate-500">|</span>
            <span>THREE.JS WEBGL</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-emerald-400">
            <Activity className="w-3.5 h-3.5" />
            <span>{fps} FPS</span>
          </div>
        </div>

        {/* Mode Selector Chips */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setCurrentMode('neural')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentMode === 'neural'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neural Core</span>
          </button>
          <button
            onClick={() => setCurrentMode('spatial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentMode === 'spatial'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Spatial Windows</span>
          </button>
          <button
            onClick={() => setCurrentMode('shield')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentMode === 'shield'
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Focus Shield</span>
          </button>
          <button
            onClick={() => setCurrentMode('ghost')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentMode === 'ghost'
                ? 'bg-teal-400 text-black shadow-md shadow-teal-400/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Ghost Spline</span>
          </button>
        </div>
      </div>

      {/* Bottom Interactive HUD Status & Description */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pointer-events-none">
        <div className="max-w-md bg-black/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 pointer-events-auto">
          <div className="text-[10px] font-mono uppercase text-cyan-400 tracking-wider font-bold mb-1">
            {currentMode === 'neural' && 'REAL-TIME NEURAL LATTICE SIMULATION'}
            {currentMode === 'spatial' && 'TELEKINESIS 3D MULTI-DISPLAY PROJECTION'}
            {currentMode === 'shield' && 'HEXAGONAL DISTRACTION PURGE DOME'}
            {currentMode === 'ghost' && 'AUTONOMOUS MACRO VECTOR SPLINE'}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentMode === 'neural' &&
              'Live 3D interactive simulation of Nexus Agent’s quantum reasoning engine with reactive audio particle swarms.'}
            {currentMode === 'spatial' &&
              'Spatial window projection demonstrating how Telekinesis coordinates IDE, Terminal, and Browser planes without fixed screen boundaries.'}
            {currentMode === 'shield' &&
              'Visual representation of the 15-second background daemon deflecting distracting applications in real-time.'}
            {currentMode === 'ghost' &&
              'Interactive spline tracking deterministic NutJS robot actions traversing system execution nodes.'}
          </p>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-[11px] font-mono text-slate-400 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
            Hover cursor to inspect perspective
          </span>
        </div>
      </div>
    </div>
  )
}

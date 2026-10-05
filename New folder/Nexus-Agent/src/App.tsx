import React, { useState } from 'react'
import { Navbar } from './components/Navbar.tsx'
import { BackgroundCanvas } from './components/BackgroundCanvas.tsx'
import { Hero } from './components/Hero.tsx'
import { Simulation3DSection } from './components/Simulation3DSection.tsx'
import { AgentPlayground } from './components/AgentPlayground.tsx'
import { FeatureMatrix } from './components/FeatureMatrix.tsx'
import { ArchitectureView } from './components/ArchitectureView.tsx'
import { DownloadSection } from './components/DownloadSection.tsx'
import { Footer } from './components/Footer.tsx'
import { DocsModal } from './components/DocsModal.tsx'
import { AuthBridgeModal } from './components/AuthBridgeModal.tsx'

export default function App() {
  const [docsModalOpen, setDocsModalOpen] = useState(false)
  const [authBridgeModalOpen, setAuthBridgeModalOpen] = useState(false)

  const scrollToSimulator = () => {
    const el = document.getElementById('simulator')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Interactive Particles Canvas */}
      <BackgroundCanvas />

      {/* Navigation Header */}
      <Navbar
        onOpenDocs={() => setDocsModalOpen(true)}
        onScrollToSimulator={scrollToSimulator}
        onOpenAuthBridge={() => setAuthBridgeModalOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="relative z-10">
        <Hero
          onScrollToSimulator={scrollToSimulator}
          onOpenDocs={() => setDocsModalOpen(true)}
          onOpenAuthBridge={() => setAuthBridgeModalOpen(true)}
        />
        <Simulation3DSection />
        <AgentPlayground />
        <FeatureMatrix />
        <ArchitectureView />
        <DownloadSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Docs Command Reference Modal */}
      <DocsModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
      />

      {/* Web-to-Desktop Authentication & Bridge Modal */}
      <AuthBridgeModal
        isOpen={authBridgeModalOpen}
        onClose={() => setAuthBridgeModalOpen(false)}
      />
    </div>
  )
}


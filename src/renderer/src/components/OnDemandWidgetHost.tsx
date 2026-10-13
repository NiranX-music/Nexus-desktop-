import React, { Suspense, lazy, useEffect, useState } from 'react'
import { demandComponentManager } from '../services/demand-component-manager'
import { motion, AnimatePresence } from 'framer-motion'
import { RiCloseLine, RiPulseLine } from 'react-icons/ri'

// Lazy-loaded components: 0 MB initial memory footprint, loaded strictly on-demand
const WeatherWidget = lazy(() => import('../Widgets/WeatherWidget'))
const StockWidget = lazy(() => import('../Widgets/StockWidget'))
const LeafletMapWidget = lazy(() => import('../Widgets/MapView'))
const TerminalOverlay = lazy(() => import('./TerminalOverlay'))
const LiveCodingWidget = lazy(() => import('../Widgets/LiveCodingWidget'))
const OracleWidget = lazy(() => import('../Widgets/RagOrcaleWidget'))
const ResearchWidget = lazy(() => import('../Widgets/DeepResearch'))
const SemanticWidget = lazy(() => import('../Widgets/SematicSearch'))
const SmartDropZonesWidget = lazy(() => import('../Widgets/SmartZoneWidget'))
const AgentFleetWidget = lazy(() => import('../Widgets/AgentFleetWidget'))
const WallpaperWidget = lazy(() => import('../Widgets/WallpaperWidget'))
const WhatsAppWidget = lazy(() => import('../Widgets/WhatsAppWidget'))
const DocForgeWidget = lazy(() => import('../Widgets/DocForgeWidget'))
const FocusWidget = lazy(() => import('../Widgets/FocusWidget'))
const WormholeWidget = lazy(() => import('../Widgets/WormholeWidget'))
const ImageWidget = lazy(() => import('../Widgets/ImageWidget'))
const EmailWidget = lazy(() => import('../Widgets/EmailWidget'))

interface ComponentWrapperProps {
  id: string
  name: string
  payload: any
  children: React.ReactNode
}

const ComponentWrapper: React.FC<ComponentWrapperProps> = ({ id, name, payload, children }) => {
  useEffect(() => {
    // If there was an activating event payload buffered, replay it to the newly mounted widget
    if (payload) {
      const state = demandComponentManager.getComponentState(id)
      const primaryEvent = state?.definition.triggerEvents[0]
      if (primaryEvent) {
        // Allow widget to complete its useEffect mount before replaying
        const timer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent(primaryEvent, { detail: payload }))
        }, 60)
        return () => clearTimeout(timer)
      }
    }
    return undefined
  }, [id, payload])

  const handleInteraction = () => {
    demandComponentManager.recordInteraction(id)
  }

  const handleClose = () => {
    demandComponentManager.releaseComponent(id, 'user-dismissed')
  }

  return (
    <div
      className="relative z-8000"
      onClick={handleInteraction}
      onKeyDown={handleInteraction}
      onMouseMove={handleInteraction}
    >
      {/* Floating active component banner & quick-release control */}
      <div className="fixed top-12 right-6 z-9999 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-black/80 px-2.5 py-1 text-[11px] font-mono text-cyan-300 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-right-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
        </span>
        <span className="font-bold uppercase tracking-wider">{name}</span>
        <button
          onClick={handleClose}
          title="Hibernate & release resources"
          className="ml-1 rounded p-0.5 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
        >
          <RiCloseLine size={14} />
        </button>
      </div>

      <Suspense
        fallback={
          <div className="fixed inset-0 z-8900 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-zinc-950/90 px-5 py-3 font-mono text-xs text-cyan-300 shadow-2xl">
              <RiPulseLine className="animate-spin text-cyan-400" size={18} />
              <span>Awakening {name} on-demand...</span>
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}

export default function OnDemandWidgetHost() {
  const [, setTick] = useState(0)

  useEffect(() => {
    // Subscribe to demand manager state changes
    const unsubscribe = demandComponentManager.subscribe(() => {
      setTick((t) => t + 1)
    })
    return unsubscribe
  }, [])

  const isWeatherActive = demandComponentManager.isComponentActive('weather')
  const isStockActive = demandComponentManager.isComponentActive('stock')
  const isMapActive = demandComponentManager.isComponentActive('map')
  const isTerminalActive = demandComponentManager.isComponentActive('terminal')
  const isLiveCodingActive = demandComponentManager.isComponentActive('live-coding')
  const isOracleActive = demandComponentManager.isComponentActive('oracle-rag')
  const isDeepResearchActive = demandComponentManager.isComponentActive('deep-research')
  const isSemanticActive = demandComponentManager.isComponentActive('semantic-search')
  const isSmartDropActive = demandComponentManager.isComponentActive('smart-dropzone')
  const isAgentFleetActive = demandComponentManager.isComponentActive('agent-fleet')
  const isWallpaperActive = demandComponentManager.isComponentActive('wallpaper-forge')
  const isWhatsAppActive = demandComponentManager.isComponentActive('whatsapp')
  const isDocForgeActive = demandComponentManager.isComponentActive('doc-forge')
  const isFocusActive = demandComponentManager.isComponentActive('focus-protocol')
  const isWormholeActive = demandComponentManager.isComponentActive('wormhole')
  const isImageActive = demandComponentManager.isComponentActive('image-gen')
  const isEmailActive = demandComponentManager.isComponentActive('email')

  return (
    <>
      <AnimatePresence>
        {isWeatherActive && (
          <ComponentWrapper
            key="weather"
            id="weather"
            name="Weather"
            payload={demandComponentManager.getBufferedPayload('weather')}
          >
            <WeatherWidget />
          </ComponentWrapper>
        )}

        {isStockActive && (
          <ComponentWrapper
            key="stock"
            id="stock"
            name="Stock Ticker"
            payload={demandComponentManager.getBufferedPayload('stock')}
          >
            <StockWidget />
          </ComponentWrapper>
        )}

        {isMapActive && (
          <ComponentWrapper
            key="map"
            id="map"
            name="Navigation Map"
            payload={demandComponentManager.getBufferedPayload('map')}
          >
            <LeafletMapWidget />
          </ComponentWrapper>
        )}

        {isTerminalActive && (
          <ComponentWrapper
            key="terminal"
            id="terminal"
            name="Terminal Shell"
            payload={demandComponentManager.getBufferedPayload('terminal')}
          >
            <TerminalOverlay />
          </ComponentWrapper>
        )}

        {isLiveCodingActive && (
          <ComponentWrapper
            key="live-coding"
            id="live-coding"
            name="Neural Forge"
            payload={demandComponentManager.getBufferedPayload('live-coding')}
          >
            <LiveCodingWidget />
          </ComponentWrapper>
        )}

        {isOracleActive && (
          <ComponentWrapper
            key="oracle-rag"
            id="oracle-rag"
            name="RAG Oracle"
            payload={demandComponentManager.getBufferedPayload('oracle-rag')}
          >
            <OracleWidget />
          </ComponentWrapper>
        )}

        {isDeepResearchActive && (
          <ComponentWrapper
            key="deep-research"
            id="deep-research"
            name="Deep Research"
            payload={demandComponentManager.getBufferedPayload('deep-research')}
          >
            <ResearchWidget />
          </ComponentWrapper>
        )}

        {isSemanticActive && (
          <ComponentWrapper
            key="semantic-search"
            id="semantic-search"
            name="Semantic Search"
            payload={demandComponentManager.getBufferedPayload('semantic-search')}
          >
            <SemanticWidget />
          </ComponentWrapper>
        )}

        {isSmartDropActive && (
          <ComponentWrapper
            key="smart-dropzone"
            id="smart-dropzone"
            name="Drop Zones"
            payload={demandComponentManager.getBufferedPayload('smart-dropzone')}
          >
            <SmartDropZonesWidget />
          </ComponentWrapper>
        )}

        {isAgentFleetActive && (
          <ComponentWrapper
            key="agent-fleet"
            id="agent-fleet"
            name="Agent Fleet"
            payload={demandComponentManager.getBufferedPayload('agent-fleet')}
          >
            <AgentFleetWidget />
          </ComponentWrapper>
        )}

        {isWallpaperActive && (
          <ComponentWrapper
            key="wallpaper-forge"
            id="wallpaper-forge"
            name="Wallpaper Forge"
            payload={demandComponentManager.getBufferedPayload('wallpaper-forge')}
          >
            <WallpaperWidget />
          </ComponentWrapper>
        )}

        {isWhatsAppActive && (
          <ComponentWrapper
            key="whatsapp"
            id="whatsapp"
            name="WhatsApp Bridge"
            payload={demandComponentManager.getBufferedPayload('whatsapp')}
          >
            <WhatsAppWidget />
          </ComponentWrapper>
        )}

        {isDocForgeActive && (
          <ComponentWrapper
            key="doc-forge"
            id="doc-forge"
            name="Doc Forge"
            payload={demandComponentManager.getBufferedPayload('doc-forge')}
          >
            <DocForgeWidget />
          </ComponentWrapper>
        )}

        {isFocusActive && (
          <ComponentWrapper
            key="focus-protocol"
            id="focus-protocol"
            name="Focus Protocol"
            payload={demandComponentManager.getBufferedPayload('focus-protocol')}
          >
            <FocusWidget />
          </ComponentWrapper>
        )}

        {isWormholeActive && (
          <ComponentWrapper
            key="wormhole"
            id="wormhole"
            name="Wormhole Tunnel"
            payload={demandComponentManager.getBufferedPayload('wormhole')}
          >
            <WormholeWidget />
          </ComponentWrapper>
        )}

        {isImageActive && (
          <ComponentWrapper
            key="image-gen"
            id="image-gen"
            name="Image Generator"
            payload={demandComponentManager.getBufferedPayload('image-gen')}
          >
            <ImageWidget />
          </ComponentWrapper>
        )}

        {isEmailActive && (
          <ComponentWrapper
            key="email"
            id="email"
            name="Email Gateway"
            payload={demandComponentManager.getBufferedPayload('email')}
          >
            <EmailWidget />
          </ComponentWrapper>
        )}
      </AnimatePresence>
    </>
  )
}

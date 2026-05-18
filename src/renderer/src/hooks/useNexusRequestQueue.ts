import { useCallback, useRef, useState } from 'react'

export type RequestRoutingMode = 'queue' | 'steer'

export interface RequestQueueItem {
  id: string
  command: string
  mode: RequestRoutingMode
  createdAt: string
  steeringTarget?: string
}

interface PendingRequest extends RequestQueueItem {
  resolve: () => void
  reject: (error: unknown) => void
}

const steeringIntentPattern =
  /\b(steer|redirect|instead|actually|change it|change this|modify|adjust|correction|no wait|wait|rather|make it|update the current|continue but)\b/i

const createRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const toPublicItem = ({ resolve: _resolve, reject: _reject, ...item }: PendingRequest) => item

export const isSteeringRequest = (command: string) => steeringIntentPattern.test(command)

export const formatSteeredCommand = (command: string, steeringTarget = '') =>
  [
    '[REQUEST STEERING UPDATE]',
    steeringTarget ? `Active request being steered: ${steeringTarget}` : '',
    `Operator steering instruction: ${command}`,
    '',
    'Apply this as the next-priority correction or continuation. If the active request already completed, treat this as the next direct command.'
  ]
    .filter(Boolean)
    .join('\n')

export function useNexusRequestQueue(executeRequest: (command: string) => Promise<void>) {
  const executeRef = useRef(executeRequest)
  const pendingQueueRef = useRef<PendingRequest[]>([])
  const activeRequestRef = useRef<PendingRequest | null>(null)
  const isDrainingRef = useRef(false)
  const routingModeRef = useRef<RequestRoutingMode>('queue')

  executeRef.current = executeRequest

  const [requestQueue, setRequestQueue] = useState<RequestQueueItem[]>([])
  const [activeRequest, setActiveRequest] = useState<RequestQueueItem | null>(null)
  const [requestRoutingMode, setRequestRoutingModeState] = useState<RequestRoutingMode>('queue')

  const syncQueueState = useCallback(() => {
    setRequestQueue(pendingQueueRef.current.map(toPublicItem))
    setActiveRequest(activeRequestRef.current ? toPublicItem(activeRequestRef.current) : null)
  }, [])

  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return
    isDrainingRef.current = true

    try {
      while (pendingQueueRef.current.length > 0) {
        const nextRequest = pendingQueueRef.current.shift()
        if (!nextRequest) continue

        activeRequestRef.current = nextRequest
        syncQueueState()

        try {
          const command =
            nextRequest.mode === 'steer'
              ? formatSteeredCommand(nextRequest.command, nextRequest.steeringTarget)
              : nextRequest.command

          await executeRef.current(command)
          nextRequest.resolve()
        } catch (error) {
          nextRequest.reject(error)
        } finally {
          if (activeRequestRef.current?.id === nextRequest.id) {
            activeRequestRef.current = null
            syncQueueState()
          }
        }
      }
    } finally {
      isDrainingRef.current = false
      syncQueueState()
    }
  }, [syncQueueState])

  const setRequestRoutingMode = useCallback((mode: RequestRoutingMode) => {
    routingModeRef.current = mode
    setRequestRoutingModeState(mode)
  }, [])

  const submitRequest = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim()
      if (!command) return Promise.resolve()

      const hasActiveWork =
        Boolean(activeRequestRef.current) ||
        pendingQueueRef.current.length > 0 ||
        isDrainingRef.current
      const shouldSteer =
        hasActiveWork && (routingModeRef.current === 'steer' || isSteeringRequest(command))
      const mode: RequestRoutingMode = shouldSteer ? 'steer' : 'queue'

      const requestPromise = new Promise<void>((resolve, reject) => {
        const request: PendingRequest = {
          id: createRequestId(),
          command,
          mode,
          createdAt: new Date().toISOString(),
          steeringTarget: activeRequestRef.current?.command,
          resolve,
          reject
        }

        if (mode === 'steer') {
          pendingQueueRef.current = [request, ...pendingQueueRef.current]
        } else {
          pendingQueueRef.current = [...pendingQueueRef.current, request]
        }

        syncQueueState()
        void drainQueue()
      })

      if (routingModeRef.current === 'steer') {
        setRequestRoutingMode('queue')
      }

      return requestPromise
    },
    [drainQueue, setRequestRoutingMode, syncQueueState]
  )

  return {
    activeRequest,
    requestQueue,
    requestRoutingMode,
    setRequestRoutingMode,
    submitRequest
  }
}

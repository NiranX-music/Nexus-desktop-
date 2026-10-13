import BrowserControlView from '@renderer/views/BrowserControl'
import type { TrialRuntimeProps } from './types'

export default function TrialBrowser(
  props: Pick<TrialRuntimeProps, 'isSystemActive' | 'isMicMuted' | 'toggleMic' | 'sendTextCommand'>
) {
  return (
    <BrowserControlView
      isSystemActive={props.isSystemActive}
      isSystemStarting={false}
      isMicMuted={props.isMicMuted}
      toggleSystem={() => {}}
      toggleMic={props.toggleMic}
      sendTextCommand={props.sendTextCommand}
    />
  )
}

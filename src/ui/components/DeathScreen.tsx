import { isMultiplayer, sendWorldAction } from '../../client/multiplayerState'
import { hasCheckpoint } from '../../progression/checkpoint'
import ReactEcs from '@dcl/sdk/react-ecs'
import { getGameOverBackdropFade,getGameOverPanelFade,playAgain,retryChapter } from '../gameOver'
import { OutcomeScreen } from './OutcomeScreen'

export function DeathScreen(): ReactEcs.JSX.Element {
  if (isMultiplayer()) return <OutcomeScreen title="YOU DIED" message="Your items and the shared raft are safe." backdrop={getGameOverBackdropFade()} fade={getGameOverPanelFade()} primary={{ label: 'RESPAWN', action: () => { sendWorldAction({ kind: 'respawn' }) } }} />
  return (
    <OutcomeScreen
      title="GAME OVER"
      message={hasCheckpoint() ? 'Your chapter checkpoint is ready. Rebuild your strategy and try again.' : 'The sea took you. Start fresh and try again.'}
      backdrop={getGameOverBackdropFade()}
      fade={getGameOverPanelFade()}
      primary={hasCheckpoint() ? { label: 'RETRY CHAPTER', action: retryChapter } : { label: 'PLAY AGAIN', action: playAgain }}
      secondary={hasCheckpoint() ? { label: 'NEW RUN', action: playAgain } : undefined}
    />
  )
}

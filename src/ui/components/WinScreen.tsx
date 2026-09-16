import ReactEcs from '@dcl/sdk/react-ecs'
import { returnToLobby } from '../../runtime/sceneFlow'
import { formatTimeS } from '../../shared/rankingTypes'
import { dismissWin,getWinBackdropFade,getWinPanelFade,getWinTimeS } from '../winScreen'
import { OutcomeScreen } from './OutcomeScreen'

export function WinScreen(): ReactEcs.JSX.Element {
  return (
    <OutcomeScreen
      title="YOU WON!"
      message="Your rescue signal reached the mainland. You survived!"
      detail={`Time: ${formatTimeS(getWinTimeS())}`}
      backdrop={getWinBackdropFade()}
      fade={getWinPanelFade()}
      primary={{ label: 'KEEP PLAYING', action: dismissWin }}
      secondary={{ label: 'RETURN TO LOBBY', action: returnToLobby }}
    />
  )
}

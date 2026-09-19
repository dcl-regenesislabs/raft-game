import ReactEcs from '@dcl/sdk/react-ecs'
import { changeRealm } from '~system/RestrictedActions'
import { getUpdateNotice } from '../../client/multiplayerState'
import { showNotification } from '../notification'
import { OutcomeScreen } from './OutcomeScreen'

export function UpdateScreen(): ReactEcs.JSX.Element {
  const update = getUpdateNotice()!
  const waiting = update.phase === 'checking'
  return (
    <OutcomeScreen
      title={waiting ? 'CHECKING VERSION' : 'UPDATE REQUIRED'}
      message={
        waiting
          ? 'Verifying the current version. Gameplay will resume when the check completes.'
          : 'Re-enter raft.dcl.eth to continue.\nIf the old version remains, restart Decentraland.'
      }
      detail={
        waiting
          ? undefined
          : update.incompatible
            ? 'A fresh raft starts with this update'
            : 'Your shared raft carries over'
      }
      backdrop={1}
      fade={1}
      primary={{
        label: 'RE-ENTER WORLD',
        action: () => {
          void changeRealm({ realm: 'raft.dcl.eth' })
            .then((result) => {
              if (!result.success) showNotification('Restart Decentraland and enter raft.dcl.eth to update.')
            })
            .catch(() => {
              showNotification('Restart Decentraland and enter raft.dcl.eth to update.')
            })
        }
      }}
    />
  )
}

import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(() => null)
}

import ReactEcs from '@dcl/sdk/react-ecs'
import { InventoryGrid } from './InventoryPanel'
// Kept as a shared entry point for storage; all thirty slots form one grid.
export function InventoryWithBar(props: { size?: number }): ReactEcs.JSX.Element {
  return <InventoryGrid size={props.size} />
}

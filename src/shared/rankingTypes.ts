export interface RankingEntry {
  rank: number
  address: string
  timeS: number
  debug: boolean
}

export function formatTimeS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

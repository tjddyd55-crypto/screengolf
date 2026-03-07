import { PlayerRecord } from "./admin-scraper"

export type RankedPlayer = {
  rank: number
  nickname: string
  handicap: number
}

export function generateRanking(players: PlayerRecord[]): RankedPlayer[] {
  if (players.length === 0) return []

  const uniqueMap = new Map<string, number>()

  for (const player of players) {
    const existing = uniqueMap.get(player.nickname)
    if (existing === undefined || player.handicap < existing) {
      uniqueMap.set(player.nickname, player.handicap)
    }
  }

  const sorted = Array.from(uniqueMap.entries()).sort(
    ([, a], [, b]) => a - b,
  )

  return sorted.map(([nickname, handicap], index) => ({
    rank: index + 1,
    nickname,
    handicap,
  }))
}

export function takeTop(
  ranking: RankedPlayer[],
  count: number,
): RankedPlayer[] {
  return ranking.slice(0, count)
}

import { NextResponse } from "next/server"
import axios from "axios"

type RankingItem = {
  rank: number
  name: string
  handicap: string
  userNo?: string
}

export const revalidate = 1800

const TARGET_URL = "https://store.sggolf.com/808/main"

type StoreRankingSource = {
  rownum: number
  nickName: string
  sg_handicap: number
  userNo?: string
}

type StoreResponse = {
  shopUserRankingList?: StoreRankingSource[]
}

export async function GET() {
  try {
    const { data: rawData } = await axios.get<string>(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    })

    const normalizedPayload = rawData.replace(/^\{\}\s*&&\s*/, "")
    const parsed = JSON.parse(normalizedPayload) as StoreResponse
    const sourceList = parsed.shopUserRankingList ?? []

    const top100: RankingItem[] = sourceList
      .filter((item) => item.rownum <= 100)
      .sort((a, b) => a.rownum - b.rownum)
      .map((item) => ({
        rank: item.rownum,
        name: item.nickName.trim(),
        handicap: item.sg_handicap.toFixed(2),
        userNo: item.userNo,
      }))

    return NextResponse.json({
      success: true,
      data: top100,
    })
  } catch (error) {
    console.error("[store-ranking] failed to fetch ranking", error)

    return NextResponse.json({
      success: false,
      data: [],
    })
  }
}

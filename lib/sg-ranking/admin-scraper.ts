import axios, { AxiosInstance } from "axios"
import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"

export type PlayerRecord = {
  nickname: string
  handicap: number
  roundDate: string
}

const LOGIN_URL = "https://screen.sggolf.com/login/form"
const MEMBER_LIST_URL =
  "https://smanager.sggolf.com/memberInfo/userList?menuId=43&parentId=36"
const REQUEST_TIMEOUT_MS = 20000
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
const LOGIN_FAILURE_MARKERS = [
  "로그인",
  "아이디 또는 비밀번호",
  "userId",
  "userPw",
]

function getAdminCredentials(): { id: string; password: string } {
  const id = process.env.SG_ADMIN_ID ?? process.env.SG_ID
  const password = process.env.SG_ADMIN_PASSWORD ?? process.env.SG_PASSWORD

  if (!id || !password) {
    throw new Error(
      "SG_ADMIN_ID/SG_ID 또는 SG_ADMIN_PASSWORD/SG_PASSWORD 환경변수가 설정되지 않았습니다.",
    )
  }

  return { id, password }
}

function normalizeCookie(setCookieHeaders: string[] | undefined): string {
  if (!setCookieHeaders || setCookieHeaders.length === 0) {
    throw new Error("로그인 실패: 세션 쿠키를 받지 못했습니다.")
  }

  return setCookieHeaders.map((cookie) => cookie.split(";")[0]).join("; ")
}

function isLikelyLoginPage(html: string): boolean {
  const normalized = html.toLowerCase()
  return LOGIN_FAILURE_MARKERS.some((marker) =>
    normalized.includes(marker.toLowerCase()),
  )
}

async function sgLogin(
  client: AxiosInstance,
  id: string,
  password: string,
): Promise<string> {
  const body = new URLSearchParams({
    userId: id,
    password,
  })

  const response = await client.post(LOGIN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Referer: LOGIN_URL,
    },
    withCredentials: true,
    validateStatus: (status) => status >= 200 && status < 400,
  })

  const sessionCookie = normalizeCookie(response.headers["set-cookie"])

  const mainResponse = await client.get("https://smanager.sggolf.com/main", {
    headers: {
      Cookie: sessionCookie,
      "User-Agent": USER_AGENT,
      Referer: LOGIN_URL,
    },
    responseType: "text",
  })

  const html = String(mainResponse.data)
  if (isLikelyLoginPage(html)) {
    throw new Error("관리자 로그인 실패: 아이디 또는 비밀번호를 확인하세요.")
  }

  return sessionCookie
}

function extractNickname(cells: cheerio.Cheerio<AnyNode>): string {
  const first = cells.eq(1).text().trim()
  if (first) {
    return first
  }

  return cells.eq(2).text().trim()
}

function extractHandicap(cells: cheerio.Cheerio<AnyNode>): number {
  const candidates = [cells.eq(3).text().trim(), cells.eq(4).text().trim()]

  for (const text of candidates) {
    const normalized = text.replace(/,/g, "")
    const value = Number.parseFloat(normalized)
    if (!Number.isNaN(value)) {
      return value
    }
  }

  return Number.NaN
}

function extractRoundDate(cells: cheerio.Cheerio<AnyNode>): string {
  return cells.eq(5).text().trim() || cells.eq(6).text().trim()
}

function parseMembers(html: string): PlayerRecord[] {
  const $ = cheerio.load(html)
  const players: PlayerRecord[] = []

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td")
    const nickname = extractNickname(cells)
    const handicap = extractHandicap(cells)
    const roundDate = extractRoundDate(cells)

    if (!nickname || Number.isNaN(handicap)) {
      return
    }

    players.push({
      nickname,
      handicap,
      roundDate,
    })
  })

  return players
}

function parseTotalPages(html: string): number {
  const $ = cheerio.load(html)
  let total = 1

  $(".pagination a").each((_, link) => {
    const href = $(link).attr("href") ?? ""
    const match = href.match(/(?:pageIndex|page)=(\d+)/)
    if (!match) {
      return
    }

    const pageIndex = Number.parseInt(match[1], 10)
    if (Number.isFinite(pageIndex) && pageIndex > total) {
      total = pageIndex
    }
  })

  return total
}

async function fetchMemberPageHtml(
  client: AxiosInstance,
  cookie: string,
  startDate: string,
  endDate: string,
  pageIndex: number,
): Promise<string> {
  const response = await client.get(MEMBER_LIST_URL, {
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
      Referer: "https://smanager.sggolf.com/main",
    },
    params: {
      menuId: 43,
      parentId: 36,
      startDate,
      endDate,
      pageIndex,
    },
    responseType: "text",
  })

  const html = String(response.data)
  if (isLikelyLoginPage(html)) {
    throw new Error("세션 만료 또는 권한 문제로 회원 목록 조회에 실패했습니다.")
  }

  return html
}

export async function scrapeMonthlyPlayers(
  year: number,
  month: number,
): Promise<PlayerRecord[]> {
  const { id, password } = getAdminCredentials()
  const client = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    withCredentials: true,
  })

  const pad = (n: number) => String(n).padStart(2, "0")
  const startDate = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`

  const cookie = await sgLogin(client, id, password)
  const firstPageHtml = await fetchMemberPageHtml(
    client,
    cookie,
    startDate,
    endDate,
    1,
  )
  const totalPages = parseTotalPages(firstPageHtml)
  const allRecords: PlayerRecord[] = [...parseMembers(firstPageHtml)]

  for (let pageIndex = 2; pageIndex <= totalPages; pageIndex += 1) {
    const html = await fetchMemberPageHtml(
      client,
      cookie,
      startDate,
      endDate,
      pageIndex,
    )
    allRecords.push(...parseMembers(html))
  }

  return allRecords
}

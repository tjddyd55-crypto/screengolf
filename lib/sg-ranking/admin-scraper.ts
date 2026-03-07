import axios, { AxiosInstance } from "axios"

export type PlayerRecord = {
  nickname: string
  handicap: number
  roundDate: string
}

const LOGIN_FORM_URL = "https://screen.sggolf.com/login/form"
const LOGIN_PROCESS_URL = "https://screen.sggolf.com/login/checkProcess"
const SMANAGER_MAIN_URL = "https://smanager.sggolf.com/main"
const MEMBER_LIST_URL = "https://smanager.sggolf.com/memberInfo/userList"
const REQUEST_TIMEOUT_MS = 20000
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

type LoginPayload = {
  resultCode?: string
  retUrl?: string
  loginVO?: {
    userId?: string | null
    nickName?: string | null
  } | null
}

type MemberListPayload = {
  paginationInfo?: {
    totalPageCount?: number
  }
  storeMemberList?: Array<{
    nickName?: string
    handi?: number | string
    lastLoginDate?: string
    regDate?: string
  }>
}

function getAdminCredentials(): { id: string; password: string } {
  const id = (process.env.SG_ADMIN_ID ?? process.env.SG_ID ?? "").trim()
  const password = (
    process.env.SG_ADMIN_PASSWORD ??
    process.env.SG_PASSWORD ??
    ""
  ).trim()

  if (!id || !password) {
    throw new Error(
      "SG_ADMIN_ID/SG_ID 또는 SG_ADMIN_PASSWORD/SG_PASSWORD 환경변수가 설정되지 않았습니다.",
    )
  }

  return { id, password }
}

function parseWrappedJson<T>(raw: string): T {
  const normalized = raw.replace(/^\{\}\s*&&\s*/, "")
  return JSON.parse(normalized) as T
}

function buildCookieHeader(setCookieHeaders: string[]): string {
  const cookieMap = new Map<string, string>()

  for (const cookie of setCookieHeaders) {
    const pair = cookie.split(";")[0]
    const separatorIndex = pair.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = pair.slice(0, separatorIndex)
    cookieMap.set(key, pair)
  }

  return Array.from(cookieMap.values()).join("; ")
}

function isLoginPayload(payload: unknown): payload is LoginPayload {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const login = payload as LoginPayload
  return "loginVO" in login && "retUrl" in login
}

async function sgLogin(
  client: AxiosInstance,
  id: string,
  password: string,
): Promise<string> {
  const retUrl = "http://smanager.sggolf.com"
  const loginFormUrl = `${LOGIN_FORM_URL}?retUrl=${encodeURIComponent(retUrl)}`

  const loginFormResponse = await client.get(loginFormUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
      Referer: loginFormUrl,
    },
    responseType: "text",
  })

  const loginFormCookies = loginFormResponse.headers["set-cookie"] ?? []
  if (loginFormCookies.length === 0) {
    throw new Error("로그인 실패: 초기 세션 쿠키를 받지 못했습니다.")
  }

  const body = new URLSearchParams({
    retUrl,
    userId: id,
    passwd: password,
  })

  const loginResponse = await client.post(LOGIN_PROCESS_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Referer: loginFormUrl,
      Cookie: buildCookieHeader(loginFormCookies),
    },
    withCredentials: true,
    validateStatus: (status) => status >= 200 && status < 400,
    maxRedirects: 0,
  })

  const loginCookies = loginResponse.headers["set-cookie"] ?? []
  const sessionCookie = buildCookieHeader([...loginFormCookies, ...loginCookies])
  if (!sessionCookie) {
    throw new Error("로그인 실패: 인증 후 세션 쿠키를 만들지 못했습니다.")
  }

  const mainResponse = await client.get(SMANAGER_MAIN_URL, {
    headers: {
      Cookie: sessionCookie,
      "User-Agent": USER_AGENT,
      Referer: loginFormUrl,
    },
    responseType: "text",
  })

  const mainPayload = parseWrappedJson<unknown>(String(mainResponse.data))
  if (isLoginPayload(mainPayload)) {
    throw new Error("관리자 로그인 실패: 아이디 또는 비밀번호를 확인하세요.")
  }

  return sessionCookie
}

function parseMembers(payload: MemberListPayload): PlayerRecord[] {
  const list = payload.storeMemberList ?? []

  return list
    .map((row) => {
      const nickname = (row.nickName ?? "").trim()
      const handicap = Number.parseFloat(String(row.handi ?? ""))
      const roundDate = row.lastLoginDate ?? row.regDate ?? ""

      return {
        nickname,
        handicap,
        roundDate,
      }
    })
    .filter(
      (row) => row.nickname.length > 0 && Number.isFinite(row.handicap),
    )
}

function parseTotalPages(payload: MemberListPayload): number {
  return Math.max(1, payload.paginationInfo?.totalPageCount ?? 1)
}

async function fetchMemberPage(
  client: AxiosInstance,
  cookie: string,
  startDate: string,
  endDate: string,
  pageIndex: number,
): Promise<MemberListPayload> {
  const response = await client.get(MEMBER_LIST_URL, {
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
      Referer: SMANAGER_MAIN_URL,
      Accept: "application/json, text/plain, */*",
    },
    params: {
      menuId: 43,
      parentId: 36,
      pageIndex,
      // SG 관리자 화면 파라미터는 배포 시점에 바뀔 수 있어
      // 기존/신규 키를 동시에 보냅니다.
      startDate,
      endDate,
      time_sDate: startDate,
      time_eDate: endDate,
    },
    responseType: "text",
  })

  const payload = parseWrappedJson<unknown>(String(response.data))
  if (isLoginPayload(payload)) {
    throw new Error("세션 만료 또는 권한 문제로 회원 목록 조회에 실패했습니다.")
  }

  return payload as MemberListPayload
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
  const firstPage = await fetchMemberPage(
    client,
    cookie,
    startDate,
    endDate,
    1,
  )
  const totalPages = parseTotalPages(firstPage)
  const allRecords: PlayerRecord[] = [...parseMembers(firstPage)]

  for (let pageIndex = 2; pageIndex <= totalPages; pageIndex += 1) {
    const payload = await fetchMemberPage(
      client,
      cookie,
      startDate,
      endDate,
      pageIndex,
    )
    allRecords.push(...parseMembers(payload))
  }

  return allRecords
}

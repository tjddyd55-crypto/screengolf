import puppeteer, { Browser, Page } from "puppeteer"

export type PlayerRecord = {
  nickname: string
  handicap: number
  roundDate: string
}

const LOGIN_URL = "https://smanager.sggolf.com/login"
const MEMBER_LIST_URL =
  "https://smanager.sggolf.com/memberInfo/userList?menuId=43&parentId=36"

function getAdminCredentials(): { id: string; password: string } {
  const id = process.env.SG_ADMIN_ID
  const password = process.env.SG_ADMIN_PASSWORD

  if (!id || !password) {
    throw new Error(
      "SG_ADMIN_ID 또는 SG_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.",
    )
  }

  return { id, password }
}

async function login(page: Page, id: string, password: string): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" })

  await page.type('input[name="userId"]', id)
  await page.type('input[name="userPw"]', password)
  await page.click('button[type="submit"]')

  await page.waitForNavigation({ waitUntil: "networkidle2" })

  const currentUrl = page.url()
  if (currentUrl.includes("login")) {
    throw new Error("관리자 로그인 실패: 아이디 또는 비밀번호를 확인하세요.")
  }
}

async function fetchPageRecords(
  page: Page,
  startDate: string,
  endDate: string,
  pageIndex: number,
): Promise<PlayerRecord[]> {
  const url = `${MEMBER_LIST_URL}&startDate=${startDate}&endDate=${endDate}&pageIndex=${pageIndex}`
  await page.goto(url, { waitUntil: "networkidle2" })

  const records = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"))
    return rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td"))
        const nickname = cells[1]?.textContent?.trim() ?? ""
        const handicapText = cells[3]?.textContent?.trim() ?? ""
        const roundDate = cells[5]?.textContent?.trim() ?? ""
        const handicap = parseFloat(handicapText)

        if (!nickname || isNaN(handicap)) return null

        return { nickname, handicap, roundDate }
      })
      .filter((r): r is PlayerRecord => r !== null)
  })

  return records
}

async function getTotalPages(page: Page): Promise<number> {
  const total = await page.evaluate(() => {
    const paginationText =
      document.querySelector(".pagination-info")?.textContent ?? ""
    const match = paginationText.match(/(\d+)\s*\/\s*(\d+)/)
    if (match) return parseInt(match[2], 10)

    const lastPageLink = document.querySelector(
      ".pagination a:last-child",
    ) as HTMLAnchorElement | null
    if (lastPageLink) {
      const href = lastPageLink.href
      const pageMatch = href.match(/pageIndex=(\d+)/)
      if (pageMatch) return parseInt(pageMatch[1], 10)
    }

    return 1
  })

  return total
}

export async function scrapeMonthlyPlayers(
  year: number,
  month: number,
): Promise<PlayerRecord[]> {
  const { id, password } = getAdminCredentials()

  const pad = (n: number) => String(n).padStart(2, "0")
  const startDate = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`

  let browser: Browser | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    await login(page, id, password)
    await page.goto(
      `${MEMBER_LIST_URL}&startDate=${startDate}&endDate=${endDate}&pageIndex=1`,
      { waitUntil: "networkidle2" },
    )

    const totalPages = await getTotalPages(page)
    const allRecords: PlayerRecord[] = []

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
      const records = await fetchPageRecords(
        page,
        startDate,
        endDate,
        pageIndex,
      )
      allRecords.push(...records)
    }

    return allRecords
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

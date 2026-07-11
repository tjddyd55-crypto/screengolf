export type MonthDateRange = {
  monthKey: string
  startDate: string
  endDate: string
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function getPreviousMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }

  return { year, month: month - 1 }
}

export function getKoreaYearMonth(
  date: Date = new Date(),
): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  })

  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)

  return { year, month }
}

export function getKoreaDateTimeParts(date: Date = new Date()): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  }
}

export function shouldRunMonthlyFinalJob(date: Date = new Date()): boolean {
  const kst = getKoreaDateTimeParts(date)
  if (kst.day !== 1) {
    return false
  }

  const minutes = kst.hour * 60 + kst.minute
  return minutes >= 10 && minutes < 70
}

export function getMonthDateRange(year: number, month: number): MonthDateRange {
  const pad = (value: number) => String(value).padStart(2, "0")
  const startDate = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`

  return {
    monthKey: getMonthKey(year, month),
    startDate,
    endDate,
  }
}

export function getLastMonthDateRange(
  date: Date = new Date(),
): MonthDateRange & { year: number; month: number } {
  const { year, month } = getKoreaYearMonth(date)
  const previous = getPreviousMonth(year, month)
  const range = getMonthDateRange(previous.year, previous.month)

  return {
    year: previous.year,
    month: previous.month,
    ...range,
  }
}

export function getCurrentMonthDateRange(
  date: Date = new Date(),
): MonthDateRange & { year: number; month: number } {
  const { year, month } = getKoreaYearMonth(date)
  const range = getMonthDateRange(year, month)

  return {
    year,
    month,
    ...range,
  }
}

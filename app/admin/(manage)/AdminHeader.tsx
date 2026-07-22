"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "../admin.module.css"

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "관리자 홈" },
  { href: "/admin/display-units", label: "전광판 관리" },
  { href: "/admin/display/display-1", label: "전광판 1 빠른 설정" },
  { href: "/admin/display/display-2", label: "전광판 2 빠른 설정" },
  { href: "/admin/display-scenes/display-1", label: "전광판 1 Scene" },
  { href: "/admin/display-scenes/display-2", label: "전광판 2 Scene" },
  { href: "/admin/google-contacts", label: "고객 연락처" },
  { href: "/admin/members", label: "회원관리" },
  { href: "/admin/sms", label: "문자 발송" },
  { href: "/admin/sms/cart", label: "문자 대상함" },
  { href: "/admin/sms/compose", label: "문자 작성" },
  { href: "/admin/sms/groups", label: "문자 그룹" },
  { href: "/admin/sms/scheduled", label: "예약 문자" },
  { href: "/admin/sms/history", label: "문자 이력" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/plan-types", label: "요금제 관리" },
]

function resolvePageTitle(pathname: string): string {
  if (pathname === "/admin") return "관리자 홈"
  if (pathname.startsWith("/admin/sms/")) {
    if (pathname.includes("/cart")) return "문자 대상함"
    if (pathname.includes("/compose")) return "문자 작성"
    if (pathname.includes("/groups")) return "문자 그룹"
    if (pathname.includes("/scheduled")) return "예약 문자"
    if (pathname.includes("/history")) return "문자 이력"
    if (/\/admin\/sms\/\d+/.test(pathname)) return "문자 상세"
    return "문자 발송"
  }
  if (pathname.startsWith("/admin/display-scenes/")) return "Scene 관리"
  if (pathname.startsWith("/admin/display/")) return "전광판 빠른 설정"
  if (pathname.startsWith("/admin/display-units")) return "전광판 관리"
  if (pathname.startsWith("/admin/google-contacts")) return "고객 연락처"
  if (pathname.startsWith("/admin/members")) return "회원관리"
  if (pathname.startsWith("/admin/notices")) return "공지사항"
  if (pathname.startsWith("/admin/plan-types")) return "요금제 관리"
  if (pathname.startsWith("/admin/sms")) return "문자 발송"
  return "관리자"
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminHeader() {
  const pathname = usePathname() ?? "/admin"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pageTitle = resolvePageTitle(pathname)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  return (
    <>
      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderDesktop}>
          <h1 className={styles.adminHeaderTitle}>
            <Link href="/admin" className={styles.adminHeaderBrand}>
              SG 매장 관리자
            </Link>
          </h1>
          <div className={styles.adminHeaderActions}>
            <details className={styles.headerMenu}>
              <summary className={styles.btnLink}>전광판 보기</summary>
              <div className={styles.headerMenuPanel}>
                <Link
                  href="/store/monthly-ranking-display"
                  target="_blank"
                  className={styles.headerMenuItem}
                >
                  전광판 1
                </Link>
                <Link
                  href="/store/monthly-ranking-display-2"
                  target="_blank"
                  className={styles.headerMenuItem}
                >
                  전광판 2
                </Link>
              </div>
            </details>
          </div>
        </div>

        <div className={styles.adminHeaderMobile}>
          <div className={styles.mobileHeaderText}>
            <Link href="/admin" className={styles.adminHeaderBrand}>
              SG 매장 관리자
            </Link>
            <p className={styles.mobileCurrentPage}>{pageTitle}</p>
          </div>
          <button
            type="button"
            className={styles.hamburgerBtn}
            aria-label="메뉴 열기"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        className={`${styles.drawerOverlay} ${drawerOpen ? styles.drawerOpen : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <nav
        className={`${styles.drawerPanel} ${drawerOpen ? styles.drawerOpen : ""}`}
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHeader}>
          <strong>메뉴</strong>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setDrawerOpen(false)}
          >
            닫기
          </button>
        </div>
        <div className={styles.drawerLinks}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.drawerLink} ${
                isNavActive(pathname, item.href) ? styles.drawerLinkActive : ""
              }`}
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className={styles.drawerDivider} />
          <Link
            href="/store/monthly-ranking-display"
            target="_blank"
            className={styles.drawerLink}
            onClick={() => setDrawerOpen(false)}
          >
            전광판 1 보기
          </Link>
          <Link
            href="/store/monthly-ranking-display-2"
            target="_blank"
            className={styles.drawerLink}
            onClick={() => setDrawerOpen(false)}
          >
            전광판 2 보기
          </Link>
        </div>
      </nav>
    </>
  )
}

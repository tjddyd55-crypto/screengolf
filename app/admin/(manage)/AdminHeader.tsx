"use client"

import Link from "next/link"
import styles from "../admin.module.css"

export default function AdminHeader() {
  return (
    <header className={styles.adminHeader}>
      <h1 className={styles.adminHeaderTitle}>
        <Link href="/admin" style={{ color: "inherit", textDecoration: "none" }}>
          SG 매장 관리자
        </Link>
      </h1>
      <div className={styles.adminHeaderActions}>
        <Link
          href="/store/monthly-ranking-display"
          target="_blank"
          className={styles.btnLink}
        >
          전광판 보기
        </Link>
      </div>
    </header>
  )
}

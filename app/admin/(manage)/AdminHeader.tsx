"use client"

import Link from "next/link"
import styles from "../admin.module.css"

export default function AdminHeader() {
  return (
    <header className={styles.adminHeader}>
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
    </header>
  )
}

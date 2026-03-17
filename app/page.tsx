import Link from "next/link"
import styles from "./page.module.css"

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>SG 골프 랭킹</h1>
          <p>매장 전광판용 랭킹 화면을 선택하세요.</p>
        </div>
        <div className={styles.ctas}>
          <Link className={styles.primary} href="/store/ranking-display">
            실시간 랭킹
          </Link>
          <Link className={styles.secondary} href="/store/monthly-ranking-display">
            월간 랭킹
          </Link>
        </div>
      </main>
    </div>
  )
}

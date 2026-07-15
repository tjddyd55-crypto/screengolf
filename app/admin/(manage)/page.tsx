import Link from "next/link"
import styles from "../admin.module.css"

export default function AdminHomePage() {
  return (
    <>
      <h2 className={styles.pageTitle}>관리자 홈</h2>
      <div className={styles.cardGrid}>
        <Link href="/admin/display" className={styles.card}>
          <h3 className={styles.cardTitle}>전광판 설정</h3>
          <p className={styles.cardDesc}>빠른 설정으로 전광판 모드를 전환합니다.</p>
        </Link>
        <Link href="/admin/display-scenes" className={styles.card}>
          <h3 className={styles.cardTitle}>Scene 관리</h3>
          <p className={styles.cardDesc}>전광판 화면을 미리 만들고 적용합니다.</p>
        </Link>
        <Link href="/admin/notices" className={styles.card}>
          <h3 className={styles.cardTitle}>공지사항 관리</h3>
          <p className={styles.cardDesc}>전광판 공지사항을 등록·수정·삭제합니다.</p>
        </Link>
        <Link href="/admin/members" className={styles.card}>
          <h3 className={styles.cardTitle}>회원관리</h3>
          <p className={styles.cardDesc}>정액 회원 정보와 만기일을 관리합니다.</p>
        </Link>
        <Link href="/admin/google-contacts" className={styles.card}>
          <h3 className={styles.cardTitle}>고객 연락처</h3>
          <p className={styles.cardDesc}>
            Google 연락처(가자 스크린)를 연동·동기화합니다.
          </p>
        </Link>
        <Link href="/admin/plan-types" className={styles.card}>
          <h3 className={styles.cardTitle}>요금제 관리</h3>
          <p className={styles.cardDesc}>회원 요금제 마스터를 등록·수정합니다.</p>
        </Link>
        <Link
          href="/store/monthly-ranking-display"
          target="_blank"
          className={styles.card}
        >
          <h3 className={styles.cardTitle}>현재 전광판 보기</h3>
          <p className={styles.cardDesc}>매장 전광판 화면을 새 탭에서 확인합니다.</p>
        </Link>
      </div>
    </>
  )
}

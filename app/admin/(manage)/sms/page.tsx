import Link from "next/link"
import styles from "../../admin.module.css"

export default function AdminSmsHomePage() {
  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>
      <h2 className={styles.pageTitle}>문자 발송</h2>
      <p className={styles.googleMeta} style={{ marginBottom: 20 }}>
        고객 연락처를 대상으로 즉시 또는 예약문자를 발송합니다.
      </p>
      <div className={styles.cardGrid}>
        <Link href="/admin/sms/compose" className={styles.card}>
          <h3 className={styles.cardTitle}>문자 작성</h3>
          <p className={styles.cardDesc}>
            대상함·그룹 초안으로 즉시/예약 문자를 작성합니다.
          </p>
        </Link>
        <Link href="/admin/sms/cart" className={styles.card}>
          <h3 className={styles.cardTitle}>문자 대상함</h3>
          <p className={styles.cardDesc}>
            여러 페이지에서 담은 연락처를 확인하고 정리합니다.
          </p>
        </Link>
        <Link href="/admin/sms/groups" className={styles.card}>
          <h3 className={styles.cardTitle}>문자 그룹</h3>
          <p className={styles.cardDesc}>자주 쓰는 대상 조합을 저장하고 불러옵니다.</p>
        </Link>
        <Link href="/admin/sms/scheduled" className={styles.card}>
          <h3 className={styles.cardTitle}>예약 목록</h3>
          <p className={styles.cardDesc}>예약된 문자를 확인하고 취소합니다.</p>
        </Link>
        <Link href="/admin/sms/history" className={styles.card}>
          <h3 className={styles.cardTitle}>발송 이력</h3>
          <p className={styles.cardDesc}>발송 결과와 제외/실패 내역을 확인합니다.</p>
        </Link>
        <Link href="/admin/google-contacts" className={styles.card}>
          <h3 className={styles.cardTitle}>고객 연락처</h3>
          <p className={styles.cardDesc}>대상을 선택해 대상함에 담습니다.</p>
        </Link>
      </div>
    </>
  )
}

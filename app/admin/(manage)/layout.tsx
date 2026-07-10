import AdminHeader from "./AdminHeader"
import styles from "../admin.module.css"

export default function AdminManageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.adminRoot}>
      <AdminHeader />
      <main className={styles.adminMain}>{children}</main>
    </div>
  )
}

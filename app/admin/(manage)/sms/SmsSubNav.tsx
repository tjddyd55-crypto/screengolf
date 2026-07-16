import Link from "next/link"
import styles from "../../admin.module.css"

const LINKS = [
  { href: "/admin/sms/compose", label: "작성" },
  { href: "/admin/sms/cart", label: "대상함" },
  { href: "/admin/sms/groups", label: "그룹" },
  { href: "/admin/sms/scheduled", label: "예약" },
  { href: "/admin/sms/history", label: "이력" },
] as const

export default function SmsSubNav({ active }: { active?: string }) {
  return (
    <div className={styles.subNav}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={active === link.href ? styles.subNavActive : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}

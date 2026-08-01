import { redirect } from "next/navigation"

/** 레거시 빠른 설정 → Scene 관리 */
export default function AdminDisplayRedirectPage() {
  redirect("/admin/display-scenes/display-1")
}

import { redirect } from "next/navigation"

/** 기존 경로 → Display Unit 1 */
export default function AdminDisplayRedirectPage() {
  redirect("/admin/display/display-1")
}

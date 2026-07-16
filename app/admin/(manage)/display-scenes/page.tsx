import { redirect } from "next/navigation"

/** 기존 경로 → Display Unit 1 */
export default function AdminDisplayScenesRedirectPage() {
  redirect("/admin/display-scenes/display-1")
}

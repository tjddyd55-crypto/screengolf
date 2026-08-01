import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ unitCode: string }>
}

/** 레거시 빠른 설정 URL → 해당 Unit Scene 관리로 redirect */
export default async function AdminDisplayUnitRedirectPage({
  params,
}: PageProps) {
  const { unitCode } = await params
  const code = unitCode?.trim() || "display-1"
  redirect(`/admin/display-scenes/${encodeURIComponent(code)}`)
}

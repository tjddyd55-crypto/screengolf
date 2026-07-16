"use client"

import { use } from "react"
import StoreDisplayClient from "../../monthly-ranking-display/StoreDisplayClient"

type PageProps = {
  params: Promise<{ unitCode: string }>
}

/** 확장 경로: /store/display/display-1, /store/display/display-2, ... */
export default function StoreDisplayByUnitPage({ params }: PageProps) {
  const { unitCode } = use(params)
  const code = encodeURIComponent(unitCode)

  return (
    <StoreDisplayClient stateApiPath={`/api/display-state/${code}`} />
  )
}

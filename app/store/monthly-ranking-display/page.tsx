"use client"

import StoreDisplayClient from "./StoreDisplayClient"

/** 기존 URL — Display Unit 1 (display-1) alias */
export default function MonthlyRankingDisplay() {
  return <StoreDisplayClient stateApiPath="/api/display-state" />
}

"use client"

import StoreDisplayClient from "../monthly-ranking-display/StoreDisplayClient"

/** Display Unit 2 alias */
export default function MonthlyRankingDisplay2() {
  return (
    <StoreDisplayClient stateApiPath="/api/display-state/display-2" />
  )
}

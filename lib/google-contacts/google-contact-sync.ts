import {
  getActiveGoogleContactsConnection,
  insertGoogleContactsSyncLog,
  updateGoogleContactsLastSync,
} from "@/lib/db/google-contacts"
import {
  createStoreGoogleContact,
  markStoreGoogleContactsNotInGroup,
  matchGoogleContactRow,
  updateStoreGoogleContactFromSync,
} from "@/lib/db/store-google-contacts"
import { getDb } from "@/lib/db/sqlite"
import { mapGooglePerson } from "@/lib/google-contacts/google-contact-mapper"
import { getGoogleContactsEnv } from "@/lib/google-contacts/google-contacts-env"
import {
  batchGetPeople,
  findContactGroupByExactName,
  listGroupMemberResourceNames,
} from "@/lib/google-contacts/google-people-client"
import { getValidAccessToken } from "@/lib/google-contacts/google-oauth"

export type GoogleSyncResult = {
  success: boolean
  groupName: string
  groupResourceName: string | null
  googleContactCount: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  conflicts: number
  failed: number
  removedFromGroup: number
  completedAt: string
  status: "success" | "partial" | "failed"
  message: string
}

let syncRunning = false

export function isGoogleSyncRunning(): boolean {
  return syncRunning
}

export async function runGoogleContactsSync(): Promise<GoogleSyncResult> {
  if (syncRunning) {
    throw new Error("이미 동기화가 진행 중입니다. 잠시 후 다시 시도해 주세요.")
  }

  syncRunning = true
  const startedAt = new Date().toISOString()
  const env = getGoogleContactsEnv()

  try {
    const connection = getActiveGoogleContactsConnection()
    if (!connection) {
      throw new Error("Google 연락처가 연결되어 있지 않습니다.")
    }

    await getValidAccessToken()

    const group = await findContactGroupByExactName(env.groupName)
    const memberNames = await listGroupMemberResourceNames(group.resourceName)
    const people = await batchGetPeople(memberNames)

    let created = 0
    let updated = 0
    let unchanged = 0
    let skipped = 0
    let conflicts = 0
    let failed = 0
    const skipDetails: Array<{ resourceName: string; reason: string }> = []
    const seen = new Set<string>()

    const applyOne = getDb().transaction((person: (typeof people)[number]) => {
      const mapped = mapGooglePerson(person)
      if (!mapped.ok) {
        skipped += 1
        skipDetails.push({
          resourceName: mapped.resourceName,
          reason: mapped.reason,
        })
        return
      }

      seen.add(mapped.contact.resourceName)
      const match = matchGoogleContactRow(mapped.contact)

      if (match.status === "conflict") {
        conflicts += 1
        skipDetails.push({
          resourceName: mapped.contact.resourceName,
          reason: "phone_conflict",
        })
        return
      }

      if (match.status === "none") {
        createStoreGoogleContact(mapped.contact, env.groupName)
        created += 1
        return
      }

      const result = updateStoreGoogleContactFromSync(
        match.row.id,
        mapped.contact,
        env.groupName,
      )
      if (result === "updated") updated += 1
      else unchanged += 1
    })

    for (const person of people) {
      try {
        applyOne(person)
      } catch (error) {
        failed += 1
        skipDetails.push({
          resourceName: person.resourceName,
          reason:
            error instanceof Error ? error.message : "contact_apply_failed",
        })
      }
    }

    const removedFromGroup = markStoreGoogleContactsNotInGroup(seen)
    const completedAt = new Date().toISOString()

    const status: GoogleSyncResult["status"] =
      failed > 0 || conflicts > 0 ? "partial" : "success"

    const message = [
      `신규 ${created}`,
      `수정 ${updated}`,
      `변경없음 ${unchanged}`,
      `제외 ${skipped}`,
      `충돌 ${conflicts}`,
      failed > 0 ? `실패 ${failed}` : null,
      removedFromGroup > 0 ? `그룹제외표시 ${removedFromGroup}` : null,
    ]
      .filter(Boolean)
      .join(", ")

    insertGoogleContactsSyncLog({
      started_at: startedAt,
      completed_at: completedAt,
      group_name: env.groupName,
      group_resource_name: group.resourceName,
      google_contact_count: people.length,
      created_count: created,
      updated_count: updated,
      unchanged_count: unchanged,
      skipped_count: skipped + conflicts,
      failed_count: failed,
      status,
      message,
      details_json: JSON.stringify({
        skips: skipDetails.slice(0, 100),
        removedFromGroup,
        conflicts,
        targetTable: "store_google_contacts",
      }),
    })

    updateGoogleContactsLastSync(connection.id, status, message)

    return {
      success: true,
      groupName: env.groupName,
      groupResourceName: group.resourceName,
      googleContactCount: people.length,
      created,
      updated,
      unchanged,
      skipped,
      conflicts,
      failed,
      removedFromGroup,
      completedAt,
      status,
      message,
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const message =
      error instanceof Error ? error.message : "동기화에 실패했습니다."

    insertGoogleContactsSyncLog({
      started_at: startedAt,
      completed_at: completedAt,
      group_name: env.groupName,
      group_resource_name: null,
      google_contact_count: 0,
      created_count: 0,
      updated_count: 0,
      unchanged_count: 0,
      skipped_count: 0,
      failed_count: 1,
      status: "failed",
      message,
      details_json: null,
    })

    const connection = getActiveGoogleContactsConnection()
    if (connection) {
      updateGoogleContactsLastSync(connection.id, "failed", message)
    }

    throw error
  } finally {
    syncRunning = false
  }
}

import { GOOGLE_PEOPLE_API_BASE } from "@/lib/google-contacts/google-contacts-env"
import { getValidAccessToken } from "@/lib/google-contacts/google-oauth"

async function peopleFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await getValidAccessToken()
  return fetch(`${GOOGLE_PEOPLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })
}

export type ContactGroupSummary = {
  resourceName: string
  name: string
  memberCount?: number
}

type ContactGroupsListResponse = {
  contactGroups?: Array<{
    resourceName?: string
    name?: string
    memberCount?: number
  }>
  nextPageToken?: string
}

export async function listContactGroups(): Promise<ContactGroupSummary[]> {
  const groups: ContactGroupSummary[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      pageSize: "1000",
    })
    if (pageToken) params.set("pageToken", pageToken)

    const res = await peopleFetch(`/contactGroups?${params.toString()}`)
    if (!res.ok) {
      throw new Error("Google 연락처 그룹 목록 조회에 실패했습니다.")
    }

    const json = (await res.json()) as ContactGroupsListResponse
    for (const group of json.contactGroups ?? []) {
      if (!group.resourceName || !group.name) continue
      groups.push({
        resourceName: group.resourceName,
        name: group.name,
        memberCount: group.memberCount,
      })
    }
    pageToken = json.nextPageToken
  } while (pageToken)

  return groups
}

export async function findContactGroupByExactName(
  groupName: string,
): Promise<ContactGroupSummary> {
  const target = groupName.trim()
  const matches = (await listContactGroups()).filter(
    (group) => group.name.trim() === target,
  )

  if (matches.length === 0) {
    throw new Error(
      `Google 연락처에서 '${target}' 라벨을 찾을 수 없습니다.`,
    )
  }

  if (matches.length > 1) {
    throw new Error(
      `Google 연락처에 '${target}' 라벨이 ${matches.length}개 있습니다. 라벨명을 고유하게 맞춰 주세요.`,
    )
  }

  return matches[0]
}

type ContactGroupGetResponse = {
  resourceName?: string
  name?: string
  memberResourceNames?: string[]
  nextPageToken?: string
  memberCount?: number
}

/** 그룹의 모든 memberResourceNames를 페이지네이션으로 수집 */
export async function listGroupMemberResourceNames(
  groupResourceName: string,
): Promise<string[]> {
  const members: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      maxMembers: "20000",
    })
    if (pageToken) params.set("pageToken", pageToken)

const res = await peopleFetch(`/${groupResourceName}?${params.toString()}`)
    if (!res.ok) {
      throw new Error("Google 연락처 그룹 멤버 조회에 실패했습니다.")
    }

    const json = (await res.json()) as ContactGroupGetResponse
    members.push(...(json.memberResourceNames ?? []))
    pageToken = json.nextPageToken
  } while (pageToken)

  return members
}

export type GooglePersonPayload = {
  resourceName: string
  etag?: string
  names?: Array<{
    displayName?: string
    givenName?: string
    familyName?: string
  }>
  nicknames?: Array<{ value?: string }>
  phoneNumbers?: Array<{ value?: string; type?: string }>
  memberships?: unknown[]
  metadata?: unknown
}

type BatchGetResponse = {
  responses?: Array<{
    httpStatusCode?: number
    person?: GooglePersonPayload
    requestedResourceName?: string
    status?: { code?: number; message?: string }
  }>
}

const PERSON_FIELDS =
  "names,nicknames,phoneNumbers,memberships,metadata"

/** batchGet은 한 번에 최대 200개 */
export async function batchGetPeople(
  resourceNames: string[],
): Promise<GooglePersonPayload[]> {
  const results: GooglePersonPayload[] = []
  const chunkSize = 200

  for (let i = 0; i < resourceNames.length; i += chunkSize) {
    const chunk = resourceNames.slice(i, i + chunkSize)
    if (chunk.length === 0) continue

    const params = new URLSearchParams({
      personFields: PERSON_FIELDS,
    })
    for (const name of chunk) {
      params.append("resourceNames", name)
    }

    const res = await peopleFetch(`/people:batchGet?${params.toString()}`)
    if (!res.ok) {
      throw new Error("Google 연락처 상세 조회에 실패했습니다.")
    }

    const json = (await res.json()) as BatchGetResponse
    for (const item of json.responses ?? []) {
      if (item.person?.resourceName) {
        results.push(item.person)
      }
    }
  }

  return results
}

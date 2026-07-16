import { NextResponse } from "next/server"
import {
  addContactsToCart,
  addFilteredContactsToCart,
  clearCart,
  countCartItems,
  getOrCreateActiveCart,
  listCartContactIds,
  listCartItemsPage,
  removeCartItem,
  removeCartItems,
  replaceCartWithContacts,
} from "@/lib/db/store-sms-cart"
import type { StoreGoogleContactListQuery } from "@/lib/db/store-google-contacts"
import {
  buildStoreSmsCartCookie,
  createStoreSmsCartKey,
  parseStoreSmsCartKey,
} from "@/lib/store-sms/store-sms-cart-cookie"
import { createStoreSmsDraftFromTarget } from "@/lib/store-sms/store-sms-campaign-service"
import { summarizeStoreSmsTarget } from "@/lib/store-sms/store-sms-targets"

export function resolveCartFromRequest(request: Request): {
  cartKey: string
  isNew: boolean
  cart: ReturnType<typeof getOrCreateActiveCart>
} {
  const existing = parseStoreSmsCartKey(request.headers.get("cookie"))
  const isNew = !existing
  const cartKey = existing ?? createStoreSmsCartKey()
  const cart = getOrCreateActiveCart(cartKey)
  return { cartKey, isNew, cart }
}

export function withCartCookie(
  response: NextResponse,
  cartKey: string,
  isNew: boolean,
): NextResponse {
  if (isNew) {
    response.headers.append("Set-Cookie", buildStoreSmsCartCookie(cartKey))
  }
  return response
}

export function getCartSummary(request: Request) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const total = countCartItems(cart.id)
  const ids = listCartContactIds(cart.id)
  const preview = summarizeStoreSmsTarget({
    type: "selected",
    contactIds: ids,
  })
  return {
    cartKey,
    isNew,
    cartId: cart.id,
    total,
    sendableEstimate: preview.sendable,
    excludedEstimate: preview.excluded,
  }
}

export function postCartItems(request: Request, contactIds: number[]) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const result = addContactsToCart(cart.id, contactIds)
  return { cartKey, isNew, ...result }
}

export function postCartAddFiltered(
  request: Request,
  filter: StoreGoogleContactListQuery,
) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const result = addFilteredContactsToCart(cart.id, filter)
  return { cartKey, isNew, ...result }
}

export function getCartItems(
  request: Request,
  options?: { query?: string; page?: number; pageSize?: number },
) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const page = listCartItemsPage(cart.id, options)
  return {
    cartKey,
    isNew,
    total: countCartItems(cart.id),
    ...page,
  }
}

export function deleteCartItem(request: Request, contactId: number) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const removed = removeCartItem(cart.id, contactId)
  return {
    cartKey,
    isNew,
    removed,
    total: countCartItems(cart.id),
  }
}

export function deleteCartItems(request: Request, contactIds: number[]) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const removed = removeCartItems(cart.id, contactIds)
  return {
    cartKey,
    isNew,
    removed,
    total: countCartItems(cart.id),
  }
}

export function clearCartRequest(request: Request) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const removed = clearCart(cart.id)
  return { cartKey, isNew, removed, total: 0 }
}

export function cartToDraft(request: Request) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const ids = listCartContactIds(cart.id)
  if (ids.length === 0) throw new Error("empty_cart")
  const draft = createStoreSmsDraftFromTarget({
    type: "selected",
    contactIds: ids,
  })
  return { cartKey, isNew, ...draft }
}

export function replaceCart(request: Request, contactIds: number[]) {
  const { cart, cartKey, isNew } = resolveCartFromRequest(request)
  const result = replaceCartWithContacts(cart.id, contactIds)
  return { cartKey, isNew, ...result }
}

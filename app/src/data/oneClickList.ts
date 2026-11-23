import { useSyncExternalStore } from "react";
import { useLiveLists } from "./lists";
import type { ListsState } from "./lists";
import { OWNED_LIST_ID, WISHLIST_LIST_ID } from "./listsDb";
import type { ListRecord } from "./listsDb";

// Which list the one-click button on every edition cell adds to. Only held locally.

const STORAGE_KEY = "ygo-one-click-list-id";

// Tells the components in this tab that the setting changed. The storage event only reaches the other tabs.
const listeners = new Set<() => void>();

function getStoredOneClickListId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? WISHLIST_LIST_ID;
}

function subscribeToOneClickListId(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// The list the stored id points to, as long as it is still one of the user's lists and is not Owned. Otherwise, i.e.
// if the list was deleted, or the lists have not loaded, Wishlist. Null only while the lists have not loaded, because
// Wishlist is always there once they have.
function findOneClickList(listsState: ListsState, storedListId: string): ListRecord | null {
  const chosenList = listsState.activeLists.find((list) => list.id === storedListId && list.id !== OWNED_LIST_ID);
  if (chosenList !== undefined) {
    return chosenList;
  }
  const wishlist = listsState.activeLists.find((list) => list.id === WISHLIST_LIST_ID);
  return wishlist === undefined ? null : wishlist;
}

// The list the one-click button adds to, re-rendering the component whenever it or the lists change. Null until the
// lists have loaded (see findOneClickList).
export function useLiveOneClickList(): ListRecord | null {
  const lists = useLiveLists();
  const storedListId = useSyncExternalStore(subscribeToOneClickListId, getStoredOneClickListId);
  return findOneClickList(lists, storedListId);
}

// Makes the list the one the one-click button adds to. The id is not checked here: findOneClickList falls back to
// Wishlist if it is not a list the user has.
export function setOneClickListId(listId: string): void {
  localStorage.setItem(STORAGE_KEY, listId);
  for (const listener of listeners) {
    listener();
  }
}
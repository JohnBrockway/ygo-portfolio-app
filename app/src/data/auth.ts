import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as signOutOfFirebase,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { useSyncExternalStore } from "react";
import { firebaseAuth } from "./firebase";

// The part of Firebase's User that the app uses, as plain data.
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

export interface AuthState {
  status: "loading" | "signed-out" | "signed-in";
  user: AuthUser | null;
  error: string | null;
}

// What every action below reports:
// - "done": it worked. For sendPasswordReset that means the email was sent if an account with that address exists.
// - "dismissed": the user closed the Google sign-in window (or opened a second one). Nothing to show.
// - "rejected": the user's input was refused (wrong password, email already in use, ...).`problem is a user-readable explanation.
// - "failed": something went wrong (network, blocked window, ...). It is already in the state's error, so the banner
//   shows it.
export interface AuthActionResult {
  status: "done" | "dismissed" | "rejected" | "failed";
  problem: string | null;
}

let state: AuthState = { status: "loading", user: null, error: null };
const listeners = new Set<() => void>();

function setState(next: AuthState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeToAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The current sign-in, re-rendering the component whenever it changes. Components should only ever read through this,
// and sign in and out through the functions below (signInWithGoogle, signInWithEmail, createAccountWithEmail,
// sendPasswordReset, signOutCurrentUser).
export function useLiveAuth(): AuthState {
  return useSyncExternalStore(subscribeToAuth, getAuthState);
}

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, displayName: user.displayName, email: user.email };
}

function describeFailure(what: string, error: unknown): string {
  if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
    return `${what}: the browser blocked the sign-in window. Allow pop-ups for this site and try again.`;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return `${what}: ${reason}`;
}

onAuthStateChanged(
  firebaseAuth,
  (user) => {
    if (user === null) {
      setState({ status: "signed-out", user: null, error: null });
    } else {
      setState({ status: "signed-in", user: toAuthUser(user), error: null });
    }
  },
  (error) => {
    setState({ status: "signed-out", user: null, error: describeFailure("Couldn't check who is signed in", error) });
  },
);

// The sign-in window being closed (or replaced by a second one) is the user's choice, not something that went wrong.
function isSignInDismissed(error: unknown): boolean {
  return (
    error instanceof FirebaseError &&
    (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request")
  );
}

// What to tell the user when Firebase refuses what they typed, by Firebase's error code. Anything not here is a failure.
const REJECTION_PROBLEMS: Readonly<Record<string, string>> = {
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/missing-password": "Enter a password.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/email-already-in-use": "An account with that email already exists. Sign in instead.",
  "auth/weak-password": "That password is too weak. Use at least 6 characters.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a while and try again, or reset your password.",
};

function findRejectionProblem(error: unknown): string | null {
  if (error instanceof FirebaseError && error.code in REJECTION_PROBLEMS) {
    return REJECTION_PROBLEMS[error.code];
  }
  return null;
}

// Runs one action against Firebase, after clearing the last error, and sorts how it went into an AuthActionResult. Never
// rejects. The new sign-in (or sign-out) shows up in the state once Firebase reports back, not here.
async function runAuthAction(failureText: string, action: () => Promise<unknown>): Promise<AuthActionResult> {
  setState({ ...state, error: null });
  try {
    await action();
    return { status: "done", problem: null };
  } catch (error) {
    if (isSignInDismissed(error)) {
      return { status: "dismissed", problem: null };
    }
    const problem = findRejectionProblem(error);
    if (problem !== null) {
      return { status: "rejected", problem };
    }
    setState({ ...state, error: describeFailure(failureText, error) });
    return { status: "failed", problem: null };
  }
}

// Opens Google's sign-in window.
export function signInWithGoogle(): Promise<AuthActionResult> {
  const provider = new GoogleAuthProvider();
  // Always ask which account to use, instead of silently taking the one Google is already signed in to: the browser may
  // have several, and the data that gets synced belongs to the one that is picked.
  provider.setCustomParameters({ prompt: "select_account" });
  return runAuthAction("Couldn't sign in", () => signInWithPopup(firebaseAuth, provider));
}

// Signs in with an existing account's email and password. Email is trimmed of whitespace, password passed exactly as typed (no trimming).
export function signInWithEmail(email: string, password: string): Promise<AuthActionResult> {
  return runAuthAction("Couldn't sign in", () => signInWithEmailAndPassword(firebaseAuth, email.trim(), password));
}

// Creates an account with this email and password, and signs in to it. The email is not verified, which is fine because an account
// only ever holds its own data.
export function createAccountWithEmail(email: string, password: string): Promise<AuthActionResult> {
  return runAuthAction("Couldn't create account", () =>
    createUserWithEmailAndPassword(firebaseAuth, email.trim(), password),
  );
}

// Sends the email with the link to choose a new password. With Firebase's default protection against guessing which
// emails have accounts this reports "done" for an address with no account too, and sends nothing.
export function sendPasswordReset(email: string): Promise<AuthActionResult> {
  return runAuthAction("Couldn't send the password reset email", () =>
    sendPasswordResetEmail(firebaseAuth, email.trim()),
  );
}

// Nothing in IndexedDB is touched: the lists and binders stay on this device.
export function signOutCurrentUser(): Promise<AuthActionResult> {
  return runAuthAction("Couldn't sign out", () => signOutOfFirebase(firebaseAuth));
}
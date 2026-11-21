import { signInWithGoogle, signOutCurrentUser, useLiveAuth } from "../data/auth";

// Who is signed in, with the button to sign out, or the button to sign in. Hovering it shows the account's email and
// user id. A failed attempt to sign in or out is shown above the button.
export function AccountControl() {
  const authState = useLiveAuth();
  const user = authState.user;

  let errorMessage = null;
  if (authState.error !== null) {
    errorMessage = (
      <p className="account-error" role="alert">
        {authState.error}
      </p>
    );
  }

  let accountName = null;
  let accountTitle = "Not signed in: lists are only saved on this device";
  let button = (
    <button
      type="button"
      className="action-button"
      disabled={authState.status === "loading"}
      onClick={() => void signInWithGoogle()}
    >
      Sign in
    </button>
  );
  if (user !== null) {
    const label = user.displayName ?? user.email ?? "Signed in";
    accountName = <span className="account-name muted">{label}</span>;
    accountTitle = `Signed in as ${user.email ?? label}\nUser id: ${user.uid}`;
    button = (
      <button type="button" className="action-button" onClick={() => void signOutCurrentUser()}>
        Sign out
      </button>
    );
  }

  return (
    <div className="account" title={accountTitle}>
      {errorMessage}
      {accountName}
      {button}
    </div>
  );
}
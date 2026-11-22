import { signOutCurrentUser } from "../data/auth";
import { discardLocalDataAndUseAccount, useLiveSyncStatus } from "../data/sync";

// Shown when the lists and binders on this device belong to a different account than the one signed in. Syncing is
// blocked until the user chooses, because syncing anyway would upload the other account's data into this one. Renders
// nothing otherwise.
export function AccountGuardBanner() {
  const status = useLiveSyncStatus();

  if (status.kind !== "account-mismatch") {
    return null;
  }

  async function handleDiscard() {
    const confirmed = window.confirm(
      "Delete all lists and binders on this device and use the account you are signed in to instead? Changes made on " +
        "this device that were never synced will be lost.",
    );
    if (confirmed) {
      await discardLocalDataAndUseAccount();
    }
  }

  return (
    <div className="error-banner" role="alert">
      <div>
        <p>The lists and binders on this device belong to a different account, so they aren't being synced.</p>
        <p className="muted">
          Sign out and sign back in as that account, or discard what is on this device and use this account's data.
        </p>
      </div>
      <div>
        <button type="button" className="action-button" onClick={() => void signOutCurrentUser()}>
          Sign out
        </button>{" "}
        <button type="button" className="action-button" onClick={handleDiscard}>
          Discard local data
        </button>
      </div>
    </div>
  );
}
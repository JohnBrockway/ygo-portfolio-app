import { syncNow, useLiveSyncStatus } from "../data/sync";
import type { SyncStatus } from "../data/sync";

// The statuses that get a button (the others are left out, see SyncIndicator).
type ButtonStatus = Exclude<SyncStatus, { kind: "loading" } | { kind: "signed-out" } | { kind: "account-mismatch" }>;

function describeLastSync(status: SyncStatus): string | undefined {
  if (status.kind === "idle") {
    return `Last synced at ${new Date(status.lastSyncedAt).toLocaleTimeString()}`;
  }
  return undefined;
}

// Every status is listed, with no default, so that a status added later doesn't quietly read as "Synced": the compiler
// asks for its label here.
function getButtonLabel(status: ButtonStatus): string {
  switch (status.kind) {
    case "syncing":
      return "Syncing…";
    case "not-synced-yet":
      return "Sync now";
    case "dirty":
      return `${status.count} unsynced`;
    case "offline":
      return "Offline, try again";
    case "error":
      return "Sync failed, try again";
    case "idle":
      return "Synced";
  }
}

// Shows how the data on this device stands against the cloud, in the nav next to the account control: how many changes
// are waiting to be uploaded, and clicking it syncs now (downloads what changed in the cloud, then uploads). It only
// says "Synced" once a sync has finished. Failures are shown by the ErrorBanner, and an account that isn't the device's
// owner by the AccountGuardBanner: here they only say that syncing isn't happening.
export function SyncIndicator() {
  const status = useLiveSyncStatus();

  if (status.kind === "loading") {
    return null;
  }

  // .sync-indicator gives it the same spacing as .account, so the two line up in the nav. Signed out, it is only a note,
  // which is left out on a phone: there is no room for it in the bar, and the sign in button already says as much.
  return (
    <div className={status.kind === "signed-out" ? "sync-indicator sync-indicator-wide-only" : "sync-indicator"}>
      {status.kind === "signed-out" ? (
        <p className="muted sync-indicator-note">Not signed in: saved on this device only</p>
      ) : status.kind === "account-mismatch" ? (
        <p className="muted sync-indicator-note">Sync paused</p>
      ) : (
        <button
          type="button"
          className="action-button"
          disabled={status.kind === "syncing"}
          title={describeLastSync(status)}
          onClick={() => void syncNow()}
        >
          {getButtonLabel(status)}
        </button>
      )}
    </div>
  );
}
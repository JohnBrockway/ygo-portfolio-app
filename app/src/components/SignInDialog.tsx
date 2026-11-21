import { useEffect, useId, useRef, useState } from "react";
import { signInWithGoogle, useLiveAuth } from "../data/auth";
import { EmailAuthForm } from "./EmailAuthForm";

// The dialog behind the Sign in button (see AccountControl). It first asks how to sign in, then carries on with that
// way: Google's own window opens straight away, and email gets the form in EmailAuthForm. Like AddToListDialog it is
// put on the page only while it is wanted (so every time it opens it starts again from the first question), and
// everything that closes it goes through dialog.close(), after which onClosed tells AccountControl to unmount it.
export function SignInDialog({ onClosed }: { onClosed: () => void }) {
  const authState = useLiveAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [view, setView] = useState<"choose" | "email">("choose");
  const [isBusy, setIsBusy] = useState(false);

  // A modal dialog has to be opened with showModal() (the open attribute would make it a plain box on the page).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  // Closes the dialog when someone has signed in, which also covers a sign-in made in another tab while this one is open.
  // (The sign-ins made here close it themselves too, below, without waiting for Firebase to report them.)
  const isSignedIn = authState.user !== null;
  useEffect(() => {
    if (isSignedIn) {
      dialogRef.current?.close();
    }
  }, [isSignedIn]);

  function closeDialog(): void {
    dialogRef.current?.close();
  }

  async function handleGoogleClick(): Promise<void> {
    setIsBusy(true);
    const result = await signInWithGoogle();
    setIsBusy(false);
    if (result.status !== "dismissed") {
      closeDialog();
    }
  }

  let content = (
    <>
      <h2 id={titleId} className="dialog-title">
        Sign in
      </h2>
      <button
        type="button"
        className="action-button account-dialog-button"
        disabled={isBusy}
        onClick={() => void handleGoogleClick()}
      >
        Continue with Google
      </button>
      <button
        type="button"
        className="action-button account-dialog-button"
        disabled={isBusy}
        onClick={() => setView("email")}
      >
        Continue with email
      </button>
      <button type="button" className="link-button" onClick={closeDialog}>
        Cancel
      </button>
    </>
  );
  if (view === "email") {
    content = <EmailAuthForm titleId={titleId} onBack={() => setView("choose")} onFinished={closeDialog} />;
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClosed}
      // A click on the backdrop lands on the dialog element itself; a click inside lands on something within it.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div className="dialog-body">{content}</div>
    </dialog>
  );
}
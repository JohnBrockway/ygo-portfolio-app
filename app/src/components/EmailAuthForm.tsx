import { useState } from "react";
import type { SubmitEvent } from "react";
import { createAccountWithEmail, sendPasswordReset, signInWithEmail } from "../data/auth";
import type { AuthActionResult } from "../data/auth";

type EmailAuthMode = "sign-in" | "create-account" | "reset-password";

const MODE_TEXT: Readonly<Record<EmailAuthMode, { title: string; submit: string }>> = {
  "sign-in": { title: "Sign in with email", submit: "Sign in" },
  "create-account": { title: "Create an account", submit: "Create account" },
  "reset-password": { title: "Reset your password", submit: "Send reset email" },
};

function submitEmailAction(mode: EmailAuthMode, email: string, password: string): Promise<AuthActionResult> {
  if (mode === "sign-in") {
    return signInWithEmail(email, password);
  } else if (mode === "create-account") {
    return createAccountWithEmail(email, password);
  } else if (mode === "reset-password") {
    return sendPasswordReset(email);
  }
  return sendPasswordReset(email);
}

// The email half of the sign in dialog (see SignInDialog): one form that is for signing in, creating an account or
// asking for a password reset email, with links to switch between them. The email stays when the mode is switched.
export function EmailAuthForm({
  titleId,
  onBack,
  onFinished,
}: {
  // The id for the heading, which the dialog is labelled by.
  titleId: string;
  // Goes back to the question of how to sign in.
  onBack: () => void;
  // Called when the sign-in is over (it worked, or it failed in a way AccountControl shows) and the dialog can close.
  onFinished: () => void;
}) {
  const [mode, setMode] = useState<EmailAuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  // What the user did wrong, shown under the fields.
  const [problem, setProblem] = useState<string | null>(null);
  // Said after a reset email was asked for. It is the same whether or not the address has an account.
  const [notice, setNotice] = useState<string | null>(null);

  function changeMode(nextMode: EmailAuthMode): void {
    setMode(nextMode);
    setProblem(null);
    setNotice(null);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await submitEmailAction(mode, email, password);
    setIsBusy(false);

    if (result.status === "rejected") {
      setProblem(result.problem);
    } else if (result.status === "failed") {
      onFinished();
    } else if (result.status === "done") {
      if (mode === "reset-password") {
        setNotice("If an account exists for that address, an email with a link to choose a new password is on its way.");
      } else {
        onFinished();
      }
    }
  }

  let passwordField = null;
  if (mode !== "reset-password") {
    passwordField = (
      <label className="account-dialog-field">
        Password
        <input
          type="password"
          className="text-input"
          autoComplete={mode === "create-account" ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
    );
  }

  let problemMessage = null;
  if (problem !== null) {
    problemMessage = (
      <p className="form-error" role="alert">
        {problem}
      </p>
    );
  }

  let noticeMessage = null;
  if (notice !== null) {
    noticeMessage = <p className="dialog-hint">{notice}</p>;
  }

  let modeLinks;
  if (mode === "sign-in") {
    modeLinks = (
      <>
        <button type="button" className="link-button" disabled={isBusy} onClick={() => changeMode("create-account")}>
          Create an account
        </button>
        <button type="button" className="link-button" disabled={isBusy} onClick={() => changeMode("reset-password")}>
          Forgot password?
        </button>
      </>
    );
  } else if (mode === "create-account") {
    modeLinks = (
      <button type="button" className="link-button" disabled={isBusy} onClick={() => changeMode("sign-in")}>
        I already have an account
      </button>
    );
  } else {
    modeLinks = (
      <button type="button" className="link-button" disabled={isBusy} onClick={() => changeMode("sign-in")}>
        Back to sign in
      </button>
    );
  }

  return (
    <>
      <h2 id={titleId} className="dialog-title">
        {MODE_TEXT[mode].title}
      </h2>
      <form className="account-dialog-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="account-dialog-field">
          Email
          <input
            type="email"
            className="text-input"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {passwordField}
        {problemMessage}
        {noticeMessage}
        <button type="submit" className="action-button account-dialog-button" disabled={isBusy}>
          {MODE_TEXT[mode].submit}
        </button>
        <div className="account-dialog-links">{modeLinks}</div>
      </form>
      <button type="button" className="link-button" disabled={isBusy} onClick={onBack}>
        Other ways to sign in
      </button>
    </>
  );
}
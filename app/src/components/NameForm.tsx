import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import type { NameProblem, RecordSaveResult } from "../data/recordConventions";

const NAME_PROBLEM_TEXT: Record<NameProblem, (noun: string) => string> = {
  empty: (noun) => `Give the ${noun} a name.`,
  duplicate: (noun) => `A ${noun} with that name already exists.`,
};

type NameFormProps = {
  // What is being named, as the user knows it: "list", "binder". Used in the messages about the name.
  noun: string;
  initialName: string;
  label: string;
  submitText: string;
  disabled: boolean;
  save: (name: string) => Promise<RecordSaveResult<unknown>>;
  // Further fields of the form, shown between the name box and the buttons (the grid size when creating a binder).
  // They are up to the caller: this form only knows about the name, so `disabled` must also cover them being invalid,
  // and the caller resets them in onSaved.
  extraFields?: ReactNode;
  onSaved?: () => void;
  onCancel?: () => void;
};

// Shared by both renaming and creation functionality, for lists and binders alike.
export function NameForm({
  noun,
  initialName,
  label,
  submitText,
  disabled,
  save,
  extraFields,
  onSaved,
  onCancel,
}: NameFormProps) {
  const [name, setName] = useState(initialName);
  const [nameProblem, setNameProblem] = useState<NameProblem | null>(null);
  const [saving, setSaving] = useState(false);

  const nameIsBlank = name.trim() === "";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await save(name);
    setSaving(false);

    // nameProblem is null if status isn't "invalid-name", so null just clears the fields that check for one.
    setNameProblem(result.nameProblem);
    if (result.status === "saved") {
      // Back to how the form started: for a new record that empties the field, ready for the next one. A form that
      // onSaved closes (renaming) is discarded anyway, so resetting it does no harm.
      setName(initialName);
      onSaved?.();
    }
    // "failed" is shown in the banner instead, so needs no handling here.
  }

  return (
    <>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          className="text-input"
          type="text"
          value={name}
          placeholder={label}
          aria-label={label}
          aria-invalid={nameProblem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setNameProblem(null);
          }}
        />
        {extraFields}
        <button className="action-button" type="submit" disabled={disabled || saving || nameIsBlank}>
          {submitText}
        </button>
        {onCancel !== undefined ? (
          <button className="action-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </form>
      {nameProblem !== null ? (
        <p className="form-error" role="alert">
          {NAME_PROBLEM_TEXT[nameProblem](noun)}
        </p>
      ) : null}
    </>
  );
}
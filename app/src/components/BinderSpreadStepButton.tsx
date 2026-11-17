import type { ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./ActionIcons";

type StepDirection = "previous" | "next";

// The button beside the open pages that opens the previous or the next spread, with a chevron pointing that way.
//
// Disabled means there is no page further in that direction. The button is then not shown either, but it keeps its
// screen space reserved to prevent shifting.
export function BinderSpreadStepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: StepDirection;
  disabled: boolean;
  onClick: () => void;
}) {
  let label: string;
  let icon: ReactNode;
  if (direction === "previous") {
    label = "Previous pages";
    icon = <ChevronLeftIcon />;
  } else {
    label = "Next pages";
    icon = <ChevronRightIcon />;
  }

  let className = "action-button icon-button binder-step-button";
  if (disabled) {
    className += " binder-step-button-hidden";
  }

  return (
    <button className={className} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}
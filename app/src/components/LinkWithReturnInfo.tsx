import { Link, useLocation } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import { makeBackState } from "../data/backState";

type LinkWithReturnInfoProps = Omit<LinkProps, "state"> & {
  // The display name of the page this link is to, shown as "Back to <backLabel>" on the next page.
  backLabel: string;
};

// A Link to a page that has a BackLink. Use this instead of Link for every such link.
// It records the current address (with its filters), so Back can return to exactly this view.
export function LinkWithReturnInfo({ backLabel, ...linkProps }: LinkWithReturnInfoProps) {
  const location = useLocation();
  const backTo = location.pathname + location.search;
  return <Link {...linkProps} state={makeBackState(backLabel, backTo)} />;
}
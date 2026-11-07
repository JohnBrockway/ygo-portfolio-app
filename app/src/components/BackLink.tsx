import { Link, useLocation, useNavigate } from "react-router-dom";
import { readBackState } from "../data/backState";

type BackLinkProps = {
  // Where the link goes (and what it is called) when we don't know the previous page.
  fallbackTo: string;
  fallbackLabel: string;
};

export function BackLink({ fallbackTo, fallbackLabel }: BackLinkProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const backState = readBackState(location.state);

  // Set the link location to the actual fully qualified destination (search params included
  // if applicable, etc.) so that ex. CTRL-clicks still direct to the right page. However,
  // when just clicking the link, override default to pop from history stack instead,
  // to make sure history isn't full of back and forths
  const to = backState === null ? fallbackTo : backState.backTo;
  const label = backState === null ? fallbackLabel : backState.backLabel;

  return (
    <Link
      to={to}
      onClick={(event) => {
        const isPlainClick =
          event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        if (backState !== null && isPlainClick) {
          event.preventDefault();
          navigate(-1);
        }
      }}
    >
      Back to {label}
    </Link>
  );
}
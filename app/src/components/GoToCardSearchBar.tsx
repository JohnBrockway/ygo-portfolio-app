import { useNavigate } from "react-router-dom";
import { CARD_SEARCH_LABEL } from "../data/cardSearchLabel";
import { SubmitSearchBar } from "./SubmitSearchBar";
import { buildCardSearchPath } from "../data/useFilterParams";

// A search bar for pages other than Cards: submitting opens the Cards page with the text already searched.
export function GoToCardSearchBar() {
  const navigate = useNavigate();
  return (
    <SubmitSearchBar
      searchLabel={CARD_SEARCH_LABEL}
      onSubmit={(query) => navigate(buildCardSearchPath(query))}
    />
  );
}
// Split the typed text into lowercase words, ignoring extra spaces.
export function splitQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== "");
}

// True when every word appears somewhere in the text. The text and tokens must already be lowercase, so text that
// is searched often should be lowercased once instead of on every keystroke.
export function matchesAllTokensInLowerText(lowerText: string, tokens: string[]): boolean {
  return tokens.every((token) => lowerText.includes(token));
}

// Joins already-lowercase texts (a set number and a title) into one text, so a query can match any of them with a
// single matchesAllTokensInLowerText call. A token never contains whitespace (splitQuery splits on it), so it can't
// match across the join.
export function joinSearchTexts(...lowerTexts: string[]): string {
  return lowerTexts.join(" ");
}

// True when
//    - every token appears somewhere in the search text (the set number and card title joined by joinSearchTexts,
//      i.e. basic search match)
//    - AND at least one token appears specifically in the set number
// Requiring a set number hit keeps title-only matches showing card tiles only.
// Both texts must already be lowercase.
export function matchesSetNumberAndTitle(
  lowerSetNumber: string,
  lowerSearchText: string,
  tokens: string[],
): boolean {
  return (
    matchesAllTokensInLowerText(lowerSearchText, tokens) &&
    tokens.some((token) => lowerSetNumber.includes(token))
  );
}
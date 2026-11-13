// Split the typed text into lowercase words, ignoring extra spaces.
export function splitQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== "");
}

// True when every word appears somewhere in the text.
export function matchesAllTokens(text: string, tokens: string[]): boolean {
  const lowerText = text.toLowerCase();
  return tokens.every((token) => lowerText.includes(token));
}

// True when
//    - every token appears somewhere in the set number or the card title (i.e. basic search match)
//    - AND at least one token appears specifically in the set number
// Requiring a set number hit keeps title-only matches showing card tiles only.
// Both texts must already be lowercase.
export function matchesSetNumberAndTitle(
  lowerSetNumber: string,
  lowerTitle: string,
  tokens: string[],
): boolean {
  let setNumberHit = false;
  for (const token of tokens) {
    if (lowerSetNumber.includes(token)) {
      setNumberHit = true;
    } else if (!lowerTitle.includes(token)) {
      return false;
    }
  }
  return setNumberHit;
}
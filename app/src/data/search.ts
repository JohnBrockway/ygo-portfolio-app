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
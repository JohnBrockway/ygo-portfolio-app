// Indexes records by a key so code can look a record up by id instead of searching the whole
// list each time. If two records share a key, the later one wins.
export function indexBy<T>(records: readonly T[], getKey: (record: T) => string): Map<string, T> {
  const recordsByKey = new Map<string, T>();
  for (const record of records) {
    recordsByKey.set(getKey(record), record);
  }
  return recordsByKey;
}
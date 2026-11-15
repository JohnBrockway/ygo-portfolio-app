// Helpers for looking records up by a key: indexBy for one record per key, groupBy (with getGroup) for several.

// Indexes records by a key so code can look a record up by id instead of searching the whole
// list each time. If two records share a key, the later one wins.
export function indexBy<T>(records: readonly T[], getKey: (record: T) => string): Map<string, T> {
  const recordsByKey = new Map<string, T>();
  for (const record of records) {
    recordsByKey.set(getKey(record), record);
  }
  return recordsByKey;
}

// Groups records by a key, keeping their order within each group, so code can get every record with a key instead of
// filtering the whole list each time.
export function groupBy<T>(records: readonly T[], getKey: (record: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = getKey(record);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [record]);
    } else {
      group.push(record);
    }
  }
  return groups;
}

// One shared empty array, so callers can use the result of getGroup as a dependency of useMemo without
// it looking changed on every render.
const NO_RECORDS: readonly never[] = [];

// The group of a map made by groupBy, or none if the key has no group.
export function getGroup<T>(groups: ReadonlyMap<string, readonly T[]>, key: string): readonly T[] {
  return groups.get(key) ?? NO_RECORDS;
}
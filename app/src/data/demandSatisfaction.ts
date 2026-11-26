import type { EntryGroup } from "./entryGroups";
import { getListEntries, getListGroups, useLiveLists } from "./lists";
import type { ListsState } from "./lists";
import { getEntryKey, OWNED_LIST_ID } from "./listsDb";
import type { ListEntryRecord } from "./listsDb";

// A demand is what one non-Owned list asks for. A plain entry (one that is in no live group) is a demand with one
// acceptable printing and edition; a group (see entryGroups.ts) is a demand with several, any one of which will
// do. Supply is the quantity on the Owned list of each printing and edition. A solver turns all the demands plus the
// supply into a satisfaction for every demand. Version 1, below, is a simple rule; a smarter one replaces it by
// changing which solver getDemandSatisfaction runs, and nothing else.

// How much of a demand is covered by what is owned.
export type SatisfactionLevel = "none" | "partial" | "complete";

export interface Demand {
  // Unique among all demands.
  key: string;
  listId: string;
  // The acceptable entries, all on listId, in the order of the group's members. Never empty: a plain entry's demand has
  // just that entry.
  options: readonly ListEntryRecord[];
}

export interface DemandSatisfaction {
  level: SatisfactionLevel;
  // The key (see getEntryKey) of the option that carries the demand, or null where nothing does (any level but
  // "complete").
  satisfiedBy: string | null;
  // For tooltips. How many copies of the option that is closest to covering the demand are owned, and how many lists
  // other than Owned hold that option (this demand's list included), which is how many copies they hold between them.
  ownedCount: number;
  wishedCount: number;
}

// Works out the satisfaction of every demand, by demand key. Gets all the demands at once because a smarter solver
// is global: whether one demand can be covered may depend on every other list.
export type DemandSolver = (
  demands: readonly Demand[],
  ownedSupply: ReadonlyMap<string, number>,
) => ReadonlyMap<string, DemandSatisfaction>;

// Identifies the demand of a live group, in the same way getEntryKey identifies the demand of a plain entry. The two
// can't collide (the keys are arrays of different lengths).
export function getGroupDemandKey(group: EntryGroup): string {
  return JSON.stringify(["group", group.listId, group.groupId]);
}

// Identifies one edition of one printing, whichever list holds it: what the supply is counted in. (The card is left out
// because the printing already decides it.)
function getPrintingEditionKey(entry: ListEntryRecord): string {
  return JSON.stringify([entry.printingId, entry.edition]);
}

// The demands of every list other than Owned, in the order of the lists. Within a list, its live groups come first,
// then its plain entries. Entries of the Owned list are supply, never demands.
function makeDemands(listsState: ListsState): Demand[] {
  const demands: Demand[] = [];
  for (const list of listsState.activeLists) {
    if (list.id === OWNED_LIST_ID) {
      continue;
    }
    const groups = getListGroups(listsState, list.id);
    const groupedEntryKeys = new Set(groups.flatMap((group) => group.members.map((member) => getEntryKey(member))));
    for (const group of groups) {
      demands.push({ key: getGroupDemandKey(group), listId: list.id, options: group.members });
    }
    for (const entry of getListEntries(listsState, list.id)) {
      if (!groupedEntryKeys.has(getEntryKey(entry))) {
        demands.push({ key: getEntryKey(entry), listId: list.id, options: [entry] });
      }
    }
  }
  return demands;
}

// How many copies of each edition of each printing are on the Owned list, by getPrintingEditionKey. An edition that is
// not owned is not in it.
function makeOwnedSupply(listsState: ListsState): Map<string, number> {
  const supply = new Map<string, number>();
  for (const entry of getListEntries(listsState, OWNED_LIST_ID)) {
    const key = getPrintingEditionKey(entry);
    supply.set(key, (supply.get(key) ?? 0) + entry.quantity);
  }
  return supply;
}

// --- Version 1 of the solver ---

const LEVEL_RANKS: Record<SatisfactionLevel, number> = { none: 0, partial: 1, complete: 2 };

// How well one option alone is covered, by the rule the badges have always used: nothing owned is none, at least as
// many owned as there are wished copies is complete (every list holding the option can be given one), and anything in
// between is partial. `satisfiedBy` is the option itself when complete.
function getOptionSatisfaction(option: ListEntryRecord, ownedCount: number, wishedCount: number): DemandSatisfaction {
  let level: SatisfactionLevel;
  if (ownedCount === 0) {
    level = "none";
  } else if (ownedCount >= wishedCount) {
    level = "complete";
  } else {
    level = "partial";
  }
  return {
    level,
    satisfiedBy: level === "complete" ? getEntryKey(option) : null,
    ownedCount,
    wishedCount,
  };
}

// Whether `candidate` is closer to covering a demand than `current`: a higher level, or the same level with more copies
// owned. On a tie the one that came first stays.
function isCloser(candidate: DemandSatisfaction, current: DemandSatisfaction): boolean {
  const rankDifference = LEVEL_RANKS[candidate.level] - LEVEL_RANKS[current.level];
  return rankDifference > 0 || (rankDifference === 0 && candidate.ownedCount > current.ownedCount);
}

// Every option is judged on its own, by what is owned of it against how many lists want it, and a demand is as covered
// as its closest option. So a group is complete when some member is, partial when none is but some member is partly
// owned, and none otherwise. It never claims "complete" falsely, because an option with as many owned as wished can be
// given to every list that holds it, this demand's included. It can understate: it does not combine copies spread over
// several members, or shared between overlapping groups.
const solveByOptionOwnership: DemandSolver = (demands, ownedSupply) => {
  const wishedCounts = new Map<string, number>();
  for (const demand of demands) {
    for (const option of demand.options) {
      const key = getPrintingEditionKey(option);
      wishedCounts.set(key, (wishedCounts.get(key) ?? 0) + 1);
    }
  }

  const satisfactions = new Map<string, DemandSatisfaction>();
  for (const demand of demands) {
    // reduce without a starting value throws on an empty array, which a demand never has.
    const closest = demand.options
      .map((option) => {
        const key = getPrintingEditionKey(option);
        return getOptionSatisfaction(option, ownedSupply.get(key) ?? 0, wishedCounts.get(key) ?? 0);
      })
      .reduce((current, candidate) => (isCloser(candidate, current) ? candidate : current));
    satisfactions.set(demand.key, closest);
  }
  return satisfactions;
};

// The solver in use. A smarter one replaces it here.
const solveDemands: DemandSolver = solveByOptionOwnership;

// Memory's lists state is replaced on every change, never changed in place, so a result belongs to the state object it
// was worked out from. Entries leave the map along with their state, once nothing refers to it any more.
const satisfactionsByState = new WeakMap<ListsState, ReadonlyMap<string, DemandSatisfaction>>();

// The satisfaction of every demand in this state, by demand key: getEntryKey for the plain entries and getGroupDemandKey
// for the live groups. Worked out once per state object.
export function getDemandSatisfaction(listsState: ListsState): ReadonlyMap<string, DemandSatisfaction> {
  const known = satisfactionsByState.get(listsState);
  if (known !== undefined) {
    return known;
  }
  const satisfactions = solveDemands(makeDemands(listsState), makeOwnedSupply(listsState));
  satisfactionsByState.set(listsState, satisfactions);
  return satisfactions;
}

// The satisfaction of every demand (see getDemandSatisfaction), re-rendering the component whenever the lists change.
export function useLiveDemandSatisfaction(): ReadonlyMap<string, DemandSatisfaction> {
  return getDemandSatisfaction(useLiveLists());
}
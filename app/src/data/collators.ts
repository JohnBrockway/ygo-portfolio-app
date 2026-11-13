// Shared collators: calling localeCompare with options builds a new collator on every call,
// which is far slower than reusing one.
export const titleCollator = new Intl.Collator();

// numeric: true sorts "LB-9" before "LB-10".
export const setNumberCollator = new Intl.Collator(undefined, { numeric: true });
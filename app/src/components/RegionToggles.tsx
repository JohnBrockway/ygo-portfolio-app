type RegionTogglesProps = {
  regions: string[];
  disabledRegions: Set<string>;
  onToggle: (region: string) => void;
};

export function RegionToggles({ regions, disabledRegions, onToggle }: RegionTogglesProps) {
  // With fewer than two regions there is nothing to choose between.
  if (regions.length < 2) {
    return null;
  }

  return (
    <div className="region-toggles" role="group" aria-label="Filter by region">
      {regions.map((region) => {
        const isOn = !disabledRegions.has(region);
        return (
          <button
            key={region}
            type="button"
            className={isOn ? "region-toggle" : "region-toggle region-toggle-off"}
            aria-pressed={isOn}
            onClick={() => onToggle(region)}
          >
            {region}
          </button>
        );
      })}
    </div>
  );
}
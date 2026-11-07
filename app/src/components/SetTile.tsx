import { setImageUrl } from "../data/images";
import type { CardSet } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";

export function SetTile({ set }: { set: CardSet }) {
  return (
    <LinkWithReturnInfo to={`/sets/${set.set_id}`} backLabel="set search" className="tile" title={set.title}>
      <TileImage imageUrl={setImageUrl(set)} />
      <div className="tile-body">
        <div className="tile-title">{set.title}</div>
        <div className="tile-meta">
          <span className="tag">{set.region}</span>
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}
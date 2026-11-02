import { Link } from "react-router-dom";
import { setImageUrl } from "../data/images";
import type { CardSet } from "../data/types";
import { TileImage } from "./TileImage";

export function SetTile({ set }: { set: CardSet }) {
  return (
    <Link to={`/sets/${set.set_id}`} className="tile" title={set.title}>
      <TileImage imageUrl={setImageUrl(set)} />
      <div className="tile-body">
        <div className="tile-title">{set.title}</div>
        <div className="tile-meta">
          <span className="tag">{set.region}</span>
        </div>
      </div>
    </Link>
  );
}
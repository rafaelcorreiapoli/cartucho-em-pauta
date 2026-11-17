import type {GroundItem} from './gameplay';
import type {Decoration} from './photography';
import type {PlenaryView} from './plenary';

const noGround:readonly GroundItem[] = [];
const noDecorations:readonly Decoration[] = [];
const noOfficeHolders:ReadonlySet<string> = new Set();

export function projectWorldSnapshot(view?:PlenaryView) {
  return {
    ground:view?.gameplay?.ground ?? noGround,
    decorations:view?.gameplay?.decorations ?? noDecorations,
    officeHolders:view?.election?.offices ? new Set(view.election.offices.map(({id})=>id)) : noOfficeHolders,
  };
}

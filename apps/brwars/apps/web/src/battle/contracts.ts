import type { LoadingState } from '../loading-assets';
import { type CameraView } from '../camera';
import type { MapSelection } from '../selection';
import type { Session } from '../session';

export type BattlefieldProps = {
  onLoadingChange: (state: LoadingState) => void;
  session: Session;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
  onUpgrade: (slot: number) => void;
  cameraTarget: { x: number; y: number; serial: number } | null;
  onCameraChange: (view: CameraView) => void;
};
export type BattlefieldState = Pick<
  BattlefieldProps,
  'session' | 'selection' | 'onSelect' | 'cameraTarget' | 'onCameraChange'
> & {
  zoom: number;
  upgradeFeedback: Map<
    number,
    { session: Session; level: number; cost: number; x: number; y: number; createdAt: number }
  >;
};
export interface BattleView {
  renderScale: number;
  worldZoom: number;
}
export interface SceneEnvironment {
  onLoadProgress: (progress: number) => void;
  onSceneReady: () => void;
  onAssetError: () => void;
  host: { current: HTMLElement };
  overlayWorld: { current: HTMLElement };
  projection: { current: { scaleX: number; scaleY: number } };
  scroll: { current: { x: number; y: number } };
  current: { readonly current: BattlefieldState };
  setZoom: (update: (zoom: number) => number) => void;
  view: BattleView;
  updateMapView: () => void;
}

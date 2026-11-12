import { prepareInterfaceAssets, type LoadingState } from '../loading-assets';
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../camera';
import type { BattlefieldState } from './contracts';
import { createBattleScene } from './scene';
import { renderScale } from './viewport';

export function mountBattlefield({
  host: hostElement,
  overlay: overlayElement,
  readState,
  onZoom,
  onLoadingChange,
}: {
  onLoadingChange: (state: LoadingState) => void;
  host: HTMLElement;
  overlay: HTMLElement;
  readState: () => BattlefieldState;
  onZoom: (update: (zoom: number) => number) => void;
}) {
  const host = { current: hostElement },
    overlayWorld = { current: overlayElement },
    projection = { current: { scaleX: 1, scaleY: 1 } },
    scroll = { current: { x: 0, y: 0 } },
    current = {
      get current() {
        return readState();
      },
    },
    setZoom = onZoom;
  if (!host.current) return;
  const view = {
    renderScale: renderScale(
      host.current.clientWidth,
      host.current.clientHeight,
      window.devicePixelRatio,
    ),
    worldZoom: current.current.zoom,
  };

  const updateMapView = () => {
    const canvas = host.current?.querySelector('canvas');
    if (!canvas || !host.current) return;
    const bounds = canvas.getBoundingClientRect();
    const next = {
      x: 0,
      y: 0,
      scaleX: bounds.width / VIEW_WIDTH,
      scaleY: bounds.height / VIEW_HEIGHT,
    };
    projection.current = {
      scaleX: next.scaleX * view.worldZoom,
      scaleY: next.scaleY * view.worldZoom,
    };
  };
  let cancelled = false,
    failed = false,
    sceneReady = false,
    interfaceReady = false,
    worldProgress = 0,
    interfaceProgress = 0;
  const report = () => {
    if (!cancelled)
      onLoadingChange({
        progress: worldProgress * 0.7 + interfaceProgress * 0.3,
        ready: !failed && sceneReady && interfaceReady,
        error: failed,
        phase: worldProgress < 1 ? 'Carregando o campo de batalha…' : 'Preparando som e interface…',
      });
  };
  const fail = () => {
    failed = true;
    report();
  };
  report();
  void prepareInterfaceAssets((progress) => {
    interfaceProgress = progress;
    report();
  })
    .then(() => {
      interfaceReady = true;
      report();
    })
    .catch(fail);
  const Battle = createBattleScene({
    onLoadProgress: (progress) => {
      worldProgress = progress;
      report();
    },
    onSceneReady: () => {
      sceneReady = true;
      report();
    },
    onAssetError: fail,
    host,
    overlayWorld,
    projection,
    scroll,
    current,
    setZoom,
    view,
    updateMapView,
  });
  const engine = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host.current,
    width: VIEW_WIDTH * view.renderScale,
    height: VIEW_HEIGHT * view.renderScale,
    backgroundColor: '#a8bd7c',
    scene: Battle,
    input: { windowEvents: false },
    render: { antialias: true, antialiasGL: true, pixelArt: false },
    scale: {
      mode:
        host.current.clientWidth > host.current.clientHeight
          ? Phaser.Scale.ENVELOP
          : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
  const resizeObserver = new ResizeObserver(() => {
    if (!host.current || !engine.isBooted) return;
    const nextScale = renderScale(
      host.current.clientWidth,
      host.current.clientHeight,
      window.devicePixelRatio,
    );
    engine.scale.scaleMode =
      host.current.clientWidth > host.current.clientHeight
        ? Phaser.Scale.ENVELOP
        : Phaser.Scale.FIT;
    if (nextScale !== view.renderScale) {
      view.renderScale = nextScale;
      engine.scale.setGameSize(VIEW_WIDTH * view.renderScale, VIEW_HEIGHT * view.renderScale);
      for (const scene of engine.scene.getScenes(true)) {
        scene.cameras.main.setZoom(view.renderScale * view.worldZoom);
        for (const child of scene.children.list)
          if (child instanceof Phaser.GameObjects.Text) child.setResolution(view.renderScale);
      }
    }
    engine.scale.refresh();
    updateMapView();
  });
  resizeObserver.observe(host.current);
  return () => {
    cancelled = true;
    resizeObserver.disconnect();
    engine.destroy(true);
  };
}

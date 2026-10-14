// Public exports for the scenes3d module.
// Populated incrementally across T-002..T-034.

export { PokerCanvas } from './PokerCanvas';
export type { PokerCanvasProps } from './PokerCanvas';

export * as CardAtlas from './components/CardAtlas';
export type { AtlasRank, AtlasSuit, AtlasUV } from './components/CardAtlas';

export { ChipInstances, DENOMINATIONS, chipCountsFor } from './components/ChipInstances';
export type {
  ChipInstancesProps,
  DenomName,
  Denomination,
} from './components/ChipInstances';
export { ChipStack } from './components/ChipStack';
export type { ChipStackProps } from './components/ChipStack';

export {
  CameraRig,
  getCameraRigConfig,
  SPECTATOR_CAMERA_CONFIG,
  PLAYER_CAMERA_CONFIG,
} from './components/CameraRig';
export type {
  CameraRigProps,
  CameraRigConfig,
  OrbitConfig,
} from './components/CameraRig';

export { CameraPresetController } from './components/CameraPresetController';
export type { CameraPresetControllerProps } from './components/CameraPresetController';
export { CameraPresetToolbar } from './components/CameraPresetToolbar';
export type { CameraPresetToolbarProps } from './components/CameraPresetToolbar';
export { TableSettingsPanel } from './components/TableSettingsPanel';
export type { TableSettingsPanelProps } from './components/TableSettingsPanel';
export { QualityToast } from './components/QualityToast';
export type { QualityToastProps } from './components/QualityToast';
export {
  HandScrubberPanel,
  streetIndexFromOutcomePhase,
} from './components/HandScrubberPanel';
export type { HandScrubberPanelProps } from './components/HandScrubberPanel';
export {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
  FELT_COLORS,
  CARD_BACKS,
  THEME_MODES,
  REPLAY_SPEEDS,
  TABLE_STORE_PERSIST_KEY,
} from './state/tableStore';
export type {
  TableStoreState,
  TableTheme,
  ThemeMode,
  FeltColorOption,
  CardBackOption,
  CardBackId,
  ReplayState,
  ReplaySpeed,
  StreetIdx,
} from './state/tableStore';
export {
  QUALITY_TIER_NAMES,
  QUALITY_TIER_SETTINGS,
  MOBILE_BREAKPOINT_PX,
  DEFAULT_QUALITY_TIER_DESKTOP,
  DEFAULT_QUALITY_TIER_MOBILE,
  resolveDefaultQualityTier,
  nextLowerTier,
  nextHigherTier,
} from './state/qualitySettings';
export {
  FPSMonitor,
  useFPSMonitor,
  FPS_WINDOW_SAMPLES,
  FPS_DEGRADE_THRESHOLD,
  FPS_SUSTAINED_MS,
  TIER_TOAST_MESSAGE,
} from './state/useFPSMonitor';
export type {
  QualityTierSettings,
  ShadowSettings,
  EnvMapSettings,
  EnvMapMode,
  PBRMode,
  AntiAliasingMode,
} from './state/qualitySettings';
export {
  CAMERA_PRESETS,
  CAMERA_PRESET_NAMES,
  CAMERA_PRESET_TRANSITION_MS,
  CINEMATIC_ORBIT_RAD_PER_SEC,
  SEAT_POV_BACK_OFFSET,
  SEAT_POV_CAM_HEIGHT,
  SEAT_POV_TARGET_HEIGHT,
  SEAT_POV_YAW_HALF_WIDTH,
  computeSeatPresetPose,
  computeSeatYawCenter,
  createCameraPresetState,
  resolveCameraPresetPose,
} from './animations/cameraPresets';
export type {
  CameraPreset,
  CameraPresetName,
  CameraPresetPose,
  CameraPresetState,
  CameraPresetStateOptions,
  SeatCameraPreset,
} from './animations/cameraPresets';

export { PokerTable } from './PokerTable';
export type {
  PokerTableProps,
  PokerTableTheme,
  TableCameraPreset,
} from './PokerTable';

export {
  DealAnimationDriver,
  buildPokerTableDealLayout,
  useDealTargetRegistry,
  registerDealTarget,
} from './animations/DealAnimationDriver';
export type {
  DealAnimationDriverProps,
  DealTargetRegistry,
} from './animations/DealAnimationDriver';

export {
  ChipSlideDriver,
  buildPokerTableChipSlideLayout,
  POT_CHIP_WORLD_POSITION,
} from './animations/ChipSlideDriver';
export type { ChipSlideDriverProps } from './animations/ChipSlideDriver';
export { ChipSlideController } from './animations/ChipSlideController';
export type { ChipSlideControllerOptions } from './animations/ChipSlideController';
export {
  CHIP_SLIDE_DURATION_MS,
  chipSlideKey,
  computeChipSlideDeltas,
} from './animations/chipSlides';
export type {
  ChipSlideDelta,
  ChipSlideLayout,
} from './animations/chipSlides';

export {
  TableMarkers,
  DEALER_BUTTON_ANIMATION_MS,
  dealerButtonWorldPosition,
  smallBlindWorldPosition,
  bigBlindWorldPosition,
} from './components/DealerButton';
export type { TableMarkersProps } from './components/DealerButton';

export type {
  TableState,
  SeatState,
  TableStatePhase,
  CardRef,
  Suit,
  ActionName,
  ResultLabel,
  ViewerContext,
  Policy,
  QualityTier,
} from './types';

export {
  SessionReplayShell,
  useSessionReplayContext,
  phaseFromStreetIndex,
  MS_PER_STREET,
  MS_INTER_HAND,
} from './SessionReplayShell';
export type {
  SessionReplayShellProps,
  SessionReplayContextValue,
} from './SessionReplayShell';

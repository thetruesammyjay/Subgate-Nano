export const playbackTokenLifetimeSeconds = 300;
export const defaultHeartbeatIntervalSeconds = 5;
export const defaultSessionTimeoutSeconds = 30;

export type PlaybackTokenClaims = { sessionId: string; streamId: string; viewerAddress: string; expiresAt: number };

export const getAccruedUsdc = (ratePerMinuteUsdc: number, seconds: number) =>
  Number(((ratePerMinuteUsdc / 60) * seconds).toFixed(6));

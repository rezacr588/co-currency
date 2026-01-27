import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export interface VersionInfo {
  /** App version from app.json (e.g., "1.0.0") */
  version: string;
  /** Native build number */
  buildNumber: string;
  /** OTA update ID if available */
  updateId: string | null;
  /** Git commit hash (short) */
  commitHash: string | null;
  /** Whether running in development mode */
  isDev: boolean;
  /** Full version string for display */
  displayVersion: string;
}

export function getVersionInfo(): VersionInfo {
  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ||
                      Constants.expoConfig?.android?.versionCode?.toString() ||
                      '1';

  // Get update info from expo-updates
  const updateId = Updates.updateId || null;

  // Extract commit hash from update message or use a placeholder
  // OTA updates include commit hash in the message
  let commitHash: string | null = null;
  if (updateId) {
    // Update ID contains info about the update
    commitHash = updateId.substring(0, 7);
  }

  const isDev = __DEV__;

  // Build display version
  let displayVersion = `v${version}`;
  if (buildNumber !== '1') {
    displayVersion += ` (${buildNumber})`;
  }
  if (commitHash && !isDev) {
    displayVersion += ` • ${commitHash}`;
  }
  if (isDev) {
    displayVersion += ' • dev';
  }

  return {
    version,
    buildNumber,
    updateId,
    commitHash,
    isDev,
    displayVersion,
  };
}

/**
 * Get a simple version string for display
 */
export function getDisplayVersion(): string {
  return getVersionInfo().displayVersion;
}

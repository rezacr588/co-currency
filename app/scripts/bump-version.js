#!/usr/bin/env node
/**
 * Bump version script for CoAI app
 *
 * Usage:
 *   node scripts/bump-version.js patch  # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.js minor  # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.js major  # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.js build  # Just increment build number
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');

function bumpVersion(type = 'patch') {
  // Read app.json
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const currentVersion = appJson.expo.version;

  // Parse version
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case 'build':
      // Just increment Android versionCode, keep version same
      newVersion = currentVersion;
      break;
  }

  // Update version
  appJson.expo.version = newVersion;

  // Increment Android versionCode
  const currentVersionCode = appJson.expo.android?.versionCode || 1;
  if (!appJson.expo.android) appJson.expo.android = {};
  appJson.expo.android.versionCode = currentVersionCode + 1;

  // Increment iOS buildNumber
  const currentBuildNumber = parseInt(appJson.expo.ios?.buildNumber || '1', 10);
  if (!appJson.expo.ios) appJson.expo.ios = {};
  appJson.expo.ios.buildNumber = String(currentBuildNumber + 1);

  // Write back
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

  console.log(`Version bumped: ${currentVersion} -> ${newVersion}`);
  console.log(`Android versionCode: ${currentVersionCode} -> ${currentVersionCode + 1}`);
  console.log(`iOS buildNumber: ${currentBuildNumber} -> ${currentBuildNumber + 1}`);

  return {
    previousVersion: currentVersion,
    newVersion,
    versionCode: currentVersionCode + 1,
    buildNumber: currentBuildNumber + 1,
  };
}

// Run if called directly
if (require.main === module) {
  const type = process.argv[2] || 'patch';
  bumpVersion(type);
}

module.exports = { bumpVersion };

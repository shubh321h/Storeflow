// Expo config plugin: makes `expo prebuild` produce an android/app/build.gradle
// that signs release builds with our permanent keystore instead of a fresh,
// random debug keystore every CI run. This is required for Firebase Phone
// Auth, which checks the app's SHA-1/SHA-256 fingerprint against what's
// registered in the Firebase console — a fingerprint that changes on every
// build would break phone verification unpredictably.
//
// Expects the keystore file to already be sitting at the project root as
// `storeflow-release.keystore` (the CI workflow decodes it there from a
// GitHub secret before prebuild runs), and these env vars to be set:
//   STOREFLOW_RELEASE_STORE_PASSWORD
//   STOREFLOW_RELEASE_KEY_ALIAS
//   STOREFLOW_RELEASE_KEY_PASSWORD

const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'STOREFLOW_RELEASE_SIGNING';

function withReleaseSigning(config) {
  // Copy the keystore from the project root into android/app/ during prebuild.
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(config.modRequest.projectRoot, 'storeflow-release.keystore');
      const destDir = path.join(config.modRequest.platformProjectRoot, 'app');
      const dest = path.join(destDir, 'storeflow-release.keystore');

      if (fs.existsSync(src)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      } else {
        console.warn(
          '[withReleaseSigning] storeflow-release.keystore not found at project root — ' +
          'release build will fall back to the default debug keystore.'
        );
      }

      return config;
    },
  ]);

  // Append a signing override for the release build type. Gradle allows a
  // second `android { ... }` block in the same file — it merges with the
  // first, so this only needs to touch the two properties that matter
  // (signingConfigs.release and buildTypes.release.signingConfig) without
  // having to parse or rewrite Expo's generated block.
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes(MARKER)) {
      return config; // already applied
    }

    config.modResults.contents += `

// ${MARKER} — added by plugins/withReleaseSigning.js
android {
    signingConfigs {
        release {
            if (project.hasProperty('STOREFLOW_RELEASE_STORE_FILE') || System.getenv('STOREFLOW_RELEASE_STORE_PASSWORD')) {
                storeFile file('storeflow-release.keystore')
                storePassword System.getenv('STOREFLOW_RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('STOREFLOW_RELEASE_KEY_ALIAS')
                keyPassword System.getenv('STOREFLOW_RELEASE_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;

    return config;
  });

  return config;
}

module.exports = withReleaseSigning;

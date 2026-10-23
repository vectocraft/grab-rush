// Applies this project's customizations to a freshly generated Capacitor android/ folder
// (after `npx cap add android`). Safe to run more than once.
// Usage: node scripts/setup-android.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const A = p => path.join(root, 'android', p);
const edit = (file, fn) => { const s = fs.readFileSync(A(file), 'utf8'); const out = fn(s); if (out !== s) fs.writeFileSync(A(file), out); };
const once = (s, marker, a, b) => (s.includes(marker) ? s : s.replace(a, b));

// Portrait lock + AdMob app ID (Google TEST id; replace before release).
edit('app/src/main/AndroidManifest.xml', s => {
  s = once(s, 'screenOrientation', 'android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="portrait"');
  s = once(s, 'gms.ads.APPLICATION_ID', '        <provider',
    '        <!-- AdMob app ID: Google TEST app ID. Replace with your own before release. -->\n' +
    '        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n' +
    '            android:value="ca-app-pub-5884386470505700~9317109398" />\n\n        <provider');
  return s;
});

// Android 12+ splash background matches the game.
edit('app/src/main/res/values/styles.xml', s => once(s, 'windowSplashScreenBackground',
  '<item name="android:background">@drawable/splash</item>',
  '<item name="android:background">@drawable/splash</item>\n        <item name="windowSplashScreenBackground">#FFB020</item>'));

// Release signing from keystore/keystore.properties (git-ignored) + version name.
edit('app/build.gradle', s => {
  s = once(s, 'keystorePropsFile', "apply plugin: 'com.android.application'\n",
    "apply plugin: 'com.android.application'\n\n" +
    '// Release signing: credentials live in keystore/keystore.properties (git-ignored).\n' +
    "def keystorePropsFile = rootProject.file('../keystore/keystore.properties')\n" +
    'def keystoreProps = new Properties()\n' +
    'if (keystorePropsFile.exists()) keystorePropsFile.withInputStream { keystoreProps.load(it) }\n');
  s = s.replace(/versionName "1\.0"\n/, 'versionName "1.0.0"\n');
  s = once(s, 'signingConfigs', '    buildTypes {\n        release {\n',
    '    signingConfigs {\n        release {\n            if (keystorePropsFile.exists()) {\n' +
    "                storeFile file(keystoreProps['storeFile'])\n                storePassword keystoreProps['storePassword']\n" +
    "                keyAlias keystoreProps['keyAlias']\n                keyPassword keystoreProps['keyPassword']\n" +
    '            }\n        }\n    }\n    buildTypes {\n        release {\n' +
    '            if (keystorePropsFile.exists()) signingConfig signingConfigs.release\n');
  return s;
});

// Local SDK path (machine specific, git-ignored).
const sdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk').replace(/\\/g, '/');
if (!fs.existsSync(A('local.properties')) && fs.existsSync(sdk)) fs.writeFileSync(A('local.properties'), 'sdk.dir=' + sdk + '\n');

console.log('android/ özelleştirmeleri uygulandı');

# Release build for Grab Rush (com.ugenis.kapiskapis): Play AAB with REAL ads, versionCode +1.
# Usage (this folder): yayin-derle.cmd          -> bump versionCode in android/app/build.gradle, build, check, copy out
#                      yayin-derle.cmd -NoBump  -> keep the current versionCode
# versionName is not touched: raise it by hand when the release needs a new name (CLAUDE.md).
# Shared logic: 00_CLAUDE-MERKEZ\tools\yayin-ortak.ps1
param([switch]$NoBump)
. 'C:\Users\ugur\Desktop\claude\00_CLAUDE-MERKEZ\tools\yayin-ortak.ps1'

$pkg = 'com.ugenis.kapiskapis'
Initialize-YayinOrtam
Assert-YayinPackage "$PSScriptRoot\android\app" $pkg
$test = (Get-YayinReklamModu $PSScriptRoot) -eq 'test'
$v = Step-YayinVersion "$PSScriptRoot\android\app\build.gradle" 'gradle' -NoBump:$NoBump

$aab = "$PSScriptRoot\android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aab) { Remove-Item $aab -Force }   # never check a stale bundle
Write-YayinAdim 'www + cap sync + AdMob yamasi + AAB'
Push-Location $PSScriptRoot
try {
  # 'npm run aab' = 'npm run sync' (build-www, cap sync, patch-admob) + gradlew bundleRelease;
  # split here so closed-test builds can swap in Google's test units in between
  Invoke-YayinKomut 'npm run sync' { npm run sync }
  if ($test) {
    Set-YayinWebTestAds "$PSScriptRoot\android\app\src\main\assets\public\ortak\ads.js" @{
      'ca-app-pub-5884386470505700/6248837787' = 'ca-app-pub-3940256099942544/6300978111'
      'ca-app-pub-5884386470505700/2309592777' = 'ca-app-pub-3940256099942544/1033173712'
      'ca-app-pub-5884386470505700/7230746962' = 'ca-app-pub-3940256099942544/5224354917'
    }
  }
  Push-Location android
  try { Invoke-YayinKomut 'gradlew bundleRelease' { .\gradlew.bat bundleRelease } } finally { Pop-Location }
} finally { Pop-Location }

# ortak/ads.js always uses the real units; Google's test publisher id appears only
# in a comment there, so whole-line comments are ignored and any other test id fails.
if ($test) {
  Assert-AabTestAds -Aab $aab -EntryPattern '^base/assets/public/.+\.js$' -IgnoreCommentLines
} else {
  Assert-AabRealAds -Aab $aab -EntryPattern '^base/assets/public/.+\.js$' -IgnoreCommentLines
}
Publish-YayinAab $aab $pkg 'Grab Rush' $v

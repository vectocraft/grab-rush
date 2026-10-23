// Fixes a conflict between @capacitor-community/admob (banner) and Capacitor 8's SystemBars on Android 15+.
// The plugin put its own window-insets listener on the decor view, which replaced Capacitor's listener,
// and then added the navigation-bar inset on top of Capacitor's padding (banner floated one bar too high).
// Patched behaviour: the listener goes on the banner container itself, so it receives the insets *after*
// Capacitor adjusted them: edge-to-edge WebView -> real nav-bar inset, padded WebView -> 0. Works in both modes.
// Runs automatically from `npm run sync`; safe to run repeatedly.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java');
let src = fs.readFileSync(file, 'utf8');
const MARK = '// kapiskapis-patch v2: insets';

// hideBanner crash: the hide task runs later on the UI thread; if the banner failed to load (or was removed)
// in between, mAdView is null and AdView.pause() throws an uncaught NullPointerException -> app closes.
function patchHide() {
  const HMARK = '// kapiskapis-patch: safe hide';
  if (src.includes(HMARK)) return;
  const old = `                    if (mAdViewLayout != null) {
                        mAdViewLayout.setVisibility(View.GONE);
                        mAdView.pause();`;
  if (!src.includes(old)) { console.error('admob patch: hideBanner kodu bulunamadı (eklenti sürümü değişmiş olabilir)'); process.exit(1); }
  src = src.replace(old, `                    ${HMARK}
                    if (mAdViewLayout == null || mAdView == null) { call.resolve(); return; }
                    {
                        mAdViewLayout.setVisibility(View.GONE);
                        mAdView.pause();`);
  console.log('admob patch: hideBanner güvenli');
}
patchHide();
if (src.includes(MARK)) { fs.writeFileSync(file, src); console.log('admob patch: zaten uygulanmış'); process.exit(0); }

let start = src.indexOf('            // set Safe Area only for Android 15+');
if (start < 0) start = src.indexOf('            // kapiskapis-patch'); // older version of this patch
const end = src.indexOf('            createNewAdView(adOptions);');
if (start < 0 || end < 0) { console.error('admob patch: beklenen kod bulunamadı (eklenti sürümü değişmiş olabilir)'); process.exit(1); }

const replacement = `            ${MARK}
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                mAdViewLayout.setOnApplyWindowInsetsListener((v, insets) -> {
                    android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                    if ("TOP_CENTER".equals(adOptions.position)) {
                        mAdViewLayoutParams.setMargins(margins[0], margins[1] + bars.top, margins[2], margins[3]);
                    } else {
                        mAdViewLayoutParams.setMargins(margins[0], margins[1], margins[2], margins[3] + bars.bottom);
                    }
                    v.setLayoutParams(mAdViewLayoutParams);
                    return insets;
                });
                mAdViewLayout.post(mAdViewLayout::requestApplyInsets);
            }

`;
src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, src);
console.log('admob patch: uygulandı');

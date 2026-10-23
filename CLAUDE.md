# Grab Rush (oyunlar/) — rehber

6 HTML5 oyunu tek Android uygulamasında (Capacitor). Paket `com.ugenis.kapiskapis`. Ayrıntı: README.md (kısmen eski: "5 oyun / Kapış Kapış").
Kota tasarrufu: bu dosyayı ve aşağıdaki hazır parçaları kullan, sıfırdan yazma. Metin/çeviri taslağı → yerel Ollama `qwen3:14b`.

## Hazır parçalar (yeniden kullan)
| Dosya | Ne verir |
|---|---|
| `ortak/economy.js` | `Save` (localStorage kayıt), ortak altın/yıldız cüzdanı, günlük ödül, `L(en, tr)` dil fonksiyonu, `LANG` |
| `ortak/kit.js` | Menü/sonuç ekranı HTML'i: `Kit.tabs`, `Kit.win`, geliştirme kartları, skin ızgarası, `Kit.fmt` (B/Mn/Mr) — butonlar `data-act`/`data-arg` |
| `ortak/ui.css` | Ortak görünüm: HUD (`.hud-row`, `.lvl-chip`, `.coin-pill`), şeker butonlar, sekmeler, paneller |
| `ortak/ads.js` | AdMob (banner/geçiş/ödüllü), tarayıcıda simülasyon, GDPR |
| `ortak/iap.js` | Google Play Billing (cordova-plugin-purchase); ürün ödülleri `GRANT` içinde |
| `ortak/cloud.js` | Play Games bulut kaydı (native `CloudSavePlugin.java`) |
| `ortak/sound.js` | WebAudio efekt + üretken müzik (dosyasız) |
| `ortak/fx.js` | `Fx.reveal` sandık açma, `Fx.burst` parıltı |
| `ortak/art.js` | SVG mağaza görselleri (sandık, yıldız, taç) |
| `ortak/themes.js` | 10 seviyede bir değişen temalar |
| `ortak/lib/three.min.js` | Three.js (3D oyunlar `render3d.js` içinde kullanıyor) |
| `scripts/kaykit-*.js`, `kenney-convert.js`, `arrow-bake.js` | CC0 3D model paketlerini (KayKit/Kenney) oyuna gömülü JS'e dönüştürür |
| `scripts/make-icons.js`, `icon-art.js` | İkon/splash/mağaza görseli üretimi |
| `scripts/shot.sh` | Headless Chrome ekran görüntüsü |
| `tests/sim.js` | Denge/ekonomi simülasyonu |
| `tests/arrow-balance.mjs` + `arrow-bot.js` | Arrow zorluk testi: "normal oyuncu" botu bölüm oynar, ölüm odası/sebebi (headless Chrome :9400) |
| `scripts/make-skin-art.js` (+ `skin-art.html`, `suru-skin-art.html`) | Kıyafet/skin portreleri → `ortak/img/skins/*.webp` (24 karelik dönen şerit) |

En yeni ve en eksiksiz örnek oyun: `arrow-legends/` (3D, karakter bake, sandık, IAP, reklam). Yeni oyunu ondan kopyalayarak başlat.

## Yeni oyun ekleme adımları
1. `yeni-oyun/index.html`: `../ortak/ui.css` + script sırası: economy → cloud → iap → sound → ads → kit → fx → art → (three) → oyun dosyaları.
2. Hub kaydı: kök `index.html` içindeki `GAMES` dizisine kart (`id, href, img, acc, name, genre`); altın kazandırıyorsa `GOLD_GAMES` ve `ortak/economy.js` `PLV_GAMES`.
3. `scripts/build-www.js` → `INCLUDE` listesine klasörü ekle.
4. Kart görseli `ortak/img/<id>.webp` (`scripts/icon-art.js` + `make-icons.js`).
5. Tüm metinler `L('English', 'Türkçe')` ile; varsayılan dil cihaz dili.

## Derleme / yayın
- `npm run sync` (www + cap sync + AdMob yaması), `npm run aab` → `android/app/build/outputs/bundle/release/`.
- Her sürümde `android/app/build.gradle` versionCode/versionName artır. AAB'de `webContentsDebuggingEnabled=false`.
- İmza: `keystore/` (yedekli tut). Play App Signing açık → telefondaki Play sürümünün üstüne yerel APK kurulmaz.
- Test: `python -m http.server 5077` + Chrome; dil için `Save.setLang('tr')`.

## Hesaplar ve tuzaklar
- Play Console: ugenis94 → "VectoCraft" (vectocraft.tr@gmail.com yönetici). AdMob: teamtask.destek hesabı (vectocraft.tr yönetici). Mağaza iletişim e-postası: vectocraft.tr@gmail.com (16 Eki 2026). Cloudflare Pages `grabrush` (gizlilik + app-ads.txt).
- Play Games + bulut kaydı: Google Cloud projesi `grab-rush`. OAuth izin ekranı **In production** olmalı; "Testing" kalırsa test listesinde olmayanlar `403 access_denied` alır. Logo yükleme → Google doğrulaması ister.
- Play Console fiyat girişi ondalık virgül (0,99).
- Yeni oyunda PGS/AdMob/IAP kimliklerini yeniden oluşturma; mevcut uygulama içinde oyun ekleniyorsa aynılarını kullan.

## İskelet: `sablon/`
Yeni oyun = `sablon/` klasörünü kopyala (`ID` sabitini değiştir) → yukarıdaki adımlar → sadece `newLevel()/update()` ve `render3d.js` sahnesini yaz.
Hazır gelen: kayıt + oyun altını, seviye yolu, Geliştir/Renk/Mağaza/Nasıl sekmeleri, kazan (3x reklam) / kaybet (atla reklamı), duraklat + Android geri tuşu,
seviye sonu geçiş reklamı (`Ads.levelEnd`), toon + dış çizgi + gölge + dokulu zemin 3D sahne, WebGL yoksa başsız çalışma, `window.__sablon` test kancası.
`sablon/` www'ye kopyalanmaz (build-www INCLUDE'da yok).
Test: `node tests/sim.js smoke` (6 sayfa), `node tests/sim.js 40` (40 gün ekonomi/reklam), `node tests/sim.js balance <hucre|suru|cag|delik> 1,5,10 3 5`.

## İkonlar
Emoji yerine premium ikon: `ortak/gicons.js` sayfadaki emojileri otomatik SVG'ye çevirir (`GI.svg('⭐')`, `no-gi` sınıfı hariç tutar).
Yeni emoji eklemek: `scripts/gicons-map.json` → `node scripts/make-gicons.js <@iconify-json/game-icons/icons.json>` (paket `npm pack @iconify-json/game-icons` ile alınır).
Lisans CC BY 3.0 → künye `gizlilik.html` sonunda. Kesilen tek satır yazılar `ortak/kit.js` sonundaki shrink-to-fit ile otomatik küçülür.

## 3D karakterler (Arrow Legends)
`node scripts/arrow-bake.js` → `arrow-legends/chars.js` (+ `chars-2..6.js`). Kaynak: KayKit (scripts/kaykit-*) ve Quaternius RPG/Ultimate Monsters (scripts/quaternius, CC0).
Yeni model: glTF'yi scripts/quaternius'a koy, `CHARS`/`MON` listesine ekle (yükseklik + saldırı animasyonu), gerekirse `CHUNK`'a bölüm ver. Oyunda `FOES` (ai rolü) ve `ROSTER`.

<!-- KAPALI-TEST-KURALLARI:BASLA -->
## Play kapalı test → üretim kuralları

> Bu bölüm `00_CLAUDE-MERKEZ\KAPALI-TEST-KURALLARI.md` dosyasından otomatik eklenir. Burayı elle değiştirme; ana dosyayı düzeltip `00_CLAUDE-MERKEZ\tools\kurallari-dagit.cmd` komutunu çalıştır.

Bu uygulama Google Play'de kapalı testte. Üretim başvuruları "uygulamanızın daha fazla test edilmesi gerekiyor" diye reddediliyor (TeamTask 18 Eki 2026, Eti Haber 11 Eki 2026). Google'ın beklediği şunlar:
- En az 12 test kullanıcısı 14 gün boyunca uygulamayı **yüklü tutmalı ve düzenli açmalı**.
- Test kullanıcıları geri bildirim vermeli.
- Geliştirici bu geri bildirimlere göre güncelleme yayınlamalı.

Kayıt dosyası: bu `CLAUDE.md` ile aynı klasördeki `TEST-GERIBILDIRIM.md`.

### Oturum başında (her seferinde, kullanıcı başka bir şey istese de)
1. `TEST-GERIBILDIRIM.md` dosyasını oku.
2. Kullanıcıya en fazla 3 satırlık bir durum özeti ver:
   - Son sürüm adı ve numarası (`pubspec.yaml` / `app.json` / `android/app/build.gradle` dosyasından).
   - Kayıttaki son yayın tarihi ve bu tarihten beri geçen gün sayısı.
   - Açık (henüz düzeltilmemiş) geri bildirim sayısı.
3. Son yayından bu yana 7 günden fazla geçtiyse ya da açık geri bildirim varsa bunu tek cümleyle hatırlat. Sonra kullanıcının istediği işe geç.

### Reklam modu: kapalı testte test reklamı, üretimde gerçek reklam
22 Ekim 2026'da AdMob hesabı (pub-5884386470505700), test kullanıcıları gerçek reklamlara tıkladığı için 29 gün askıya alındı. Bu tek seferlik bir cezaydı; ikinci ihlalde hesap kalıcı kapanır.
- Bu klasördeki `REKLAM-MODU.txt` dosyasının ilk satırı `test` ya da `gercek` olur. `yayin-derle.cmd` bu satıra göre derler.
  - `test` (varsayılan): Google test reklamları kullanılır. Paket adının sonuna `-TEST-REKLAM` eklenir.
  - `gercek`: gerçek reklamlar kullanılır.
- Kullanıcı bu uygulama için "üretime geçtik" ya da "onay geldi" demedikçe mod **`test` kalır**. Bu klasörde güncelleme yapılırsa çıkan paket test reklamlıdır.
- Kullanıcı üretim onayının geldiğini söylediğinde:
  1. İlk satırı `gercek` yap.
  2. `yayin-derle.cmd` ile gerçek reklamlı paketi çıkar.
  3. `TEST-GERIBILDIRIM.md` dosyasına not düş.
- Test reklamlı bir paket üretime yükseltilmez. Üretim için `gercek` modda yeniden derlenir.
- Telefonda deneme için ayrı derleme yapılacaksa da gerçek reklam kimliğiyle derleme.
- Klasörde `REKLAM-MODU.txt` yoksa bu bölüm geçerli değildir. Örneğin Eti Haber başka bir yayıncı hesabını kullanıyor ve `yayin-derle.cmd` dışında derleniyor.

### Yayın paketi
- Paket yalnızca `yayin-derle.cmd` ile çıkar. Bu komut sürüm adını (1.0.0 → 1.0.1) ve derleme numarasını kendisi artırır. Sürümü elle değiştirme.
- Büyük bir değişiklikte yeni sürüm satırına geçmek için (ör. 1.1.0) sürüm adına yalnızca `1.1` yaz. Komut bunu `1.1.0` yapar.
- `yayin-derle.cmd` başarıyla bittikten sonra şunları yap:
  1. `TEST-GERIBILDIRIM.md` içindeki **Sürümler** tablosuna bir satır ekle: sürüm adı (numara), tarih, ne değişti, hangi geri bildirime karşılık geldiği (G-numarası).
  2. Play Console'a yapıştırılacak sürüm notlarını hazırla ve kullanıcıya kod bloğu içinde ver:
     ```
     <tr-TR>
     ...
     </tr-TR>
     <en-US>
     ...
     </en-US>
     ```
     Her dil en fazla 500 karakter olsun. Yalnızca o sürümde gerçekten yapılan değişiklikleri yaz. Bir değişiklik bir geri bildirimden geliyorsa bunu belirt (ör. "Test kullanıcılarının isteğiyle …"). "Hata düzeltmeleri ve iyileştirmeler" gibi genel ifadeleri tek başına kullanma.
  3. Aynı notu dosyadaki sürüm satırının altına da kaydet.

### Kullanıcı geri bildirim getirdiğinde
- **Geri bildirimler** tablosuna ekle: G-numarası, tarih, kaynak (WhatsApp, e-posta, Play test geri bildirimi, yüz yüze, iç test), kısa içerik, durum (açık / X.Y.Z sürümünde düzeltildi / yapılmayacak + neden).
- Düzeltme yapıldığında durumu güncelle.
- Kullanıcının sohbette getirdiği her sorun ya da istek test kullanıcılarından WhatsApp ile gelmiştir. Kaynağı **WhatsApp** yaz, kaynağı sorma (kullanıcı başka bir kaynak söylerse onu yaz).
- **Geri bildirim uydurma.** Kullanıcı söylemeden kendi bulduğun hataları "iç test" kaynağıyla yaz.

### Üretim başvurusu
- Başvuruyu kullanıcı istediğinde sen hazırlarsın (formu Play Console'da doldurmak dahil). Son "Gönder" adımından önce cevapların tamamını kullanıcıya gösterip açık onay al.
- Cevaplar `TEST-GERIBILDIRIM.md`'deki somut bilgilere dayansın: kaç test kullanıcısı, kaç gün, hangi geri bildirimler, hangi sürümde ne değişti. Genel ve kısa cevap yazma.
- Cevaplarda şunu açıkça anlat: test kullanıcılarından sorunları ve önerileri **WhatsApp üzerinden** topladık ve yayınladığımız sürüm güncellemelerini bu geri bildirimlere göre yaptık.
- **Tarih aralığı:** Daha önce başvuru yapıldıysa son başvuru tarihinden, yapılmadıysa kapalı teste ilk gönderim tarihinden (Sürümler tablosundaki ilk satır) bugüne kadar yapılan **her şeyi** yaz: her sürümün adı/numarası ve tarihi, o sürümde ne değiştiği ve hangi geri bildirime karşılık geldiği. Hiçbir sürümü ya da değişikliği atlama.
- Kayıtta "iç test" kaynaklı maddeler varsa bunları kullanıcılardan gelmiş gibi yazma; "test sürecinde tespit edilen" diye ayrıca belirt.
- Başvuru reddedilirse ret tarihini ve "en erken yeniden başvuru" tarihini (ret + 14 gün) dosyanın **Başvurular** bölümüne yaz.

### Test kullanıcılarına mesaj
Kullanıcı isterse uygulamanın katılım linkiyle birlikte kısa bir Türkçe mesaj hazırla. Mesaj şunları anlatsın:
1. Telefondaki Play Store hesabı, test listesine eklenen e-postayla **aynı** olmalı (Play Store → sağ üstteki profil fotoğrafı).
2. Katılım linkini o hesapla açıp "Test kullanıcısı ol"a basmalı, uygulamayı **Play Store'dan** yüklemeli (APK dosyasıyla değil).
3. Uygulamayı 14 gün silmemeli ve 2–3 günde bir açıp birkaç dakika kullanmalı.
4. Play Store'daki uygulama sayfasında "Geliştiriciye özel geri bildirim" kutusuna kısa bir yorum yazmalı, ya da doğrudan size iletmeli.

Mesajı **sen gönderme**, kullanıcıya metin olarak ver.

### Onay gerektiren işler
Play Console'da kaydetme, yayınlama, üretime başvurma ya da birine mesaj gönderme gibi işleri kullanıcıdan açık onay almadan yapma.
<!-- KAPALI-TEST-KURALLARI:BITIR -->

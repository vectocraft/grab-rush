# Kapış Kapış — 5 oyun bir arada

Beş hyper-casual oyun + ortak ekonomi/reklam/ses katmanı. Saf HTML5 Canvas + JavaScript, harici asset yok.
Tarayıcıda direkt açılır; Capacitor ile Android uygulaması olarak derlenir (proje hazır: `android/`).

```
oyunlar/
├── index.html            # Oyun merkezi: cüzdan, günlük ödül, reklamsız paket
├── ortak/
│   ├── economy.js        # Kayıt (localStorage), ortak altın cüzdanı, günlük ödül serisi
│   ├── ads.js            # Reklam katmanı: tarayıcıda simülasyon, uygulamada gerçek AdMob (+GDPR onayı)
│   ├── sound.js          # WebAudio ile sentezlenen efektler + üretken arka plan müziği
│   ├── iap.js            # Uygulama içi satın alma (Google Play Billing; ürün listesi aşağıda)
│   ├── themes.js         # Her 10 seviyede değişen görsel temalar
│   └── ui.css
├── koloni-kapismasi/     # Koloni Kapışması (State.io tarzı)
├── suru-seli/            # Sürü Seli (Mob Control tarzı)
├── gizlilik.html         # Gizlilik politikası (uygulama içinden de açılır)
├── scripts/build-www.js  # Oyun dosyalarını www/ klasörüne kopyalar (Capacitor webDir)
├── scripts/setup-android.js # android/ yeniden üretilirse manifest/imza/splash ayarlarını uygular
├── scripts/make-icons.js # İkon, açılış ekranı ve mağaza görsellerini üretir
├── tests/sim.js          # Uzun dönem oyuncu simülasyonu + denge ölçümü
├── store/                # Play Store görselleri + Play Console doldurma rehberi
├── keystore/             # İmzalama anahtarı (git'e koyma, YEDEKLE!)
├── capacitor.config.json
└── android/              # Capacitor Android projesi
```

**Çalıştırma:** `index.html` dosyasını tarayıcıda aç (telefon görünümü için DevTools → cihaz modu).
Telefondan denemek için: `npx serve .` → aynı Wi-Fi'deki telefondan `http://<pc-ip>:3000`.

---

## 0. Rakip analizi ve tasarım kararları

State.io, Mob Control ve Count Masters'ın mağaza yorumları incelendi
([State.io yorumları](https://justuseapp.com/en/app/1559032748/state-io-conquer-the-world/reviews),
[Mob Control olumsuz yorumlar](https://appsupports.co/1562817072/mob-control/negative-reviews),
[Mob Control yorumları](https://justuseapp.com/en/app/1562817072/mob-control/reviews),
[Count Masters yorumları](https://justuseapp.com/en/app/1568245971/count-masters-crowd-runner-3d/reviews)).

| Rakiplerde en çok şikâyet edilen | Kapış Kapış'taki çözüm |
|---|---|
| Her seviyeden sonra zorunlu reklam, çalışmayan "Hayır teşekkürler" | Geçiş reklamı sadece kazanınca, 3 galibiyette bir, 5. seviyeden sonra, 90 sn arayla; kaybedince asla. "Devam" düğmesi hep hazır. |
| Rakipler hep oyuncuya karşı birleşiyor | Yapay zekâ oyuncuyu özel hedef almaz, rakipler birbirine de saldırır. |
| "Ya çok kolay ya imkânsız", 100+ seviyede duvar | Dinamik zorluk: aynı seviyede her kayıpta rakip %10 zayıflar (maks. %30), oyuncuya söylenir. Uzun simülasyonla duvar kalmadığı doğrulandı. |
| Geliştirmeler söylediğini yapmıyor | Geliştirme kartları gerçek değeri gösterir (ör. `1.3/sn → 1.4/sn`). |
| Haritalar/şehirler hep aynı | 6 tema (her 10 seviyede) + 4 harita düzeni (serbest, halka, koridor, adalar). |
| Rastgele kartlar (Mob Control) | Başlangıç kartını oyuncu seçer. |
| Telefon ısınıyor, pil bitiyor, çok birlikte kasıyor | 60 FPS sınırı, birlik sayısı sınırı (200), p99.9 kare süresi < 1 ms (masaüstü ölçüm). |
| Seri/rütbe düşürme cezaları | Günlük seri bir gün kaçırınca sıfırlanmaz, sadece 2 gün geri gider. |
| Seviye bitmiyor/takılıyor | 4 aylık simülasyonlarda tek bir takılan seviye yok. |

## Arayüz

- Ortak arayüz kiti: `ortak/ui.css` (şeker düğmeler, konturlu başlıklar, alt sayfa menüler) + `ortak/kit.js`
  (seviye yolu, sekmeler, geliştirme kartları, skin ızgarası, yıldızlı sonuç ekranları).
- Yazı tipi: Baloo 2 (`ortak/fonts`, SIL OFL lisansı), uygulamaya gömülü, internetsiz çalışır.
- Görseller: `ortak/img/` (logo + oyun kartları), hepsi `node scripts/make-icons.js` ile `scripts/icon-art.js`'deki SVG'den üretilir.
- Önizleme: `scripts/shot.sh "koloni-kapismasi/index.html#demo" out.png` (headless Chrome ile ekran görüntüsü;
  `#play` seviyeyi başlatır, `#demo` kısa bir savaşı ileri sarar).

## 3. oyun: Altın Ocağı (idle maden) — `altin-ocagi/`
Katlar cevher kazar → asansör kasaya taşır (nakit). Yönetici alınan kat/asansör kendi çalışır ve uygulama kapalıyken
de kazanır (en fazla 3 saat, dönüşte "2x al" ödüllü reklamı). Her 25 seviyede kat üretimi 2x. Yeni kat açmak ve
25'lik eşikler ortak kasaya altın verir. Geçiş reklamı yok; ödüllü reklam: 30 dk 2x üretim, çevrimdışı 2x.
Tempo (model): 2. kat ~3 dk, 5. kat ~11 dk, 10. kat ~47 dk, 15. kat ~2.5 saat aktif oyunda.
**Köy (Travian tarzı, `empire.js` + `village3d.js`):** 16 arsalı köy; binalar seviyeyle büyür, üstlerinde küçük seviye rozeti.
Köydeki ordu Toplanma Alanı'nın avlusunda asker dizisi olarak görünür. Toplanma Alanı paneli: gelen / giden / köydeki
birlikler (Travian'daki gibi birlik tabloları + geri sayım). Üst barda 📜 Raporlar (okunmamış rozeti) ve barbar akını
gelirken kırmızı ⚔️ uyarı; raporlarda saldıran/savunan birlik-kayıp tabloları ve ganimet. Maden dışındaki sekmelerde
maden çizilmez (pil + HUD altından maden görünmesin). Köy 30 fps çizilir, ağaçlar instanced, gölge 1024; KayKit
dokusu ve modelleri sayfa açılınca önceden çözülür (köy açılışında siyah bina yok).
**Maden → köy ekonomisi:** binalar maden nakdiyle kurulur; askerler demir + maden nakdi ister (birim başına, madenin o
askerin eğitim süresi boyunca kazandığının %30'u). Askeri/yönetim binaları en fazla maden kat sayısı × 2 seviyeye,
üretim binaları en iyi maden katının seviyesine çıkabilir: köyü büyütmek için önce maden büyür. Sur sabit olarak köy
kapısındaki parselde (seviye kademeleri: çit → ahşap kazık → taş → mazgallı → kapı kulesi/parmaklık → kale).
Eğitim panelinde MAKS'ın asker sayısı ve toplam süresi yazar; ödüllü reklam kalan eğitimin %25'ini (en az 15 dk) keser.
**Kasalar (Travian gibi):** her köyün kendi kasası var; açık olmayan köylerin madenleri kendi kasalarına kesintisiz kazanır.
Maden Pazarı'ndan kervan: her kervan hedef köyün (5 + Pazar Sv./2) dakikalık gelirini taşır, 1 + Sv./25 kervan (maks 5), yol
mesafeye göre (kare başına 2 dk), kervan dönene kadar meşgul. Üstteki köy düğmesi (▾) köy listesini açar (kasa, gelir, geçiş).
**Harita:** 41×41 kare, sürüklenerek gezilir, açık köyü ortalar, 5 karede bir koordinat; eski 15×15 dünyalar kenarlardan
genişletilir. Her köyün 3 kare çevresinde en az 2 vaha (biri madene etki eden) ve 2 barbar köyü garanti. Vahalar: 🌴 köy
geliri, ⛰️ demir, 🌬️ asansör/taşıma hızı, 💎 Cevher (katların üretimi +%25), ⛏️ Derin Damar (kat açma/yükseltme %20 ucuz).
**Fetih:** sadakati yalnız "Fethet" ile giden senatör düşürür; normal saldırıdaki senatör sadece savaşır.
**Sen yokken:** ordu/kervan hareketleri gerçek varış zamanlarıyla sırayla işlenir (varış → yağma → dönüş → kasa), raporlar doğru zamanlı.
**Bölge teması:** KayKit atlasındaki mavi takım rengi bölgeye göre boyanır (Çöl sarı, Buzul yeşil, Volkan kırmızı, Ay mor).
**Bina modelleri:** KayKit Medieval Hexagon Pack (CC0, Kay Lousberg — www.kaylousberg.com), kaynak dosyalar `scripts/kaykit/`.
`node scripts/kaykit-convert.js` modelleri sıkıştırıp `altin-ocagi/kaykit.js` içine gömer (yükleyici yok, internetsiz).
**Köy skinleri (⭐):** Köy Temaları (çatı/sancak rengi: Bahar, Altın Saray, Kızıl, Gece Kalesi, Zümrüt-reklam) ve Sur
Skinleri (Buz, Lav, Altın, Obsidyen-reklam), Mağaza sekmesinde.
Asker fiyatı yanında "≈ N sn maden geliri", yağma ekranında taşıma kapasitesi ve maliyetin kaç katı ganimet getirebileceği yazar.

## 4. oyun: Çağlar Savaşı (Age of War tarzı) — `caglar-savasi/`
Dikey tek şerit: üssün altta, rakip üstte. 5 çağ (Taş → Orta Çağ → Barut → Modern → Gelecek) × 3 birlik, kule,
çağa özel süper saldırı. Öldürme = altın + XP, XP dolunca çağ atla. 200 sn sonra "ani ölüm" (kuleler susar, üsler
erir) → her maç biter. Kalıcı geliştirmeler (ortak kasa altını): Hazine, Kale Duvarı, Talim. Dinamik zorluk.
**Savaş düzeni:** bir savaş Taş Devri'nden Gelecek'e sürer; her çağ atlayış = seviye (ödül anında, savaş sürer) ve kayıt
noktası (kaybedince o çağdan devam). Düşman üssünü yıkmak savaşı kazandırır (3x ödül, sonraki savaş daha güçlü rakip).
Rakip, sen çağ atlayınca ~25 sn içinde o da atlar; üs canı 2500·2^çağ; 15 dk güvenlik sınırı (ani ölüm).
Zorluk kazanılan savaş sayısına bağlı. Denge (bot, geliştirme 3): 1. savaş ~4 dk, 2-3. savaş 8-12 dk, 5. savaş ~%33.
Üsler: KayKit Medieval/City Builder/Space Base (CC0) — `caglar-savasi/kaykit-cag.js`; ortaçağ modelleri takım rengine boyanır.
Askerler: KayKit Adventurers karakterleri (CC0), `node scripts/kaykit-units.js` iskelet animasyonundan 3 yürüme + 1 saldırı
karesini sabit modele pişirir (`caglar-savasi/kaykit-units.js`); oyunda kareler sırayla gösterilir, ayak altında takım halkası.
7 çağ (Taş, Antik, Orta, Barut, Dünya Savaşı, Modern, Gelecek); her birimin silahı ve saldırısı tabloda (`UNITS`, `DEF` — game.js).
KayKit karakterleri yalnız silahı uyan çağlarda; barut/savaş/modern askerleri ve tanklar kodla çizilir, Gelecek'te Quaternius mech'leri.
Kuleler ve mermiler: Kenney Tower Defense Kit (CC0, www.kenney.nl); mech'ler: Quaternius Animated Mech Pack (CC0, quaternius.com).
Paketler `scripts/ext/` içine indirilir, `node scripts/cag-ext-convert.js` → `caglar-savasi/cag-ext.js`. Panel ikonları gerçek modellerden
çizilen küçük resimler (`War3D.thumb`). Rakip: üssü %50 sağlam, iki kuleyle başlar; 12 dk güvenlik sınırı.
Kuşatma: 25 sn sahada askerin yoksa rakip altın biriktirip 5-9'luk ağır dalgalar gönderir, geliri 1.6x, özel saldırısı 2x hızlı
ve üssünü de vurur (ekranda uyarı). Kule öldürmeleri %55 altın / %80 XP verir. Test: `TURTLE=1 node tests/sim.js balance cag 1 3 2`.
3D: `render3d.js` (Three.js) — şerit kameradan uzağa akar, her çağın kendi üssü, birlikleri, taretleri, mermileri ve
çevresi var; can çubukları/uçan altın yazıları 2D canvas üst katmanında. WebGL yoksa 2D çizim kullanılır.

## 5. oyun: Obur Delik (Hole.io tarzı) — `obur-delik/`
Şehirde bir deliği yüzen joystick ile sürüklersin; delikten küçük olan her şey (koni → insan → araba → ev → bina →
gökdelen) içine düşer, delik büyür. 90 sn (+Süre geliştirmesi) sonunda en çok puanı olan kazanır. Senden %20 küçük
deliği yutabilirsin, büyükler de seni yutar (2.6 sn sonra yarı boyda yeniden doğarsın, 4 sn korunursun, puanın %10'u gider).
Harita 8-10 blok, 3-5 rakip; delik yutmanın ödülü düşük tutuldu ki ilk büyüyen herkesi silip süpürmesin.
Güçler: 🧲 mıknatıs, ⚡ hız, ❄️ rakipleri dondur. Her 10 seviyede tema (Şehir, Sahil, Kış, Çöl, Gece) ve 👑 Kara Delik boss'u.
Geliştirmeler: Başlangıç Boyu, Hız, Süre. Ödüllü reklam: büyük başla, 3x ödül, +15 sn devam.
Şehir seed'li üretilir; 3D'de her eşya tipi instanced çizilir (düşük draw call), yalnız hareket eden/düşenler her kare güncellenir.
Denge (bot): Sv.1-6 %75-100, Sv.8-20 %25-100 (geliştirmeli), maç başına 0-2 delik yutuluyor; `node tests/sim.js balance delik 1,5,10 4 3`.

## 1. Koloni Kapışması (State.io benzeri) — 3D
Three.js (`ortak/lib/three.min.js`, MIT) ile gerçek 3D: eğik kamera, gölgeler, fethedilen bölgeler havaya kalkar,
3D kuleler, birlikler tek çizim çağrısıyla (instancing). WebGL yoksa otomatik 2D çizim kullanılır.

Kıta haritası: her seviyede farklı şekilli bir kıta, her kulenin bir bölgesi var (Voronoi). Kuleyi alınca bölge rengine boyanır;
üstte canlı bölge payı çubuğu. **Kontroller:** kulenden sürükle (yoldaki kendi kulelerin de katılır) · kuleye dokun + hedefe dokun ·
**kendi kulene dokunarak takviye** · bölgenin herhangi bir yerine dokunmak yeter.

**Temel mekanik:** Hücreler zamanla birlik üretir. Kendi hücrenden rakip/nötr hücreye sürükle → birlikler akar.
Hedefteki birlik sayısını aşarsan hücre senin olur. Yoldaki zıt renkli birlikler çarpışıp birbirini yok eder.

**Asker biriktirme:** Üretim kapasitede (normal 50, fabrika 60, kale 80) durur; takviyeyle kapasitenin üstüne çıkan asker erimez.

**Yapay zekâ:** saldırı altındaki bölgesini savunur, 2-3 bölgeden ortak saldırır, gerektiği kadar asker gönderip komşu
düşman gücüne göre garnizon bırakır; 5. seviyeden 2 bölgeyle başlar (ikinci bölge daima oyuncudan en uzak komşu).
Üretim çarpanı 19. seviyede 1.4'te sabitlenir, başlangıç askeri ~25'te durur: geç seviyeler asker seliyle değil akıllı oyunla zorlaşır. Nötr hedeflere az, sahipli
hedeflere yüksek güvenlik payıyla saldırır. Karar aralığı insan temposunda (1. seviyede ~3 sn, en kısa 2 sn, tek hamle), ilk hamle 3. saniyede;
zorluk hızdan değil hamle kalitesinden gelir. Denge: `node tests/sim.js balance hucre 3,8,15,25 4 4` (`NOABIL=1` botun yeteneklerini kapatır, `TRACE=1` maçı izler).

**Özgün katkılar:**
- **Özel hücreler:** ⚙️ *Fabrika* 2 kat üretir, 🛡️ *Kale* gelen saldırıya 2 kat dayanır → haritada stratejik hedefler oluşur.
- **Enerji ve yetenekler:** Hücre ele geçirdikçe enerji dolar. ❄️ *Dondur* (rakip üretimi durur, birlikleri yavaşlar), 💨 *Hız*.
- **Çoklu seçim:** Parmağını birden fazla hücrenin üstünden geçirip tek hedefe bırak (ya da dokun-dokun modu).
- **👑 Boss seviyeleri (her 10 seviyede):** Dev bir *Ana Hücre* (150 kapasite) periyodik olarak en zayıf hücrene dalga gönderir.
  Ana hücreyi ele geçirirsen tüm boss kolonisi nötre düşer. 2 kat ödül.
- Seviye haritaları seed'li üretilir (her oyuncuda aynı seviye = adil, sonsuz içerik). Rakip sayısı 1→3'e çıkar.

## 2. Sürü Seli (Mob Control benzeri)

**Temel mekanik:** Basılı tutup sürükle → top sürü fırlatır. Birlikler `x2`, `x3`, `+N` kapılarından geçerek çoğalır,
`÷2` kapılarından kaçınmak gerekir. Düşman kalesini yık; kırmızı çizgiyi geçen düşman can götürür.
Her N atışta bir 🦍 *Dev* birlik çıkar.

**Özgün katkı — Kapı Kartları:** Oyuncu kapıları sadece kullanmaz, **kendi kapısını kurar**.
Alttaki kartlardan birini seçip sahaya dokunarak `x2`, `+5`, 🛡️ *Kalkan* (bir darbe emer) veya ⚡ *Hız* kapısı yerleştirir.
Kale %66 ve %33 canına düştüğünde yeni kart düşer. Bu, basit "tut-ateşle" döngüsüne stratejik bir karar katmanı ekler
ve doğal bir **ödüllü reklam noktası** oluşturur (📺 +Kart).

**Kale tipleri** (4. seviyeden itibaren dönüşümlü):
- 🏰 *Kale* — klasik
- 🏹 *Okçu Kulesi* — yaklaşan birliklerine ok atar (Kalkan kartı burada değerli)
- 🧱 *Kalkanlı Kale* — önünde sağa-sola kayan bir duvar var, zamanlama gerekir
- 👑 *Kara Kale* (her 10 seviyede boss) — ok + duvar + ağır birlikler, 1.6x can, 2x ödül

**Ses:** Tüm efektler ve müzik WebAudio ile kodla üretilir (dosya yok, APK küçük kalır).
HUD'daki 🔊 düğmesi: efekt+müzik → sadece efekt → sessiz. Reklam oynarken ve uygulama arka plana geçince ses otomatik susar.

---

## 3. Para kazanma (monetizasyon) tasarımı

Hyper-casual türün standart gelir modeli uygulanmıştır: **gelirin çoğu reklamdan**, küçük kısmı IAP'den.

| Tür | Nerede | Kural |
|---|---|---|
| **Geçiş (interstitial)** | Sadece kazanılan seviyenin ödülü alındıktan sonra | İlk 4 seviyede yok · 3 galibiyette bir · en az 90 sn ara · ödüllü reklamdan sonraki 30 sn gösterilmez · kayıptan sonra asla |
| **Ödüllü (rewarded)** | 3x seviye ödülü · seviye atlama · başlangıç takviyesi · oyun içi takviye · canlanma · +kapı kartı · skin açma (3 reklam) · 2x günlük ödül | Tamamen isteğe bağlı; yarıda kapatılırsa ödül verilmez |
| **Banner** | Sadece menü/sonuç ekranları | Oyun sırasında gizli (dokunma kazalarını ve kötü deneyimi önler) |
| **IAP: Reklamları kaldır** | Oyun merkezi | Banner + geçiş reklamlarını kapatır, ödüllüler isteğe bağlı kalır (sektör standardı) |

**Ekonomi döngüsü:** Seviye → altın → geliştirmeler (maks. 15 seviye, üstel fiyat: `taban × 1.55^seviye`)
ve skinler (1.500 – 12.000 altın, biri 3 ödüllü reklamla) → daha zor seviye. Seviye ödülü 60. seviyeden sonra
yavaş büyür; böylece geç oyunda altın enflasyonu olmaz ve 3x reklam değerini korur.
Altını çoğaltmanın en hızlı yolu 3x ödüllü reklam → reklam izleme motivasyonu. Günlük ödül 7 günlük seriyle geri dönüşü (retention) artırır.
İki oyun **ortak cüzdan** kullanır: bir oyunda kazanılan altın diğerinde harcanır → oyunlar arası çapraz tanıtım.

Tüm ayarlar `ortak/ads.js` içindeki `CONFIG` nesnesindedir. Analitik olayları (`level_start`, `level_win`, `level_fail`,
`rewarded_complete`, `interstitial_show`, `ability`, `card_place`…) `Ads.track()` üzerinden akar — Firebase Analytics'e
bağlamak için sadece o fonksiyonu doldurmak yeterli. Hangi seviyede oyuncu kaybettiğinizi bu olaylardan görürsünüz.

---

## 4. Android derleme (kurulu ve test edildi)

Capacitor 8 + `@capacitor-community/admob` 8 kurulu, `android/` projesi oluşturuldu, debug APK başarıyla derlendi.
`ads.js`, uygulama içinde `Capacitor.Plugins.AdMob` bulunca **otomatik olarak gerçek AdMob'a geçer**; tarayıcıda simülasyon gösterir.

**Gereksinimler:** Node.js, Android SDK (yolu `android/local.properties` içinde), **JDK 21**
(taşınabilir olarak `C:\Users\ugur\.jdks\jdk-21.0.12.1+1` konumuna indirildi; sistemdeki Java 8 yeterli değil).

```powershell
cd oyunlar
$env:JAVA_HOME = "$HOME\.jdks\jdk-21.0.12.1+1"
npm run apk      # www/ üret -> cap sync -> debug APK
# Çıktı: android\app\build\outputs\apk\debug\app-debug.apk
```

- Telefona yükleme: USB hata ayıklamayı aç, sonra
  `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk`
  (ya da APK dosyasını telefona kopyalayıp aç). Android Studio ile açmak için: `npm run open`.
- Oyun kodunu değiştirdikten sonra `npm run sync` (veya `npm run apk`) çalıştır. `www/` otomatik üretilir, elle düzenleme.
- Uygulama dikey ekrana kilitli; AdMob **test** uygulama ID'si `AndroidManifest.xml` içinde.
- GDPR/UMP onay formu entegre: başlatmada `requestConsentInfo` çağrılır, gerekiyorsa form gösterilir
  (formun çıkması için AdMob panelinde "Gizlilik ve mesajlaşma" bölümünden bir GDPR mesajı yayınlaman gerekir).

### Yayın dosyaları (hazır)
Uygulama adı **Kapış Kapış**, paket adı `com.ugenis.kapiskapis`, sürüm 1.0.0 (versionCode 1), özel ikon + açılış ekranı, imzalı sürüm derlemesi:
```powershell
npm run aab   # Play Store paketi -> android\app\build\outputs\bundle\release\app-release.aab
```
- Her mağaza güncellemesinde `android/app/build.gradle` içindeki `versionCode`'u 1 artır.
- İkonu değiştirmek için `scripts/make-icons.js` içindeki SVG'yi düzenleyip `node scripts/make-icons.js` çalıştır.
- Satın alma: `ortak/iap.js` (Google Play Billing). Play Console'da açılacak ürünler — tek seferlik (non-consumable): `remove_ads` ($2.99), `premium_bundle` ($5.99); tüketilebilir: `stars_s` ($0.99), `stars_m` ($4.99), `stars_l` ($9.99), `stars_xl` ($19.99), `starter_pack` ($1.99), `star_card_30` ($4.99). Ayrıntılar: `store/market-plan.md`.

### AdMob banner yaması
`scripts/patch-admob.js` (`npm run sync` içinde otomatik çalışır): AdMob eklentisi Android 15+'da Capacitor'ın sistem çubuğu
dinleyicisini eziyor ve banner'ı bir gezinme çubuğu boyu yukarıda gösteriyordu. Yama, dinleyiciyi banner'ın kendi kapsayıcısına taşır.
Eklenti güncellenip kod değişirse betik uyarı verir.

### ⚠️ İmzalama anahtarı
`keystore/kapiskapis-release.jks` ve şifresi (`keystore/keystore.properties`) uygulamanın kimliğidir.
(Şifre dosyası bilerek `android/` dışında tutulur; `android/` yeniden üretilirse silinmesin diye.
Yeniden üretimde: `npx cap add android && node scripts/setup-android.js && node scripts/make-icons.js`.)
**İkisini de şimdi güvenli bir yere yedekle** (şifreli bulut + USB). Kaybolursa güncelleme yüklemek için Google'dan
anahtar sıfırlama istemek gerekir. Bu dosyaları asla git'e koyma/paylaşma (`.gitignore`'da).

### Yayın öncesi kalanlar
1. **Reklam:** AdMob'da uygulama + 3 reklam birimi → `ortak/ads.js` içindeki `IDS` + `initializeForTesting: false` →
   `AndroidManifest.xml` içindeki uygulama ID'si.
2. `gizlilik.html` içindeki `[iletişim e-postası]` alanını doldur, dosyayı herkese açık bir adreste yayınla (ör. GitHub Pages).
3. Play Console'u `store/play-console.md` rehberine göre doldur (mağaza metni, veri güvenliği, derecelendirme, `remove_ads` ürünü).
4. Telefonda oyunu açıp 2-8 dikey ekran görüntüsü al (Play zorunlu kılıyor).
5. **`capacitor.config.json` içindeki `webContentsDebuggingEnabled: true` satırını kaldır** (test için açıldı: telefondaki
   kaydı USB + `adb forward` ile düzenlemeye yarıyor; yayında açık kalırsa herkes kaydını düzenleyebilir).

## 5. Testler ve denge

```bash
node tests/sim.js 120                          # 120 günlük oyuncu simülasyonu (~3 dk)
node tests/sim.js balance suru 10,30,60 4 5    # seviye 10/30/60'ı 4'er kez, tüm geliştirmeler 5. seviyede
```
Simülasyon gerçek sayfaları sanal saat/tarih ile yükler; AdMob (yarıda kapatılan ödüllü reklam dahil), Play Billing,
WebAudio ve canvas taklit edilir. Bozuk kayıt, NaN çizim/ses parametresi, reklam kuralı ihlali, takılan oyun, sızan
reklam dinleyicisi gibi durumları raporlar. Oyun dengesini değiştirdikten sonra çalıştırılması önerilir.

## 6. Sonraki adımlar (öneri)

- Firebase Remote Config ile reklam sıklığını ve zorluğu yayından sonra A/B test etmek
- Firebase Analytics: `Ads.track()` içine bağlanarak seviye bazlı oyuncu kaybı (churn) analizi
- Birlik/kapı/kale için sprite ve animasyonlar

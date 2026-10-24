# Görsel ve efekt raporu V3 — Grab Rush'ı daha ilgi çekici yapmak

Tarih: 24 Ekim 2026 · Dal: `gorev-v3` (V2'nin üstüne) · Görev: `docs/GOREV-V3.md` · Geri bildirim kaydı: `TEST-GERIBILDIRIM.md` G-14, G-15

## Özet

| # | Görev maddesi | Durum | Nerede |
|---|---|---|---|
| 1 | Sürü Seli: asker/düşman modeli, koşu animasyonu, "dev ordu" | Yapıldı | `suru-seli/render3d.js` |
| 1 | Sürü Seli: kapı anı (uçuşan sayılar, flaş, ses, ×2 patlaması) | Yapıldı | `suru-seli/game.js`, `render3d.js`, `ortak/sound.js` |
| 1 | Sürü Seli: savaş anı (toz, kıvılcım, sayaç çarpışması, ağır çekim) | Yapıldı | aynı |
| 1 | Sürü Seli: 10 bölümde bir değişen dünya (6 tema) | Yapıldı | aynı + `ortak/themes.js` |
| 1 | Sürü Seli: sinematik bosslar (kamera, giriş yazısı, faz, son vuruş ağır çekim) | Yapıldı | aynı |
| 1 | Sürü Seli: bölüm sonu (hazineye koşu, altın yağmuru, yıldız animasyonu) | Yapıldı | aynı + `ortak/kit.js`, `ortak/ui.css` |
| — | **Kullanıcı hatası (G-15): takviye helikopteri kameraya dönüktü** | Düzeltildi, ekranla doğrulandı | `suru-seli/render3d.js`, `game.js` |
| 2 | Arrow: oda ortamı (ışık havuzu, sis, kar/kül/yaprak), kapı açılma efekti | Yapıldı | `arrow-legends/render3d.js` |
| 2 | Arrow: kahraman hasar flaşı + kalkan efekti | Yapıldı | aynı |
| 2 | Arrow: elit düşman tacı/aurası, türe göre ölüm efekti | Yapıldı | aynı |
| 2 | Arrow: ödül anları (yetenek kartı, sandık, seviye) | Yapıldı | `arrow-legends/index.html`, `ortak/fx.js`, `ortak/kit.js` |
| 3 | Hub: canlı kartlar, seçimde büyüme, hareketli arkaplan, ilk açılış girişi | Yapıldı | `index.html`, `ortak/ui.css` |
| 3 | Ortak UI juice: düğme squash, cüzdana uçan ikon, seviye kutlaması, kazanma yıldızları, konfeti | Yapıldı | `ortak/fx.js`, `ortak/kit.js`, `ortak/ui.css` |
| 3 | Diğer oyunlar (Obur Delik, Çağlar Savaşı, Koloni, Altın Ocağı): Fx3D efekt dili | Yapıldı | her oyunun `render3d.js` + `index.html` |
| 4 | Rakip araştırması V3 eki + kalan maddeler | Yapıldı | `docs/RAKIP-ARASTIRMA-V2.md` (sonda "V3 eki") |

Kayıt formatı, para birimleri, IAP ve reklam akışı **değişmedi**; yeni hiçbir özellik reklam izletmiyor. Gerçek ışık, gölge haritası ya da post-process eklenmedi. Yeni efektlerin hepsi `ortak/fx3d.js` havuzlarından ya da örneklenmiş (instanced) tek çizim çağrılarından çiziliyor. `android/` ve imza dosyalarına dokunulmadı.

## Ortak efekt sistemi (`ortak/fx3d.js`, eski API aynı)

| Yeni hazır efekt | Ne yapıyor | Kim kullanıyor |
|---|---|---|
| `coins` | Havaya atılıp düşen, dönerken parlayan altınlar | Sürü hazine sandığı, ×2 kapı, Arrow elit ölümü, Obur büyüme, Koloni ele geçirme, Altın Ocağı banka |
| `confetti` | Çok renkli, savrularak düşen pullar | Sürü ×2 kapı ve hazine, Çağlar çağ atlama |
| `dust` | Yerde yayılan toz bulutu | — (hazır; Sürü kendi duman havuzunu kullanıyor) |
| `weather` | Kamera önündeki alana saniyede N parçacık: kar, kül, kor, kum, neon zerre, ateşböceği, yaprak | Sürü dünyaları, Arrow bölüm ortamları |

Ortak sesler (`ortak/sound.js`, dosyasız WebAudio): `mega` (×2 kapı), `clash` (orduların çarpışması), `slow` (ağır çekim), `star` (kazanma yıldızı), `levelup` (kutlama). `mega` ve `levelup` kısa titreşim de veriyor.

## 1 — Sürü Seli (Crowd Surge)

### Dünyalar: 10 bölümde bir değişen ortam
`ortak/themes.js`'e `Themes.pick(liste, seviye)` eklendi: oyunun kendi tema listesi, ortak listeyle aynı 10 bölümlük ritimde döner; eksik alanlar (2D renkleri) ortak temadan gelir. HUD'da seviye altında dünyanın ikonu ve adı yazıyor.

| Seviye | Dünya | Gökyüzü / sis | Yer ve su | Kenar dekoru | Hava |
|---|---|---|---|---|---|
| 1–10 | 🌃 Gece Vadisi (V2 görünümü) | Lacivert-mor alacakaranlık | Çimen, göl | Ağaç, çam, çalı, lamba | Ateşböcekleri |
| 11–20 | 🏜️ Çöl | Mor → turuncu gün batımı, sıcak pus | Kum (su düzlemi kum dalgası) | Kaktüsler (gövde + iki kol), kumtaşı kayalar | Savrulan kum |
| 21–30 | ❄️ Kar Diyarı | Buz mavisi | Kar örtüsü, buzlu su | Karlı çamlar, kar tümsekleri | Kar yağışı |
| 31–40 | 🌋 Volkan | Kızıl-siyah, kor ufuk | Akan, parlayan lav | Kuru gövdeler, obsidyen dikenler, kor tepeli dağlar | Yükselen korlar + kül |
| 41–50 | 🌆 Neon Şehir | Mor-pembe | Parlayan siber ızgara (kayıyor) | Işıklı pencereli bloklar, çatıda pembe/camgöbeği neon şeritler | Neon zerreler |
| 51–60 | 🏙️ Gece Şehri | Gece mavisi, sıcak ufuk | Gece suyu | Işıklı pencereli gökdelenler, sıcak sokak lambaları | Ateşböcekleri |

Hepsi aynı sahneyi yeniden renklendiriyor ve aynı yerlerde farklı örnekli nesneler çiziyor. Yeni ışık yok. Bloklar, neon şeritler ve kaktüsler toplam 4 yeni çizim çağrısı, kullanılmayan dünyada sayıları 0.

### Askerler ve düşmanlar
- **Detaylı askerlere** botlar ve omuzluklar eklendi (takım renginin koyu tonu). Botlar bacakla birlikte dönüyor.
- **Koşu daha canlı:** adım boyu ve zıplama arttı, gövde her adımda hafifçe yalpalıyor. Zafer koşusunda tempo artıyor ve askerler öne eğiliyor.
- **"Dev ordu" hissi:**
  - Ordunun altında takım renginde, ordu büyüdükçe genişleyen bir yer parıltısı var.
  - 25 askerden sonra arka köşelerde iki **sancaktar** takım bayrağını dalgalandırıyor.
  - Yürüyen ordunun arkasında hafif toz kalkıyor (asker sayısıyla artıyor).
- **Düşmanların gözleri kırmızı parlıyor:** takım rengi uzaktan da okunuyor. Bu yalnızca bir renk değişikliği, ek çizim çağrısı yok.

### Kapı anı
- Kapıdan geçince **büyük sayı "vurarak" çıkıyor** (büyüyüp oturuyor). ×2 kapılarında yazı "×2 +N" ve altın renkli.
- Kapıdan orduya **küçük sayılar uçuyor** (en çok 10, kazanılan askere göre). Konumlar sabit bir hash ile hesaplanıyor, `Math.random` kullanılmıyor; bu yüzden simülasyonun rastgele dizisi değişmiyor.
- Kapının kendisinde şunlar oluyor: renginde yıldız flaşı ve ışık patlaması, kapı boyunca yükselen kıvılcım perdesi, yolda bir kıvılcım halkası ve genişleyen halka. Eksi kapıda kırmızı kıvılcım yağıyor.
- **×2 kapısında** ayrıca: altın patlama, konfeti, altın yağmuru, büyük flaş, kamera darbesi, `mega` sesi ve titreşim.

### Savaş anı
- Düşman orduya değdiği her an yolda **toz bulutu**, çelik kıvılcımı ve `clash` sesi çıkıyor. İri düşmanda ayrıca şok halkası var. Kare başına en çok 6 olay işleniyor.
- **Sayaçların çarpışması:**
  - Yaklaşan düşman dalgasının ortasında kırmızı bir sayaç beliriyor. Dalga eridikçe sayaç azalıyor ve her düşüşte "pop" yapıyor.
  - Ordunun sayacı büyürken yeşil şişiyor, küçülürken kırmızı titriyor.
  - İki sayaç birbirine yaklaşınca aralarında yanıp sönen ⚔ işareti çıkıyor.
- **Son asker ağır çekimi:**
  - Orduya ulaşmış büyük bir dalga (en az 10 düşman) son askerine kadar silinince oyun 0.6 sn boyunca 1/3 hıza iniyor.
  - Bu sırada ekranda koyu bir kenar karartması, "DALGA EZİLDİ!" yazısı, yıldız ve halka çıkıyor; `slow` sesi çalıyor.
  - Aynı an en erken 14 sn sonra tekrar edebilir, yani ağır çekim sık sık araya girmiyor.
  - Ağır çekim yalnızca zamanı yavaşlatıyor, oyun kuralına dokunmuyor.

### Sinematik bosslar (5 bossun hepsi)
- **Giriş:**
  - Boss belirince 2.6 sn sinema şeritleri iniyor ve kırmızı bir "BOSS" bandı kayarak geliyor; isim bandı V2'deki gibi duruyor.
  - Kamera bossa doğru yaklaşıyor, sonra yumuşakça oyun görüşüne dönüyor.
  - Oynanış görüşü değişmedi: kameranın bakışına yalnızca bu yaklaşma sırasında dokunuluyor.
- **Faz değişimi (%50 can):**
  - "⚡ ÖFKELENDİ! 2. faz — bitir onu!" bandı, kırmızı şok halkası, büyük flaş, kamera darbesi ve boss sesi.
  - Boss bundan sonra kırmızı nabızla parlıyor ve üstünden kor saçıyor.
  - Saldırı hızı ve hasar **değişmedi** (denge korunsun diye yalnızca görsel).
- **Can barı** vuruşta sallanıyor (V2 rakip çıkarımı 4'ün kalan kısmı).
- **Son vuruş:**
  - Beyaz ekran flaşı, ardından "ZAFER!" yazısı.
  - Bossun yıkılışı ilk 0.7 sn ağır çekimde (0.4×) oynuyor ve kamera yıkılan bossa yaklaşıyor.
  - Yalnızca çizim yavaşlıyor; oyun zaten bitmiş durumda.

### Bölüm sonu: hazine
1. Boss yıkılırken yolun ilerisinde altın şeritli bir **hazine sandığı** yaylanarak belirir.
2. Ordu ona doğru koşar (0.8 sn).
3. Ordu varınca kapak açılır. Altın fıskiyesi, konfeti, büyük yıldız ve flaş çıkar, altın akmaya devam eder.
4. Bu sırada ordu sayaçları gizlenir.

Kazanma paneli 0.9 sn yerine **2.4 sn** sonra açılıyor ki bu an görünsün. Panelde yıldızlar sırayla, büyükten küçülerek ve parlama halkasıyla "çakılıyor". Her yıldızda kıvılcım ve `star` sesi var, ardından konfeti yağıyor. Bu kısım `Kit.win` içinde olduğu için **bütün oyunların** kazanma ekranında aynı.

### Kullanıcı hatası G-15 — takviye helikopteri ters duruyordu
- **Kök neden:** Helikopter modeli burnu +z'ye (kameraya doğru) bakacak şekilde kurulmuş, sahnede de hiç döndürülmemişti. Yani burnu oyuncuya, kuyruğu düşmana dönüktü.
- **Düzeltme:**
  - Model yarım tur döndürüldü: burun yolun ilerisine, düşmanların geldiği yöne bakıyor.
  - Gelirken ve ayrılırken burnunu öne eğiyor.
  - İpler ve inen askerler kapının yeni tarafından (sol) iniyor.
  - Kapı nişancısı artık oyunun hedef seçtiği düşmana (en yakın düşman, yoksa boss) mermiyle dönüyor.
  - Oyunda mermilerin çıkış noktası da kapının olduğu sola taşındı.
- **Doğrulama:** `docs/screens-v3/suru-heli-once.jpg` / `suru-heli-sonra.jpg` (oyun kamerası), `suru-heli-yakin-sonra.jpg` (arkadan: cam burun düşmanlara, kuyruk rotoru kameraya), `suru-heli-yan-sonra.jpg` (yandan: burun yolun ilerisine, açık kapı ve ipler görünür). Yakın çekimler `R3.heliCam` test kancasıyla alındı.

## 2 — Arrow Legends

### Odalar ve zindan
- Her duvar meşalesinin altında, bölümün ışık renginde **ışık havuzu** var (11 toplamalı düzlem, tek malzeme).
- Zeminde iki kat yavaşça kayan **alçak sis** var. Rengi bölümün sis renginden açılıyor.
- **Bölüm havası** (yüzen toz noktalarına ek):

| Bölüm | Ortam |
|---|---|
| 2 (sular altı) | Zerreler |
| 3 (mezarlık) | Ateşböcekleri |
| 4 (lav) | Kor ve kül |
| 5 (buzul) | Kar yağışı |
| 6 (orman mezarlığı) | Düşen yapraklar ve ateşböcekleri |

- **Kapı açılması:** Oda temizlenince bariyer yeşil ışıkla patlıyor. Taş parçaları fırlıyor, kıvılcım halkası ve yıldız çıkıyor, ışık sarmalı yükseliyor, ekran yeşil flaş yapıyor. Portal kapı aralığından yaylanarak "büyüyor".

### Kahraman
- **Hasar alınca:**
  - Ekran kenarında kırmızı vinyet flaşı.
  - Kahraman kırmızı parlıyor.
  - Etrafında kırmızı altıgen bir **kalkan dalgası** genişliyor (V2'deki Mana Kalkanı küresi kırmızıya boyanarak).
  - Kırmızı halka ve kısa bir kamera darbesi.
- **Can %30'un altındayken** kenar vinyeti yavaşça nabız atıyor.
- Bunların hepsi DOM opaklığı ya da mevcut nesnelerle yapılıyor; yeni shader yok.

### Yaratıklar
- **Elit düşmanlar** (oyunda zaten vardı: 2.4× can, 1.25× boy):
  - Başlarının üstünde dönen altın **taç**, ayaklarında altın **rün halkası**.
  - Altın nabız parıltısı ve yükselen altın zerreler.
  - Öldüklerinde altın yağmuru, büyük yıldız ve halka.
- **Türe göre ölüm** (V2'deki ortak ölüm efektinin üstüne):

| Tür | Türler | Ölüm efekti |
|---|---|---|
| İskelet | minion, warrior, archer, orcskull | Kemik rengi parçalar saçılıyor, mezar tozu, beyaz flaş |
| Slime / su | greenblob, pinkblob, spikyblob, glub, frog, squidle, fish, mushnub | Kendi renginde yapışkan damlalar yay çizip düşüyor, ıslak halka ve zemin lekesi |
| Büyücü / ruh | necro, wizardb, ghost, ghostskull, bluedemon, alien | Mor sarmal ve zerrelerle yükselip **buharlaşıyor** |
| İblis / ejder | demon, demonf, dragon, dragonx, cactoro | Kor patlaması, yüksek kıvılcımlar, yanık izi |

### Ödül anları
- **Yetenek seçimi:**
  - Kartlar sırayla **çevrilerek** geliyor.
  - Her kartın resminden bir kez ışık süpürmesi geçiyor.
  - Nadir ve efsane kartların arkasında nadirlik renginde ışıma var.
  - Kartların arkasında altın bir hâle nabız atıyor.
  - V2'de "uygulanmadı" denen rakip çıkarımı 7 bununla tamamlandı.
- **Sandık / ödül açılışı** (`Fx.reveal`, hub dahil her yerde):
  - Altın kazanınca cüzdana **ikon uçuşu** (aşağıda).
  - Kazanma ekranındaki yıldız ve konfeti anı.
  - `Fx.reveal`'in mevcut ışın, flaş ve kart çevirme sahnesi korunuyor.

## 3 — Uygulama geneli

### Hub (ana ekran)
- **İlk açılış girişi** (uygulama her açıldığında bir kez):
  - Mavi sahnede amblem flaşla dönerek büyüyor, "Grab Rush" yazısı vurarak geliyor, ışınlar dönüyor ve `levelup` fanfarı çalıyor.
  - 2.3 sn sonra kalkıyor; dokununca hemen kapanıyor.
- **Hareketli arkaplan:** yukarı süzülen 6 ışık zerresi ve hafif bir ışık hüzmesi.
- **Canlı kartlar:**
  - Açılışta kartlar sırayla kayarak geliyor.
  - Her 2.6 sn'de bir sıradaki kart "ışık yakalıyor": bir ışık süpürmesi ve kartın vurgu renginde çerçeve parıltısı.
- **Seçim:** Dokunulan kart vurgu rengiyle **büyüyor**, kıvılcım patlıyor, ses çalıyor; 0.23 sn sonra oyun açılıyor.
- **Seviye ödülü:** Önce "SEVİYE ATLADIN!" kutlaması geliyor (ışınlar, büyük başlık, konfeti, fanfar), sonra ödül sandığı.
- "Azaltılmış hareket" tercihinde zerreler, süpürme ve giriş kapalı.

### Ortak UI juice (`ortak/ui.css`, `ortak/fx.js`, `ortak/kit.js`)
- **Düğmeler:** basınca yassılıyor (squash), bırakınca yaylanarak geri geliyor.
- **`Fx.fly`:** kazanılan her ⭐ (günlük ödül, görev, seviye ödülü, kazanma yıldızı) son dokunulan yerden cüzdana yay çizerek uçuyor. Cüzdan her varışta zıplıyor ve hafif "cash" sesi çıkıyor. `Save.addCoins` kancasıyla otomatik; oyunların kodunu değiştirmek gerekmedi.
- **`Fx.confetti`, `Fx.celebrate`:** tam ekran konfeti ve ışınlı kutlama başlığı.
- **Kazanma ekranı:** yıldızlar sırayla çakılıyor, her birinde parlama halkası, kıvılcım ve çınlama, ardından konfeti. 6 oyunun hepsinde.

### Diğer oyunlar
Dördüne de `ortak/fx3d.js` eklendi (her biri küçük havuz: 600–900 parçacık, kare başı bütçe 160–260).

| Oyun | Yeni anlar |
|---|---|
| Obur Delik | Yutulan her nesnede delik renginde kıvılcım halkası; büyük nesnede yıldız ve taş parçası. Delik büyüdükçe (12 birimde bir) ışık halkası, sarmal ve altın yağmuru. Yutulan rakip delik kendi renginde patlıyor. |
| Çağlar Savaşı | İsabetler türüne göre: taş/kaya parçaları, lazer/plazma halkası, top/roket patlama halkası. Düşen birim takım renginde halka ve yıldız. **Çağ atlama:** ışık sarmalı, halka, yıldız, konfeti. Yıkılan üs zincirleme patlıyor. |
| Koloni Kapışması | **Bölge ele geçirme:** yeni sahibin renginde kıvılcım halkası, yükselen sarmal, kulenin üstünde yıldız; oyuncu aldıysa altın. |
| Altın Ocağı | Her kazma vuruşunda maden renginde kıvılcım. Taşıma arabası bankaya varınca altın yağmuru ve yıldız. |

Ucuz ve belirgin kalması için bu oyunlara yeni ışık, gölge ya da model eklenmedi. Kazanma ekranları ortak `Kit.win` ile yıldız ve konfeti anını kendiliğinden aldı.

## 4 — Rakipler
`docs/RAKIP-ARASTIRMA-V2.md` sonuna "V3 eki" bölümü eklendi:
- "Juice it or lose it" (GDC 2012)
- hit-stop, sarsıntı ve parçacık ölçüleri
- kapı koşusu türü
- çoklu oyun hub uygulamaları (Samsung Gaming Hub, itch.io hub'ları)

Kaynak bağlantıları ve 6 çıkarım orada. Uygulanan ve uygulanmayan maddeler (gerekçesiyle) de orada.

## Kalite kontrolleri

### Testler
| Test | Önce (HEAD `ac4ae47`) | Sonra |
|---|---|---|
| `node tests/sim.js smoke` (6 sayfa, 3'er dk) | 0 hata | **0 hata** |
| `node tests/sim.js 40` (40 gün ekonomi/reklam) | 0 hata | **0 hata** |
| Tarayıcı (SwiftShader) sayfa hatası, 23 sahne + 20 an | — | **0** (yalnızca başsız Chrome'un "vibrate engellendi" uyarısı) |

`tests/sim.js` iki yerde güncellendi: Sürü'nün kazanma paneli artık 2.4 sn sonra açıldığı için hem denge (balance) hem 40 gün simülasyonu panel için 3 sn bekliyor. İlk denemede 40 gün simülasyonu "play/home düğmesi bulunamadı" hatası vermişti; sebebi buydu, bekleme süresi düzeltilince 0 hata.

40 gün simülasyonu tohuma göre çok oynuyor (oyuncu kararları ortak bir rastgele diziden). Bu yüzden ilerleme sayılarını önce/sonra karşılaştırmak anlamlı değil. Örneğin aynı kodla tohum 7, 42 ve 99 için 60–80 oturum çıkıyor. Önemli olan hata sayısı ve o 0.

### Denge
**Sürü** — `node tests/sim.js balance suru 1,5,10,20 4 5`:

| Seviye | Önce (kazanma / süre) | Sonra |
|---|---|---|
| 1 | %100 / 45 sn | %100 / 45 sn |
| 5 | %100 / 54 sn | %100 / 54 sn |
| 10 | %100 / 41 sn | %100 / 42 sn |
| 20 | %100 / 80 sn | %100 / 83 sn |

Faz değişimi yalnızca görsel. Ağır çekim zamanı uniform yavaşlatıyor. Uçan sayılar `Math.random` kullanmıyor. Botun aldığı sonuç aynı kaldı.

**Arrow** — `node tests/arrow-balance.mjs "1:avg,3:avg,6:avg"` (bot, aynı oturumda önce ve sonra):

| Bölüm | Önce | Sonra |
|---|---|---|
| 1 | Kazandı (138 sn) | Kazandı (127 sn) |
| 3 | 8. odada öldü | 9. odada öldü |
| 6 | 23. odada öldü | Kazandı (720 sn) |

Arrow'da oyun mantığına dokunulmadı (yalnızca çizim). Farklar botun rastgeleliği. İlk "sonra" çalıştırmasında 1. bölümde bot boss odasında takılmış (`stuck`), 3 ve 6 kazanılmıştı; V2 raporunda da aynı oynama vardı.

### Performans — `scripts/visual-bench.cjs`
Ortam: başsız Chromium, SwiftShader (GPU'yu CPU taklit ediyor), 393×852, DPR 1, CPU 4× yavaşlatılmış, sahne başı 15 sn. Önce ve sonra **arka arkaya** ölçüldü; önce, ayrı bir çalışma kopyasında HEAD `ac4ae47`.

Bench'e eklenenler:
- `BENCH_ROOT` ile başka bir kopyayı ölçme.
- Hub ve diğer 4 oyun sahnesi.
- `suru-gate`, `suru-snow`, `suru-volcano`, `suru-neon` sahneleri.
- p50 ve en uzun kare.
- Genel `requestAnimationFrame` süresi.
- Ana iş parçacığı meşguliyeti (%).

**3D sahneler — render çağrısı (ms):**

| Sahne | p50 önce → sonra | p95 önce → sonra | oyun JS p50 | en uzun kare |
|---|---|---|---|---|
| suru-run | 11.2 → 14.1 | 31.9 → 38.9 | 1.9 → 2.6 | 48 → 48 |
| suru-boss | 15.8 → 16.5 | 29.7 → 58.2 | 2.8 → 3.3 | 72 → 61 |
| suru-wave | 12.8 → 19.6 | 39.9 → 27.7 | 2.5 → 3.7 | 1140 → 996 |
| suru-giant | 14.6 → 19.1 | 69.4 → 39.9 | 2.5 → 2.9 | 79 → 44 |
| suru-tank | 16.1 → 18.0 | 27.1 → 58.8 | 2.2 → 2.4 | 49 → 63 |
| suru-dragon | 17.4 → 21.6 | 42.7 → 76.7 | 2.6 → 3.0 | 81 → 85 |
| suru-support | 13.0 → 19.2 | 38.7 → 32.3 | 2.8 → 4.6 | 59 → 85 |
| suru-gate | 13.1 → 12.7 | 25.8 → 43.7 | 2.1 → 2.2 | 41 → 46 |
| suru-snow (sv 25) | 14.0 → 15.7 | 48.5 → 21.3 | 2.4 → 3.3 | 500 → 25 |
| suru-volcano (sv 35) | 12.9 → 15.5 | 53.3 → 30.7 | 2.8 → 2.8 | 830 → 52 |
| suru-neon (sv 45) | 17.1 → 16.9 | 28.1 → 42.7 | 5.5 → 4.1 | 50 → 57 |
| arrow-play | 9.4 → 12.1 | 20.0 → 27.6 | 1.1 → 1.5 | 801 → 894 |
| arrow-boss | 9.4 → 9.5 | 18.5 → 27.5 | 1.2 → 1.8 | 24 → 898 |
| arrow-wizard | 8.1 → 11.2 | 17.0 → 19.2 | 1.1 → 1.6 | 20 → 1299 |
| arrow-creatures | 7.8 → 10.2 | 23.2 → 21.5 | 1.1 → 1.1 | 1077 → 23 |
| arrow-ice | 13.5 → 12.6 | 36.1 → 32.2 | 2.4 → 1.8 | 1067 → 1219 |
| arrow-skills | 11.4 → 10.1 | 24.2 → 20.7 | 1.8 → 1.5 | 852 → 21 |
| arrow-boss4 | 16.5 → 15.5 | 26.8 → 30.7 | 1.5 → 1.3 | 29 → 37 |

**Gürültüyü ayırmak için tekrar ölçüm** (aynı oturumda, önce/sonra sırayla, iki tur, p50 ms):

| Sahne | Önce (tur 1 / tur 2) | Sonra (tur 1 / tur 2) |
|---|---|---|
| suru-run | 12.8 / 12.9 | 18.2 / 14.3 |
| suru-wave | 12.9 / 12.6 | 14.9 / 12.5 |
| suru-support | 14.8 / 16.3 | 16.8 / 15.9 |
| arrow-play | 8.3 / 7.7 | 7.0 / 9.3 |
| arrow-wizard | 11.3 / 9.4 | 10.6 / 11.0 |

**Hangi ekleme ne kadar?** V3 süsleri `R3.v3off` test kancasıyla tek tek kapatılarak ölçüldü (suru-run ve suru-wave, ikişer tur). Botlar/omuzluklar, yer parıltısı, bayraklar, toz ve hava kapatıldığında p50 en çok ~1 ms düşüyor. Çalıştırmalar arası oynama ±2 ms. Arrow'da sis ve ışık havuzları kapatılınca p50 değişmedi (8.1–9.4 ms aralığında).

**2D/DOM sahneler** — `requestAnimationFrame` geri çağrısı (ms) ve ana iş parçacığı meşguliyeti:

| Sahne | rAF p50 önce → sonra | rAF p95 önce → sonra | meşgul önce → sonra |
|---|---|---|---|
| hub | — (rAF yok) | — | %22 → %38 |
| obur | 19.8 → 13.9 | 37.7 → 30.5 | %6.4 → %6.3 |
| cag | 11.6 → 13.4 | 23.4 → 29.1 | %13.7 → %7.7 |
| altin | 20.0 → 25.3 | 39.4 → 49.9 | %24.1 → %27.1 |
| koloni | 11.1 → 12.5 | 25.1 → 27.1 | %16.7 → %16.2 |

**Yorum:**
- **Sürü:** V3 eklemeleri bu ortamda kare başına yaklaşık 1–2 ms. Oyun JS'i +0.3–1 ms; 4× yavaşlatılmış CPU'da ölçüldüğü için telefonda ~0.1–0.3 ms. Kalan fark çoğunlukla SwiftShader'ın dolgu maliyeti (yer parıltısı, toz, toplamalı parçacıklar).
- **Zayıf telefon:** Uyarlanabilir kalite V2'deki gibi önce çözünürlüğü düşürüyor, sonra "düşük efekt" moduna geçiyor. V3'ün dekoratif ekleri de bu moda bağlandı: botlar/omuzluklar, ordu parıltısı, sancaklar, toz ve hava kapanıyor.
- **Arrow:** p50 aynı aralıkta. Ortalama ve "en uzun kare" sütunundaki 0.8–1.3 sn'lik kareler tek seferlik: yeni bir model ya da doku ilk kez yükleniyor. Hangi sahnede çıktıkları çalıştırmadan çalıştırmaya değişiyor (V2 raporunda da aynıydı). Zayıf telefon için Arrow'a yeni bir kalite adımı eklendi: en düşük çözünürlükte hâlâ 34 fps altındaysa sis ve hava kapanıyor.
- **Hub:**
  - Meşguliyet artışı JS değil, **CSS kompozit işi**. Sürekli hareket eden her öğe her karede sayfanın yeniden birleştirilmesini gerektiriyor; SwiftShader bunu CPU'da yaptığı için büyük görünüyor. Telefonda bu iş GPU'da ve ucuz.
  - Yine de azaltıldı. İlk sürümde %35–37'ydi (6 kartta sürekli parıltı, nefes alan resimler, iki dönen hüzme, 16 zerre). Sonra kartlar tek tek parlıyor, resimler sabit, hüzme dönmüyor ve 6 zerre kaldı.
  - Zerreler tamamen kaldırılınca %21'e iniyor. "Arkaplanda hareketli ortam" maddesi için bırakıldı.
- **Diğer oyunlar:** Fark gürültü içinde. Altın Ocağı +5 ms rAF; kazma kıvılcımlarının parçacık yüklemesi. İstenirse bütçe 160'tan 100'e indirilebilir.

## Ekran görüntüleri — `docs/screens-v3/`
`*-once.jpg` eski kodla (HEAD `ac4ae47`), `*-sonra.jpg` yeni kodla alındı; 1080×1920. Bench ile yeniden üretmek için:

```
NODE_PATH=$(npm root -g) node scripts/visual-bench.cjs <klasör> <etiket> [sahne,...]
```

Bench PNG yazar; depoya JPEG olarak kondu.

**Önce / sonra (bench sahneleri, hepsi hem `-once` hem `-sonra`):**

| Dosya | İçerik |
|---|---|
| `hub-*` | Ana ekran (canlı kartlar, zerreler) |
| `suru-run-*`, `suru-wave-*`, `suru-gate-*` | Sürü yol çatışması, kalabalık dalga, kapılar (sv 6 / 12 / 15) |
| `suru-snow-*`, `suru-volcano-*`, `suru-neon-*` | Sv 25 / 35 / 45: eski kodda hep aynı gece, yeni kodda Kar / Volkan / Neon dünyası |
| `suru-giant-*`, `suru-tank-*`, `suru-boss-*`, `suru-dragon-*` | Bosslar |
| `suru-support-*` | Destek yetenekleri (takviye helikopteri dahil) |
| `arrow-play-*`, `arrow-boss-*`, `arrow-wizard-*`, `arrow-creatures-*`, `arrow-ice-*`, `arrow-skills-*`, `arrow-boss4-*` | Arrow sahneleri (V2 ile aynı kurgu) |
| `obur-*`, `cag-*`, `altin-*`, `koloni-*` | Diğer dört oyun |

**Yeni anlar (yalnızca sonra):**

| Dosya | İçerik |
|---|---|
| `suru-heli-once.jpg` / `suru-heli-sonra.jpg` | **G-15:** takviye helikopteri, oyun kamerası |
| `suru-heli-yakin-sonra.jpg`, `suru-heli-yan-sonra.jpg` | **G-15:** yakın çekim, burun düşmana bakıyor |
| `suru-kapi-x2-sonra.jpg` | ×2 kapısı: "×2 +40", altın patlama ve halka |
| `suru-carpisma-sonra.jpg` | Sv 12 Çöl: savaş öncesi dalga ve kapılar |
| `suru-boss-giris-sonra.jpg` | Ateş Ejderi girişi: sinema şeritleri, "BOSS" bandı |
| `suru-faz2-sonra.jpg` | Helikopter boss %50: "ÖFKELENDİ!", kırmızı şok halkası |
| `suru-zafer-1-sonra.jpg` | Son vuruş: flaş, "ZAFER!", ağır çekim yıkılış |
| `suru-zafer-2-sonra.jpg` | Zafer koşusu: ordu hazine sandığına varıyor |
| `suru-kazan-panel-sonra.jpg` | Kazanma paneli: yıldızlar ve konfeti |
| `arrow-elit-sonra.jpg` | İki elit düşman: taç, altın aura |
| `arrow-hasar-sonra.jpg` | Kahraman vuruldu: kırmızı vinyet ve kalkan dalgası |
| `arrow-yetenek-sonra.jpg` | Yetenek seçimi kartları |
| `arrow-kar-sonra.jpg` | 5. bölüm buzul: kar yağışı, sis, ışık havuzları |
| `arrow-lav-sonra.jpg` | 4. bölüm lav: kor ve kül |
| `hub-giris-sonra.jpg` | İlk açılış girişi |

Ekran görüntüsü alınamayanlar: Arrow'un türe göre ölüm efektleri ve kapı açılma patlaması. İkisi de tek karelik anlar ve başsız SwiftShader'da saniyede ~3 kare çizildiği için yakalanamadı. Kodda varlar ve tarayıcıda hatasız çalıştırıldılar.

Test kancaları:
- `window.__suru.frames(n, dt)`: anlık kareleri çizer.
- `R3.heliCam`: helikopter yakın çekimi.
- `R3.v3off` (Sürü ve Arrow): V3 süslerini tek tek kapatır.

## Riskler / açık noktalar
1. **Telefonda deneme şart.** Ölçümler SwiftShader'da. Özellikle Xiaomi gibi zayıf cihazda şunlar denenmeli: Sürü'nün Neon ve Volkan dünyaları (en çok parçacık ve dolgu) ile hub'ın zerreleri.
2. **Kazanma paneli 1.5 sn geç açılıyor** (Sürü, zafer anı için). Oyuncu sabırsızlanırsa süre `win()` içindeki 2400 ms'den kısaltılabilir. Testler 3 sn bekleyecek şekilde güncellendi.
3. **Faz 2 yalnızca görsel.** Rakip araştırması "yeni saldırı deseni" de öneriyor; denge bozulmasın diye eklenmedi.
4. **Kum dünyasında su düzlemi kum rengine boyanıyor.** Dalga deseni "kum dalgası" gibi okunuyor ama gerçek bir kumul modeli yok.
5. **Hub girişi** uygulama her açıldığında bir kez görünüyor (oturum başına). Rahatsız ederse yalnızca ilk kurulumda gösterilecek şekilde değiştirilebilir.
6. **G-14 ve G-15** `TEST-GERIBILDIRIM.md`'ye işlendi. Sürüm derlenmedi: `yayin-derle.cmd` Windows'ta çalıştırılmalı. Reklam modu `test` kalıyor.

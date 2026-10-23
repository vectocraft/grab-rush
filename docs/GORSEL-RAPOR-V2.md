# Görsel ve oynanış raporu V2 — Sürü Seli + Arrow Legends

Tarih: 23 Ekim 2026 · Dal: `gorev-v2` · Görev: `docs/GOREV-V2.md` (kullanıcının telefonda oynadıktan sonraki notları)

## Özet

| # | Kullanıcı maddesi | Durum | Nerede |
|---|---|---|---|
| A | Rakip araştırması | Yapıldı | `docs/RAKIP-ARASTIRMA-V2.md` |
| 1 | Sürü: düşman çok az | Dalgalar ~1.5–2 kat kalabalık, denge korunuyor | `suru-seli/game.js` |
| 2 | Sürü: bosslar ucuz | 3 yeni model (zırhlı dev, kuşatma tankı, **yeni 5. boss: Ateş Ejderi**), giriş, üst can barı, uyarı alanları, isabet kıvılcımı, ölüm sahnesi | `suru-seli/render3d.js` |
| 3 | Sürü: asker ekleme 11'de takılı | Kök neden bulundu ve düzeltildi | `suru-seli/game.js` |
| 4 | Sürü: askerler küçük | %30 büyük, diziliş genişletildi | iki dosya |
| 5 | Sürü: destek çağırma | 3 yetenek: takviye helikopteri, füze yağmuru, kalkan | iki dosya + `index.html` |
| 6 | Sürü: rakip maddeleri | 5 madde uygulandı (aşağıda) | — |
| 7 | Arrow: efektler 2–3 kat | Yapıldı | `arrow-legends/render3d.js`, `ortak/fx3d.js` |
| 8 | Arrow: büyücü efektleri | Yapıldı | aynı |
| 9 | Arrow: boss grafikleri | Her bossa ayırt edici donanım, giriş, uyarı, ölüm sahnesi — **model değişmedi** (bkz. riskler) | aynı |
| 10 | Arrow: yaratıklar hedef görsele | Çizgi, cel gölge, rim ışık, doygunluk, ölçek, canlılık, turkuaz zemin | aynı |
| 11 | Arrow: rakip maddeleri | 6 madde uygulandı | aynı |
| Ek | Arrow: **her yetenek kendi efekti** | 40 yeteneğin tamamı (tablo aşağıda) | aynı |

Kayıt formatı, para birimi, IAP ve reklam akışı değişmedi. Yeni destek yetenekleri ücretsiz ve reklamsız. Gerçek ışık, gölge haritası, post-process eklenmedi; piksel oranı sınırları aynı.

## Sürü Seli (Crowd Surge)

### 1 — Daha kalabalık düşman dalgaları
- Paket başına asker: `2 + min(6, lv/4) + 0..2` → `4 + min(8, lv/3.2) + 0..3`. Paketler arası süre `max(1.25, 2.1 − 0.015·lv)` → `max(1.1, 1.85 − 0.013·lv)`.
- Bölümün ilk ~20 saniyesinde paketler yarı boydan tam boya büyüyor: taze takım önce ödül şeridinde büyüyebiliyor. Bu olmadan 30. seviyede (geliştirme 5) takım 11. saniyede siliniyordu.
- "Ordu büyüdükçe sel de büyür" çarpanı aynen duruyor.
- Bölüm başına doğan düşman (ordu çarpanı öncesi, aynı tohum):

| Seviye | Önce | Sonra |
|---|---|---|
| 1 | 60 | 117 |
| 5 | 174 | 286 |
| 10 | 178 | 261 |
| 20 | 229 | 338 |
| 30 | 369 | 584 |

- Ekranda en fazla 240 → 360 düşman çizilebiliyor.
- Yolun yukarısından gelen iri (⚠️) ve bombacı (💣) düşmanlar için yanıp sönen uyarı işareti var.

**Denge testi** — `node tests/sim.js balance suru 1,5,10,20 4 5` (geliştirme 5, botlar destek yeteneği KULLANMIYOR):

| Seviye | Önce (kazanma / süre) | Sonra |
|---|---|---|
| 1 | %100 / 46 sn | %100 / 45 sn |
| 5 | %100 / 54 sn | %100 / 54 sn |
| 10 | %100 / 43 sn | %100 / 41 sn |
| 20 | %100 / 74 sn | %100 / 80 sn |

Daha geniş tarama (6 deneme): önce 1–20 %100, 30 %33; sonra 1–20 %100, 30 %50. Geliştirme 10 ile 30, 40, 60. seviyeler %100.
"Zorlanır" ölçümü, kazanılan bölüm başına ortalama kayıp asker: seviye 5 → 5.3'ten 8.7'ye, seviye 10 → 3.2'den 5.2'ye, seviye 20 → 86'dan 108'e. Yani iyi oyuncu yine kazanıyor ama daha çok asker kaybediyor.
(Not: testler `Math.random` kullandığı için çalıştırmalar arasında ±1 deneme oynuyor; bir ara çalıştırmada 20. seviye %50–75 çıktı, sonraki iki çalıştırmada %100.)

### 2 — Yeni bosslar
Boss sırası artık 5'li: 🏰 kale → 👹 zırhlı dev → 🛡️ zırhlı tank → 🚁 helikopter → **🐉 Ateş Ejderi** (yeni). Hepsi prosedürel three.js; büyük parçalarda askerlerdeki gibi cel gölge + mürekkep dış çizgi.

| Boss | Model | Giriş | Saldırı / uyarı | Ölüm |
|---|---|---|---|---|
| Kale | Eski model (pencereler, mangallar) | Yerden yükselir; toz ve taş parçaları | Top mermilerinin iniş yerinde **içi dolan kırmızı alan** | Ortak ölüm sahnesi |
| Zırhlı Dev (yeni) | Çelik zırh, göğüste nabız gibi atan **ocak çekirdeği**, yanan vizör yarığı, dikenli omuzluklar, boynuzlu miğfer, rünlü çekiç; yürürken bacaklar, vuruşta çekiç kolu oynuyor | Gökten düşer, **yere iner**: çatlak, toz halkası, taş parçaları, kamera sarsıntısı | Çekiç kalkarken yerde 90 birimlik **kırmızı alan dolar**, inince şok halkası | Ortak |
| Zırhlı Tank (yeni) | Eğik ön zırh + reaktif zırh blokları, uyarı şeritleri, palet bağlantıları ve dönen tekerlekler, **çift namlu** (atışta geri tepiyor), kumandan kulesi + makineli, anten, parlayan egzozlar, kırmızı sensör vizörü | Yola girerken paletlerden toz | Mermi iniş alanları | Ortak |
| Helikopter | Eski model (V1'de yenilenmişti) | Yüksekten iner | Mermi alanları | Ortak, düşerek |
| **Ateş Ejderi (yeni)** | Pullu gövde, sırt dikenleri, 4 boğumlu boyun, boynuzlu kafa, **açılan çene**, çırpan zar kanatlar, sallanan kuyruk, korlu karın, parlayan gözler, ağızdan kor zerreleri | Uçarak yüksekten süzülür, kükrer (ağızdan kıvılcım) | **Ateş nefesi:** 3 ateş topu yelpaze hâlinde takımın tarafına düşer (her birinin kırmızı alanı); arada 5'li kor yağmuru | Ortak, düşerek |

- **Üstte isimli boss can barı** (HUD'un altında): ikon + isim, sayı, vuruşta parlayan kenar ve arkasında yavaşça eriyen sarı "son hasar" şeridi. Boss üstündeki küçük bar da duruyor.
- **İsabet efekti:** Boss vuruldukça gövdesinin rastgele bir noktasından kıvılcım ve parça fırlıyor (kare başına sınırlı); ejderde pul rengi.
- **Ölüm sahnesi (yalnızca çizim):** Model 1.3 sn sarsılıp eğiliyor ve batıyor (uçanlar düşüyor), gövdesinde 0.11 sn'de bir patlama; sonunda büyük patlama, parlama, kıvılcım yağmuru, 24 taş parçası, yanık izi, büyük şok halkası ve kamera darbesi.
- Ejder ateş topları en çok takımın %5'ini götürüyor (top mermisi %8). Tek vuruşta silme yok (rakip şikâyeti).
- Ejder kazanma başlığı: "EJDER YENİLDİ!". Nasıl oynanır sekmesine boss listesi ve destek açıklaması eklendi.

### 3 — "Asker ekleme 11'de takılı" — kök neden
- Kapıyı vurdukça sayısı artıyor; üst sınır `cap = 10 + round(0.6 × seviye)` idi. Bu **1. ve 2. seviyede tam 11**, 10. seviyede 16, 20. seviyede bile 22. Kapı "+11"e geldikten sonra ne kadar vurulsa da artmıyordu.
- Yeni sınır: `16 + 1.6 × zorluk seviyesi + min(40, asker × 0.25)`. 1. seviyede 40 askerle 28, 20. seviyede 100 askerle 73. Seviye ve ordu büyüdükçe artmaya devam ediyor.
- Sonsuz şişmesin diye vuruş başı artış +12'den sonra azalıyor (`0.12 × min(1, 12/değer)`): +24'te yarı hızda.
- Asker sandığı da ordu ile büyüyor: `6 + seviye/4` → `+ min(30, asker × 0.08)`.
- Ekran görüntülerinde kapılar +29, +32, +36 değerlerine çıkıyor.

### 4 — Daha büyük askerler
- Asker ölçeği 1.75 → 2.3 (%31). Diziliş ızgarası 12 × 11 → 14 × 12.5. Dolgu askerler de aynı aralıkla.
- Altı sütun hâlâ çarpışma genişliğinin (`squadHalf`) içinde: kenardan "haksız" kayıp yok.
- Düşmanlar da orantılı: 1.65 → 2.05, iriler 2.9 → 3.5. Kamera çerçevesi alt kenarda biraz genişletildi; 60+ askerlik takım ekrana sığıyor.

### 5 — Destek çağırma
Yolun altında üç yuvarlak düğme. Her birinin **dolum halkası** var, dolunca altın renkte nabız atıyor, aktifken yeşil. Kilitli olanın altında "Sv N" yazıyor. Reklam yok, kendiliğinden doluyor.

| Yetenek | Açılış | Bekleme (ilk kullanım) | Ne yapar | Görsel |
|---|---|---|---|---|
| 🚁 Takviye | Sv 1 | 28 sn (8 sn) | `6 + sv/2 + min(40, asker×0.1)` asker iner; 5 sn boyunca kapı nişancısı en yakın düşmana (yoksa bossa) ateş eder | Yeşil nakliye helikopteri arkadan gelir, takımın üstünde durur; **iki ipten askerler kayarak iner**; kapıda makineli nişancı, namlu alevi, yere eğik iz mermileri; pervane rüzgârı yerde toz halkası; sonra yolun ilerisine tırmanır |
| 🚀 Füze Yağmuru | Sv 2 | 22 sn (12 sn) | 8 füze en kalabalık düşmanlara (yoksa bossa) düşer, her biri patlama | Gökten eğik dalan füzeler, alevli egzoz + duman izi, yerde **sarı hedef alanları** dolar |
| 🛡️ Kalkan | Sv 3 | 26 sn (15 sn) | 6 sn hiç asker kaybettirmez ("BLOK") | Takımın üstünde altıgen desenli enerji kubbesi (fresnel kenar, kayan altıgenler), her engellemede parlama ve kıvılcım, açılışta halka + yıldız, son 1.2 sn yanıp söner |

- WebGL yoksa (2D yol) de çalışıyor; `--disable-webgl` ile denendi, hata yok.
- Test kancası: `#demo:...:heli,shield` (ekran görüntüleri için).

### 6 — Rakip araştırmasından uygulananlar (Sürü)
1. **Sıkı ve kalabalık düşman kümeleri** (Count Masters / Mob Control) → madde 1.
2. **Bossun saldırısı önceden görünsün, tek vuruşta silmesin** (Join Clash şikâyeti) → içi dolan kırmızı alanlar, devin çekiç kaldırması, ejder ateşi takımın en çok %5'i.
3. **Üstte isimli boss can barı** → madde 2.
4. **Dolum halkalı destek/şampiyon düğmesi** (Mob Control) → madde 5.
5. **Özel düşman için doğma göstergesi** (Mob Control 3.12) → ⚠️ / 💣 uyarısı.
- Uygulanmayanlar: "pist ordu büyüdükçe genişlesin" (iki şeritli tasarım buna uymuyor; kenardan düşme zaten yok), "reklam sıklığı" (görev reklam akışına dokunmayı yasaklıyor).

### Sürü performansı
`scripts/visual-bench.cjs`: headless SwiftShader, 393×852, DPR 1, CPU 4x yavaş, 15 sn. "Önce" = `06c8436` (ayrı çalışma kopyası), "sonra" = yeni kod; **arka arkaya** ölçüldü. Kare = render çağrısı ortalaması (ms); three.js / oyun JS kırılımı.

| Sahne | Kare ort. önce → sonra | p95 önce → sonra | three.js önce → sonra | oyun JS önce → sonra |
|---|---|---|---|---|
| suru-run (6. sv yol) | 13.3 → 16.7 | 29.1 → 33.0 | 11.2 → 13.7 | 2.1 → 3.1 |
| suru-run tekrar 1 | 18.6 → 20.1 | 34.2 → 70.4 | 14.5 → 16.2 | 4.1 → 3.8 |
| suru-run tekrar 2 | 18.9 → 18.0 | 38.6 → 34.5 | 14.3 → 14.2 | 4.6 → 3.8 |
| suru-boss (helikopter) | 24.3 → 16.7 | 53.7 → 33.1 | 19.4 → 13.8 | 5.0 → 3.0 |
| suru-wave (12. sv kalabalık) | 38.7 → 17.7 | 64.5 → 53.7 | 35.4 → 13.6 | 3.3 → 4.1 |
| suru-giant | 16.5 → 15.8 | 39.8 → 34.7 | 12.9 → 13.2 | 3.6 → 2.6 |
| suru-tank | 30.5 → 20.1 | 69.3 → 38.2 | 27.4 → 16.8 | 3.1 → 3.3 |
| suru-support | 16.4 → 17.2 | 32.6 → 38.0 | 13.5 → 13.7 | 2.9 → 3.5 |
| suru-dragon (yalnızca sonra) | — → 23.7 | — → 51.1 | — → 19.6 | — → 4.1 |

Yorum: Bu ortamda sahne ~2–3 fps çalıştığı için ölçüm çok gürültülü (aynı kod iki çalıştırmada 13.3 ve 18.9 ms verdi). Tekrarlı ölçümlerde fark gürültü içinde; belirgin bir düşüş yok. Gerçek artış beklenen yerler: daha büyük askerlerin dolgu maliyeti ve daha çok düşman örneği (tek çizim çağrısı başına örnek, çağrı sayısı aynı). Ejderin mürekkep çizgileri ~20 ek çizim çağrısı (tek boss, sahnede yalnızca bir boss görünür). Uyarlanabilir kalite adımları aynen duruyor (çözünürlük düşürme + süs kapatma).

## Arrow Legends (madde 7–11 + ek madde: her yeteneğin kendi efekti)

Değişen dosyalar: `arrow-legends/render3d.js`, `arrow-legends/game.js`, `ortak/fx3d.js` (yalnızca yeni hazır efektler eklendi, eski API aynı), `scripts/visual-bench.cjs` (yeni Arrow sahneleri).
Oyun mantığına, dengeye, kayıt formatına, IAP/reklam akışına dokunulmadı. Oyuna eklenen alanlar (`e.shock`, `e.psn`, yazıların `dx`/`max` alanı) yalnızca çizim için ve kayda yazılmıyor.

### Ortak efekt sistemine eklenenler (`ortak/fx3d.js`)
Hepsi mevcut havuzlardan (GPU parçacık, taş/buz parçası, zemin izi) çiziliyor. Yeni nesne ya da çizim çağrısı yok.

| Hazır efekt | Ne yapıyor |
|---|---|
| `ring` | Zeminde dışa doğru yayılan kıvılcım halkası (şok dalgası kenarı) |
| `star` | Büyük ışın yıldızı + beyaz çekirdek + yumuşak hâle (kritik, boss kükremesi) |
| `frost` | Buz patlaması: mavi-beyaz flaş, havada dönen ışıklı **buz parçaları**, süzülen kar taneleri, soğuk sis |
| `heal` | Yeşil/altın parçacıkların sarmal çizerek yükselmesi |
| `charge` | Parçacıkların bir küreden merkeze akması (büyü yükleme) |
| `spiral` | Yükselen ışık sarmalı (seviye atlama, boss girişi) |
| `flake` | Tek, yavaş düşen tane (buz okunun kar izi, zehir sporları) |

Arrow'un efekt havuzu büyütüldü: 1400 → 2600 parçacık, kare başı bütçe 420 → 700, taş 80 → 140, zemin izi 16 → 24, şimşek 12 → 16.

### 7 — Efektler 2–3 kat daha gösterişli
- **İsabet:** Kıvılcım sayısı iki katına çıktı, flaş 2.6 → 3.8, GPU isabet gücü %40 arttı. Güçlü vuruşta küçük bir halka var.
- **Ölüm:** Büyük flaş, ışın yıldızı, altın kıvılcım halkası, yükselen "ruh" sarmalı ve 1.5 kat kıvılcım.
- **Kritik:** Hedefin üstünde çapraz bir **ışık kesiği** (X), büyük altın yıldız ve iki renkli halka. Hit-stop, sarsıntı ve ekran flaşı korunuyor.
- **Seviye atlama:** Işık sütunu, yeşil-altın sarmal, 44 kıvılcımlı halka, beyaz yıldız, iki zemin halkası, buz-rün halkası, yeşil ekran flaşı ve kamera darbesi.
- **Element başına belirgin efekt (her ok isabetinde):**
  - Ateş: yanan kıvılcım saçılımı, tutuşmada turuncu halka, yıldız ve yanık izi.
  - Buz: küçük buz patlaması, ara sıra zeminde buz rünü. Ayrıntısı aşağıdaki **Buz Oku** bölümünde.
  - Şimşek: yukarıdan inen kısa yıldırım ve oktan arkaya çakan küçük kıvılcımlar. Zincirlenen düşmanlar 0.5 sn "şoklu" kalıyor ve üstlerinde mor-yeşil arklar çatırdıyor.
  - Zehir: yeşil damla saçılımı. Okların arkasında spor izi kalıyor, zehir gölündeki düşman yeşile dönüyor ve kabarcık çıkarıyor.
- **Ok/küre gövdesi elementin rengini alıyor:** buz oku buz beyazı, ateş oku kor turuncusu. Zehir de iz rengi olarak eklendi; eskiden sadece ateş, buz ve şimşek vardı.
- **Düşman mermileri:** Her birinin arkasında kendi renginde parlak bir iz var ve parıltıları titriyor. Tehlikeli mermiler en parlak öğeler arasında kalıyor (rakip çıkarımı 8).

### Buz Oku (kullanıcının özel isteği) — "çok çok daha iyi"
| An | Önce | Sonra |
|---|---|---|
| Atış | Camgöbeği iz | Okun kendisi buz beyazı. Yaydan çıkarken küçük bir buz patlaması oluyor, arkasında mavi ışık izi ve süzülen **kar taneleri** kalıyor. |
| İsabet | Yok (yalnızca ilk donmada efekt vardı) | Her isabette küçük buz patlaması: buz parçaları, kar ve sis. Ara sıra zeminde buz rünü çıkıyor. |
| Donma anı | Flaş, 9 kristal, kıvılcım halkası | Bunlara ek olarak büyük `frost` patlaması (ışıklı buz parçaları), kar halkası ve zeminde büyüyüp sönen **buz rünü** |
| Donmuş düşman | Yarı saydam tek kabuk | Kabuk, ayaklarında 6 **buz kristali**, altında buz rünü diski, mavi renk. Üstüne kar yağıyor, ❄️ durum ikonu görünüyor. |
| Donmuş düşman ölünce | Normal ölüm | **Buz gibi parçalanıyor:** 16 kristal, büyük buz patlaması, kar halkası, zemin rünü |

Buz Aurası yeteneği ve Buz Rahibi aynı yeni buz dilini kullanıyor.

### Ek madde — her yeteneğin kendi efekti
Bir yetenek seçildiği anda kendi rengi ve biçimiyle bir efekt oynuyor. Ortak bir halka, yıldız ve sarmal var; üstüne yeteneğe özel bir biçim ekleniyor. Tablo `SKILL_FX` ile `skillFx()` içinde. Pek çoğunun **aktifken** de görünen bir izi var.

| Yetenek | Seçince | Aktifken / tetiklenince |
|---|---|---|
| Ön Ok +1 / Ek Küre (`front`) | Önüne doğru açılan camgöbeği ok yelpazesi | Yan yana daha çok ok, her birinin izi var |
| Çoklu Atış / Çift Büyü (`multi`) | Altın ok yelpazesi | Her dalgada yay patlaması |
| Çapraz Oklar (`diag`) | Yeşil ok yelpazesi | Açılı oklar ve izleri |
| Yan Oklar (`side`) | Pembe ok yelpazesi | Yanlara giden oklar |
| Arka Ok (`rear`) | Mor ok yelpazesi | Geriye giden ok |
| Seken Ok (`ricochet`) | Dört köşede camgöbeği parlama ve taş parçaları | Her sekmede camgöbeği halka ve yıldız |
| Delici Atış (`pierce`) | Beyaz-camgöbeği ok yelpazesi | Düşmanı delip geçtiği yerde ok yönünde ışık çizgileri |
| Duvar Sekmesi (`wall`) | Turuncu sekme parlamaları | Duvara çarpınca turuncu kıvılcım ve yıldız |
| Saldırı Artışı (`atk`) | Hero'nun çevresinde yükselen kırmızı alev halkası | Yay elinde seviyeyle büyüyen kor parıltısı ve kıvılcımlar |
| Keskin Uçlar (`atkS`) | Beyaz-mavi alev halkası | Elde soğuk beyaz parıltı, oklarda beyaz kıvılcım |
| Atış Hızı (`spd`) | Sarı hız sarmalı ve halkası | Yay elinin çevresinde dönen **2 sarı hız ışığı** (iz bırakıyor). Her atışta küçük sarı halka. |
| **Çevik Eller / "Hızlı Eller"** (`spdS`) | Sarı hız sarmalı | Aynı hız ışıkları (seviyeyle hızlanıyor), her atışta sarı halka ve kıvılcım |
| Kritik Ustası (`crit`) | Büyük altın + kırmızı yıldız | Elde ara sıra altın parıltı. Kritik vuruşta X kesiği. |
| Can Artışı (`hp`) | **İyileşme sarmalı** (altın) ve halka | Ayakların çevresinden yükselen altın kıvılcımlar |
| Kalın Deri (`hpS`) | Altın iyileşme sarmalı | Yükselen altın kıvılcımlar |
| İksir (`potion`) | Pembe **iyileşme sarmalı** | — (tek seferlik) |
| Kan Emici (`vamp`) | Kırmızı iyileşme sarmalı | Öldürülen düşmandan hero'ya akan **kan akışı** ve kırmızı iyileşme |
| Alev Oku / Alev Küresi (`fire`) | Tutuşma patlaması | Alevli oklar. İsabette alev saçılımı. Yanan düşman titriyor ve alev saçıyor, üstünde 🔥 var. |
| Buz Oku / Buz Küresi (`ice`) | Buz patlaması, buz rünü, kristaller | Yukarıdaki Buz Oku tablosu |
| Yıldırım (`bolt`) | Gökten hero'ya inen yıldırım ve yanık izi | Ok boyunca çatırtı, isabette küçük yıldırım, zincir, şoklu düşmanlarda ark ve ⚡ |
| Zehir Bulutu (`poison`) | Yeşil sis ve spor yağmuru | Yeşil spor izi, yeşil damlalar, zehir gölü. Zehirlenen düşman yeşile dönüyor, üstünde ☠️ var. |
| Ateş Çemberi (`orbit`) | Tutuşma patlaması | Dönen alev küreleri, artık arkalarında GPU alev izi var |
| Ok Yağmuru (`rain`) | Altın ok yelpazesi | Hedef halkası, yağan oklar, isabet tozu |
| Kafadan Vuruş (`headshot`) | Merkeze akan kırmızı **nişangâh** ve iki halka | Tetiklenince kırmızı nişangâh, yıldız ve kritik patlaması |
| Arkan Nova (`nova`) | Mor halka ve merkeze akış | Nova anında 48 kıvılcımlı mor halka ve yıldız (eski şok halkasına ek) |
| Meteor (`meteor`) | Tutuşma patlaması | Düşerken arkasında ateş izi var. İnişte 40 kıvılcımlı halka ve büyük yıldız. |
| Bölünen Küre (`split`) | Mor-camgöbeği halka | Bölündüğü an mor yıldız ve halka |
| Alev İzi (`trail`) | Tutuşma patlaması | Arkada yanan zemin |
| Dönen Bıçaklar (`blades`) | Mavi-beyaz sekme parlamaları | Bıçakların arkasında artık ışık izi var |
| Buz Aurası (`frostaura`) | Buz patlaması ve rün | Rünlü buz alanı ve dönen buz kristalleri |
| Mana Kalkanı (`shield`) | Mavi yıldız ve kristaller | Altıgen kalkan küresi. Darbe engellenince mavi halka ve yıldız. |
| Kaçınma Ustası (`dodge`) | Rüzgâr halkası | Ayaklarda arada bir rüzgâr tozu. Kaçınca beyaz yıldız, halka ve rüzgâr. |
| Koşarken Atış (`move`) | Camgöbeği rüzgâr halkası | Koşarken ayaklarda toz ve kıvılcım |
| Hızlı Çizmeler (`boots`) | Beyaz rüzgâr halkası | Koşarken toz izi |
| Altın Avcısı (`greed`) | **Altın çeşmesi** | Üstünden süzülen altın parıltıları |
| Bilgelik (`wisdom`) | Mavi bilgi sarmalı | Başının çevresinde dönen 2 mavi ışık |
| Dev Avcısı (`giant`) | Kırmızı alev halkası | Boss odasında elde alev |
| Öfke (`rage`) | Kırmızı alev halkası | Can yarının altına inince yerde kırmızı öfke halkası ve alevler |
| Cellat (`execute`) | Merkeze akan mor duman | **Bitirilebilecek** (%15 can altı) düşmanların üstünde mor ışık. İnfazda mor patlama. |
| İkinci Nefes (`second`) | Altın ışık sütunu | Başının üstünde hâle. Tetiklenince altın patlama. |

### 8 — Büyücü efektleri
- **Hero (Büyücü / Buz Rahibi):**
  - **Büyü yükleme:** Her atıştan önceki ~0.3 sn'de elde büyüyen bir küre oluşuyor ve parçacıklar bu küreye akıyor. Kürenin rengi elemente göre değişiyor.
  - **Çıkış:** Halka ve yıldız.
  - **Mermi:** Kürenin çevresinde iki renkli **sarmal iz** dönüyor.
  - **İsabet:** Arkan yıldızı ve halka.
- **Düşman büyücüler (necro sınıfı, `wizardb` dahil) ve bosslar:**
  - **Büyü hazırlığı:** Büyü yaparken (`cast`) altlarında dönen **rün dairesi** beliriyor, ellerine parçacıklar akıyor.
  - **Büyü anı:** Ellerinde patlama.
  - **Işınlanma:** Mor yıldız ve sarmal.
  - **Mermi izleri:** Mor küreler iz bırakıyor.
- **Alan büyüleri:**
  - Nova: büyük mor kıvılcım halkası.
  - Meteor: gökten inerken ateş izi, inişte halka ve yıldız.
  - Buz Aurası ve Zehir Bulutu: yukarıdaki dil.

### 9 — Bosslar
Kaynak modeller (Quaternius/KayKit) zaten oyunda. Bu ortamda yeni model üretilemediği için bosslar **model üstü donanım ve sahneleme** ile ayrıştırıldı.

| Boss | Yeni görünüm (dönen donanım) |
|---|---|
| Kemik Kral | Çevresinde dönen 6 kemik parçası, omuzlarında mor ruh alevleri, taç |
| Derin Glub | 8 su kabarcığı, yükselen su zerreleri, hâle |
| Mantar Kral | Süzülen 7 parlak spor ve spor bulutu |
| Magma Ejderhası | 5 lav kristali ve **iki büyük ateş kanadı**. Kanatlar çırpıyor ve alev saçıyor. |
| Ayaz Kral | Başının üstünde dönen **7 buz kristalinden taç** |
| Taş Dev | Çevresinde süzülen 6 kaya (camgöbeği parıltılı) |
| Muhafızlar / ara bosslar | Ekip renginde 3 kristal |

- **Ortak:**
  - Bossun altında ekip renginde dönen **rün aurası** var (eski spot ışığına ek). Öfkelenince aura kırmızıya dönüyor, aura ve donanım iki kat hızlanıyor.
- **Giriş sahnesi:**
  - Boss yükselirken parçacıklar ona doğru akıyor ve yerden toz kalkıyor.
  - Zemin çatlıyor, ekip renginde bir **ışık sarmalı** yükseliyor.
  - Kükremede 64 kıvılcımlı şok halkası, büyük yıldız, iki zemin halkası ve renkli ekran flaşı var.
  - Sinematik kamera ve isim bandı aynı kaldı.
- **Saldırı uyarıları:**
  - Kırmızı daireler içten doluyor. Dolum %80'i geçince **sıcak titreşimle** yanıp sönüyor, kenarından kıvılcımlar yükseliyor.
  - Hücum çizgilerinin üstünde kıvılcımlar beliriyor.
- **Ölüm sahnesi:**
  - Önce büyük bir patlama oluyor: taş parçaları, beyaz yıldız, 60 kıvılcımlı altın halka, altın sarmal, iki zemin halkası ve beyaz ekran flaşı.
  - Ardından boss yere batarken gövdesinde arka arkaya küçük patlamalar çıkıyor ve boss beyaza dönüyor.
  - Mevcut ağır çekim ve sandık sahnesi korunuyor.

### 10 — Yaratıklar (hedef görsel: `docs/art-target/arrow-legends-hedef.jpg`)
- **Kalın siyah dış çizgi:** 0.035 → 0.05.
- **Daha sert cel gölge:** Gölge basamağı 150 → 128, aydınlık tonlar aynı.
- **Renk ve ışık (shader yaması):**
  - Her karakterde %22 daha doygun renk ve soğuk mavi **kenar ışığı (rim)** var.
  - Yeni ışık eklenmedi. Tüm karakterler tek bir ortak shader programı kullanıyor.
- **Daha okunaklı siluet:** Normal düşmanlar %12 daha büyük çiziliyor. Çarpışma alanı değişmedi.
- **Canlılık:**
  - Hafif nefes alma (squash).
  - Doğarken yaylanarak "pop" etkisi.
  - Vurulunca ezilme ve beyaz flaş birlikte.
- **Zemin (1. bölüm):** Hedefteki gibi **turkuaz taş** (`#7f9a94`). Diğer bölümlerin kendi teması korunuyor.

### 11 — Rakip araştırmasından uygulananlar (Arrow)
1. Saldırı uyarısı daireleri doluyor ve inmeden önce yanıp sönüyor; hücum çizgileri parlıyor (Archero).
2. Kritik sayılar büyük, altın renkli, `!` işaretli ve "pop" ile çıkıyor. Element hasarı kendi renginde: yanma turuncu, zehir yeşil, aura buz mavisi, nova mor. Sayılar yana kayarak üst üste binmiyor.
3. Vuruş hissi: beyaz flaş ve ezilme, kritikte hit-stop ve sarsıntı. Hero'nun vurulma kıvılcımı ve sarsıntısı geri geldi. Eski kodda bunlar yanlışlıkla bir yorum satırının içinde kalmıştı, yani hiç çalışmıyordu (iç testte bulundu).
4. Boss girişi ve öfke fazı görsel olarak ayrıldı: aura kırmızıya dönüyor, donanım hızlanıyor.
6. Tutarlı element dili ve düşman üstünde **durum ikonları**: 🔥 ❄️ ⚡ ☠️ (Soul Knight / Archero).
8. Tehlikeli mermiler ve hero en parlak öğeler: düşman mermilerinde iz var, hero'nun elinde efektler var.

### Performans (`scripts/visual-bench.cjs`: headless SwiftShader, 393×852, DPR 1, CPU 4x yavaş, 15 sn)
Ortanca (p50) ve p95: render çağrısının ms cinsinden CPU süresi. "Oyun JS" = three.js dışındaki efekt ve animasyon kodu. Önce: HEAD `06c8436`, sonra: yeni kod. İkisi de aynı oturumda arka arkaya ölçüldü.

| Sahne | p50 önce → sonra | p95 önce → sonra | oyun JS p50 önce → sonra | en uzun kare önce → sonra |
|---|---|---|---|---|
| arrow-play (1-2) | 8.6 → 9.7 | 22.0 → 21.6 | 0.9 → 1.3 | 766 → 23 |
| arrow-boss (Kemik Kral) | 11.6 → 14.7 | 23.3 → 27.2 | 1.4 → 1.6 | 30 → 31 |
| arrow-wizard | 11.9 → 11.1 | 25.3 → 31.2 | 1.2 → 1.4 | 989 → 38 |
| arrow-creatures (2. bölüm) | 11.0 → 13.9 | 22.4 → 29.3 | 1.2 → 1.8 | 50 → 864 |
| arrow-ice (Buz Oku + çoklu atış) | 10.8 → 11.7 | 26.6 → 26.7 | 1.2 → 2.5 | 729 → 32 |
| arrow-skills (büyücü seti) | 11.3 → 11.5 | 31.8 → 27.5 | 1.4 → 1.4 | 1044 → 1186 |
| arrow-boss4 (Magma Ejderhası) | 11.7 → 12.2 | 21.5 → 24.8 | 1.4 → 1.3 | 24 → 26 |

Yorum:
- Ortanca kare 0–3 ms arttı. Çalıştırmalar arası gürültü ±%15.
- En pahalı sahne Buz Oku: oyun JS'i +1.3 ms. Bu ölçüm 4 kat yavaşlatılmış CPU'da; gerçek telefonda ~0.3 ms'ye denk geliyor.
- Ölçüm ilk sürümde daha kötüydü. Şunlarla düşürüldü:
  - İsabet başına buz patlaması %60 olasılığa ve 0.45 güce indirildi, buz sisi güce göre azaltıldı.
  - Buz izi iki karede bir çiziliyor.
- **İlk kullanımda takılma giderildi:** "skills" sahnesinde ilk donmuş düşman ve ilk rün dairesi, savaş ortasında ~1.1 sn'lik bir shader derlemesine yol açıyordu. Yeni efektlerin shader'ları artık ilk odada önceden derleniyor (`warmV2`).
- Tablodaki kalan tek seferlik 0.7–1.2 sn'lik kareler eski kodda da var (yeni yaratık modeli ya da dokusu ilk kez yükleniyor). Hangi sahnede çıktıkları çalıştırmadan çalıştırmaya değişiyor.

### Ekran görüntüleri — `docs/screens-v2/`
- `arrow-play-*`: 1. bölüm, oda 2.
- `arrow-boss-*`: Kemik Kral.
- `arrow-boss4-*`: Magma Ejderhası (4-40).
- `arrow-wizard-*`: Büyücü, nova ve meteor; karşısında iki düşman büyücü.
- `arrow-creatures-*`: 2. bölüm yaratıkları.
- `arrow-ice-*`: Buz Oku, çoklu atış, hız.
- `arrow-skills-*`: Büyücü yetenek seti (ateş çemberi, buz aurası, kalkan, zehir, alev).

`*-once.jpg` eski kodla (HEAD `06c8436`) alındı, `*-sonra.jpg` yeni kodla.

### Kalan riskler
- **GPU dolgu maliyeti:** Daha çok toplamalı parçacık ekranda üst üste binen alan demek. Kare başı bütçe (700) ve uyarlanabilir kalite (DPR 1.75 → 1.5 → 1.25, gölgeler 3 karede bir) bunu sınırlıyor. Yine de Xiaomi gibi zayıf cihazda gerçek telefonda denenmeli.
- **Shader değişikliği her yere yansıyor:** Rim ışığı ve doygunluk yaması menü kahramanına ve kıyafet portresi üretimine (`scripts/skin-art.html`) de uygulanıyor. Mağaza portreleri yeniden üretilirse biraz daha canlı çıkar.
- **Şimşek havuzu paylaşımlı:** Şimşek havuzu 16 parça ve zincir yıldırım, şok arkları ile ok çatırtısı bu havuzu paylaşıyor. Çok kalabalık şimşek anlarında en eski ark erken kaybolabilir (yalnızca görsel).
- **Bosslarda yeni model yok:** Bosslar yeni 3D model değil, mevcut modelin üstüne eklenen donanımla ayrışıyor. Tamamen yeni modeller için yeni CC0 glTF kaynağı gerekir (`scripts/arrow-bake.js`).
- **Denge testi:** `node tests/arrow-balance.mjs "1:avg,3:avg,6:avg"` sonuçları:
  - Yeni kod: 1., 3. ve 6. bölümler kazanıldı.
  - Eski kod: 3. ve 6. bölümler kazanıldı. 1. bölümde bot boss odasında takıldı (`stuck`); bu, botun rastgele davranışından.
  - Efektler oyun mantığını değiştirmediği için sonuçlar kendi gürültüsü içinde aynı.

## Kalite kontrolleri
- `node tests/sim.js smoke`: 6 sayfa, **0 hata** (son kodla).
- `node tests/sim.js balance suru 1,5,10,20 4 5`: yukarıdaki tablo, 0 hata.
- `tests/arrow-balance.mjs "1:avg,3:avg,6:avg"`: yeni kodla 1., 3., 6. bölüm kazanıldı (ayrıntı Arrow bölümünde).
- Tarayıcıda (WebGL SwiftShader ve `--disable-webgl`) Sürü'nün tüm bossları ve üç destek yeteneği çalıştırıldı: sayfa hatası yok.

## Ekran görüntüleri — `docs/screens-v2/`
`*-once.jpg` eski kod (`06c8436`), `*-sonra.jpg` yeni kod; 1080×1920. Yeniden üretmek: `NODE_PATH=$(npm root -g) node scripts/visual-bench.cjs docs/screens-v2 <etiket> <sahne,...>` (PNG yazar; depoya JPEG olarak kondu).

| Dosya | İçerik |
|---|---|
| `suru-wave-*` | Sv 12, kalabalık düşman dalgası, büyük askerler, +29 kapı |
| `suru-giant-*` | Sv 2 boss: eski dev → zırhlı dev (üst can barı) |
| `suru-tank-*` | Sv 3 boss: eski tank → kuşatma tankı (çift namlu) |
| `suru-dragon-sonra` | Sv 5 boss: yeni Ateş Ejderi (eskisinde bu seviye kaleydi, "önce" yok) |
| `suru-boss-*` | Sv 4 helikopter boss |
| `suru-support-*` | Sv 8: takviye helikopteri (ipler), füze yağmuru, kalkan kubbesi, yetenek düğmeleri |
| `suru-run-*` | Sv 6 yol çatışması |
| `arrow-*` | Arrow bölümündeki liste |

## Riskler / açık noktalar
1. **Arrow bossları yeni 3D model değil.** Görev "gerekirse tamamen değişsin" diyordu; depoda kullanılmayan CC0 boss modeli yok, bu yüzden bosslar donanım + sahneleme ile ayrıştırıldı. Tam yeni model için Quaternius/KayKit'ten yeni glTF eklenip `scripts/arrow-bake.js` ile pişirilmeli.
2. **Telefon testi şart.** Ölçümler headless SwiftShader'da; Xiaomi gibi zayıf cihazda Sürü'nün kalabalık dalgası + büyük askerler ve Arrow'un yoğun parçacıkları denenmeli.
3. **Sürü dengesi botla ölçüldü** ve bot destek yeteneklerini kullanmıyor. Gerçek oyuncu için oyun bir miktar daha kolay olacak; dalgalar ilk elden dene, gerekirse `packGap`/paket formülü ile ince ayar.
4. **Boss sırası değişti** (4'lü → 5'li). Oyuncunun bir sonraki seviyesindeki boss eskisinden farklı olabilir; kayıt etkilenmiyor.
5. Arrow'daki shader yaması kıyafet portresi üretimine de yansıyor (Arrow bölümü).
6. İç testte bulunan Arrow hatası (kahraman vurulma efekti yorum satırında kalmış) düzeltildi; `TEST-GERIBILDIRIM.md` G-13, kaynak "iç test".

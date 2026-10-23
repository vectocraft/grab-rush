# Görsel yükseltme raporu — Sürü Seli + Arrow Legends

Tarih: 23 Ekim 2026 · Dal: `claude/sweet-galileo-ya9ecj`

Sıra görevdeki gibiydi: önce ortak efekt sistemi, sonra iki oyunun ortamı ve grafikleri, en son Sürü Seli'ndeki tek sıra ateş hatası.
Oyun mantığına, dengeye, ekonomiye ve kayıt formatına dokunulmadı. Tek mantık değişikliği atışların çıkış noktası (madde 3).

## 1. Ortak efekt sistemi — `ortak/fx3d.js` (yeni)

Post-processing ya da bloom yok. Her parıltı, önceden hazırlanmış bir doku ile çizilen toplamalı (additive) bir dörtgen. Bir efekt sırasında hiçbir nesne oluşturulmuyor, her şey havuzdan geliyor.

| Parça | Nasıl çalışıyor | Maliyet |
|---|---|---|
| Parıltı parçacıkları | GPU'da hareket ediyor. Başlangıç konumu, hız, yerçekimi, sürtünme, boyut ve saydamlık ömür boyunca shader'da hesaplanıyor. Yayımlarken birkaç sayı yazılıyor, sonrasında JavaScript işi yok. Kıvılcımlar ekrandaki hızları yönünde uzuyor (iz gibi). | 1 çizim çağrısı, halka tampon |
| Taş parçaları | Küçük, ışıklı katı parçalar. GPU'da dönüp düşüyor, yere inince duruyor. | 1 çizim çağrısı |
| Zemin izleri | Çatlak ve yanık izi. Shader'da kendiliğinden soluyor. | 1 çizim çağrısı |
| Şimşek | Kameraya dönük, zikzak bir şerit. Mordan yeşile renk geçişi var, ortası beyaz, yaşadığı sürece titriyor, kollara ayrılıyor. | Aktif şimşek başına 1 çizim |
| Sarsıntı | "Trauma" modeli: `shake(k)` ile birikiyor, hızla sönüyor. | — |
| Hazır efektler | `muzzle` (namlu/yay patlaması + yelpaze kıvılcım), `trail` (ok/roket izi), `impact` (isabet), `chips` (taş fırlaması), `crack` (çatlak), `explosion`, `bolt`/`chain` (zincir şimşek), `shower` (kıvılcım yağmuru), `mote` (kor/toz), `aura` (rünlü zemin halkası) | — |

- Kare başına parçacık bütçesi var. Aynı karede gelen çok sayıda isabet havuzu taşırmıyor.
- `warm()` her parçayı bir kez görünmez çiziyor. Böylece ilk şimşekte oluşan takılma önleniyor: ölçümde ilk boss atışında 400–600 ms'lik bir kare vardı, bu çağrıdan sonra kayboldu.

## 2. Arrow Legends

- **Efektler (hedef görseldeki gibi):**
  - Her atışta yayın önünde parlak bir patlama ve ileri doğru yelpaze şeklinde kıvılcım.
  - Her okun arkasında renkli ışık izi: varsayılan camgöbeği/pembe, element seçilmişse onun rengi.
  - Zincir şimşek mor→yeşil, kollara ayrılıyor. Eski kodda her şimşek, her parçası için yeni bir Mesh oluşturuyordu; bu da kalktı.
  - İsabette taş parçaları fırlıyor.
  - Ölümde, kritik vuruşta, boss yere vurduğunda ve nova'da zeminde çatlak kalıyor; sarsıntı vurduğu güce göre artıyor. Meteorda tam patlama var.
  - Hasar sayıları zaten vardı, olduğu gibi kaldı.
  - Oyuncunun altında beyaz halka yerine dönen, rünlü, camgöbeği bir aura var.
- **Zindan atmosferi:**
  - Meşale hâleleri büyüdü ve titriyor; meşalelerden kor parçacıkları yükseliyor.
  - Her odanın zemininde nefes alır gibi parlayan 3 rün var. Rengi temaya göre değişiyor: lav turuncu, buz/su camgöbeği, diğerleri camgöbeği/mor.
  - Boss'un altında kırmızı-mor ışık havuzu, üstünde ışık sütunu ve yükselen parçacıklar var. Bunlar için gerçek ışık eklenmedi.
- **Renk paleti:** Zemin soğuk tona çekildi. Gökten gelen ışık daha mavi, arka kenar ışığı (rim) daha güçlü, pozlama 1.02 → 1.1, vinyet daha koyu ve morumsu. Sonuç: sıcak meşale ışığına karşı soğuk taş zemin.

## 3. Sürü Seli

- **HATA — tek sıra ateş (düzeltildi, `suru-seli/game.js`):**
  - Eskiden her yaylımda 12 mermi aynı `y` değerinden, düz bir çizgi üzerinde çıkıyordu.
  - Şimdi atıcılar dizilişin tamamına dağılıyor ve her yaylımda farklı askerler ateş ediyor. Her mermi kendi askerinin yerinden çıkıyor (ön 4 sıra derinliğinde), hafif yanal sapma var.
  - Bu dağılım `Math.random()` kullanmıyor, sabit bir hash ile hesaplanıyor. Böylece simülasyonun rastgele sayı dizisi değişmiyor.
  - Mermi sayısı, hasar ve hız aynı.
  - Denge testinin sonucu (`node tests/sim.js balance suru 1,5,10,20 4 5`):

    | Seviye | Önce | Sonra |
    |---|---|---|
    | 1 | %100 / 46 sn | %100 / 46 sn |
    | 5 | %100 / 54 sn | %100 / 55 sn |
    | 10 | %100 / 44 sn | %100 / 43 sn |
    | 20 | %100 / 73 sn | %100 / 74 sn |
- **Ortam (gece / alacakaranlık):**
  - Gökyüzü lacivertten mora ve pembe ufka geçiyor, yıldızlı.
  - Sis mor. Ay ışığı soğuk, ağaçlar ve tepeler gece tonunda.
  - Lambaların hâlesi ve kaldırımda ışık havuzu var.
  - Şerit kenar ışıkları neon gibi parlıyor. Gece tonu zemin dokusuna gömülü olduğu için şerit ışıksız (MeshBasic) çiziliyor; bu, eskisinden daha ucuz.
- **Kapılar:**
  - Çerçevenin etrafında neon parıltı var: yeşil ödül, kırmızı ceza, altın x2.
  - Kirişler daha parlak, zemin şeridi daha geniş.
  - Sayılar 28 → 40 px ve arkalarında neon hâle var. Hâle `shadowBlur` değil, geniş yarı saydam bir çizgi (telefonda ucuz).
- **Efektler:**
  - Mermiler parlak iz (tracer) olarak çiziliyor: renkli dış parıltı + beyaz çekirdek, çapraz iki dörtgen.
  - Her merminin çıktığı askerde namlu alevi var.
  - İsabette kıvılcım, ara sıra taş parçası.
  - Patlamada parlama, kor, kıvılcım, taş parçaları ve yanık izi var.
  - Roketlerin ateş izi var. Düşman mermileri de kırmızı iz olarak çiziliyor.
  - Eskiden işlemcide tek tek güncellenen kıvılcımlar (`S.parts`, enkaz, kıyafet izi) artık GPU sisteminde.
- **Boss'lar:**
  - **Helikopter:** 1.4 kat büyük. Zırh, parlayan kokpit, iki motor ve sıcak egzozlar, dönen ana ve kuyruk pervanesi, dönen namlulu silah kapsülleri, roket rampaları, yanıp sönen seyir ışıkları. Yolu tarayan bir projektörü ve arkasında mor fırtına parıltısı var. Çevresinde ara sıra mor/yeşil şimşek çakıyor. Atış anında silahta namlu alevi, kıvılcım yağmuru ve kısa şimşek var.
  - **Kale:** Pencereler parlıyor, kapıda ateş mangalları ve korlar var, toplarda namlu alevi ve şimşek var.
  - **Tank:** Namlu freni, ön farlar ve kırmızı sensör şeridi eklendi; atışta namlu alevi ve duman var.
  - **Dev:** Gözleri parlıyor.
- **Kalabalık:** Oyundaki asker sayısı değişmedi. Ekranda, diziliş ızgarasının boşluklarına (altıgen yerleşim) ve 60 askerden sonra arka sıralara en fazla 96 "dolgu" asker ekleniyor. Bunlar dış çizgisiz ve düşük poligonlu, birkaç ucuz çizim çağrısıyla çiziliyor.
- **Uyarlanabilir kalite:** Mevcut adım korundu (yavaşsa çözünürlük 1.5'ten 1'e düşer). Buna bir adım eklendi: çözünürlük 1'de hâlâ kare 25 ms'yi geçiyorsa yalnızca süs olan şeyler kapanıyor. Bunlar dolgu askerler, lamba ışık havuzları ve parçacık bütçesinin yarısı. Oyunu etkileyen görseller (askerler, mermiler, isabetler, kapılar) kalıyor.

## 4. Kısıtlar

- Gölge haritası eklenmedi. Sürü Seli'nde gölge kapalı kaldı; Arrow'un mevcut gölgesi aynı.
- Gerçek ışık eklenmedi, post-process yok.
- Piksel oranı üst sınırları değişmedi: Sürü 1.5, Arrow 1.75.
- WebGL yoksa (`--disable-webgl` ile denendi) iki oyun da 2D yoldan hatasız açılıyor. `Suru3D.init`, `Fx3D` yoksa `null` döndürüyor.
- `node tests/sim.js smoke` geçti: 6 sayfa, 0 hata.

## 5. Performans ölçümleri

Araç: `scripts/visual-bench.cjs`. Headless Chromium, WebGL SwiftShader ile; 393×852 CSS, DPR 1; **CPU 4x yavaşlatılmış**; 15 sn ölçüm.

Tablodaki "kare" sütunu oyunun render çağrısının toplam süresi. Bu süre iki parçadan oluşuyor:

- **three.js:** sahne gezme + WebGL komutları.
- **oyun JS:** efekt ve animasyon kodu.

| Sahne | Kare ort. (ms) önce → sonra | p95 önce → sonra | three.js ort. önce → sonra | oyun JS ort. önce → sonra |
|---|---|---|---|---|
| Sürü Seli — yolda çatışma | 26.0 → 25.2 | 48.6 → 59.6 | 22.1 → 20.8 | 3.9 → 4.4 |
| Sürü Seli — helikopter boss | 28.9 → 26.2 | 59.5 → 55.9 | 24.8 → 20.7 | 4.2 → 5.6 |
| Arrow — normal oda | 13.1 → 12.4 | 24.9 → 22.6 | 10.7 → 10.7 | 2.4 → 1.7 |
| Arrow — boss odası | 14.0 → 16.2 | 26.4 → 34.9 | 12.0 → 13.9 | 2.0 → 2.3 |

GPU'yu ölçmek için ayrı bir test yapıldı. SwiftShader GPU işini de işlemcide yaptığı için, sahne durdurulmuşken ve CPU yavaşlatılmadan alınan kare hızı GPU dolgu maliyeti için yaklaşık bir gösterge veriyor. İki ölçümün ortalaması (DPR 2):

| Sahne | Önce | Sonra |
|---|---|---|
| Sürü — yolda çatışma | ~5.3 fps | ~4.0 fps |
| Sürü — boss | ~5.4 fps | ~4.4 fps |

İlk sürümde bu düşüş ~%35'ti. Şerit zemini ışıksız çizilerek, dolgu askerleri düşük poligonlu yapılarak, parçacık havuzları küçültülerek ve büyük parlayan yüzeyler kısılarak ~%20'ye indirildi.

Ölçümleri yorumlarken:

- Her ölçüm canlı oyunla alındığı için gürültülü; çalıştırmalar arasında ±%15 oynuyor.
- İşlemci tarafı (oyun JS + three.js) önceki seviyede kaldı.
- Ölçülen tek artış, ek parlak yüzeylerin GPU dolgu maliyeti.

## 6. Kalan riskler

1. **Dolgu oranı (fill-rate):** Toplamalı parıltılar, neon hâleler ve lamba havuzları ekranda üst üste binen alan demek. SwiftShader'da sahne ~%20 yavaşladı. Gerçek telefon GPU'ları (Adreno/Mali) bu harmanlamada çok daha hızlı, ama Xiaomi'deki eski takılmayı **gerçek cihazda** denemek gerekiyor. Yavaşlarsa yeni "hafif mod" adımı kendiliğinden devreye giriyor.
2. **İlk kullanımda takılma:** `warm()` şimşek, parçacık, taş ve iz için bunu önlüyor. Başka bir sürücüde yeni bir efekt kombinasyonu ilk kez çizilirken kısa bir takılma yine olabilir.
3. **Dolgu askerler:** Kalabalığı olduğundan büyük gösteriyor, ama etiket gerçek sayıyı yazıyor ve kalabalığın genişliği çarpışma alanını aşmıyor. Kullanıcılar bunu yanıltıcı bulursa `MAX_F` 0 yapılarak kapatılabilir.
4. **Ölçüm ortamı:** Headless SwiftShader telefonu temsil etmiyor. Değerler görece karşılaştırma için.
5. **Arrow hedef palet:** Hedef görseldeki zemin turkuaz. Oyunda bölüm temaları zemin rengini belirlediği için tüm temalara sadece hafif soğuk bir ton uygulandı; tamamen turkuaz zemin her temayı değiştirirdi.

## 7. Ekran görüntüleri — `docs/screens-gorsel/`

`*-once.png` eski hâli, `*-sonra.png` yeni hâli gösteriyor. Hepsi 1080×1920, WebGL SwiftShader ile alındı.

- `suru-run-*`: Seviye 6, yolda çatışma (40 asker, havan ekibi).
- `suru-boss-*`: Seviye 4, helikopter boss.
- `arrow-play-*`: Bölüm 1, 2. oda.
- `arrow-boss-*`: Bölüm 1, 10. oda (Kemik Kral).

Yeniden üretmek için: `NODE_PATH=$(npm root -g) node scripts/visual-bench.cjs docs/screens-gorsel <etiket>`

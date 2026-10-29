# Rapor: Arrow Legends yaratık detayı (G-27, ikinci kısım)

Görev: `docs/GOREV-ARROW-DETAY.md`. Küçültülen yaratıklar (normal 0,6, boss 0,75) telefonda daha net ve "zengin" görünsün.
Yalnızca görsel değişiklik var. Oyun mantığına, dengeye, vuruş alanlarına (`game.js` `r`), reklama, IAP'ye, kayıt biçimine ve diğer 5 oyuna dokunulmadı.

## Ne değişti

### `arrow-legends/render3d.js`
| Satır | Değişiklik |
|---|---|
| 14 | `FOE_K(e)`: yaratık çizim katsayısı tek yerde (normal 0,6, boss 0,75). Eskiden `sync()` içinde sabit olarak yazılıydı. |
| 325–347 | **Yaratık shader'ı (`foeLook`)**. Toon shader'a eklenen tek bir paylaşımlı program (`customProgramCacheKey 'foeLook'`): <br>• renk doygunluğu ×1,38 ve hafif kontrast (soluk görünmüyorlar)<br>• ayak gölgelemesi: gövdenin alt ~%32'si %40'a kadar koyulaşıyor, yaratık zemine oturuyor<br>• iki tonlu kenar ışığı (fresnel); üstten gelen tarafta daha parlak. Normal yaratıkta soğuk mavi, **elitte nabız gibi atan altın**, **bossta ekip rengi** (öfkede kırmızı)<br>• sert toon parlama noktası: koyu ve parlak yüzeylerde (gözler, kabuklar) daha güçlü, **göz parıltısı** etkisi veriyor.<br>Uniform değerleri her yaratığın zaten var olan kendi malzemesinde duruyor. Yeni malzeme klonu, doku ya da çizim çağrısı eklenmedi. |
| 349–350 | Yaratıklar için paylaşımlı ayrı dış çizgi malzemesi: kalınlık 0,05 → 0,038 (nesne birimi), daha soğuk koyu renk. Küçük boyda yüz detayları çizginin altında kaybolmuyor. |
| 353–364 | `charMesh(name, scale, 'foe')`: yaratık shader'ı ve çizgisi; gölge diski 2,6 → 2,3 × çizim ölçeği (ayağa daha sıkı oturuyor); modelin gerçek kafa yüksekliği `userData.hy` olarak saklanıyor. |
| 752 | Elit tacı 2,4 → 1,7 ölçek (küçülen gövdeye göre). |
| 757 (warmV2) | Yaratık shader'ı ilk odada önceden derleniyor, ilk yaratık çıkınca takılma olmuyor. |
| 1244 | `R.top(e)`: yaratığın çizilen kafa yüksekliği (zıplama dahil). Can barı bunu kullanıyor. |
| 1366–1376 | **Yürürken zıplama ve sallanma**: her adımda küçük bir sekme (kafa yüksekliğinin %9'u), inişte basılma, tepede uzama ve yana sallanma (±4°). Yürümeye başlarken ve dururken yumuşak geçiş var. Bosslarda yok, çünkü onların kendi düzeni var. |
| 1381–1384 | Kenar ışığı rengi ve şiddeti her karede ayarlanıyor (elit, boss veya normal). |
| 1401 | Durum efektlerinin yayılımı (yanma alevi, buz kabuğu, zehir, şok) küçülen gövdeye göre ×`FOE_K`. Önceden eski boyuta göre geniş çıkıyordu. |
| 1491–1495 | Elit tacı artık kafanın üstünde, sabit 2,15×boy yerine gerçek kafa yüksekliğinde duruyor (önceden havada asılı kalıyordu). Elit rün halkası 3,2 → 2,5 × r. |

### `arrow-legends/game.js`
| Satır | Değişiklik |
|---|---|
| 1476–1478 | Yaratık can barı, 3D sahnenin söylediği kafa yüksekliğinin hemen üstünde duruyor (elitte tacın üstünde). Önceden eski boyuta göre çok yukarıda kalıyordu. Genişlik 34 → 30 px. WebGL yoksa (2D çizim) eski formül geçerli. |

### `scripts/visual-bench.cjs`
- Yeni `arrow-foes` sahnesi eklendi: 2. bölümde bir oda, kameraya yakın 2 elit. Sahnenin isteğe bağlı `clip` alanıyla yakın çekim ekran görüntüsü de alınıyor.

## Ekran görüntüleri (`docs/screens-arrow-detay/`, 1080×1920; `-once` / `-sonra`)
- `arrow-foes-zoom-*`: yakın çekim. Sonra: canlı renk, göz parıltısı, elitlerde altın kenar ışığı, taç kafada, can barı başın hemen üstünde.
- `arrow-foes-*`, `arrow-creatures-*`, `arrow-play-*`, `arrow-boss-*`: tam ekran.
- Not: odalar rastgele kurulduğu için önce ve sonra karelerindeki yaratık konumları aynı değil.

## Kare süresi (headless Chromium, SwiftShader WebGL, 393×852, CPU 4× yavaşlatılmış, 15 sn)
`node scripts/visual-bench.cjs` ile ölçüldü. "Önce" ölçümü aynı betikle `BENCH_ROOT=<önceki commit>` üzerinde alındı. Değerler 3 ölçümün ortalaması (arrow-boss tek ölçüm), birim ms/kare.

| Sahne | toplam p50 önce → sonra | toplam p95 | çizim p50 | oyun JS p50 |
|---|---|---|---|---|
| arrow-play | 5,67 → 5,90 | 13,73 → 12,20 | 4,67 → 4,77 | 0,93 → 0,87 |
| arrow-creatures | 7,43 → 7,53 | 15,20 → 17,37 | 6,23 → 6,30 | 0,97 → 1,03 |
| arrow-foes | 7,57 → 7,90 | 16,70 → 15,10 | 6,37 → 6,67 | 0,90 → 1,00 |
| arrow-boss | 7,60 → 7,70 | 17,40 → 15,90 | 5,70 → 6,20 | 1,20 → 1,10 |

Fark kare başına +0,1–0,3 ms ve ölçümün gürültü aralığında kalıyor (p95 bazı sahnelerde düştü, bazılarında arttı). Yeni çizim çağrısı, doku veya malzeme klonu eklenmedi, ek maliyet yalnızca birkaç fragment shader satırı. Hiçbir sahnede sayfa hatası çıkmadı. SwiftShader GPU'yu CPU'da taklit ettiği için mutlak fps (~5) telefonu temsil etmez; burada karşılaştırma önemli. Telefonda (Oppo CPH2205) ayrıca denenmeli.

## Kontrol
- `node tests/sim.js smoke`: 6 sayfa, 0 hata.
- `visual-bench` sahneleri arrow-play, arrow-boss, arrow-boss4, arrow-creatures, arrow-foes: 0 sayfa hatası.

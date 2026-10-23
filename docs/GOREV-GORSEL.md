# Görev — Grab Rush görsel yükseltme (Sürü Seli + Arrow Legends)

Kullanıcıyla Türkçe konuş, kod ve commit'ler İngilizce. Bu repo Grab Rush'ın web kaynağı (HTML5 + Three.js, Capacitor ile Android'e paketleniyor; `android/`, keystore ve `www/` bilerek repoda yok). Yeni bir dalda çalış, main'e push yok, force-push yok.

Kullanıcı, YouTube Shorts kapağı için Nano Banana'nın ürettiği görseli çok beğendi ve oyunun grafiklerinin **o hisse** yaklaşmasını istiyor.
- `docs/art-target/suru-seli-simdi.jpg`: oyunun şimdiki hali
- `docs/art-target/suru-seli-hedef.jpg`: hedef his
- `docs/art-target/arrow-legends-simdi.jpg`: Arrow Legends'ın şimdiki hali. Hedef görsel (`arrow-legends-hedef.jpg`) sonradan eklenecek; eklenmediyse aynı dili Arrow Legends'a da uygula.

## ÖNCELİK: önce EFEKTLER, sonra grafikler
Kullanıcı özellikle Arrow Legends hedef görselindeki (`docs/art-target/arrow-legends-hedef.jpg`) **efektleri** çok beğendi: "Grafiklerden önce efektleri bu şekilde yapmak lazım." Sıra şöyle olsun: önce efekt sistemi (her iki oyunda), sonra ortam ve grafik iyileştirmeleri.
Hedef görseldeki efektler:
- Okçudan çıkan **yelpaze şeklinde çoklu ok yaylımı**; her okun parlak, renkli ışık izi var.
- Atış anında yayın önünde **parlak patlama ve kıvılcım saçılması**.
- Düşmanlar arasında zincirlenen **mor-yeşil şimşek** (chain lightning).
- İsabette **taş parçaları fırlıyor, zeminde çatlaklar** oluşuyor, kısa ekran sarsıntısı.
- Düşman üstünde **hasar sayıları** (ör. "19").
- Oyuncunun altında parlayan **aura halkası**.
Efektleri tekrar kullanılabilir bir modülde topla (ör. `ortak/fx3d.js`). Sürü Seli'nde de aynı sistemi kullan: mermi izleri, namlu alevleri, isabet kıvılcımları, şimşek.

## Sürü Seli (`suru-seli/`)
1. Ortam: gece / alacakaranlık teması, koyu mor-lacivert gökyüzü, daha yüksek kontrast, canlı renkler.
2. Kapılar: neon parlayan çerçeveler (yeşil ödül / kırmızı ceza), ışık hâlesi, sayılar daha büyük ve okunaklı.
3. Efektler: mermi izleri (tracer), namlu alevleri, isabet kıvılcımları, patlama ve ateş topları; boss saldırısında kısa şimşek efektleri.
4. Boss helikopteri daha büyük ve detaylı: dönen pervane, ışıklar, namlu alevi. Diğer bosslara da aynı özen.
5. Sürü daha kalabalık ve sık görünsün (instancing ile; mantıktaki sayı değişmeden görsel yoğunluk).
6. **HATA:** Ateşler tek sıra halinde çıkıyor. Atışlar sürünün genişliğine yayılsın; her asker ya da bir grup kendi konumundan ateş etsin, hafif dağılımla bir yaylım ateşi gibi dursun.

## Arrow Legends (`arrow-legends/`)
Zindan atmosferi: meşale ışıkları, parlayan rünler, sis ve toz parçacıkları, düşman vuruşlarında kıvılcım, okçu atışında iz efekti, boss'larda dramatik ışık. Kontrast ve renk paleti hedef görseldeki gibi daha sinematik olsun.

## Kısıtlar
- **Performans kritik:** Sürü Seli daha önce Xiaomi telefonda takıldı. Gerçek post-processing bloom yerine sahte parlama kullan: additive sprite, emissive malzeme, önceden hazırlanmış glow dokuları. Yeni efektler için parçacık havuzu kur. DPR üst sınırını koru, gölge haritası ekleme.
- Oyun mantığına, dengeye, ekonomiye ve kayıt formatına dokunma; sadece görsel ve atış dağılımı hatası.
- WebGL yoksa 2D yedek yol çalışmaya devam etmeli.

## Kalite
- `node tests/sim.js smoke` geçmeli.
- Headless Chrome'da WebGL (SwiftShader) ile önce ve sonra 1080x1920 ekran görüntüleri: `docs/screens-gorsel/`.
- Kare süresini ölç: CPU 4x yavaşlatmada kare başına çizim süresi. Önce ve sonra değerlerini raporla.
- Sonunda `docs/GORSEL-RAPOR.md` (Türkçe): neler değişti, performans ölçümleri, kalan riskler. Commit + push.

# Görev: Arrow Legends yaratıklarını daha detaylı ve güzel göster

Test kullanıcıları (WhatsApp, 29 Eki 2026): "Yaratıklar çok büyük, çok yer kaplıyor; yarı yarıya küçültüp belki detaylarını biraz artırıp daha güzel görünmesini sağlayabilirsiniz."

Küçültme yapıldı (`arrow-legends/render3d.js`, `sync()` içinde normal yaratıklar `VS(scale) * 0.6`, bosslar `0.75`). Vuruş alanları (game.js `r`) değişmedi; DEĞİŞTİRME.

## Yapılacak (yalnızca görsel)
Küçülen yaratıklar telefonda daha net ve "zengin" görünsün:
- Malzeme: yaratık başına daha canlı renk/doku, hafif kenar ışığı (rim light / fresnel), gölgelendirmeyi iyileştir; dış çizgi (outline) kalınlığını yeni boyuta göre ayarla (küçülünce çizgi orantısız kalın kalmasın).
- Küçük detaylar: göz parıltısı, elit/boss için hafif aura veya parıltı; yürürken hafif zıplama/sallanma (squash & stretch) gibi ucuz animasyon.
- Gölge diski ve can barı yeni boyuta uysun.
- Performans: telefonda (orta seviye Android, WebView) fps düşmesin. Yeni geometri/doku eklersen paylaşımlı (instanced/shared) kullan, yaratık başına yeni malzeme klonu oluşturma. Önce/sonra kare süresini ölç (headless Chrome, `tests/arrow-balance.mjs` + `arrow-bot.js` örnek; WebGL için `--use-angle=swiftshader --enable-unsafe-swiftshader`).

## Dokunma
Oyun mantığı, denge, vuruş alanları, reklam (`ortak/ads.js`), IAP, kayıt biçimi, diğer 5 oyun.

## Teslim
- Bu dalda (`arrow-detay`) commit + push.
- `docs/RAPOR-ARROW-DETAY.md`: ne değişti (dosya/satır), önce/sonra ekran görüntüleri (`docs/screens-arrow-detay/`), kare süresi ölçümü.

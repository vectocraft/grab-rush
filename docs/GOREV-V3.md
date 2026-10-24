# GÖREV V3 — Grab Rush'ı daha iyi, daha ilgi çekici yap (grafik + efekt, devam)

V2 (`docs/GORSEL-RAPOR-V2.md`, dal `gorev-v2`) telefonda denendi. Kullanıcı: **efektleri beğendi, optimizasyon çok daha iyi.**
İstek: "Grab Rush için hem grafik hem efekt çalışmasına devam edelim, bunu daha iyi, daha ilgi çekici bir oyun yapalım."
Bu görev `gorev-v3` dalında, v2'nin üstüne yapılır.

Genel kurallar değişmedi (`docs/GOREV-V2.md` başı): telefon performansı (fake bloom, havuz, bütçe, DPR sınırı, `ortak/fx3d.js` yeniden kullan), kayıt geriye uyumlu, IAP/reklam akışına dokunma (yeni özellik reklam izletmeyi zorunlu kılmasın), metinler TR+EN, `android/` ve imza yok.

## Öncelik sırası

### 1 — Sürü Seli (Crowd Surge): daha da çekici
- **Askerler ve düşmanlar:** daha detaylı, okunaklı 3D modeller (KayKit/Kenney/Quaternius CC0 araçları `scripts/` altında; ya da prosedürel), takım rengi net. Koşu animasyonu daha canlı. Kalabalık büyüdükçe görsel olarak "dev ordu" hissi.
- **Kapılar:** çarpma/çoğalma anı çok tatmin edici olsun: kapıdan geçen askerlerin sayısı uçuşan sayılarla, kapıda flaş + ses ile eşleşen kıvılcım; × kapılarında (varsa) büyük patlama efekti.
- **Savaş anı:** iki ordu çarpışınca toz bulutu, kıvılcım, asker sayısı sayaçlarının çarpışması, son askerde yavaşlatılmış (slow-mo) an.
- **Ortam çeşitliliği:** her 10 bölümde değişen tema (gece şehri, çöl, kar, volkan, neon siber…) — gökyüzü, yol, kenar dekorları, ışıklar. Mevcut `ortak/themes.js` ile uyumlu.
- **Boss savaşları:** v2'deki 5 boss'u daha sinematik yap (kamera yaklaşması, boss girişinde yazı, faz değişimi, son vuruşta slow-mo).
- **Bölüm sonu:** kazanma anında ordunun kaleye/hazineye koşması, altın yağmuru, yıldız animasyonu.

### 2 — Arrow Legends: daha da çekici
- **Odalar/zindan:** tema başına daha zengin ortam (dekor, ışık havuzları, sis, düşen yapraklar/kar/kül), oda geçişinde kapı açılma efekti.
- **Kahraman:** daha güzel model/kostüm görünümü, saldırı ve hareket animasyonları daha akıcı, hasar alınca kırmızı flaş + kalkan efekti.
- **Yaratıklar:** v2'deki yeni görünüm üstüne çeşit: elit düşmanlar için aura/taç, ölüm animasyonlarında tür başına farklı efekt (iskelet dağılır, slime patlar, büyücü buharlaşır).
- **Ödül anları:** sandık açma, yetenek seçimi ekranı, seviye atlama — daha görkemli UI efektleri (kart parlaması, nadirlik rengine göre ışık).

### 3 — Uygulama geneli (hub, menüler) — "ilgi çekici" ilk izlenim
- **Ana ekran (hub):** oyun kartları canlı (hafif hareketli önizleme/parıltı), seçilince büyüme, arkaplanda hareketli ortam. İlk açılışta etkileyici giriş.
- **Ortak UI juice:** düğmelere basma hissi (squash), ödül/altın kazanınca altının sayaca uçması, seviye atlama kutlaması, günlük ödül/sandık açılışı (`ortak/fx.js` `Fx.reveal`) daha görkemli.
- **Diğer oyunlar (Obur Delik, Çağlar Savaşı, Altın Ocağı, Koloni):** `ortak/fx3d.js` / `ortak/fx.js` efekt dilini bu oyunlara da taşı (isabet, toplama, patlama, kazanma anı). Grafik yükseltmesi yalnızca ucuz ve belirgin olanlar (ışık, renk paleti, gölge, partikül).

### 4 — Rakiplerden
`docs/RAKIP-ARASTIRMA-V2.md`'deki görsel/efekt maddelerinden henüz uygulanmamış olanları uygula; yeni kısa bir bölüm ekle (hyper-casual hub uygulamaları ve "juicy" oyun hissi örnekleri).

## Kalite
- `node tests/sim.js smoke` hatasız; denge testleri (Sürü: `node tests/sim.js balance suru 1,5,10,20 4 5`; Arrow: `tests/arrow-balance.mjs` varsa) önce/sonra — denge bozulmasın.
- `scripts/visual-bench.cjs` ile kare süresi önce/sonra; performans düşmemeli (düşerse optimize et). Hub ve her oyun için ölçüm.
- Ekran görüntüleri `docs/screens-v3/` (her oyun + hub, önce/sonra).
- `docs/GORSEL-RAPOR-V3.md` (Türkçe): yapılanlar, ölçümler, ekran listesi.
- Küçük, anlamlı commit'ler; bitince push.

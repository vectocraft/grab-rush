# GÖREV V2 — Crowd Surge (Sürü Seli) + Arrow Legends: kullanıcı geri bildirimi

Bu görev `claude/sweet-galileo-ya9ecj` dalındaki görsel yükseltmenin (bkz. `docs/GORSEL-RAPOR.md`) **üstüne** yapılır.
Kullanıcı o sürümü telefonda oynadı: iki oyunun yeni grafikleri ve efektleri **çok beğenildi**. Aşağıdaki maddeler onun notları.
Hepsini yap, sonra kalite kontrollerini çalıştır ve rapor yaz.

Genel kurallar (değişmedi):
- Telefon performansı önemli (Xiaomi'de takılma şikâyeti olmuştu): gerçek ışık/gölge haritası yok, efektler `ortak/fx3d.js` havuzlarıyla, kare başına bütçe korunur, DPR sınırı kalır.
- Kayıt formatı geriye uyumlu kalmalı (eski kayıtlar açılmalı). Para birimi/IAP/reklam akışına dokunma (yeni özellik reklam izletmeyi ZORUNLU kılmamalı).
- `android/`, keystore ve imza dosyaları bu repoda yok; ekleme.
- Kullanıcıya görünen metinler Türkçe + İngilizce (oyunun mevcut dil sistemiyle).

## A — Rakip araştırması (önce bunu yap, kısa tut)

`docs/RAKIP-ARASTIRMA-V2.md` yaz:
- **Crowd Surge rakipleri:** Count Masters, Mob Control, Join Clash 3D, Crowd City, Clone Armies / benzeri "kapıdan geç, ordunu büyüt" oyunları.
  Oyuncuların sevdiği ve şikâyet ettiği şeyler (mağaza yorumları, inceleme yazıları), özellikle: düşman yoğunluğu, boss savaşları, destek/yetenek çağırma, ordunun görünümü, ilerleme sistemi.
- **Arrow Legends rakipleri:** Archero, Archero 2, Survivor.io, Capybara Go, Soul Knight benzeri.
  Özellikle **görsel ve efekt** açısından: büyü/mermi efektleri, isabet hissi, boss tasarımları, yaratık stili, renk paleti, ekran sarsıntısı, hasar sayıları, element efektleri.
- Her oyun için birkaç madde + kaynak bağlantısı. Sonunda: **bu görevde uyguladığın maddelerin listesi**.

## B — Crowd Surge (Sürü Seli)

1. **Düşman çok az geliyor** → dalgalar daha kalabalık olsun (düşman sayısı ve yoğunluğu artsın). Denge bozulmasın: `node tests/sim.js balance suru 1,5,10,20 4 5` kazanma oranları makul kalmalı (iyi oyuncu kazanır, ama zorlanır). Gerekirse ordu büyüme hızı/kapılar da birlikte ayarlanır.
2. **Düşman bossları saçma ve ucuz duruyor** → yeni, güzel 3D boss modelleri (prosedürel three.js geometrisiyle, mevcut stile uygun): ör. zırhlı dev, tank/robot, ejderha benzeri yaratık… Bölüme göre çeşit. Giriş animasyonu, can barı, vuruş efektleri, ölüm patlaması.
3. **Asker ekleme sayısı 11'de takılı kalıyor** → askere asker ekleyen yükseltme/kapı değeri 11'de duruyor. Sınırı bul (kod/ekonomi), kaldır ya da makul şekilde yükselt; seviye arttıkça artmaya devam etsin. Kök nedeni raporda yaz.
4. **Askerler daha büyük görünsün** → şu an çok küçükler. Ölçeği büyüt (kalabalık ordu yine ekrana sığsın, kamera/diziliş ona göre).
5. **Destek çağırma** → oyuncu bölüm içinde takviye çağırabilsin: ör. **takviye helikopteri** (asker indirir ya da yukarıdan ateş eder), hava saldırısı, kalkan… Bekleme süresi/şarjı olan 1–3 yetenek düğmesi. Görsel olarak gösterişli (helikopter modeli, ip ile inen askerler, füze izleri).
6. Rakip araştırmasından seçtiğin **Crowd Surge** maddelerini uygula.

## C — Arrow Legends

7. **Efektleri 2–3 kat daha gösterişli yap** (kullanıcı: "bunun 2-3 katı yapılabilir"): daha yoğun parıltı, daha büyük isabet patlamaları, element başına belirgin efekt (ateş, buz, şimşek, zehir), kritik vuruşta özel efekt, seviye atlama / yetenek alma anında gösterişli efekt. Performans bütçesini koru.
8. **Büyücü** (büyücü sınıfı/karakteri ve büyücü düşmanlar) için efektler: büyü yükleme, mermi, iz, isabet, alan büyüleri.
9. **Boss grafikleri** yenilensin; gerekirse bosslar tamamen değişsin. Her boss için ayırt edici 3D model, giriş sahnesi, saldırı uyarı efektleri (yerde kırmızı alan vb.), ölüm sahnesi.
10. **Yaratıklar** kapak görselindeki gibi daha güzel olsun: `docs/art-target/arrow-legends-hedef.jpg` hedef. Daha detaylı, sevimli/korkutucu, okunaklı siluetler; renk paleti ve aydınlatma bu görsele yakın.
11. Rakip araştırmasından seçtiğin **Arrow Legends** görsel/efekt maddelerini uygula.

## Kalite

- `node tests/sim.js smoke` hatasız.
- Sürü Seli denge testi (yukarıdaki komut) önce/sonra tablosu.
- Önce/sonra ekran görüntüleri: `docs/screens-v2/` (boss, kalabalık dalga, destek çağırma, Arrow Legends boss, büyücü, yaratıklar).
- `scripts/visual-bench.cjs` ile kare süresi önce/sonra (performans düşmemeli; düşerse optimize et).
- `docs/GORSEL-RAPOR-V2.md`: yapılanlar madde madde (kullanıcının 11 maddesi + rakip maddeleri), kök nedenler, ölçümler. Türkçe yaz.
- `TEST-GERIBILDIRIM.md`'ye kullanıcının maddelerini "test kullanıcısı geri bildirimi" olarak ekle.
- Küçük, anlamlı commit'ler; bitince dalı push et.

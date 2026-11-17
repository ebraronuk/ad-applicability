# Direktif Kapsam Kontrolü

**Bir uçakta zorunlu bir arıza giderme emri yayınlandığında, filodaki hangi uçakları bağladığını söyler, ve her uçak için neden o kararı verdiğini gösterir.**

Karar veremediğinde tahmin etmez: hangi bilginin eksik olduğunu söyler. Gerçek direktifler, gerçek uçaklar, ölçülmüş kapsama.

```mermaid
flowchart LR
    A["Federal Register API<br/>196 gerçek direktif"] --> P
    B["Uçak sicili<br/>400 gerçek uçak"] --> E

    P["parse.ts<br/>dilbilgisi<br/>paragraf (c) → ifade ağacı"] --> E
    E{"evaluate.ts<br/>Kleene üç değerli mantık<br/>totality derleyici garantisi"}

    E --> V1["▲ Kapsamda<br/>+ eşleşen ölçüt"]
    E --> V2["○ Kapsam dışı<br/>+ gerekçe"]
    E --> V3["◆ Belirsiz<br/>+ eksik olan bilgi"]

    V1 --> U["Next.js<br/>3 ekran"]
    V2 --> U
    V3 --> U
    U --> API["POST /api/runs"]
    API --> DB[("Postgres<br/>denetim izi")]
```

## Neyi gösteriyor

| Yapılan iş | Kanıtı |
|---|---|
| **Regülasyon metnini çalıştırılabilir kurala çevirme.** Paragraf (c) düzyazı; ondan bir ifade ağacı çıkaran dilbilgisi elle yazıldı | 196 gerçek maddenin **%99'u** çözümleniyor, `npm test` ölçüyor, [`docs/coverage.md`](docs/coverage.md) yazıyor |
| **Üç değerli mantık.** Belirsizlik kenarda ele alınan bir hata değil, ifadenin içinde birleşen bir değer | Bilinmeyen bir olgu kesin bir kararı asla çeviremiyor: property testi. `conjoin`'i bozunca test düşüyor, bilerek doğrulandı |
| **Derleyici garantili totality.** Her uçak üç karardan tam birini alıyor | Düğüm tipi üzerindeki switch `never` ataması ile bitiyor; yeni bir tip ekleyip işlememek `tsc`'yi düşürüyor |
| **Kuralların şemada yaşadığı veritabanı** | `definite_verdict_has_reasoning` ve `undetermined_names_what_is_missing`: açıklanamayan bir kararı kaydetmek **imkânsız** |
| **Ajan yazdığı kodun denetimi** | Gözden geçirmenin yakaladığı **5 gerçek kusur**, nasıl bulundukları ile birlikte aşağıda yazılı |

**Sayılar:** 196 direktif × 400 uçak = **77.600 karar**. Bunların %0,6'sı belirsiz, oysa direktiflerin %45'i bir belgeye devrediyor. Farkı kapatan şey Kleene kısa devresi: kesin bir ret, yanındaki bilinmeyene rağmen sonucu belirliyor.

**Çalıştırmak:** `npm install && npm test`, başka hiçbir şey gerekmiyor. Arayüz için `npm run dev`, denetim kaydı için `docker compose up -d`.

## Ekranlar

![Bir direktif, filoya karşı: her satırda karar ve gerekçesi](docs/screenshots/in-scope.jpg)

## "Belirsiz" neden ürünün kalbi

`data/corpus/ads.json` içindeki korpus üzerinde ölçüldü: **gerçek direktiflerin %45'i kendi kapsamını söylemiyor.** Kapsamı bir üretici servis bültenine, takılı bir parça numarasına ya da başka bir otoritenin direktifine devrediyor, hiçbiri halka açık olmayan, hiçbir sicil kaydının taşımadığı belgeler.

Orada tahmin eden bir motor işe yaramaz; bilinmeyeni "kapsam dışı" sayan bir motor ise tehlikelidir. Bu yüzden belirsizlik, ifadenin tamamı boyunca birleşen birinci sınıf bir değer, Kleene'in güçlü üç değerli mantığı. Önemli olan özellik şu: **bilinmeyen bir olgu cevabı yalnızca belirsize genişletebilir; kesin bir evet'i kesin bir hayır'a asla çeviremez.** Bu bir yorum değil, bir property testi (aşağıda).

Aynı mantıktan işe yarar bir sonuç da çıkıyor: kesin bir ret, yanındaki bilinmeyene rağmen konjonksiyonu tek başına sonuçlandırıyor. Yanlış modeldeki bir uçak, çözülemeyen parça koşulu ne derse desin kapsam dışıdır. Motorun korpusu, tam parse edilebilen madde oranından daha fazla çözmesinin sebebi bu.

## Kapsama, ölçülmüş

`npm test` tarafından, Mayıs–Kasım 2026 arasında yayınlanmış 196 gerçek direktiften üretiliyor. Güncel değerler: [`docs/coverage.md`](docs/coverage.md)

```
corpus                 196 directives
parsed                 194 (99.0%)
fully resolvable       105 (53.6%)
deferred to a document  89   (87 servis bülteni, 4 takılı parça, 3 tablo)
unparsed                 2
```

Motorun 194 parse edilmiş direktifi 400 uçaklık filoya karşı değerlendirmesi,
toplam 77.600 karar:

```
kapsamda       111   (%0,14)
kapsam dışı  77.027  (%99,3)
belirsiz        462   (%0,6)
```

Yukarıdaki kısa devre iddiası bu rakamla doğrulanıyor: direktiflerin **%45'i**
bir belgeye devrediyor, ama kararların yalnızca **%0,6'sı** belirsiz kalıyor,
çünkü kesin bir ret konjonksiyonu tek başına sonuçlandırıyor. Bu da bir test,
varsayım değil.

`tests/coverage.test.ts` içindeki eşikler bir kilit dişlisi: dilbilgisinde yapılan ve gerçek direktiflerin daha azını anlayan bir değişiklik, sessizce geçmek yerine testi düşürüyor.

## Neyi yapmıyor

Açıkça yazılıyor, çünkü bu sınır bir tasarım kararı, yapılacaklar listesi değil:

- **Uyum süresi hesabı yok.** Direktifler son tarihleri uçuş saati, çevrim ya da takvim ayı cinsinden, bir başlangıç olayına göre veriyor. Kullanım verisi halka açık değil, o yüzden motor son tarih hesaplıyormuş gibi yapmıyor.
- **Servis bülteni kütüphanesi yok.** Üretici bültenleri halka açık değil. %45'lik devir oranının sebebi bu ve açık veriyle çözülebilir bir şey değil.
- **Modifikasyon durumu yok.** Sicil kaydı bir uçağa hangi bültenlerin uygulandığını tutmuyor, o yüzden "şu bülten uygulanmış olanlar hariç" ifadesi yapısal olarak belirsize çözülüyor.
- **Seri numarası karşılaştırması bilinçli olarak kısmi.** Sıralama yalnızca aynı tanınan biçimdeki seriler arasında tanımlı; gerisi tahmin yerine belirsiz döndürüyor. Karşılaştırmayı reddetmek bir özellik.
- **Filo verisi dünya çapında, ABD tescilli değil.** Gerekçesi `scripts/fetch-fleet.py` başında yazılı: FAA'nın kendi sicil veritabanı otomatik isteklere 403 ve 503 dönüyor, o yüzden programatik erişim için yayınlanan OpenSky uçak veritabanı kullanıldı. İçindeki her uçak gerçek bir uçak, her seri numarası gerçek bir seri numarası; ama bir FAA direktifinin gerçekten bağladığı popülasyon değil.

## Çalıştırma

```
npm install
npm test          # test paketi + docs/coverage.md üretir
npm run typecheck
npm run dev       # arayüz, http://localhost:3000
npm run build
```

Korpusu Federal Register'dan yenilemek için:

```
python3 scripts/fetch-corpus.py
python3 scripts/fetch-fleet.py
```

Korpus ve filo bilerek repoya işlenmiş: her kapsama değeri çevrimdışı tekrar üretilebilmeli, ve parser'ın ölçüldüğü metin onu iyi göstermek için seçilmiş örnekler değil düzenleyicinin kendi ifadesi olmalı.

Kararlar ise Postgres'te, çünkü bir değerlendirme sonucu birinin sonradan savunmak zorunda olduğu bir kayıt. Kısıtlar şemada: `definite_verdict_has_reasoning` ve `undetermined_names_what_is_missing`, açıklanamayan bir kararın kaydedilmesini imkânsız kılıyor.

```
docker compose up -d   # şema migrations/ içinden uygulanır
```

Postgres kapalıyken paket yeşil kalır, 4 test atlanır.

## Bu nasıl yazıldı

Kodlama ajanlarıyla (Claude Code) yazıldı; kimsenin bir konvansiyonu hatırlamasına bağlı olmayan kapılar altında. Gözden geçirmenin gerçekten yakaladığı üç kusur, üçü de farklı bir yöntemle bulundu:

**Bir ASCII tabloyu yutup uçak modeli diye raporlayan parser.** AD 2026-22785 şöyle başlıyor: *"Lycoming Engines (Lycoming) Model engines identified in table 1 ..."*, burada `Model`'den sonraki kelime kategori kelimesinin kendisi. Lazy bir eşleşme sıfır uzunlukta duramaz, o yüzden metinde çok ileride başka bir "engines" geçişine kadar koştu ve arada bir tablo çizgisini yakaladı. Çökme değil, ret değil: **kendinden emin yanlış cevap**, hiçbir tip denetleyicisinin göremediği sınıf. *Korpusun tamamı üzerinde çalışan bir property testi buldu;* 196 maddenin tam birinde düştü. Zaten okuduğum örneklerden yazılmış bir test geçerdi.

**Üretici kısıtının düşürülmesi.** Parser model bulamayınca üreticiyi de bırakıyordu, madde yalnızca devir düğümlerine indirgeniyordu. Sonuç: Lycoming motorlarıyla ilgili bir direktif filodaki 400 uçağın hepsi için "belirsiz" dönüyordu, oysa hiçbiri Lycoming motoru değil. *Yalnızca motoru uçtan uca gerçek veride çalıştırmak ortaya çıkardı;* birim testleri de parser testleri de geçiyordu, çünkü hiçbiri parse sonucunu bir filoya karşı değerlendirmiyordu. Düzeltme yeni bir AST düğümü gerektirdi ve derleyici onu değerlendiricide ele almaya zorladı.

**Sessizce atlayan veritabanı testleri.** `describe.skipIf` toplama anında değerlendiriliyor, oysa bayrak `beforeAll` içinde kuruluyordu; yani bayrak o anda hep `false` ve dört test, veritabanı ayakta olmasına rağmen her koşumda sessizce atlanıyordu. Paket yeşil görünüyor, hiçbir şey doğrulamıyordu. *Testin kendisini yazarken çıktı.* Sessizce atlayan bir test, düşen testten kötüdür.

## Lisans

MIT

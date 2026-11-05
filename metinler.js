// Oyundaki bütün yazılar burada. Kodu (oyun.js) açmadan buradan düzenleyebilirsin.
//
// Nasıl yazılır:
// - Her satır virgülle biter. Yazılar tek tırnak 'böyle' ya da çift tırnak "böyle" içinde olur.
// - Yazının içinde tek tırnak (kesme işareti) kullanacaksan dışını çift tırnak yap: "Bitcoin'i aldın"
// - Emoji kullanabilirsin.
// - Bazı yazılarda süslü parantezli yer tutucular var; oyun bunları gerçek değerle doldurur:
//     {ad}      satın alınan yükseltmenin ya da yakalanan güçlendirmenin adı
//     {tik}     şimdiye kadarki tıklama sayısı
//     {sure}    şimdiye kadarki oyun süresi (ör. "12 dk 30 sn")
//     {dopamin} şu anki dopamin miktarı
// - Bir listeyi boş bırakma, en az bir satır kalsın.

const METINLER = {

  // ============ WhatsApp: kankalar grubu ============
  // Her mesaj: kim yazdı, ne yazdı, uygun cevap ne.
  // Oyuncuya üç şık çıkar: biri buradaki uygun cevap, ikisi başka mesajların cevapları.
  // Sadece uygun cevap dopamin verir. Bu yüzden her mesajın cevabı diğerlerinden farklı olsun.
  whatsapp: {
    mesajlar: [
      { kim: 'kankam', mesaj: 'Lole gel', cevap: 'lol mu kaldı amk' },
      { kim: 'maykıl', mesaj: 'Hey corç versene borç', cevap: 'olmaz maykıl bende de yok' },
      { kim: 'elwind', mesaj: 'erasmusa gidiyim mi sence', cevap: 'erasmus nerde bilmiyorum açıkcası' },
      { kim: 'elwind', mesaj: 'bu kışlık montlar ne zaman gelcek yeni sezon', cevap: 'kanka yeni sezonda mont gelme diye bişey mi var' },
      { kim: 'Mert', mesaj: 'maç kaçta', cevap: '21.45 olm hâlâ bilmiyo musun' },
      { kim: 'Can', mesaj: 'ödevi yapan var mı atsın', cevap: 'bende de yok kanka' },
      { kim: 'Burak Borç', mesaj: 'bu akşam halısaha 1 kişi eksik', cevap: 'kaleye geçmem ona göre' },
      { kim: 'Gizem', mesaj: 'neden kimse cevap vermiyor 🙄', cevap: 'buradayım buradayım' },
      { kim: 'Kerem', mesaj: 'abi kahve 180 tl olmuş kafede', cevap: 'evde neskafe yaparız' },
      { kim: 'Deniz', mesaj: 'grubun adını kim değiştirdi', cevap: 'ben değilim yemin' },
      { kim: 'Mert', mesaj: 'yarın sınav varmış duydunuz mu', cevap: 'NE SINAVI' },
      { kim: 'Can', mesaj: '03:47 uyuyan var mı', cevap: 'uyku nedir' },
      { kim: 'Ece', mesaj: '📸 Fotoğraf · bu ben miyim filtre mi', cevap: 'filtre ama güzel' },
      { kim: 'Burak Borç', mesaj: 'şarj aletimi kim aldı', cevap: 'bende yarın getiririm' },
      { kim: 'Kerem', mesaj: 'oyunda 1 milyon dopamin yaptım', cevap: 'ss yoksa yalan' },
      { kim: 'Deniz', mesaj: '@herkes 5 dk discorda gelin', cevap: 'mikrofonum bozuk ama gelirim' },
      { kim: 'kankam', mesaj: 'sigarayı bıraktım 3 gündür', cevap: 'helal olsun kral' },
      { kim: 'Gizem', mesaj: 'biri beni bu gruptan çıkarsın', cevap: 'buradan çıkış yok' },
      { kim: 'Mert', mesaj: 'dürümcü kapanmış mıdır şu an', cevap: '24 saat açık o' },
      { kim: 'Can', mesaj: '🎤 Sesli mesaj · 4:32', cevap: '4 dakika ne anlattın' },
    ],
    // Alakasız cevap verilince, mesajı atan kişi bunlardan birini yazar
    tepkiler: ['?', 'ne diyon', 'mesajı okumadan cevap veriyo', '🤨', 'bot musun kanka', 'ne alaka sjsjsj'],
  },

  // ============ Yayın chati (Twitch tarzı) ============
  chat: {
    // Mesajları yazan kullanıcı adları
    adlar: ['elwind', 'durdurulamazguc', 'sallbeg', 'cheribu', 'akalintha', 'baba', 'pompaci_tk', 'riotgamesmanyagi', 'lixaposken', 'amlaşma', 'sjhyon', 'filiz_yilmaz','ocunoglu','ümraniyesapigi','tifa','higanbana','şirketmuhbiri','bebekallah','akshanbabaoyunda','bokpoy','hichigo','panky','crystal','sıçılayse','lidya_ceren','esty','meh','hermes','achlys','wirsth','monchhichi','draven','talon','hecarim','mayhoşlulu,','sevgikelebegikogmaw','suçsehritwich','kazbura','sevgisizbüyüdüm',],
    // Sürekli akan rastgele mesajlar
    mesajlar: [
      'KEKW', 'w', 'LUL', 'reis ne yapıyon', 'bu adam mal mi', 'ohh yap abi yapp', 'tıkla tıkla tıkla', 'ilk', 'sa', 'as',
      'buton kırılacak', 'nerden buldun bu oyunu', 'kapat şu bilgisayarı', 'ördeğe yem ver', 'sıkıldım', 'GG',
      'bu kaçıncı DVD', '📀📀📀', 'çok iyi gidiyon', 'bune la', 'annen çağırıyo', 'asdfghjkl', '+1', '💀', '🔥🔥','sıktı lol geç','mal misin oynadığın oyuna bak','abi adımı okur musun?','keyiflendik','devam et','bok gibi oynuyon','çimene dokun aq','slm','çerez','slotu çevirsene amk','gayet iyi gidiyoz bence','serrri','31','yeni sezon montlar ne zaman gelicek?','abi neden press the atack girdik','naber oc','ben lol oynicam bb','tung tung sahur','cuh','cantina','kapsonu taktık','fırsattan istifade','kaşla göz arası','yasabir','imajımız açısından iyi oldu','ikiz dingiller','sümük gibi yapıştı','kafayı yemis','riven yetenek gerektiren bir şampiyon ve bence sana uygun değil','abi sıkca canını'
    ],
    // Oyunda bir şey olunca chat'in tepkisi (listeden rastgele biri seçilir)
    olaylar: {
      satinAlma: ['POG {ad}', '{ad} aldı KEKW', 'yine mi para harcadın', 'W alım'],
      kose: ['hileci oe'],
      jackpot: ['JACKPOT 🎰🎰🎰'],
      zarar: ['zarar ettin embesil'],
      guclendirme: ['{ad} 🔥🔥'],
    },
  },

  // ============ SMS ============
  // Sağ altta telefon bildirimi gibi kayan mesajlar
  sms: [
    { kimden: 'Kargo', mesaj: 'Kargonuz yola çıktı 📦 Takip için tıklayın.' },
    { kimden: 'BANKA', mesaj: 'Sn. müşterimiz, kartınızla 0,01 TL harcama yapıldı.' },
    { kimden: 'Annen', mesaj: 'Neredesin? Arıyorum açmıyorsun.' },
    { kimden: 'MAĞAZA', mesaj: 'Sadece bugün %70 indirim! Kaçırma 🔥' },
    { kimden: 'Operatör', mesaj: "Paketinizin %80'ini kullandınız." },
    { kimden: 'Doğrulama', mesaj: 'Doğrulama kodunuz: 482910. Kimseyle paylaşmayın.' },
    { kimden: 'Bilinmeyen', mesaj: 'Tebrikler! Bir telefon kazandınız (kazanmadınız).' },
    { kimden: 'Kurye', mesaj: 'Siparişiniz 3 dakika içinde kapınızda 🛵' },
    { kimden: 'Belediye', mesaj: 'Yarın 09:00-17:00 arası su kesintisi yapılacaktır.' },
    { kimden: 'Arkadaşın', mesaj: 'naber kanka bi bakar mısın' },
    { kimden: 'Oyun', mesaj: 'Günlük ödülün seni bekliyor 🎁' },
    { kimden: 'Spor Salonu', mesaj: 'Seni özledik! 3 aydır gelmiyorsun.' },
  ],

  // ============ Duolingo ============
  duolingo: {
    // Çoktan seçmeli: Türkçe kelime sorulur, dört İngilizce şıktan doğrusu seçilir.
    // Yanlış şıklar doğru cevaba benzesin ki zor olsun (yazılışı ya da anlamı yakın kelimeler).
    secmeli: [
      { turkce: 'düşünce', dogru: 'thought', yanlislar: ['though', 'through', 'tough'] },
      { turkce: 'etkilemek', dogru: 'affect', yanlislar: ['effect', 'afford', 'effort'] },
      { turkce: 'kabul etmek', dogru: 'accept', yanlislar: ['except', 'expect', 'aspect'] },
      { turkce: 'hassas', dogru: 'sensitive', yanlislar: ['sensible', 'sentient', 'sensual'] },
      { turkce: 'sonunda', dogru: 'eventually', yanlislar: ['actually', 'evidently', 'essentially'] },
      { turkce: 'ödünç vermek', dogru: 'lend', yanlislar: ['borrow', 'lent', 'land'] },
      { turkce: 'fırsat', dogru: 'opportunity', yanlislar: ['oportunity', 'opportunaty', 'oppurtunity'] },
      { turkce: 'sorumluluk', dogru: 'responsibility', yanlislar: ['responsability', 'responsibilty', 'responsibillity'] },
      { turkce: 'inanılmaz', dogru: 'incredible', yanlislar: ['incredulous', 'inedible', 'increasing'] },
      { turkce: 'kıskanç', dogru: 'jealous', yanlislar: ['zealous', 'generous', 'gelatinous'] },
      { turkce: 'öneri', dogru: 'suggestion', yanlislar: ['digestion', 'congestion', 'suggestive'] },
      { turkce: 'vicdan', dogru: 'conscience', yanlislar: ['conscious', 'consensus', 'conscientious'] },
      { turkce: 'deneyim', dogru: 'experience', yanlislar: ['experiment', 'expertise', 'expense'] },
      { turkce: 'ihmal etmek', dogru: 'neglect', yanlislar: ['negotiate', 'reject', 'select'] },
      { turkce: 'kalıcı', dogru: 'permanent', yanlislar: ['pertinent', 'prominent', 'persistent'] },
      { turkce: 'tesadüf', dogru: 'coincidence', yanlislar: ['coexistence', 'confidence', 'consequence'] },
      { turkce: 'kaçınılmaz', dogru: 'inevitable', yanlislar: ['invisible', 'invincible', 'inviolable'] },
      { turkce: 'ertelemek', dogru: 'postpone', yanlislar: ['postpose', 'propose', 'purpose'] },
      { turkce: 'tutarlı', dogru: 'consistent', yanlislar: ['constant', 'insistent', 'consistant'] },
      { turkce: 'gereklilik', dogru: 'necessity', yanlislar: ['neccessity', 'necesity', 'nessecity'] },
      { turkce: 'öngörmek', dogru: 'anticipate', yanlislar: ['participate', 'anticipant', 'antiquate'] },
      { turkce: 'karşılaştırma', dogru: 'comparison', yanlislar: ['comparation', 'compassion', 'companion'] },
    ],
    // Yazmalı: İngilizce kelime sorulur, oyuncu Türkçesini yazar.
    // Birden fazla doğru cevap olabilir. Türkçe karakter, büyük/küçük harf ve boşluk fark etmez.
    yazmali: [
      { ingilizce: 'squirrel', cevaplar: ['sincap'] },
      { ingilizce: 'butterfly', cevaplar: ['kelebek'] },
      { ingilizce: 'earthquake', cevaplar: ['deprem', 'zelzele'] },
      { ingilizce: 'rainbow', cevaplar: ['gökkuşağı'] },
      { ingilizce: 'library', cevaplar: ['kütüphane'] },
      { ingilizce: 'nurse', cevaplar: ['hemşire'] },
      { ingilizce: 'bridge', cevaplar: ['köprü'] },
      { ingilizce: 'giraffe', cevaplar: ['zürafa'] },
      { ingilizce: 'fridge', cevaplar: ['buzdolabı'] },
      { ingilizce: 'toothbrush', cevaplar: ['diş fırçası'] },
      { ingilizce: 'rabbit', cevaplar: ['tavşan'] },
      { ingilizce: 'lightning', cevaplar: ['şimşek', 'yıldırım'] },
      { ingilizce: 'neighborhood', cevaplar: ['mahalle', 'semt'] },
      { ingilizce: 'umbrella', cevaplar: ['şemsiye'] },
      { ingilizce: 'riddle', cevaplar: ['bilmece'] },
      { ingilizce: 'jealous', cevaplar: ['kıskanç'] },
      { ingilizce: 'opportunity', cevaplar: ['fırsat'] },
      { ingilizce: 'experience', cevaplar: ['deneyim', 'tecrübe'] },
      { ingilizce: 'responsibility', cevaplar: ['sorumluluk'] },
      { ingilizce: 'coincidence', cevaplar: ['tesadüf', 'rastlantı'] },
      { ingilizce: 'suggestion', cevaplar: ['öneri', 'tavsiye'] },
      { ingilizce: 'wisdom', cevaplar: ['bilgelik'] },
    ],
  },

  // ============ Anlatıcı ============
  // Ekranın altında belgesel anlatıcısı gibi altyazıyla konuşur.
  anlatici: {
    // Anlatıcı satın alınınca söylediği ilk cümle
    giris: 'Ve işte karşınızda: ekranın başındaki insan. Onu bugün yakından izleyeceğiz.',
    // 18-35 saniyede bir rastgele söylediği cümleler
    laflar: [
      'Kahramanımız butona bir kez daha bastı. Neden? Bunu kendisi de bilmiyor.',
      'Dışarıda güneş batıyor. Kimse fark etmedi.',
      'Parmaklar yoruluyor. Ama durmak, bir seçenek değil.',
      'Bir DVD logosu köşeye yaklaşıyor... yaklaşıyor... ve ıskalıyor.',
      'Ördek ona bakıyor. Yargılamıyor. Sadece bakıyor.',
      'Doğada her canlı bir şeyin peşindedir. Bu canlı, sayıların peşinde.',
      'Ekranlar çoğaldıkça dikkat azalır. Bilim insanları buna "salı" diyor.',
      'Uzaklarda bir yerde bir anne "yemek soğuyor" diye sesleniyor.',
      'Bir an duraksadı. Sonra tıklamaya devam etti. Klasik.',
      'Şimdiye kadar tam {tik} kez tıkladı. Ve sayı artmaya devam ediyor.',
      '{sure} geçti. Kimse saati sormadı.',
    ],
    // Oyunda bir şey olunca söyledikleri (listeden rastgele biri seçilir)
    olaylar: {
      satinAlma: ['{ad}. Tam da ihtiyacı olan şey.', 'Ve {ad} da geldi. Ekran biraz daha kalabalık.', '{ad}... Bir tane daha. Her zaman bir tane daha.'],
      kose: ['İnanılmaz. DVD tam köşeye çarptı. Bu an nesiller boyu anlatılacak.'],
      jackpot: ['Üç aynı meyve. Bu an hiç bitmesin istiyor.'],
      jetonHarcama: ['Beş jeton harcadı. Karşılığında otuz saniyelik bir mutluluk.'],
      guclendirme: ['{ad}. Ekranda parlayan her şeye uzanmak, türün doğasında var.'],
      tamEkran: ['Ve bütün ekranlar tek bir girdapta birleşti. Geri dönüş yolu artık görünmüyor.'],
    },
  },
};

'use strict';

// ============ yardımcılar ============
const $ = s => document.querySelector(s);
const sayiFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const ondalikFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = n => sayiFmt.format(Math.floor(n));
const rastgele = (a, b) => a + Math.random() * (b - a);
const sec = liste => liste[Math.floor(Math.random() * liste.length)];
const sinirla = (x, a, b) => Math.max(a, Math.min(b, x));
// Fiyatları okunaklı sayılara yuvarlar (3, 5, 25, 150, 1.200 ...)
const yuvarla = n => n < 10 ? Math.round(n) : n < 100 ? 5 * Math.round(n / 5) : n < 1e3 ? 25 * Math.round(n / 25) : n < 1e4 ? 100 * Math.round(n / 100) : 500 * Math.round(n / 500);

function youtubeId(girdi) {
  if (!girdi) return '';
  const m = String(girdi).match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(girdi) ? girdi : '';
}

function sureFmt(sn) {
  const sa = Math.floor(sn / 3600);
  const dk = Math.floor((sn % 3600) / 60);
  return sa ? `${sa} sa ${dk} dk` : `${dk} dk ${Math.floor(sn % 60)} sn`;
}

// ============ durum ve kayıt ============
const KAYIT = 'dopamin-kayit-v1';
const S = {
  dopamin: 0,
  toplam: 0,
  tik: 0,
  ezilen: 0,
  sure: 0,
  alinan: {},
  goruldu: {},
  basarim: {},
  kaynaklar: {},
  sesAcik: true,
  xp: 0,
  seviye: 1,
  butonTipi: 'klasik',
  esyalar: { klasik: true },
  piyasalar: {},
  kose: 0,
  kazilan: 0,
  duoDogru: 0,
  jeton: 0,
  jackpot: 0,
  yumurta: 0,
  ordekTok: 100,
  bitti: false,
  ses: {},
};
// Ses kanallarının varsayılan seviyeleri (0-1). Anlatıcının sesli okuması varsayılan olarak kapalı.
const SES_VARSAYILAN = { ana: 0.8, efekt: 1, ortam: 1, video: 0.6, radyo: 1, asmr: 1, anlatici: 0 };
let kayitKapali = false;
let oyunBitti = false;
let yukleniyor = false;   // kayıttan gelen yükseltmeler kurulurken true

function yukle() {
  try {
    const k = JSON.parse(localStorage.getItem(KAYIT));
    if (k) Object.assign(S, k);
  } catch (e) { /* kayıt yoksa sıfırdan başla */ }
  // Eski kayıtlardaki dolar bilgisini yeni piyasa yapısına taşı
  if (S.kur && !S.piyasalar.dolar) {
    S.piyasalar.dolar = { kur: S.kur, gecmis: S.kurGecmis || [], miktar: S.dolar || 0, maliyet: S.dolarMaliyet || 0, kar: S.dolarKar || 0 };
  }
  delete S.kur; delete S.kurGecmis; delete S.dolar; delete S.dolarMaliyet; delete S.dolarKar;
  S.ses = { ...SES_VARSAYILAN, ...S.ses };
}
function kaydet() {
  if (kayitKapali) return;
  try { localStorage.setItem(KAYIT, JSON.stringify(S)); } catch (e) { /* gizli sekme vb. */ }
}

const adet = id => S.alinan[id] || 0;

// Saniye sayacı: son 10 saniyede gerçekten kazanılan her şeyin ortalaması
const Olcer = {
  kova: 0,
  gecmis: [],
  zaman: 0,
  adim(dt) {
    this.zaman += dt;
    while (this.zaman >= 0.25) {
      this.zaman -= 0.25;
      this.gecmis.push(this.kova);
      this.kova = 0;
      if (this.gecmis.length > 40) this.gecmis.shift();
    }
  },
  deger() {
    // Sayfa yeni açıldığında tek bir büyük kazanç sayacı şişirmesin diye en az 3 saniyeye bölünür
    return this.gecmis.reduce((a, b) => a + b, 0) / (Math.max(this.gecmis.length, 12) * 0.25);
  },
};
// Tek seferlik ödüller sayacı şişirmesin
const OLCULMEYEN = new Set(['basarim', 'seviye', 'debug']);

function kazan(n, kaynak) {
  if (!(n > 0) || oyunBitti) return;
  kaynak = kaynak || 'diger';
  n *= Guc.carpan(kaynak);
  S.dopamin += n;
  S.toplam += n;
  S.kaynaklar[kaynak] = (S.kaynaklar[kaynak] || 0) + n;
  if (!OLCULMEYEN.has(kaynak)) Olcer.kova += n;
  if (kaynak !== 'seviye') Seviye.xpEkle(n);
}

// Ödüllerin oyunun ilerisinde de anlamlı kalması için pasif kazanca göre büyür
const olcek = () => 1 + saniyeBasi() / 40;

// ============ yükseltmeler ============
// sps: saniye başına dopamin. gerek: önce alınması gerekenler. cokluAlim: tekrar alınabilir.
// alinca: sadece satın alındığı an çalışır (kayıttan yüklerken çalışmaz).
const YUKSELTMELER = [
  { id: 'dvd', ad: 'Zıplayan DVD', fiyat: 3, cokluAlim: true, artis: 1.5, acik: () => `Her çarpmada +${dvdDegeri()} dopamin` },
  { id: 'sekme', ad: 'Sekme Başlığı', fiyat: 5, acik: 'Dopamin sayacı artık sekmede de' },
  { id: 'ucusan', ad: 'Uçuşan Sayılar', fiyat: 10, acik: 'Tık başına +1 dopamin' },
  { id: 'sayac', ad: 'Saniye Sayacı', fiyat: 25, acik: 'Saniyede ne kadar dopamin aldığını gör' },
  { id: 'buton', ad: 'Büyük Buton', fiyat: 40, acik: 'Daha büyük, daha iyi. Tık başına +1 dopamin' },
  { id: 'dvdses', ad: 'DVD Çarpma Sesi', fiyat: 75, gerek: ['dvd'], acik: 'Çarpma başına +5 dopamin' },
  { id: 'sondakika', ad: 'Son Dakika', fiyat: 100, sps: 4, acik: 'Gündemden kopma. Saniyede +4' },
  { id: 'lofi', ad: 'Lofi', fiyat: 150, sps: 8, acik: 'Ders çalışırken dinle. Saniyede +8' },
  { id: 'yagmur', ad: 'Yağmur Sesi', fiyat: 250, sps: 14, acik: 'Huzur veren yağmur. Saniyede +14' },
  { id: 'subway', ad: 'Subway Surfers', fiyat: 400, sps: 22, acik: 'Dikkat süren için. Sessiz başlar. Saniyede +22' },
  { id: 'presHiz', ad: 'Pres Hızı', fiyat: 500, gerek: ['pres'], acik: 'Pres %15 daha hızlı iner' },
  { id: 'firildak', ad: 'Fırıldak', fiyat: 700, sps: 20, acik: 'Arkada bir şey dönsün. Saniyede +20' },
  { id: 'pres', ad: 'Hidrolik Pres', fiyat: 1000, acik: 'Bir şeyleri yavaşça ez' },
  { id: 'basarim', ad: 'Başarımlar', fiyat: 1500, acik: 'Başarılarını kutla' },
  { id: 'gokgurultu', ad: 'Gök Gürültüsü', fiyat: 2000, gerek: ['yagmur'], sps: 8, acik: 'Yağmura gök gürültüsü ekle. Saniyede +8' },
  { id: 'minecraft', ad: 'Minecraft Parkur', fiyat: 3500, sps: 30, acik: 'Bir video yetmiyordu. Saniyede +30' },
  { id: 'slime', ad: 'ASMR Slime', fiyat: 4000, sps: 35, acik: 'Slime videoları izle. Saniyede +35' },
  { id: 'technicolor', ad: 'Technicolor', fiyat: 5000, gerek: ['dvd'], acik: 'DVD her çarpmada renk değiştirir. Çarpma başına +10' },
  { id: 'yemek', ad: 'Yemek Videosu', fiyat: 6000, sps: 60, acik: 'Biri yemek yiyor. Saniyede +60' },
  { id: 'ekran', ad: 'Ekran Süresi', fiyat: 7500, acik: 'Ekran alışkanlıklarını takip et' },
  { id: 'seviye', ad: 'Seviyeler', fiyat: 8000, acik: 'Tecrübe kazan, seviye atla' },
  { id: 'slot', ad: 'Slot Makinesi', fiyat: 12000, acik: 'Arada bir çevir. Tutarsa elindeki dopamini katlar.' },
  { id: 'otoPres', ad: 'Otomatik Pres', fiyat: 15000, gerek: ['pres'], acik: 'Pres kendi kendine başlar ve toplar' },
  { id: 'kose', ad: 'Köşe Vuruşu', fiyat: 15000, gerek: ['dvd'], acik: 'DVD köşeye çarparsa 10 kat dopamin' },
  { id: 'arayuz', ad: 'Arayüz Yükseltmesi', fiyat: 15000, acik: 'Parlak renkler. Daha çok gradyan.' },
  { id: 'esya', ad: 'Eşya Dükkanı', fiyat: 17500, acik: 'Butonun için yeni tipler ve sesler al' },
  { id: 'kazi', ad: 'Kazı Kazan', fiyat: 20000, acik: 'Ara sıra kazı kazan bileti gelir' },
  { id: 'dolar', ad: 'Dolar', fiyat: 25000, acik: 'Dolar al, bekle, sat. Arada düşer ama uzun vadede hep yükselir.' },
  { id: 'duolingo', ad: 'Duolingo', fiyat: 25000, acik: 'Yeni bir dil öğren. Yoksa...' },
  { id: 'whatsapp', ad: 'Aile WhatsApp Grubu', fiyat: 30000, acik: 'Aile grubuna katıl. Mesajlara cevap ver.' },
  { id: 'asmr', ad: 'ASMR', fiyat: 35000, sps: 120, acik: 'Kulağına fısıldasınlar. Saniyede +120' },
  { id: 'gta', ad: 'GTA Mega Rampa', fiyat: 45000, sps: 80, acik: 'Arabalar rampadan uçuyor. Saniyede +80' },
  { id: 'dvdHiz1', ad: 'DVD Hızı', fiyat: 50000, gerek: ['technicolor'], acik: "DVD'ler iki kat hızlı" },
  { id: 'subwaySes', ad: 'Subway Surfers Sesli', fiyat: 50000, gerek: ['subway'], sps: 150, acik: 'Subway Surfers\'ın sesini aç. Saniyede +150' },
  { id: 'asmr2', ad: 'ASMR 2x', fiyat: 60000, gerek: ['asmr'], sps: 100, acik: 'İki kat fısıltı. Saniyede +100' },
  { id: 'sms', ad: 'SMS', fiyat: 60000, acik: 'Telefonuna mesajlar yağsın' },
  { id: 'fitness', ad: 'Fitness Hocası', fiyat: 75000, sps: 100, acik: 'Ekran başında formda kal. Saniyede +100' },
  { id: 'radyo', ad: 'Radyo', fiyat: 85000, sps: 120, acik: 'Arkada radyo çalsın. Ekranı yok, sadece sesi. Saniyede +120' },
  { id: 'jeton', ad: 'Oyun İçi Para', fiyat: 100000, acik: 'Akıllıca gizlenmiş mikro ödemeler' },
  { id: 'tepki', ad: 'Tepki Yayıncısı', fiyat: 100000, sps: 200, acik: 'Kaosun içinde bir dost. Saniyede +200' },
  { id: 'kripto', ad: 'Kripto', fiyat: 125000, gerek: ['dolar'], acik: 'Portföyüne kripto ekle. Bu düşebilir.' },
  { id: 'guclendirme', ad: 'Güçlendirmeler', fiyat: 150000, acik: 'Ekranda beliren güçlendirmeleri yakala' },
  { id: 'anlatici', ad: 'Anlatıcı', fiyat: 200000, acik: 'Olan biten her şeyi sesli anlatan biri' },
  { id: 'tamEkran', ad: 'Tam Ekran', fiyat: 250000, gerek: ['subway'], sps: 500, acik: 'İşi ciddiye alma vakti. Saniyede +500' },
  { id: 'kaldirac', ad: 'Kaldıraç', fiyat: 250000, gerek: ['dolar'], acik: 'Dolar ve kriptoda kâr da zarar da 2 kat' },
  { id: 'ordek', ad: 'Ördek', fiyat: 300000, acik: 'Bir ördek sahiplen. Beslersen yumurtlar.' },
  { id: 'chat', ad: 'Yayın Chati', fiyat: 500000, sps: 250, acik: 'Yayın aç, chat seni izlesin. Saniyede +250' },
  { id: 'dvdHiz2', ad: 'DVD Hızı II', fiyat: 500000, gerek: ['dvdHiz1'], acik: "DVD'ler yine iki kat hızlı" },
  { id: 'solucan', ad: 'Solucan Deliği', fiyat: 1e6, gerek: ['tamEkran'], sps: 1000, acik: 'Zamanda ve uzayda yolculuk. Saniyede +1.000' },
  { id: 'okyanus', ad: 'Okyanusa Git', fiyat: 2e6, gerek: ['solucan'], acik: 'Geri dönüşü yok.' },
];

function tikGucu() {
  // Sahip olunan her buton tipi, takılı olmasa da tıklamayı kalıcı olarak güçlendirir
  const tipBonusu = BUTON_TIPLERI.reduce((t, b) => t + (S.esyalar[b.id] ? b.tik : 0), 0);
  return 1 + (adet('ucusan') ? 1 : 0) + (adet('buton') ? 1 : 0) + tipBonusu;
}
function saniyeBasi() {
  let t = 0;
  for (const y of YUKSELTMELER) if (y.sps && adet(y.id)) t += y.sps;
  return t;
}
function dvdDegeri() {
  return 1 + (adet('dvdses') ? 5 : 0) + (adet('technicolor') ? 10 : 0);
}
function dvdHizi() {
  return (adet('dvdHiz1') ? 2 : 1) * (adet('dvdHiz2') ? 2 : 1) * (Guc.var('dvdFirtina') ? 3 : 1);
}
function fiyat(y) {
  return y.cokluAlim ? yuvarla(y.fiyat * Math.pow(y.artis, adet(y.id))) : y.fiyat;
}

// Satın alınınca (ve kayıt yüklenince) her yükseltmenin etkisini kurar. Tekrar çağrılması zararsızdır.
const ETKILER = {
  dvd: () => DVD.esitle(),
  sayac: () => { $('#sps').hidden = false; },
  buton: () => $('#buton').classList.add('buyuk'),
  subway: () => videoPencere('subway', 'Subway Surfers'),
  sondakika: () => bantKur(),
  lofi: () => videoPencere('lofi', 'lofi'),
  yagmur: () => { Yagmur.aktif = true; Ses.yagmurBaslat(); },
  firildak: () => $('#firildak').classList.add('acik'),
  pres: () => Pres.kur(),
  basarim: () => basarimKontrol(),
  gokgurultu: () => gokZamanla(),
  minecraft: () => videoPencere('minecraft', 'Minecraft Parkur'),
  slime: () => videoPencere('slime', 'ASMR Slime'),
  yemek: () => videoPencere('yemek', 'Yemek'),
  ekran: () => Ekran.kur(),
  seviye: () => { $('#seviye').hidden = false; Seviye.ciz(); },
  radyo: () => Radyo.kur(),
  slot: () => Slot.kur(),
  gta: () => videoPencere('gta', 'GTA Mega Rampa'),
  arayuz: () => document.body.classList.add('suslu'),
  esya: () => Esya.kur(),
  kazi: () => Kazi.zamanla(),
  dolar: () => Dolar.kur(),
  duolingo: () => Duo.zamanla(),
  whatsapp: () => Whatsapp.kur(),
  asmr: () => videoPencere('asmr', 'ASMR', 60),
  subwaySes: () => videoSesliYap('subway', videoSesi('subway')),
  sms: () => Sms.zamanla(),
  fitness: () => videoPencere('fitness', 'Fitness Hocası'),
  jeton: () => Jeton.kur(),
  tepki: () => videoPencere('tepki', 'Tepki Yayıncısı'),
  kripto: () => Kripto.kur(),
  guclendirme: () => Guc.zamanla(),
  anlatici: () => Anlatici.kur(),
  // Satın alınca pencereler tünele çekilir; kayıttan yüklerken tünel doğrudan kurulur
  tamEkran: () => (yukleniyor ? Duvar.kur(false) : Duvar.gec()),
  ordek: () => Ordek.kur(),
  chat: () => Chat.kur(),
  solucan: () => Duvar.solucan(),
  okyanus: () => Son.baslat(),
};
const ALINCA = {
  kazi: () => setTimeout(() => Kazi.ac(), 1500),
  duolingo: () => setTimeout(() => Duo.ac(), 2500),
  sms: () => setTimeout(() => Sms.ac(), 2000),
  guclendirme: () => setTimeout(() => Guc.ac(), 2000),
};

function satinAl(id) {
  const y = YUKSELTMELER.find(x => x.id === id);
  if (!y || !gorunurMu(y)) return;
  const f = fiyat(y);
  if (S.dopamin < f) return;
  S.dopamin -= f;
  S.alinan[id] = adet(id) + 1;
  Ses.satin();
  if (ETKILER[id]) ETKILER[id]();
  if (ALINCA[id]) ALINCA[id]();
  Anlatici.soyle(sec([`${y.ad}. Tam da ihtiyacı olan şey.`, `Ve ${y.ad} da geldi. Ekran biraz daha kalabalık.`, `${y.ad}... Bir tane daha. Her zaman bir tane daha.`]));
  Chat.olay(sec(['POG ' + y.ad, y.ad + ' aldı KEKW', 'yine mi para harcadın', 'W alım']));
  dukkanCiz(true);
  kaydet();
}

// ============ ses (hepsi kodla üretiliyor, dosya yok) ============
// Kanallar: efekt (oyun sesleri) ve ortam (yağmur, gök gürültüsü, kozmik ses, dalga) ana sese bağlıdır.
// Videoların, radyonun, ASMR'ın ve anlatıcının sesi ayrıca ayarlanır (bkz. videoSesleriniAyarla).
const Ses = {
  ctx: null,
  ana: null,
  efekt: null,
  ortam: null,
  baslat() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ana = this.ctx.createGain();
      this.ana.connect(this.ctx.destination);
      this.efekt = this.ctx.createGain();
      this.efekt.connect(this.ana);
      this.ortam = this.ctx.createGain();
      this.ortam.connect(this.ana);
      this.ayarla();
      if (adet('yagmur')) this.yagmurBaslat();
      if (adet('tamEkran') && !oyunBitti) {
        this.kozmik();
        if (adet('solucan')) this.kozmikGuclen();
      }
    } catch (e) { this.ctx = null; }
  },
  ayarla() {
    if (this.ana) {
      this.ana.gain.value = S.sesAcik ? S.ses.ana * 0.75 : 0;
      this.efekt.gain.value = S.ses.efekt;
      this.ortam.gain.value = S.ses.ortam;
    }
    $('#sesBtn').textContent = S.sesAcik ? '🔊' : '🔇';
    Radyo.sesAyarla();
    videoSesleriniAyarla();
    Anlatici.sus();
  },
  ton(frek, sure, tip = 'sine', ses = 0.2, kayma = 0, kanal = 'efekt') {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime;
    o.type = tip;
    o.frequency.setValueAtTime(frek, t);
    if (kayma) o.frequency.exponentialRampToValueAtTime(Math.max(20, frek * kayma), t + sure);
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(this[kanal]);
    o.start(t);
    o.stop(t + sure + 0.02);
  },
  gurultuTamponu() {
    if (this._tampon) return this._tampon;
    const c = this.ctx;
    const n = c.sampleRate * 2;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (this._tampon = b);
  },
  gurultu(sure, filtre, ses, filtreTipi = 'lowpass', kanal = 'efekt') {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.gurultuTamponu();
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = filtreTipi;
    f.frequency.value = filtre;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ses, t + Math.min(0.04, sure * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    s.connect(f).connect(g).connect(this[kanal]);
    s.start(t);
    s.stop(t + sure + 0.05);
  },
  // Buton tipine göre tık sesi
  tik() {
    switch (S.butonTipi) {
      case 'klavye': this.gurultu(0.035, 2500, 0.5, 'highpass'); this.ton(150, 0.06, 'triangle', 0.35, 0.6); break;
      case 'atari': this.ton(880, 0.07, 'square', 0.1, 2); break;
      case 'balon': this.gurultu(0.07, 2500, 0.6); this.ton(500, 0.08, 'sine', 0.3, 0.25); break;
      case 'altin': this.ton(1318, 0.3, 'sine', 0.14); this.ton(1976, 0.25, 'sine', 0.07); break;
      default: this.ton(rastgele(520, 620), 0.08, 'triangle', 0.25, 0.5);
    }
  },
  tikBirak() {
    if (S.butonTipi === 'klavye') this.gurultu(0.025, 3500, 0.22, 'highpass');
  },
  dvd() { this.ton(rastgele(260, 340), 0.12, 'sine', 0.16, 0.7); },
  kose() { [660, 880, 1320, 1760].forEach((f, i) => setTimeout(() => this.ton(f, 0.25, 'triangle', 0.16), i * 70)); },
  satin() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.ton(f, 0.15, 'triangle', 0.14), i * 60)); },
  basari() { [784, 988, 1319].forEach((f, i) => setTimeout(() => this.ton(f, 0.35, 'sine', 0.14), i * 90)); },
  seviye() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.ton(f, 0.2, 'square', 0.07), i * 80)); },
  yanlis() { this.ton(220, 0.35, 'sawtooth', 0.1, 0.6); },
  belir() { this.ton(1046, 0.12, 'sine', 0.08); setTimeout(() => this.ton(1568, 0.18, 'sine', 0.06), 70); },
  makara() { this.ton(rastgele(700, 900), 0.03, 'square', 0.04); },
  para() { this.ton(988, 0.08, 'square', 0.08); setTimeout(() => this.ton(1319, 0.25, 'square', 0.08), 80); },
  mesaj() { this.ton(880, 0.1, 'sine', 0.15); setTimeout(() => this.ton(1175, 0.15, 'sine', 0.12), 110); },
  guc() { [523, 784, 1046, 1568].forEach((f, i) => setTimeout(() => this.ton(f, 0.15, 'sawtooth', 0.06), i * 50)); },
  vak() { this.ton(420, 0.12, 'square', 0.1, 0.6); setTimeout(() => this.ton(380, 0.15, 'square', 0.08, 0.6), 130); },
  // Final ekranı: yavaşça kabarıp çekilen dalga sesi
  dalga() {
    const c = this.ctx;
    if (!c || this._dalga) return;
    const s = c.createBufferSource();
    s.buffer = this.gurultuTamponu();
    s.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = c.createGain();
    g.gain.value = 0.12;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.1;
    lfo.connect(lfoG).connect(g.gain);
    s.connect(lp).connect(g).connect(this.ortam);
    s.start();
    lfo.start();
    this._dalga = s;
  },
  // Tam ekran tüneli: derinden uğuldayan, yavaşça dalgalanan uzay sesi
  kozmik() {
    const c = this.ctx;
    if (!c || this._kozmik) return;
    const cikis = c.createGain();
    cikis.gain.value = 0;
    cikis.gain.linearRampToValueAtTime(0.5, c.currentTime + 4);
    cikis.connect(this.ortam);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 700;
    filtre.Q.value = 6;
    filtre.connect(cikis);
    // Filtre yavaşça açılıp kapanır, ses "nefes alır"
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = c.createGain();
    lfoG.gain.value = 450;
    lfo.connect(lfoG).connect(filtre.frequency);
    lfo.start();
    // Birbirine yakın, hafif kayık frekanslar uğultuyu oluşturur
    const kaynaklar = [lfo];
    for (const [frek, tip, ses] of [[55, 'sawtooth', 0.09], [55.4, 'sawtooth', 0.09], [82.4, 'triangle', 0.07], [110.3, 'sine', 0.06], [164.8, 'sine', 0.035]]) {
      const o = c.createOscillator();
      o.type = tip;
      o.frequency.value = frek;
      const g = c.createGain();
      g.gain.value = ses;
      o.connect(g).connect(filtre);
      o.start();
      kaynaklar.push(o);
    }
    // Üstte hafif bir rüzgar
    const r = c.createBufferSource();
    r.buffer = this.gurultuTamponu();
    r.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const rg = c.createGain();
    rg.gain.value = 0.05;
    r.connect(bp).connect(rg).connect(cikis);
    r.start();
    kaynaklar.push(r);
    this._kozmik = { cikis, kaynaklar };
  },
  // Solucan deliğinde kozmik ses güçlenir
  kozmikGuclen() {
    if (!this._kozmik) return;
    this._kozmik.cikis.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 3);
  },
  hepsiniSustur() {
    if (this._yagmur) { this._yagmur.stop(); this._yagmur = null; }
    if (this._kozmik) {
      this._kozmik.kaynaklar.forEach(k => k.stop());
      this._kozmik = null;
    }
  },
  durdur() { this.ton(180, 0.08, 'triangle', 0.25, 0.6); },
  ezme() { this.gurultu(0.35, 1200, 0.45); this.ton(110, 0.35, 'sine', 0.45, 0.4); },
  kazi() { this.gurultu(0.04, 5000, 0.05, 'highpass'); },
  gok() {
    this.gurultu(rastgele(2.5, 4), 160, 0.9, 'lowpass', 'ortam');
    setTimeout(() => this.gurultu(rastgele(1.5, 2.5), 300, 0.4, 'lowpass', 'ortam'), 250);
  },
  yagmurBaslat() {
    const c = this.ctx;
    if (!c || this._yagmur) return;
    const s = c.createBufferSource();
    s.buffer = this.gurultuTamponu();
    s.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000;
    const g = c.createGain();
    g.gain.value = 0.07;
    s.connect(hp).connect(lp).connect(g).connect(this.ortam);
    s.start();
    this._yagmur = s;
  },
};

// ============ efekt tuvali (DVD'ler, yağmur) ============
const tuval = $('#fx');
const cx = tuval.getContext('2d');
let W = 0, H = 0;

function boyutla() {
  const dpr = window.devicePixelRatio || 1;
  W = innerWidth;
  H = innerHeight;
  tuval.width = W * dpr;
  tuval.height = H * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const DVD_RENKLERI = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#a55eea', '#ff6b81', '#00d2d3'];

const DVD = {
  liste: [],
  w: 100,
  h: 50,
  ekle() {
    const yon = () => (Math.random() < 0.5 ? -1 : 1) * rastgele(110, 160);
    this.liste.push({ x: rastgele(0, W - this.w), y: rastgele(0, H - this.h), vx: yon(), vy: yon(), renk: sec(DVD_RENKLERI) });
  },
  esitle() {
    while (this.liste.length < adet('dvd')) this.ekle();
  },
  guncelle(dt) {
    const pay = 6;
    const hiz = dvdHizi();
    for (const d of this.liste) {
      d.x += d.vx * dt * hiz;
      d.y += d.vy * dt * hiz;
      let carpti = false;
      if (d.x < 0) { d.x = 0; d.vx = Math.abs(d.vx); carpti = true; }
      if (d.x + this.w > W) { d.x = W - this.w; d.vx = -Math.abs(d.vx); carpti = true; }
      if (d.y < 0) { d.y = 0; d.vy = Math.abs(d.vy); carpti = true; }
      if (d.y + this.h > H) { d.y = H - this.h; d.vy = -Math.abs(d.vy); carpti = true; }
      if (!carpti) continue;
      if (adet('technicolor')) d.renk = sec(DVD_RENKLERI.filter(r => r !== d.renk));
      const kosede = (d.x <= pay || d.x + this.w >= W - pay) && (d.y <= pay || d.y + this.h >= H - pay);
      if (kosede && adet('kose')) {
        const o = dvdDegeri() * 10;
        kazan(o, 'dvd');
        S.kose++;
        Ses.kose();
        Anlatici.soyle('İnanılmaz. DVD tam köşeye çarptı. Bu an nesiller boyu anlatılacak.', true);
        Chat.olay('KÖŞEEEEE 📀');
        ucanSayi(sinirla(d.x + this.w / 2, 40, W - 40), sinirla(d.y + this.h / 2, 30, H - 30), 'KÖŞE! +' + fmt(o));
      } else {
        kazan(dvdDegeri(), 'dvd');
        if (adet('dvdses')) Ses.dvd();
      }
    }
  },
  ciz() {
    const renkli = adet('technicolor');
    for (const d of this.liste) {
      cx.save();
      cx.translate(d.x, d.y);
      cx.fillStyle = renkli ? d.renk : '#1d1d1f';
      cx.font = 'italic 900 34px "Arial Black", Arial, sans-serif';
      cx.textBaseline = 'top';
      cx.textAlign = 'center';
      cx.fillText('DVD', this.w / 2, 0);
      cx.beginPath();
      cx.ellipse(this.w / 2, 42, 46, 7, 0, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = '#fff';
      cx.font = 'bold 8px Arial, sans-serif';
      cx.textBaseline = 'middle';
      cx.fillText('VIDEO', this.w / 2, 42.5);
      cx.restore();
    }
  },
};

const Yagmur = {
  aktif: false,
  damlalar: [],
  guncelle(dt) {
    if (!this.aktif) return;
    while (this.damlalar.length < 140) {
      this.damlalar.push({ x: rastgele(0, W), y: rastgele(-H, 0), u: rastgele(10, 22), h: rastgele(500, 900) });
    }
    for (const d of this.damlalar) {
      d.y += d.h * dt;
      d.x -= d.h * dt * 0.08;
      if (d.y > H) { d.y = rastgele(-60, 0); d.x = rastgele(0, W + 100); }
    }
  },
  ciz() {
    if (!this.aktif) return;
    cx.strokeStyle = 'rgba(70, 100, 150, .28)';
    cx.lineWidth = 1.2;
    cx.beginPath();
    for (const d of this.damlalar) {
      cx.moveTo(d.x, d.y);
      cx.lineTo(d.x - d.u * 0.08, d.y + d.u);
    }
    cx.stroke();
  },
};

// ============ sabit pencereler ============
// Ekran sanal bir 1600×900 alan gibi düşünülür ve her pencerenin bu alanda kendi sabit yeri vardır.
// Pencere satın alınınca o yerde belirir; başka ne alınırsa alınsın yeri değişmez.
// Yerler dağınıktır: farklı boyutlarda, hafif eğik. Soldakiler sol kenara, sağdakiler sağ kenara yapışır;
// ortadaki 480px buton için, alttaki şerit de ördeğin yürümesi için boş kalır.
// r: derece cinsinden eğiklik. Pencere, kendi yerine sığacak kadar büyütülür ya da küçültülür.
const SANAL_W = 1600;
const SANAL_H = 900;
const ORTA_BOSLUK = 480;
const YERLER = {
  // sol taraf: videolar
  subway:    { x: 20,   y: 24,  w: 270, h: 152, r: -2 },
  lofi:      { x: 312,  y: 14,  w: 220, h: 124, r: 3 },
  slime:     { x: 300,  y: 168, w: 240, h: 135, r: -2 },
  minecraft: { x: 36,   y: 200, w: 240, h: 135, r: 2 },
  yemek:     { x: 14,   y: 360, w: 256, h: 144, r: -3 },
  gta:       { x: 300,  y: 498, w: 236, h: 133, r: 2.5 },
  fitness:   { x: 40,   y: 530, w: 230, h: 129, r: 2 },
  asmr:      { x: 284,  y: 660, w: 210, h: 118, r: 3 },
  tepki:     { x: 18,   y: 682, w: 210, h: 118, r: -2 },
  // sağ taraf: araçlar
  slot:      { x: 1056, y: 40,  w: 230, h: 115, r: -3 },
  pres:      { x: 1310, y: 20,  w: 270, h: 236, r: 2 },
  dolar:     { x: 1060, y: 190, w: 220, h: 128, r: 2 },
  whatsapp:  { x: 1316, y: 290, w: 260, h: 214, r: -2 },
  kripto:    { x: 1050, y: 352, w: 236, h: 137, r: -1.5 },
  chat:      { x: 1070, y: 520, w: 220, h: 195, r: 3 },
  ekran:     { x: 1330, y: 540, w: 240, h: 194, r: 2 },
  // açılır pencereler: kısa süreliğine bir tarafın üstüne gelir
  duo:       { x: 150,  y: 280, w: 300, h: 225, r: -2 },
  kazi:      { x: 1005, y: 300, w: 300, h: 175, r: 2 },
};
// Videolar ve hangi ses kanalına bağlı oldukları (tam ekranda hepsi tünele taşınır)
const VIDEO_KANALI = {
  subway: 'video', lofi: 'video', slime: 'video', minecraft: 'video', yemek: 'video', gta: 'video',
  fitness: 'video', tepki: 'video', asmr: 'asmr',
};

function pencere(id, baslik, icerik, genislik, govdeYuk, sinif) {
  const varolan = document.getElementById('p-' + id);
  if (varolan) return varolan;
  if (oyunBitti) return document.createElement('div');
  const p = document.createElement('div');
  p.className = 'pencere' + (sinif ? ' ' + sinif : '');
  p.id = 'p-' + id;
  p.innerHTML = `<div class="govde" style="height:${govdeYuk}px">${icerik}</div>`;
  p.setAttribute('aria-label', baslik);
  p.style.width = genislik + 'px';
  p._ayar = { genislik, yuk: govdeYuk };
  $('#pencereler').appendChild(p);
  duzenle();
  return p;
}

function pencereKapat(id) {
  const p = document.getElementById('p-' + id);
  if (!p) return;
  p.id = '';
  p.classList.add('kapan');
  setTimeout(() => p.remove(), 260);
}

// Bütün pencereleri kendi sabit yerine koyar
function duzenle() {
  const ekranW = Math.max(innerWidth, 320);
  const ekranH = Math.max(innerHeight, 320);
  const s = Math.min(ekranW / SANAL_W, ekranH / SANAL_H);
  // Raf, iki tarafın arasında kalan genişliği kullanır
  const yanW = (SANAL_W - ORTA_BOSLUK) / 2 * s;
  $('#raf').style.maxWidth = Math.max(260, ekranW - 2 * yanW - 24) + 'px';

  for (const p of document.querySelectorAll('#pencereler > .pencere')) {
    const yer = YERLER[p.id.slice(2)];
    if (!yer || !p._ayar) continue;
    const solda = yer.x < SANAL_W / 2;
    const x = solda ? yer.x * s : ekranW - (SANAL_W - yer.x) * s;
    const w = yer.w * s, h = yer.h * s;
    // Pencere, oranı bozulmadan yerine sığacak kadar ölçeklenir, yatayda ortalanır ve hafif eğilir
    const olcek = Math.min(w / p._ayar.genislik, h / p._ayar.yuk);
    p.style.left = x + (w - p._ayar.genislik * olcek) / 2 + 'px';
    p.style.top = yer.y * s + 'px';
    p.style.transformOrigin = 'top left';
    p.style.transform = `scale(${olcek}) rotate(${yer.r || 0}deg)`;
  }
}

// sesSeviyesi: videonun temel ses seviyesi (0-100). Gerçek ses, kanalın ve ana sesin ayarıyla çarpılır.
function youtubeIframe(vid, baslik, sesSeviyesi, kanal = 'video') {
  const sesli = sesSeviyesi ? ` data-sesli="${sesSeviyesi}" data-kanal="${kanal}"` : '';
  return `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&rel=0&playsinline=1&cc_load_policy=0&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}" allow="autoplay; encrypted-media; picture-in-picture"${sesli} title="${baslik}"></iframe>`;
}

// Gömülü YouTube oynatıcısına komut gönderir (ses açma/kapama)
function ytKomut(iframe, func, args = []) {
  try { iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch (e) { /* yoksay */ }
}
function videoSesleriniAyarla() {
  for (const f of document.querySelectorAll('iframe[data-sesli]')) {
    const seviye = Math.round(Number(f.dataset.sesli) * S.ses[f.dataset.kanal || 'video'] * S.ses.ana);
    if (S.sesAcik && Ses.ctx && !oyunBitti && seviye >= 1) {
      ytKomut(f, 'unMute');
      ytKomut(f, 'setVolume', [Math.min(100, seviye)]);
      ytKomut(f, 'playVideo');
    } else {
      ytKomut(f, 'mute');
    }
  }
}
function videoSesliYap(id, sesSeviyesi) {
  const f = document.querySelector(`#p-${id} iframe, #duvar iframe[data-id="${id}"]`);
  if (!f) return;
  f.dataset.sesli = sesSeviyesi;
  f.dataset.kanal = VIDEO_KANALI[id] || 'video';
  videoSesleriniAyarla();
}

// Bütün videolar sesli çalar; çok video aynı anda çaldığı için varsayılan ses kısıktır
function videoPencere(id, baslik, sesSeviyesi = 25) {
  sesSeviyesi = videoSesi(id, sesSeviyesi);
  const vid = youtubeId(AYARLAR.videolar[id]);
  // Tam ekrandayken yeni videolar pencere açmaz, doğrudan tünele katılır
  if (adet('tamEkran')) {
    if (vid) Duvar.ekle(id, vid);
    return;
  }
  const icerik = vid
    ? youtubeIframe(vid, baslik, sesSeviyesi, VIDEO_KANALI[id])
    : `<div class="bos"><div>🎬<br>ayarlar.js dosyasında<br><b>videolar.${id}</b> için YouTube linki ekle</div></div>`;
  const p = pencere(id, baslik, icerik, 320, 180);
  sesliYuklenince(p);
}
// Videonun temel ses seviyesi (0-100)
// 0: sessiz. Subway Surfers, sesli yükseltmesi alınana kadar sessiz çalar.
function videoSesi(id, varsayilan = 25) {
  if (id === 'subway') return adet('subwaySes') ? 70 : 0;
  return { lofi: 45, asmr: 60, radyo: 70 }[id] || varsayilan;
}
// Oynatıcı yüklenince sesini ayarla ve altyazıları kapat (oynatıcı komutları ancak yüklendikten sonra dinler).
// YouTube altyazıyı bazen video başladıktan sonra açtığı için kapatma birkaç kez tekrarlanır.
function oynaticiHazirlaninca(f) {
  if (!f) return;
  // YouTube oynatıcısı açılırken bir an videonun adını ve oynat düğmesini gösterir.
  // Video oynamaya başlayana kadar oynatıcı görünmez tutulur, sonra yavaşça belirir.
  f.classList.add('aciliyor');
  f.addEventListener('load', () => {
    setTimeout(() => f.classList.remove('aciliyor'), 2800);
    setTimeout(videoSesleriniAyarla, 1200);
    for (const gecikme of [1200, 4000, 10000]) {
      setTimeout(() => {
        ytKomut(f, 'unloadModule', ['captions']);
        ytKomut(f, 'unloadModule', ['cc']);
      }, gecikme);
    }
  });
}
function sesliYuklenince(p) {
  oynaticiHazirlaninca(p.querySelector('iframe'));
}

// ============ hidrolik pres ============
// Akış: Başlat → (eziliyor) → Topla → (piston kalkar) → Başlat
const NESNELER = ['🍉', '🧸', '🍩', '🥫', '🎂', '🍔', '🧃', '🎃', '🍕', '⚽', '🥚', '🍎', '🧁', '🪀', '📦'];

const Pres = {
  aktif: false,
  durum: 'hazir',   // hazir | eziyor | bitti | kalkiyor
  y: 0,             // pistonun konumu: 0 = en üst, 1 = en alt
  nesne: '',
  otoSayac: 0,
  kirintilar: [],
  kur() {
    if (this.aktif) return;
    const p = pencere('pres', 'Hidrolik Pres', '<canvas width="600" height="440"></canvas><div class="pres-alt"><button type="button" class="pres-btn"></button></div>', 300, 262);
    this.tuval = p.querySelector('canvas');
    this.cx = this.tuval.getContext('2d');
    this.btn = p.querySelector('.pres-btn');
    this.btn.addEventListener('click', () => { Ses.baslat(); this.butonaBas(); });
    this.yeniNesne();
    this.aktif = true;
    this.etiket();
  },
  yeniNesne() {
    let n;
    do n = sec(NESNELER); while (n === this.nesne);
    this.nesne = n;
  },
  hiz() { return 0.28 * (adet('presHiz') ? 1.15 : 1); },
  odul() { return Math.round(100 * olcek()); },
  butonaBas() {
    if (this.durum === 'hazir') this.durum = 'eziyor';
    else if (this.durum === 'bitti') this.topla();
    this.otoSayac = 0;
    this.etiket();
  },
  topla() {
    const o = this.odul();
    kazan(o, 'pres');
    const r = this.btn.getBoundingClientRect();
    ucanSayi(r.left + r.width / 2, r.top - 10, '+' + fmt(o));
    Ses.satin();
    this.durum = 'kalkiyor';
  },
  etiket() {
    const yazilar = { hazir: 'Başlat', eziyor: 'Eziliyor…', bitti: `Topla +${fmt(this.odul())}`, kalkiyor: 'Hazırlanıyor…' };
    this.btn.textContent = yazilar[this.durum];
    this.btn.disabled = this.durum === 'eziyor' || this.durum === 'kalkiyor';
    this.btn.classList.toggle('topla', this.durum === 'bitti');
  },
  guncelle(dt) {
    if (!this.aktif) return;
    if (this.durum === 'eziyor') {
      this.y = Math.min(1, this.y + dt * this.hiz());
      if (this.y >= 1) {
        this.durum = 'bitti';
        S.ezilen++;
        Ses.ezme();
        for (let i = 0; i < 18; i++) {
          this.kirintilar.push({ x: 300, y: 380, vx: rastgele(-260, 260), vy: rastgele(-260, -60), o: 1 });
        }
        this.otoSayac = 0;
        this.etiket();
      }
    } else if (this.durum === 'kalkiyor') {
      this.y = Math.max(0, this.y - dt * 0.9);
      if (this.y === 0) {
        this.yeniNesne();
        this.durum = 'hazir';
        this.otoSayac = 0;
        this.etiket();
      }
    }
    // Otomatik pres: kısa bir bekleyişten sonra kendisi başlatır ve toplar
    if (adet('otoPres') && (this.durum === 'hazir' || this.durum === 'bitti')) {
      this.otoSayac += dt;
      if (this.otoSayac > 0.6) this.butonaBas();
    }
    for (const k of this.kirintilar) {
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.vy += 900 * dt;
      k.o -= dt * 1.4;
    }
    this.kirintilar = this.kirintilar.filter(k => k.o > 0);
  },
  ciz() {
    if (!this.aktif) return;
    const c = this.cx;
    const zemin = 400, ust = 60, plakaYuk = 30, nesneYuk = 170;
    c.fillStyle = '#f6f3ec';
    c.fillRect(0, 0, 600, 440);
    // gövde
    c.fillStyle = '#5b6270';
    c.fillRect(70, 20, 40, zemin);
    c.fillRect(490, 20, 40, zemin);
    c.fillRect(50, 20, 500, ust - 20);
    c.fillStyle = '#3e434d';
    c.fillRect(30, zemin, 540, 30);
    // piston
    const plakaAlt = ust + plakaYuk + this.y * (zemin - ust - plakaYuk - 14);
    c.fillStyle = '#b8bec9';
    c.fillRect(270, ust, 60, plakaAlt - plakaYuk - ust);
    c.fillStyle = '#7d8592';
    c.fillRect(140, plakaAlt - plakaYuk, 320, plakaYuk);
    // nesne (toplandıktan sonra görünmez)
    if (this.durum !== 'kalkiyor') {
      const h = Math.max(8, Math.min(nesneYuk, zemin - plakaAlt));
      const sy = h / nesneYuk;
      const sx = 1 + (1 - sy) * 1.4;
      c.save();
      c.translate(300, zemin);
      c.scale(sx, sy);
      c.font = `${nesneYuk}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillText(this.nesne, 0, 12);
      c.restore();
    }
    for (const k of this.kirintilar) {
      c.globalAlpha = Math.max(0, k.o);
      c.fillStyle = '#d6604d';
      c.fillRect(k.x, k.y, 10, 10);
    }
    c.globalAlpha = 1;
  },
};

// ============ son dakika bandı ============
function bantKur() {
  const bant = $('#bant');
  if (!bant.hidden) return;
  const yazilar = AYARLAR.sonDakika || [];
  $('#bantYazi').textContent = yazilar.length ? yazilar.join('     •     ') : ' ';
  bant.hidden = false;
  document.body.classList.add('bantli');
  duzenle();
}

// ============ gök gürültüsü ============
let gokZamanlayici = null;
function gokZamanla() {
  if (gokZamanlayici) return;
  const sonraki = () => {
    gokZamanlayici = setTimeout(() => {
      if (oyunBitti) return;
      const f = $('#flas');
      f.classList.remove('cak');
      void f.offsetWidth;
      f.classList.add('cak');
      Ses.gok();
      sonraki();
    }, rastgele(12000, 28000));
  };
  sonraki();
}

// ============ ekran süresi ============
const KAYNAK_ADLARI = {
  tik: 'Tıklama', dvd: 'DVD', pres: 'Hidrolik Pres', basarim: 'Başarımlar', seviye: 'Seviye ödülleri',
  kazi: 'Kazı Kazan', slot: 'Slot Makinesi', dolar: 'Dolar', kripto: 'Kripto', duolingo: 'Duolingo',
  whatsapp: 'WhatsApp', sms: 'SMS', ordek: 'Ördek', debug: 'Debug', diger: 'Diğer',
};
const kaynakAdi = k => KAYNAK_ADLARI[k] || (YUKSELTMELER.find(y => y.id === k) || {}).ad || k;

const Ekran = {
  kur() {
    if (this.p) return;
    this.p = pencere('ekran', 'Ekran Süresi', '<div class="ekran"><div class="ekran-sure"></div><div class="ekran-artis"></div><div class="ekran-liste"></div></div>', 260, 210);
    this.ciz();
  },
  ciz() {
    if (!this.p) return;
    this.p.querySelector('.ekran-sure').textContent = sureFmt(S.sure);
    this.p.querySelector('.ekran-artis').textContent = `Geçen haftaya göre ▲ %${fmt(Math.min(999, 40 + S.sure / 20))}`;
    const sirali = Object.entries(S.kaynaklar).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const enCok = sirali.length ? sirali[0][1] : 1;
    const liste = this.p.querySelector('.ekran-liste');
    liste.innerHTML = '';
    for (const [k, v] of sirali) {
      const satir = document.createElement('div');
      satir.className = 'ekran-satir';
      satir.innerHTML = '<span class="ad"></span><span class="cubuk"><i></i></span><span class="deger"></span>';
      satir.querySelector('.ad').textContent = kaynakAdi(k);
      satir.querySelector('i').style.width = (100 * v / enCok) + '%';
      satir.querySelector('.deger').textContent = fmt(v);
      liste.appendChild(satir);
    }
  },
};

// ============ seviyeler ============
const Seviye = {
  enFazla: 50,
  gereken: l => Math.round(150 * Math.pow(l, 2.1)),
  xpEkle(n) {
    if (!adet('seviye') || S.seviye >= this.enFazla) return;
    S.xp += n;
    while (S.seviye < this.enFazla && S.xp >= this.gereken(S.seviye)) {
      S.xp -= this.gereken(S.seviye);
      S.seviye++;
      const odul = S.seviye * 100;
      kazan(odul, 'seviye');
      bildirim(`⭐ Seviye ${S.seviye}!`, `+${fmt(odul)} dopamin`);
      Ses.seviye();
    }
  },
  ciz() {
    if (!adet('seviye')) return;
    const oran = S.seviye >= this.enFazla ? 1 : S.xp / this.gereken(S.seviye);
    $('#seviyeNo').textContent = 'Seviye ' + S.seviye;
    $('#seviyeYuzde').textContent = S.seviye >= this.enFazla ? 'MAKS' : '%' + Math.floor(oran * 100);
    $('#seviyeDolu').style.width = (oran * 100) + '%';
  },
};

// ============ radyo ============
// Radyonun ekranı yoktur, sadece sesi çalar. YouTube linkiyse oynatıcı görünmez bir köşede durur
// (ekran dışına konursa tarayıcı onu durdurabildiği için ekranın içinde ama görünmez tutulur).
const Radyo = {
  ses: null,
  kur() {
    if (this.el) return;
    const kaynak = (AYARLAR.radyo || '').trim();
    if (!kaynak) return;
    const el = document.createElement('div');
    el.id = 'radyoGizli';
    el.setAttribute('aria-hidden', 'true');
    const vid = youtubeId(kaynak);
    el.innerHTML = vid ? youtubeIframe(vid, 'Radyo', videoSesi('radyo'), 'radyo') : '<audio></audio>';
    document.body.appendChild(el);
    this.el = el;
    oynaticiHazirlaninca(el.querySelector('iframe'));
    this.ses = el.querySelector('audio');
    if (this.ses) {
      this.ses.src = kaynak;
      this.sesAyarla();
      this.cal();
    }
  },
  cal() {
    if (this.ses && this.ses.paused) this.ses.play().catch(() => { /* ilk dokunuşta tekrar denenir */ });
  },
  sesAyarla() {
    if (!this.ses) return;
    this.ses.muted = !S.sesAcik;
    this.ses.volume = sinirla(S.ses.radyo * S.ses.ana, 0, 1);
  },
};

// ============ eşya dükkanı ============
const BUTON_TIPLERI = [
  // tik: sahip olunca tık başına kalıcı olarak eklenen dopamin
  { id: 'klasik', ad: 'Klasik', fiyat: 0, tik: 0 },
  { id: 'klavye', ad: 'Mekanik Klavye Tuşu', fiyat: 2500, tik: 5 },
  { id: 'atari', ad: 'Atari Butonu', fiyat: 6000, tik: 15 },
  { id: 'balon', ad: 'Balon', fiyat: 12000, tik: 40 },
  { id: 'altin', ad: 'Altın Buton', fiyat: 40000, tik: 150 },
];

// Eşyalar, raftaki 🛍️ ikonuna tıklayınca açılan panelde durur
const Esya = {
  kur() {
    if (this.acik) return;
    this.acik = true;
    dukkanCiz(true);
  },
  panelAcKapa() {
    const p = $('#esyaPanel');
    p.hidden = !p.hidden;
    this.ciz();
  },
  tak(id) {
    S.butonTipi = id;
    const b = $('#buton');
    for (const t of BUTON_TIPLERI) b.classList.remove('tip-' + t.id);
    b.classList.add('tip-' + id);
  },
  sec(t) {
    if (S.esyalar[t.id]) {
      this.tak(t.id);
    } else {
      if (S.dopamin < t.fiyat) return;
      S.dopamin -= t.fiyat;
      S.esyalar[t.id] = true;
      this.tak(t.id);
      Ses.satin();
    }
    Ses.tik();
    this.ciz();
    kaydet();
  },
  ciz() {
    const liste = $('#esyaListe');
    if (!this.acik || $('#esyaPanel').hidden) return;
    liste.innerHTML = '';
    for (const t of BUTON_TIPLERI) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'esya';
      const takili = S.butonTipi === t.id;
      const sahip = S.esyalar[t.id];
      b.classList.toggle('takili', takili);
      b.classList.toggle('pahali', !sahip && S.dopamin < t.fiyat);
      b.innerHTML = '<span class="ad"></span><span class="durum"></span>';
      b.querySelector('.ad').textContent = t.ad;
      if (t.tik) {
        const bonus = document.createElement('small');
        bonus.textContent = ` +${t.tik} tık`;
        bonus.classList.toggle('kazanildi', !!sahip);
        b.querySelector('.ad').appendChild(bonus);
      }
      b.querySelector('.durum').textContent = takili ? 'Takılı' : sahip ? 'Tak' : fmt(t.fiyat);
      b.addEventListener('click', () => this.sec(t));
      liste.appendChild(b);
    }
  },
};

// ============ kazı kazan ============
// Üç kutuda para ya da ✖ çıkar. Üçü de aynı miktarsa o miktar kazanılır.
const KAZI_ODULLERI = [
  { odul: 250, agirlik: 40 },
  { odul: 500, agirlik: 30 },
  { odul: 1000, agirlik: 18 },
  { odul: 2500, agirlik: 9 },
  { odul: 10000, agirlik: 3 },
];
const KAZI_CARPI = { odul: 0, agirlik: 45 };
function agirlikliSec(liste) {
  let r = Math.random() * liste.reduce((t, x) => t + x.agirlik, 0);
  for (const x of liste) if ((r -= x.agirlik) < 0) return x;
  return liste[0];
}

const Kazi = {
  zamanlayici: null,
  zamanla() {
    if (this.zamanlayici) return;
    const sonraki = () => {
      this.zamanlayici = setTimeout(() => { this.ac(); sonraki(); }, rastgele(45000, 90000));
    };
    sonraki();
  },
  ac() {
    if (oyunBitti || document.getElementById('p-kazi')) return;
    // %40 ihtimalle üç kutuda aynı miktar çıkar. Kaybeden bilette en az bir ✖ olur.
    let semboller;
    if (Math.random() < 0.4) {
      const k = agirlikliSec(KAZI_ODULLERI);
      semboller = [k, k, k];
    } else {
      const havuz = [...KAZI_ODULLERI, KAZI_CARPI];
      do semboller = [0, 1, 2].map(() => agirlikliSec(havuz));
      while (!semboller.includes(KAZI_CARPI));
      // Nadiren üç kutu da ✖ olur (Kara Kedi başarımı)
      if (Math.random() < 0.06) semboller = [KAZI_CARPI, KAZI_CARPI, KAZI_CARPI];
    }
    const carpan = olcek();
    const miktar = s => yuvarla(s.odul * carpan);
    const p = pencere('kazi', 'Kazı Kazan', '<div class="kazi"><canvas class="alt" width="520" height="220"></canvas><canvas class="ust" width="520" height="220"></canvas></div><div class="kazi-not">Kazımak için sürükle</div>', 260, 140, 'kazi-pencere');

    const alt = p.querySelector('.alt').getContext('2d');
    alt.fillStyle = '#fff8e1';
    alt.fillRect(0, 0, 520, 220);
    alt.textAlign = 'center';
    alt.textBaseline = 'middle';
    semboller.forEach((s, i) => {
      const x = 95 + i * 165;
      alt.fillStyle = '#fff';
      alt.strokeStyle = '#f0d98a';
      alt.lineWidth = 4;
      alt.beginPath();
      alt.roundRect(x - 72, 30, 144, 160, 18);
      alt.fill();
      alt.stroke();
      if (s === KAZI_CARPI) {
        alt.fillStyle = '#d63045';
        alt.font = 'bold 110px system-ui, sans-serif';
        alt.fillText('✖', x, 112);
      } else {
        alt.font = '50px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        alt.fillText('💰', x, 80);
        alt.fillStyle = '#1a9e50';
        const yazi = fmt(miktar(s));
        alt.font = `800 ${yazi.length > 6 ? 30 : 38}px system-ui, sans-serif`;
        alt.fillText(yazi, x, 145);
      }
    });

    const ustT = p.querySelector('.ust');
    const ust = ustT.getContext('2d');
    const gradyan = ust.createLinearGradient(0, 0, 520, 220);
    gradyan.addColorStop(0, '#c9ccd1');
    gradyan.addColorStop(0.5, '#eef0f3');
    gradyan.addColorStop(1, '#aeb3ba');
    ust.fillStyle = gradyan;
    ust.fillRect(0, 0, 520, 220);
    ust.fillStyle = '#8a9099';
    ust.font = 'bold 40px system-ui, sans-serif';
    ust.textAlign = 'center';
    ust.textBaseline = 'middle';
    ust.fillText('KAZI KAZAN', 260, 110);
    ust.globalCompositeOperation = 'destination-out';

    let kaziyor = false, hamle = 0, bitti = false;
    const kazi = e => {
      if (!kaziyor || bitti) return;
      const r = ustT.getBoundingClientRect();
      const x = (e.clientX - r.left) * (520 / r.width);
      const y = (e.clientY - r.top) * (220 / r.height);
      ust.beginPath();
      ust.arc(x, y, 30, 0, Math.PI * 2);
      ust.fill();
      if (++hamle % 6 === 0) Ses.kazi();
      if (hamle % 10 === 0 && this.acikOran(ust) > 0.55) {
        bitti = true;
        ust.clearRect(0, 0, 520, 220);
        this.sonuc(p, semboller, miktar);
      }
    };
    ustT.addEventListener('pointerdown', e => { kaziyor = true; ustT.setPointerCapture(e.pointerId); kazi(e); });
    ustT.addEventListener('pointermove', kazi);
    ustT.addEventListener('pointerup', () => { kaziyor = false; });
    // Hiç kazınmazsa bilet bir süre sonra kaybolur
    setTimeout(() => { if (!bitti) pencereKapat('kazi'); }, 40000);
  },
  acikOran(ust) {
    const d = ust.getImageData(0, 0, 520, 220).data;
    let bos = 0, toplam = 0;
    for (let i = 3; i < d.length; i += 4 * 16) { toplam++; if (d[i] === 0) bos++; }
    return bos / toplam;
  },
  sonuc(p, semboller, miktar) {
    const not = p.querySelector('.kazi-not');
    S.kazilan++;
    if (semboller.every(x => x === KAZI_CARPI)) S.ucCarpi = (S.ucCarpi || 0) + 1;
    if (semboller[0] === semboller[1] && semboller[1] === semboller[2]) {
      const o = miktar(semboller[0]);
      kazan(o, 'kazi');
      not.textContent = `Kazandın! +${fmt(o)} dopamin`;
      not.classList.add('kazandi');
      Ses.basari();
    } else {
      not.textContent = 'Bu sefer olmadı. Bir dahakine!';
      Ses.yanlis();
    }
    setTimeout(() => pencereKapat('kazi'), 3000);
  },
};

// ============ slot makinesi ============
// Jetonla çevrilir: en fazla 3 jeton birikir, her 30 saniyede bir jeton gelir.
// Kazanç elindeki dopamini katlar, böylece oyunun sonunda da anlamlı kalır:
// üç aynı meyve elindekini meyvenin çarpanıyla çarpar, iki aynı meyve %5 ekler.
// Oyunun başında elinde az para varken de bir şey kazanılsın diye en az "taban" kadar verir.
const SLOT_MEYVELERI = [
  { s: '🍒', carpan: 1.2, taban: 200, agirlik: 30 },
  { s: '🍋', carpan: 1.3, taban: 320, agirlik: 25 },
  { s: '🍇', carpan: 1.5, taban: 480, agirlik: 20 },
  { s: '🍉', carpan: 1.75, taban: 800, agirlik: 13 },
  { s: '🔔', carpan: 2, taban: 1600, agirlik: 8 },
  { s: '7️⃣', carpan: 3, taban: 4000, agirlik: 4 },
];
const SLOT_IKILI_ORAN = 0.05;
const SLOT_JETON_EN_FAZLA = 3;
const SLOT_JETON_SURESI = 30;

const Slot = {
  donuyor: false,
  kur() {
    if (this.p) return;
    this.p = pencere('slot', 'Slot Makinesi', `
      <div class="slot">
        <div class="makaralar"><span>🍒</span><span>🍋</span><span>7️⃣</span></div>
        <div class="slot-alt">
          <span class="slot-jeton"></span>
          <button type="button" class="slot-btn">Çevir</button>
        </div>
      </div>`, 300, 150);
    this.makaralar = [...this.p.querySelectorAll('.makaralar span')];
    this.btn = this.p.querySelector('.slot-btn');
    this.btn.addEventListener('click', () => { Ses.baslat(); this.cevir(); });
    if (S.slotJeton === undefined) S.slotJeton = SLOT_JETON_EN_FAZLA;
    this.ciz();
  },
  guncelle(dt) {
    if (!this.p) return;
    if (S.slotJeton < SLOT_JETON_EN_FAZLA) {
      S.slotSayac = (S.slotSayac || 0) + dt;
      if (S.slotSayac >= SLOT_JETON_SURESI) {
        S.slotSayac = 0;
        S.slotJeton++;
      }
    } else {
      S.slotSayac = 0;
    }
  },
  cevir() {
    if (this.donuyor) return;
    if (S.slotJeton > 0) S.slotJeton--;
    else if (adet('jeton') && S.jeton > 0) Jeton.harca(1);
    else return;
    this.donuyor = true;
    const sonuc = [0, 1, 2].map(() => agirlikliSec(SLOT_MEYVELERI));
    // Makaralar hızla döner ve soldan sağa sırayla durur
    const durmalar = [700, 1050, 1400];
    const baslangic = performance.now();
    const adim = () => {
      const gecen = performance.now() - baslangic;
      let hepsiDurdu = true;
      this.makaralar.forEach((m, i) => {
        if (gecen < durmalar[i]) {
          hepsiDurdu = false;
          m.textContent = sec(SLOT_MEYVELERI).s;
          m.classList.add('donuyor');
        } else if (m.classList.contains('donuyor')) {
          m.classList.remove('donuyor');
          m.textContent = sonuc[i].s;
          Ses.durdur();
        }
      });
      if (!hepsiDurdu) {
        Ses.makara();
        setTimeout(adim, 70);
      } else {
        this.bitir(sonuc);
      }
    };
    adim();
    this.ciz();
  },
  bitir(sonuc) {
    this.donuyor = false;
    const [a, b, c] = sonuc;
    let o = 0, yazi;
    if (a === b && b === c) {
      o = Math.round(Math.max(S.dopamin * (a.carpan - 1), a.taban * olcek()));
      yazi = `JACKPOT! ×${String(a.carpan).replace('.', ',')} +${fmt(o)}`;
      S.jackpot++;
      Anlatici.soyle('Üç aynı meyve. Bu an hiç bitmesin istiyor.', true);
      Chat.olay('JACKPOT 🎰🎰🎰');
      Ses.kose();
    } else if (a === b || b === c || a === c) {
      o = Math.round(Math.max(S.dopamin * SLOT_IKILI_ORAN, 40 * olcek()));
      yazi = '+' + fmt(o);
      Ses.satin();
    } else {
      Ses.yanlis();
    }
    if (o) {
      kazan(o, 'slot');
      const r = this.p.getBoundingClientRect();
      ucanSayi(r.left + r.width / 2, r.top + r.height * 0.3, yazi);
    }
    S.slotCevrilen = (S.slotCevrilen || 0) + 1;
    this.ciz();
  },
  ciz() {
    if (!this.p) return;
    const kalan = Math.ceil(SLOT_JETON_SURESI - (S.slotSayac || 0));
    this.p.querySelector('.slot-jeton').textContent = `🎟️ ${S.slotJeton}/${SLOT_JETON_EN_FAZLA}` + (S.slotJeton < SLOT_JETON_EN_FAZLA ? ` · ${kalan} sn` : '');
    // Hak bitince oyun içi parayla (🪙) çevrilebilir
    const jetonla = S.slotJeton <= 0 && adet('jeton') && S.jeton > 0;
    this.btn.disabled = this.donuyor || (S.slotJeton <= 0 && !jetonla);
    this.btn.textContent = this.donuyor ? 'Dönüyor…' : jetonla ? 'Çevir (1 🪙)' : 'Çevir';
  },
};

// ============ piyasalar: dolar ve kripto ============
// Al, bekle, sat. Satınca ana para geri gelir; kâr kazanç sayılır, zarar dopaminden düşer.
// Kaldıraç yükseltmesi kârı da zararı da 2 katına çıkarır.
function piyasa(o) {
  return {
    kur() {
      if (this.p) return;
      if (!S.piyasalar[o.id]) S.piyasalar[o.id] = { kur: o.baslangic, gecmis: [o.baslangic], miktar: 0, maliyet: 0, kar: 0 };
      this.p = pencere(o.id, o.baslik, `
        <canvas class="grafik" width="640" height="220"></canvas>
        <div class="dolar-alt">
          <div class="dolar-bilgi"><b class="kur-yazi"></b><span class="cuzdan"></span></div>
          <div class="dolar-btnlar">
            <button type="button" data-is="ceyrek">%25 al</button>
            <button type="button" data-is="hepsi">Hepsini al</button>
            <button type="button" data-is="sat">Sat</button>
          </div>
        </div>`, 320, 186, 'piyasa-pencere');
      this.grafik = this.p.querySelector('.grafik').getContext('2d');
      this.p.querySelector('.dolar-btnlar').addEventListener('click', e => {
        const is = e.target.dataset && e.target.dataset.is;
        if (is === 'ceyrek') this.al(S.dopamin * 0.25);
        else if (is === 'hepsi') this.al(S.dopamin);
        else if (is === 'sat') this.sat();
      });
      this.zaman = 0;
      this.ciz();
    },
    get d() { return S.piyasalar[o.id]; },
    al(miktar) {
      miktar = Math.floor(miktar);
      if (miktar < 1) return;
      S.dopamin -= miktar;
      this.d.miktar += miktar / this.d.kur;
      this.d.maliyet += miktar;
      Ses.satin();
      this.ciz();
    },
    sat() {
      const d = this.d;
      if (d.miktar <= 0) return;
      let fark = d.miktar * d.kur - d.maliyet;
      if (adet('kaldirac')) fark *= 2;
      S.dopamin += d.maliyet;
      const r = this.p.getBoundingClientRect();
      if (fark >= 0) {
        kazan(fark, o.id);
        d.kar += fark;
        ucanSayi(r.left + r.width / 2, r.top + 40, '+' + fmt(fark) + ' kâr');
        Ses.basari();
      } else {
        S.dopamin = Math.max(0, S.dopamin + fark);
        ucanSayi(r.left + r.width / 2, r.top + 40, '-' + fmt(-fark) + ' zarar');
        Ses.yanlis();
        Chat.olay('zarar ettin KEKW');
      }
      d.miktar = 0;
      d.maliyet = 0;
      this.ciz();
    },
    guncelle(dt) {
      if (!this.p) return;
      this.zaman += dt;
      if (this.zaman < 2) return;
      this.zaman = 0;
      const d = this.d;
      d.kur = Math.max(o.taban || 0.01, d.kur * (1 + o.degisim()));
      d.gecmis.push(d.kur);
      if (d.gecmis.length > 90) d.gecmis.shift();
      this.ciz();
    },
    ciz() {
      if (!this.p) return;
      const d = this.d;
      this.p.querySelector('.kur-yazi').textContent = `1 ${o.birim} = ${ondalikFmt.format(d.kur)} dopamin`;
      const deger = d.miktar * d.kur;
      const cuzdan = this.p.querySelector('.cuzdan');
      cuzdan.textContent = d.miktar > 0 ? `Cüzdan: ≈ ${fmt(deger)} (${deger >= d.maliyet ? '▲' : '▼'})` : 'Cüzdan boş';
      cuzdan.classList.toggle('zararda', d.miktar > 0 && deger < d.maliyet);
      const c = this.grafik;
      const g = d.gecmis;
      c.fillStyle = '#0f1419';
      c.fillRect(0, 0, 640, 220);
      if (g.length < 2) return;
      const min = Math.min(...g), max = Math.max(...g);
      const aralik = Math.max(max - min, max * 0.002);
      const nx = i => 10 + (i / (g.length - 1)) * 620;
      const ny = v => 200 - ((v - min) / aralik) * 180;
      const renk = g[g.length - 1] >= g[0] ? [46, 213, 115] : [255, 71, 87];
      c.beginPath();
      g.forEach((v, i) => (i ? c.lineTo(nx(i), ny(v)) : c.moveTo(nx(i), ny(v))));
      c.lineTo(630, 210);
      c.lineTo(10, 210);
      c.closePath();
      const dolgu = c.createLinearGradient(0, 0, 0, 220);
      dolgu.addColorStop(0, `rgba(${renk}, .45)`);
      dolgu.addColorStop(1, `rgba(${renk}, 0)`);
      c.fillStyle = dolgu;
      c.fill();
      c.beginPath();
      g.forEach((v, i) => (i ? c.lineTo(nx(i), ny(v)) : c.moveTo(nx(i), ny(v))));
      c.strokeStyle = `rgb(${renk})`;
      c.lineWidth = 4;
      c.stroke();
    },
  };
}

// Dolar uzun vadede hep yükselir ama inişli çıkışlıdır: küçük dalgalanmaların yanında ara sıra
// sert düşer. Ortalamada her 2 saniyede ~%0,08 artar; bir saatte aşağı yukarı 4-5 katına çıkar.
const Dolar = piyasa({
  id: 'dolar', baslik: 'USD / TRY', birim: '$', baslangic: 34.5,
  degisim: () => (Math.random() < 0.03 ? -rastgele(0.03, 0.06) : rastgele(-0.005, 0.0095)),
});
// Kripto çılgınca oynar: ara sıra çakılır, ara sıra uçar
const Kripto = piyasa({
  id: 'kripto', baslik: 'DopaCoin / DPC', birim: 'DPC', baslangic: 1000, taban: 1,
  degisim: () => {
    const r = Math.random();
    if (r < 0.02) return -rastgele(0.2, 0.4);
    if (r < 0.04) return rastgele(0.25, 0.5);
    return rastgele(-0.045, 0.05);
  },
});

// ============ aile whatsapp grubu ============
// [kim, mesaj, uygun cevap]. Her mesaja üç şık çıkar: biri uygun cevap, ikisi başka mesajların cevabı.
// Sadece uygun cevap dopamin verir; alakasız cevap verilirse aile tepki gösterir.
const AILE_MESAJLARI = [
  ['Annen', 'Günaydın 🌹☕', 'Günaydın anne 🌸'],
  ['Teyze', 'Hayırlı sabahlar canlarım 🌸🌸🌸', 'Size de teyze'],
  ['Dayı', '🎥 Video · Bunu mutlaka izleyin!!', 'İzledim dayı 👍'],
  ['Babaannen', 'Torunum nasılsın?', 'İyiyim babaanne 😊'],
  ['Hala', 'Bu mesajı 10 kişiye göndermezseniz 7 yıl şanssızlık...', 'Gönderdim hala 🙄'],
  ['Annen', 'Yemek hazır, neredesin?', 'Geliyorum!'],
  ['Teyze', 'Evlenmiyor musun artık? 😊', 'Kısmet teyze 😅'],
  ['Enişte', 'Dolar ne olacak böyle', 'Bilmiyorum enişte'],
  ['Kuzen', 'grubu sessize aldım', 'Ben de 🤫'],
  ['Babaannen', 'ALO BENİ DUYUYOR MUSUNUZ', 'Duyuyoruz babaanne'],
  ['Annen', 'Kaç saattir telefondasın', 'Bırakıyorum şimdi'],
  ['Dayı', 'Bu bilgi çok önemli herkes okusun‼️', 'Okudum dayı'],
  ['Hala', 'İyi geceler 🌙✨ tatlı rüyalar', 'İyi geceler hala 🌙'],
  ['Teyze', '🎤 Sesli mesaj · 0:47', 'Dinledim teyze'],
  ['Baban', 'Eve gelirken ekmek al', 'Tamam baba'],
  ['Annen', 'Ceketini al hava soğuk', 'Aldım anne'],
  ['Babaannen', 'Hayırlı cumalar 🌹🕌', 'Amin 🙏'],
  ['Dayı', 'Maçı izliyor musunuz', 'Gol oldu mu?'],
];
// Alakasız cevap verilince gelen tepkiler
const AILE_TEPKILERI = ['?', 'Ne alakası var', 'Yine telefona gömülmüş', 'Mesajı okumadın değil mi', '🤨', 'Anlamadım'];

const Whatsapp = {
  bekleyenler: [],   // cevap bekleyen mesajlar (en eskisi önce)
  kur() {
    if (this.p) return;
    this.p = pencere('whatsapp', 'Aile 👨‍👩‍👧‍👦', '<div class="wp"><div class="wp-akis"></div><div class="wp-cevaplar"></div></div>', 280, 230, 'wp-pencere');
    this.akis = this.p.querySelector('.wp-akis');
    this.cevaplar = this.p.querySelector('.wp-cevaplar');
    this.cevaplar.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) this.cevapla(b.textContent);
    });
    this.yeniMesaj();
    const sonraki = () => { this.z = setTimeout(() => { this.yeniMesaj(); sonraki(); }, rastgele(8000, 18000)); };
    sonraki();
  },
  ekle(kim, yazi, benim) {
    const d = document.createElement('div');
    d.className = 'wp-mesaj' + (benim ? ' benim' : '');
    d.innerHTML = '<b></b><span></span>';
    d.querySelector('b').textContent = kim;
    d.querySelector('span').textContent = yazi;
    this.akis.appendChild(d);
    while (this.akis.children.length > 6) this.akis.firstChild.remove();
    this.akis.scrollTop = this.akis.scrollHeight;
  },
  yeniMesaj() {
    if (oyunBitti) return;
    const mesaj = sec(AILE_MESAJLARI);
    this.ekle(mesaj[0], mesaj[1]);
    // En fazla 3 mesaj bekler; dördüncü gelince en eskisi cevapsız kalır
    this.bekleyenler.push(mesaj);
    if (this.bekleyenler.length > 3) this.bekleyenler.shift();
    Ses.mesaj();
    if (this.bekleyenler.length === 1) this.butonlar();
  },
  butonlar() {
    this.cevaplar.innerHTML = '';
    const mesaj = this.bekleyenler[0];
    if (!mesaj) {
      this.cevaplar.innerHTML = '<span class="wp-bos">Herkese cevap verildi ✓✓</span>';
      return;
    }
    const yanlislar = karistir(AILE_MESAJLARI.filter(m => m[2] !== mesaj[2]).map(m => m[2])).slice(0, 2);
    const alinti = document.createElement('div');
    alinti.className = 'wp-alinti';
    alinti.textContent = `↩ ${mesaj[0]}: ${mesaj[1]}`;
    const satir = document.createElement('div');
    satir.className = 'wp-sik';
    for (const c of karistir([mesaj[2], ...yanlislar])) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      satir.appendChild(b);
    }
    this.cevaplar.append(alinti, satir);
  },
  cevapla(yazi) {
    const mesaj = this.bekleyenler.shift();
    if (!mesaj) return;
    this.ekle('Sen', yazi, true);
    const r = this.cevaplar.getBoundingClientRect();
    if (yazi === mesaj[2]) {
      const o = Math.round(300 * olcek());
      kazan(o, 'whatsapp');
      ucanSayi(r.left + r.width / 2, r.top, '+' + fmt(o));
      Ses.tik();
    } else {
      Ses.yanlis();
      setTimeout(() => this.ekle(mesaj[0], sec(AILE_TEPKILERI)), 700);
    }
    this.butonlar();
  },
};

// ============ sms ============
const SMS_MESAJLARI = [
  ['Kargo', 'Kargonuz yola çıktı 📦 Takip için tıklayın.'],
  ['BANKA', 'Sn. müşterimiz, kartınızla 0,01 TL harcama yapıldı.'],
  ['Annen', 'Neredesin? Arıyorum açmıyorsun.'],
  ['MAĞAZA', 'Sadece bugün %70 indirim! Kaçırma 🔥'],
  ['Operatör', "Paketinizin %80'ini kullandınız."],
  ['Doğrulama', 'Doğrulama kodunuz: 482910. Kimseyle paylaşmayın.'],
  ['Bilinmeyen', 'Tebrikler! Bir telefon kazandınız (kazanmadınız).'],
  ['Kurye', 'Siparişiniz 3 dakika içinde kapınızda 🛵'],
  ['Belediye', 'Yarın 09:00-17:00 arası su kesintisi yapılacaktır.'],
  ['Arkadaşın', 'naber kanka bi bakar mısın'],
  ['Oyun', 'Günlük ödülün seni bekliyor 🎁'],
  ['Spor Salonu', 'Seni özledik! 3 aydır gelmiyorsun.'],
];

const Sms = {
  zamanla() {
    if (this.z) return;
    const sonraki = () => { this.z = setTimeout(() => { this.ac(); sonraki(); }, rastgele(15000, 35000)); };
    sonraki();
  },
  ac() {
    if (oyunBitti) return;
    const [kim, yazi] = sec(SMS_MESAJLARI);
    const o = Math.round(250 * olcek());
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'sms';
    d.innerHTML = '<span class="sms-ikon">✉️</span><span class="sms-govde"><b></b><span></span></span><span class="sms-zaman">şimdi</span>';
    d.querySelector('b').textContent = kim;
    d.querySelector('.sms-govde span').textContent = yazi;
    const kapat = () => { d.classList.add('git'); setTimeout(() => d.remove(), 300); };
    d.addEventListener('click', e => {
      kazan(o, 'sms');
      ucanSayi(e.clientX, e.clientY, '+' + fmt(o));
      Ses.tik();
      kapat();
    });
    const kutu = $('#smsler');
    kutu.prepend(d);
    while (kutu.children.length > 3) kutu.lastChild.remove();
    Ses.mesaj();
    setTimeout(kapat, 7000);
  },
};

// ============ oyun içi para (🪙) ============
// Ekranda ara sıra para belirir, tıklayınca toplanır. 5 para = 30 saniye 2 kat dopamin.
// Slot hakkı bitince 1 parayla da çevrilebilir.
const Jeton = {
  kur() {
    if (this.acik) return;
    this.acik = true;
    $('#jetonKutu').hidden = false;
    $('#jetonBoost').addEventListener('click', () => this.boost());
    this.ciz();
    const sonraki = () => { this.z = setTimeout(() => { this.paraAt(); sonraki(); }, rastgele(8000, 18000)); };
    sonraki();
  },
  ekle(n) { S.jeton += n; this.ciz(); },
  harca(n) { S.jeton -= n; this.ciz(); },
  boost() {
    if (S.jeton < 5) return;
    this.harca(5);
    Guc.baslat('ikiKat', 30);
    Ses.guc();
    Anlatici.soyle('Beş jeton harcadı. Karşılığında otuz saniyelik bir mutluluk.');
  },
  ciz() {
    if (!this.acik) return;
    $('#jetonSayi').textContent = fmt(S.jeton);
    $('#jetonBoost').disabled = S.jeton < 5;
  },
  paraAt() {
    if (oyunBitti) return;
    const miktar = Math.random() < 0.15 ? 3 : 1;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toplanir para';
    b.textContent = '🪙';
    b.style.left = rastgele(20, 80) + 'vw';
    b.style.top = rastgele(15, 75) + 'vh';
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.ekle(miktar);
      Ses.para();
      ucanSayi(e.clientX, e.clientY, `+${miktar} 🪙`);
      b.remove();
    });
    $('#toplanabilir').appendChild(b);
    setTimeout(() => b.remove(), 6000);
  },
};

// ============ güçlendirmeler ============
const GUCLER = {
  altinTik: { ad: 'Altın Tık', ikon: '👆', sure: 15, acik: 'Tıklar 10 kat' },
  cilginlik: { ad: 'Çılgınlık', ikon: '🔥', sure: 12, acik: 'Saniye başı kazanç 5 kat' },
  dvdFirtina: { ad: 'DVD Fırtınası', ikon: '📀', sure: 15, acik: "DVD'ler 3 kat hızlı, 3 kat değerli" },
};
// "2 kat" para güçlendirmesi bunlara işlemez
const GUC_HARIC = new Set(['basarim', 'seviye', 'dolar', 'kripto', 'duolingo']);
const PASIF = new Set(YUKSELTMELER.filter(y => y.sps).map(y => y.id));

const Guc = {
  aktif: {},   // güçlendirme -> bitiş zamanı (oyun süresi, saniye)
  var(ad) { return (this.aktif[ad] || 0) > S.sure; },
  carpan(kaynak) {
    let c = 1;
    if (this.var('ikiKat') && !GUC_HARIC.has(kaynak)) c *= 2;
    if (kaynak === 'tik' && this.var('altinTik')) c *= 10;
    if (kaynak === 'dvd' && this.var('dvdFirtina')) c *= 3;
    if (PASIF.has(kaynak) && this.var('cilginlik')) c *= 5;
    return c;
  },
  baslat(ad, sure) {
    this.aktif[ad] = Math.max(this.aktif[ad] || 0, S.sure) + sure;
    this.ciz();
  },
  zamanla() {
    if (this.z) return;
    const sonraki = () => { this.z = setTimeout(() => { this.ac(); sonraki(); }, rastgele(25000, 50000)); };
    sonraki();
  },
  ac() {
    if (oyunBitti) return;
    const tur = sec(Object.keys(GUCLER));
    const g = GUCLER[tur];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toplanir guc-kure';
    b.textContent = g.ikon;
    b.style.left = rastgele(20, 80) + 'vw';
    b.style.top = rastgele(15, 75) + 'vh';
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.baslat(tur, g.sure);
      Ses.guc();
      bildirim(`${g.ikon} ${g.ad}!`, `${g.acik} · ${g.sure} sn`);
      Anlatici.soyle(`${g.ad}. Ekranda parlayan her şeye uzanmak, türün doğasında var.`);
      Chat.olay(g.ad.toUpperCase() + ' 🔥🔥');
      b.remove();
    });
    $('#toplanabilir').appendChild(b);
    setTimeout(() => b.remove(), 7000);
  },
  ciz() {
    const kutu = $('#etkiler');
    kutu.innerHTML = '';
    for (const [ad, bitis] of Object.entries(this.aktif)) {
      const kalan = Math.ceil(bitis - S.sure);
      if (kalan <= 0) { delete this.aktif[ad]; continue; }
      const g = ad === 'ikiKat' ? { ikon: '🪙', ad: '2 kat' } : GUCLER[ad];
      const c = document.createElement('span');
      c.className = 'etki';
      c.textContent = `${g.ikon} ${g.ad} · ${kalan} sn`;
      kutu.appendChild(c);
    }
  },
};

// ============ anlatıcı ============
// Bir doğa belgeselinin anlatıcısı gibi, olan biteni ekranın altında altyazıyla anlatır.
// Yazılar harf harf belirir. İstenirse ses ayarlarından sesli okuma da açılabilir
// (tarayıcının kendi sesli okuma özelliği; varsayılan olarak kapalı).
const ANLATICI_LAFLARI = [
  'Kahramanımız butona bir kez daha bastı. Neden? Bunu kendisi de bilmiyor.',
  'Dışarıda güneş batıyor. Kimse fark etmedi.',
  'Parmaklar yoruluyor. Ama durmak, bir seçenek değil.',
  'Bir DVD logosu köşeye yaklaşıyor... yaklaşıyor... ve ıskalıyor.',
  'Ördek ona bakıyor. Yargılamıyor. Sadece bakıyor.',
  'Doğada her canlı bir şeyin peşindedir. Bu canlı, sayıların peşinde.',
  'Ekranlar çoğaldıkça dikkat azalır. Bilim insanları buna "salı" diyor.',
  'Uzaklarda bir yerde bir anne "yemek soğuyor" diye sesleniyor.',
  'Bir an duraksadı. Sonra tıklamaya devam etti. Klasik.',
];

const Anlatici = {
  acik: false,
  son: 0,
  kur() {
    if (this.acik) return;
    this.acik = true;
    this.soyle('Ve işte karşınızda: ekranın başındaki insan. Onu bugün yakından izleyeceğiz.', true);
    const sonraki = () => { this.z = setTimeout(() => { this.bosLaf(); sonraki(); }, rastgele(18000, 35000)); };
    sonraki();
  },
  soyle(metin, zorla) {
    if (!this.acik || oyunBitti) return;
    const simdi = performance.now();
    // Bir cümle bitmeden yenisi başlamasın (önemli olanlar hariç)
    if (!zorla && simdi - this.son < 6000) return;
    this.son = simdi;
    this.yaz(metin);
    this.oku(metin);
  },
  // Altyazıyı harf harf yazar, okunacak kadar ekranda tutup kaybolur
  yaz(metin) {
    const el = $('#altyazi');
    clearInterval(this.yazici);
    clearTimeout(this.gizleyici);
    el.hidden = false;
    el.classList.remove('git');
    el.textContent = '';
    let i = 0;
    this.yazici = setInterval(() => {
      el.textContent = metin.slice(0, ++i);
      if (i >= metin.length) clearInterval(this.yazici);
    }, 28);
    this.gizleyici = setTimeout(() => {
      el.classList.add('git');
      this.gizleyici = setTimeout(() => { el.hidden = true; }, 500);
    }, 2500 + metin.length * 55);
  },
  oku(metin) {
    const seviye = S.ses.anlatici * S.ses.ana;
    if (!S.sesAcik || seviye <= 0 || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(metin);
    u.lang = 'tr-TR';
    const turkce = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
    if (turkce) u.voice = turkce;
    // Belgesel anlatıcısı gibi: yavaş ve kalın
    u.rate = 0.9;
    u.pitch = 0.8;
    u.volume = sinirla(seviye, 0, 1);
    speechSynthesis.speak(u);
  },
  sus() {
    if ((!S.sesAcik || S.ses.anlatici <= 0) && 'speechSynthesis' in window) speechSynthesis.cancel();
  },
  bosLaf() {
    const laflar = [
      ...ANLATICI_LAFLARI,
      `Şimdiye kadar tam ${fmt(S.tik)} kez tıkladı. Ve sayı artmaya devam ediyor.`,
      `${sureFmt(S.sure)} geçti. Kimse saati sormadı.`,
    ];
    this.soyle(sec(laflar));
  },
};

// ============ tam ekran: video tüneli ve solucan deliği ============
// Tam Ekran alınınca video pencereleri dönerek merkeze çekilip kapanır. Ardından bütün videolar
// ekranı kaplayan, dönen bir tünelin duvarlarında oynamaya devam eder; arkada kozmik bir ses uğuldar.
// Solucan Deliği tüneli hızlandırır, renklerini kaydırır ve sesi güçlendirir.
const Duvar = {
  kur(animasyonlu) {
    if (this.el || oyunBitti) return;
    const el = document.createElement('div');
    el.id = 'duvar';
    el.innerHTML = '<div class="tunel"></div>';
    if (animasyonlu) el.classList.add('giris');
    if (adet('solucan')) el.classList.add('solucan');
    document.body.insertBefore(el, $('#fx'));
    this.el = el;
    this.tunel = el.querySelector('.tunel');
    Yildiz.aktif = true;
    Ses.kozmik();
  },
  // Satın alma anı: açık video pencereleri merkeze doğru dönerek çekilir, sonra tünel açılır
  gec() {
    for (const id of Object.keys(VIDEO_KANALI)) {
      const p = document.getElementById('p-' + id);
      if (!p) continue;
      const r = p.getBoundingClientRect();
      p.style.setProperty('--dx', (innerWidth / 2 - (r.left + r.width / 2)) + 'px');
      p.style.setProperty('--dy', (innerHeight / 2 - (r.top + r.height / 2)) + 'px');
      p.id = '';
      p.classList.add('cekil');
      setTimeout(() => p.remove(), 1100);
    }
    Anlatici.soyle('Ve bütün ekranlar tek bir girdapta birleşti. Geri dönüş yolu artık görünmüyor.', true);
    setTimeout(() => {
      this.kur(true);
      for (const id of Object.keys(VIDEO_KANALI)) {
        if (!adet(id)) continue;
        const vid = youtubeId(AYARLAR.videolar[id]);
        if (vid) this.ekle(id, vid);
      }
    }, 900);
  },
  ekle(id, vid) {
    this.kur(false);
    if (!this.tunel || this.tunel.querySelector(`[data-id="${id}"]`)) return;
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = youtubeIframe(vid, id, videoSesi(id), VIDEO_KANALI[id]);
    const f = panel.querySelector('iframe');
    f.dataset.id = id;
    oynaticiHazirlaninca(f);
    this.tunel.appendChild(panel);
    // Paneller tünelin çevresine altın açıyla (137,5°) dağılır, böylece art arda uçanlar hep farklı
    // yönden gelir; uçuşları da zamanca eşit aralıklıdır
    const paneller = [...this.tunel.children];
    paneller.forEach((p, i) => {
      p.style.setProperty('--aci', i * 137.5 + 'deg');
      p.style.setProperty('--gecikme', -(i * 7 / paneller.length) + 's');
    });
  },
  solucan() {
    this.kur(false);
    if (this.el) this.el.classList.add('solucan');
    Ses.kozmikGuclen();
  },
};

// Solucan deliğinde merkezden dışarı akan yıldızlar
const Yildiz = {
  aktif: false,
  liste: [],
  guncelle(dt) {
    if (!this.aktif) return;
    const enUzak = Math.hypot(W, H) / 2;
    while (this.liste.length < 160) this.liste.push({ a: Math.random() * Math.PI * 2, r: rastgele(0, enUzak), h: rastgele(80, 260) });
    for (const y of this.liste) {
      y.r += y.h * dt * (1 + y.r / 120);
      if (y.r > enUzak) { y.r = rastgele(0, 30); y.a = Math.random() * Math.PI * 2; }
    }
  },
  ciz() {
    if (!this.aktif) return;
    cx.strokeStyle = 'rgba(140, 90, 255, .65)';
    cx.lineWidth = 2;
    cx.beginPath();
    for (const y of this.liste) {
      const x1 = W / 2 + Math.cos(y.a) * y.r;
      const y1 = H / 2 + Math.sin(y.a) * y.r;
      const u = 4 + y.r * 0.08;
      cx.moveTo(x1, y1);
      cx.lineTo(x1 + Math.cos(y.a) * u, y1 + Math.sin(y.a) * u);
    }
    cx.stroke();
  },
};

// ============ ördek ============
// Ekranın altında bir sağa bir sola yürür, ara sıra durup etrafına bakar. Kovboy şapkası ve
// güneş gözlüğü takar. Tıklayınca yem verilir. Tokluğu zamanla azalır; tok ördek yürürken
// 20 saniyede bir arkasına yumurta bırakır, yumurtalar tıklayınca toplanır. Aç ördek yavaşlar,
// tamamen acıkınca oturur ve yumurtlamaz.
const ORDEK_SVG = `
<svg viewBox="0 0 120 120" aria-hidden="true">
  <g class="bacak bacak-arka"><path d="M50 98 L48 112 L40 114" /></g>
  <g class="bacak bacak-on"><path d="M64 98 L66 112 L58 114" /></g>
  <path class="kuyruk" d="M26 76 Q14 66 18 58 Q28 66 36 70 Z" />
  <ellipse class="govde" cx="56" cy="80" rx="34" ry="23" />
  <ellipse class="kanat" cx="50" cy="80" rx="19" ry="11" transform="rotate(-12 50 80)" />
  <circle class="kafa" cx="86" cy="52" r="18" />
  <path class="gaga" d="M100 52 Q114 52 116 57 Q112 62 100 61 Z" />
  <g class="gozluk">
    <rect x="83" y="44" width="17" height="10" rx="4" />
    <path d="M83 48 L70 46" />
    <path class="parilti" d="M87 47 L90 50 M93 46 L96 49" />
  </g>
  <g class="sapka">
    <path class="sapka-tepe" d="M71 36 Q70 18 78 15 Q84 19 90 15 Q99 18 98 36 Z" />
    <rect class="sapka-bant" x="71" y="29" width="27" height="5" rx="1" />
    <ellipse class="sapka-kenar" cx="84" cy="36" rx="27" ry="5.5" />
  </g>
</svg>`;

const Ordek = {
  x: 120,
  yon: 1,
  bekle: 0,
  yumurtaSayac: 0,
  sonYem: 0,
  kur() {
    if (this.el) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.id = 'ordek';
    el.setAttribute('aria-label', 'Ördek: tıklayınca yem verilir');
    el.innerHTML = `<div class="ordek-tok"><i></i></div>${ORDEK_SVG}`;
    el.addEventListener('click', () => this.besle());
    document.body.appendChild(el);
    this.el = el;
    this.x = rastgele(80, Math.max(120, innerWidth - 200));
    $('#yumurtalar').addEventListener('click', e => {
      const y = e.target.closest('.yumurta');
      if (y) this.topla(y, e);
    });
    this.ciz();
  },
  besle() {
    const simdi = performance.now();
    if (simdi - this.sonYem < 600) return;
    this.sonYem = simdi;
    S.ordekTok = Math.min(100, S.ordekTok + 25);
    Ses.vak();
    const r = this.el.getBoundingClientRect();
    ucanSayi(r.left + r.width / 2, r.top, '🌾');
    this.el.classList.remove('zipla');
    void this.el.offsetWidth;
    this.el.classList.add('zipla');
    this.ciz();
  },
  guncelle(dt) {
    if (!this.el) return;
    S.ordekTok = Math.max(0, S.ordekTok - dt * 0.35);
    const ac = S.ordekTok < 30;
    const yuruyor = S.ordekTok > 0 && this.bekle <= 0;
    if (this.bekle > 0) this.bekle -= dt;
    if (yuruyor) {
      this.x += this.yon * (ac ? 22 : 48) * dt;
      const sag = innerWidth - 90;
      if (this.x < 10) { this.x = 10; this.yon = 1; }
      if (this.x > sag) { this.x = sag; this.yon = -1; }
      // Ara sıra durur, bazen geri döner
      if (Math.random() < dt * 0.12) {
        this.bekle = rastgele(1, 3);
        if (Math.random() < 0.5) this.yon *= -1;
      }
    }
    this.el.style.transform = `translateX(${this.x}px)`;
    this.el.classList.toggle('yuruyor', yuruyor);
    this.el.classList.toggle('sola', this.yon < 0);
    if (!ac) {
      this.yumurtaSayac += dt;
      if (this.yumurtaSayac >= 20) { this.yumurtaSayac = 0; this.yumurtla(); }
    }
  },
  yumurtla() {
    const kutu = $('#yumurtalar');
    if (kutu.children.length >= 4) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'yumurta';
    b.textContent = '🥚';
    // Yumurta ördeğin arkasına düşer
    b.style.left = (this.x + (this.yon > 0 ? 6 : 64)) + 'px';
    if (Math.random() < 0.08) b.classList.add('altin');
    kutu.appendChild(b);
    Ses.vak();
  },
  topla(b, e) {
    const o = Math.round((b.classList.contains('altin') ? 20000 : 2000) * olcek());
    kazan(o, 'ordek');
    S.yumurta++;
    ucanSayi(e.clientX, e.clientY, '+' + fmt(o));
    Ses.para();
    b.remove();
  },
  ciz() {
    if (!this.el) return;
    this.el.querySelector('.ordek-tok i').style.width = S.ordekTok + '%';
    this.el.classList.toggle('ac', S.ordekTok < 30);
    this.el.classList.toggle('bayildi', S.ordekTok <= 0);
  },
};

// ============ yayın chati ============
const CHAT_ADLARI = ['tıkçı42', 'dopaminbaba', 'ördekseven', 'kanka_07', 'gece_kuşu', 'DVDavcısı', 'slotkral', 'baykuş_izliyor', 'mikroödeme', 'x_x_x', 'sadece_izliyorum', 'ilk_gelen'];
const CHAT_LAFLARI = [
  'KEKW', 'w', 'LUL', 'reis ne yapıyon', 'bu adam deli', 'dopamin canavarı', 'tıkla tıkla tıkla', 'ilk', 'sa', 'as',
  'buton kırılacak', 'nerden buldun bu oyunu', 'PogChamp', 'abi dolar kaç oldu', 'ördeğe yem ver', 'sıkıldım', 'GG',
  'bu kaçıncı DVD', '📀📀📀', 'çok iyi gidiyon', 'çık dışarı biraz', 'annen çağırıyo', 'asdfghjkl', '+1', '💀', '🔥🔥',
];
const CHAT_RENKLERI = ['#ff6b81', '#feca57', '#48dbfb', '#1dd1a1', '#a29bfe', '#ff9ff3', '#ffa502'];

const Chat = {
  zaman: 0,
  kur() {
    if (this.p) return;
    this.p = pencere('chat', '🔴 CANLI · Yayın Chati', '<div class="chat"></div>', 260, 230, 'chat-pencere');
    this.akis = this.p.querySelector('.chat');
  },
  olay(yazi) {
    if (this.p) this.ekle(sec(CHAT_ADLARI), yazi);
  },
  ekle(ad, yazi) {
    const d = document.createElement('div');
    d.className = 'chat-satir';
    d.innerHTML = '<b></b> <span></span>';
    const b = d.querySelector('b');
    b.textContent = ad + ':';
    b.style.color = CHAT_RENKLERI[ad.length % CHAT_RENKLERI.length];
    d.querySelector('span').textContent = yazi;
    this.akis.appendChild(d);
    while (this.akis.children.length > 14) this.akis.firstChild.remove();
  },
  guncelle(dt) {
    if (!this.p) return;
    this.zaman -= dt;
    if (this.zaman > 0) return;
    this.zaman = rastgele(0.4, 1.4);
    this.ekle(sec(CHAT_ADLARI), sec(CHAT_LAFLARI));
  },
};

// ============ final: okyanus ============
const Son = {
  t: 0,
  baslat() {
    oyunBitti = true;
    S.bitti = true;
    kaydet();
    // Her şeyi kapat, ekranı boşalt
    $('#pencereler').innerHTML = '';
    if ($('#duvar')) $('#duvar').remove();
    $('#toplanabilir').innerHTML = '';
    $('#smsler').innerHTML = '';
    $('#yumurtalar').innerHTML = '';
    if (Ordek.el) Ordek.el.remove();
    Ses.hepsiniSustur();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (Radyo.ses) Radyo.ses.pause();
    DVD.liste.length = 0;
    Yagmur.aktif = false;
    Yildiz.aktif = false;
    document.body.classList.add('bitti');
    document.title = 'Okyanus';
    const s = $('#son');
    s.hidden = false;
    this.tuval = s.querySelector('canvas');
    this.cx = this.tuval.getContext('2d');
    s.querySelector('.son-istatistik').textContent =
      `${fmt(S.toplam)} dopamin · ${sureFmt(S.sure)} ekran süresi · ${fmt(S.tik)} tıklama`;
    Ses.baslat();
    Ses.dalga();
  },
  ciz(dt) {
    const c = this.cx;
    if (!c) return;
    this.t += dt;
    const w = this.tuval.width = innerWidth;
    const h = this.tuval.height = innerHeight;
    const gok = c.createLinearGradient(0, 0, 0, h * 0.6);
    gok.addColorStop(0, '#9fd3e6');
    gok.addColorStop(1, '#fde7c8');
    c.fillStyle = gok;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255, 220, 160, .9)';
    c.beginPath();
    c.arc(w * 0.7, h * 0.5, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    c.fill();
    const katmanlar = [['#5fa8c9', 0.55, 6], ['#4b93b8', 0.63, 9], ['#3a7fa6', 0.72, 12], ['#2c6a91', 0.83, 16]];
    katmanlar.forEach(([renk, oran, genlik], i) => {
      c.fillStyle = renk;
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) {
        const y = h * oran + Math.sin(x / (140 + i * 30) + this.t * (0.5 + i * 0.15)) * genlik + Math.sin(x / 57 + this.t * 0.9) * genlik * 0.3;
        c.lineTo(x, y);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    });
  },
};

// ============ duolingo ============
// Çoktan seçmeli: [Türkçe, doğru cevap, birbirine benzeyen yanlış şıklar]
const DUO_SECMELI = [
  ['düşünce', 'thought', ['though', 'through', 'tough']],
  ['etkilemek', 'affect', ['effect', 'afford', 'effort']],
  ['kabul etmek', 'accept', ['except', 'expect', 'aspect']],
  ['hassas', 'sensitive', ['sensible', 'sentient', 'sensual']],
  ['sonunda', 'eventually', ['actually', 'evidently', 'essentially']],
  ['ödünç vermek', 'lend', ['borrow', 'lent', 'land']],
  ['fırsat', 'opportunity', ['oportunity', 'opportunaty', 'oppurtunity']],
  ['sorumluluk', 'responsibility', ['responsability', 'responsibilty', 'responsibillity']],
  ['inanılmaz', 'incredible', ['incredulous', 'inedible', 'increasing']],
  ['kıskanç', 'jealous', ['zealous', 'generous', 'gelatinous']],
  ['öneri', 'suggestion', ['digestion', 'congestion', 'suggestive']],
  ['vicdan', 'conscience', ['conscious', 'consensus', 'conscientious']],
  ['deneyim', 'experience', ['experiment', 'expertise', 'expense']],
  ['ihmal etmek', 'neglect', ['negotiate', 'reject', 'select']],
  ['kalıcı', 'permanent', ['pertinent', 'prominent', 'persistent']],
  ['tesadüf', 'coincidence', ['coexistence', 'confidence', 'consequence']],
  ['kaçınılmaz', 'inevitable', ['invisible', 'invincible', 'inviolable']],
  ['ertelemek', 'postpone', ['postpose', 'propose', 'purpose']],
  ['tutarlı', 'consistent', ['constant', 'insistent', 'consistant']],
  ['gereklilik', 'necessity', ['neccessity', 'necesity', 'nessecity']],
  ['öngörmek', 'anticipate', ['participate', 'anticipant', 'antiquate']],
  ['karşılaştırma', 'comparison', ['comparation', 'compassion', 'companion']],
];
// Yazmalı: İngilizce kelime sorulur, Türkçesi yazılır. [İngilizce, kabul edilen Türkçe cevaplar]
const DUO_YAZMALI = [
  ['squirrel', ['sincap']],
  ['butterfly', ['kelebek']],
  ['earthquake', ['deprem', 'zelzele']],
  ['rainbow', ['gökkuşağı']],
  ['library', ['kütüphane']],
  ['nurse', ['hemşire']],
  ['bridge', ['köprü']],
  ['giraffe', ['zürafa']],
  ['fridge', ['buzdolabı']],
  ['toothbrush', ['diş fırçası']],
  ['rabbit', ['tavşan']],
  ['lightning', ['şimşek', 'yıldırım']],
  ['neighborhood', ['mahalle', 'semt']],
  ['umbrella', ['şemsiye']],
  ['riddle', ['bilmece']],
  ['jealous', ['kıskanç']],
  ['opportunity', ['fırsat']],
  ['experience', ['deneyim', 'tecrübe']],
  ['responsibility', ['sorumluluk']],
  ['coincidence', ['tesadüf', 'rastlantı']],
  ['suggestion', ['öneri', 'tavsiye']],
  ['wisdom', ['bilgelik']],
];
// Cevap karşılaştırılırken büyük/küçük harf, boşluk ve Türkçe karakterler fark etmez (gokkusagi = gökkuşağı)
const duoNormal = s => s.toLocaleLowerCase('tr').trim().replace(/\s+/g, ' ')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
const karistir = liste => liste.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

const Duo = {
  zamanlayici: null,
  zamanla() {
    if (this.zamanlayici) return;
    const sonraki = () => {
      this.zamanlayici = setTimeout(() => { this.ac(); sonraki(); }, rastgele(35000, 70000));
    };
    sonraki();
  },
  // Yanlış cevapta ya da süre dolunca baykuş elindeki dopaminin %5'ini alır
  ceza() {
    const c = Math.floor(S.dopamin * 0.05);
    S.dopamin -= c;
    return c;
  },
  ac() {
    if (oyunBitti || document.getElementById('p-duo')) return;
    const yazmali = Math.random() < 0.5;
    const sure = yazmali ? 12 : 8;
    const p = pencere('duo', 'Duolingo', `
      <div class="duo">
        <div class="duo-baykus">🦉</div>
        <div class="duo-soru"></div>
        <div class="duo-cevap"></div>
        <div class="duo-sure"><i></i></div>
      </div>`, 280, 210, 'duo-pencere');
    const soru = p.querySelector('.duo-soru');
    const kutu = p.querySelector('.duo-cevap');
    let bitti = false;
    const bitir = (yazi, baykus, gecikme) => {
      bitti = true;
      p.querySelector('.duo-baykus').textContent = baykus;
      soru.textContent = yazi;
      kutu.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
      setTimeout(() => pencereKapat('duo'), gecikme);
    };
    const dogru = () => {
      const o = Math.round(800 * olcek());
      S.duoDogru++;
      kazan(o, 'duolingo');
      Ses.basari();
      bitir(`Harika! +${fmt(o)} dopamin`, '🦉🎉', 1600);
    };
    const yanlis = cevap => {
      Ses.yanlis();
      bitir(`Yanlış! Doğrusu "${cevap}". Baykuş ${fmt(this.ceza())} dopamin aldı.`, '😠', 3000);
    };

    if (yazmali) {
      const [en, cevaplar] = sec(DUO_YAZMALI);
      soru.textContent = `"${en}" kelimesini Türkçe yaz`;
      kutu.innerHTML = '<form class="duo-yaz"><input type="text" autocomplete="off" spellcheck="false" placeholder="cevabın..."><button type="submit">Kontrol</button></form>';
      const girdi = kutu.querySelector('input');
      kutu.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        if (bitti || !girdi.value.trim()) return;
        if (cevaplar.map(duoNormal).includes(duoNormal(girdi.value))) { girdi.classList.add('dogru'); dogru(); }
        else { girdi.classList.add('yanlis'); yanlis(cevaplar[0]); }
      });
      // Butona tıklarken yazmaya geçilebilsin diye odak hemen verilir
      setTimeout(() => girdi.focus({ preventScroll: true }), 50);
    } else {
      const [tr, en, benzerler] = sec(DUO_SECMELI);
      soru.textContent = `"${tr}" İngilizcede ne demek?`;
      kutu.className = 'duo-cevap duo-secenekler';
      for (const s of karistir([en, ...benzerler])) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = s;
        b.addEventListener('click', () => {
          if (bitti) return;
          if (s === en) { b.classList.add('dogru'); dogru(); }
          else { b.classList.add('yanlis'); yanlis(en); }
        });
        kutu.appendChild(b);
      }
    }

    // Süre dolarsa baykuş küser
    const cubuk = p.querySelector('.duo-sure i');
    requestAnimationFrame(() => { cubuk.style.transition = `width ${sure}s linear`; cubuk.style.width = '0%'; });
    setTimeout(() => {
      if (bitti) return;
      Ses.yanlis();
      bitir(`Süre doldu. Baykuş ${fmt(this.ceza())} dopamin aldı 👀`, '😠', 3000);
    }, sure * 1000);
  },
};

// ============ başarımlar ============
const BASARIMLAR = [
  { id: 'basarim', ad: 'Başarım Avcısı', acik: 'Başarımları aç', kosul: () => adet('basarim'), odul: 1000 },
  { id: 'tik100', ad: 'Isınma Turu', acik: 'Butona 100 kez tıkla', kosul: () => S.tik >= 100, odul: 500 },
  { id: 'tik1000', ad: 'Parmak Jimnastiği', acik: 'Butona 1.000 kez tıkla', kosul: () => S.tik >= 1000, odul: 3000 },
  { id: 'dvd5', ad: 'DVD Koleksiyoncusu', acik: '5 DVD al', kosul: () => adet('dvd') >= 5, odul: 500 },
  { id: 'dvd15', ad: 'DVD Kütüphanesi', acik: '15 DVD al', kosul: () => adet('dvd') >= 15, odul: 3000 },
  { id: 'kose', ad: 'Köşe Avcısı', acik: 'DVD ile köşeye çarp', kosul: () => S.kose >= 1, odul: 2500 },
  { id: 'pres10', ad: 'Ezici Güç', acik: 'Preste 10 şey ez', kosul: () => S.ezilen >= 10, odul: 2000 },
  { id: 'toplam10k', ad: 'Erteleme Ustası', acik: 'Toplam 10.000 dopamin topla', kosul: () => S.toplam >= 1e4, odul: 1000 },
  { id: 'toplam100k', ad: 'Dopamin Bağımlısı', acik: 'Toplam 100.000 dopamin topla', kosul: () => S.toplam >= 1e5, odul: 5000 },
  { id: 'seviye10', ad: 'Seviye Atladım', acik: '10. seviyeye ulaş', kosul: () => adet('seviye') && S.seviye >= 10, odul: 2500 },
  { id: 'ekran1', ad: 'Ekran Bağımlısı', acik: '1 saat oyna', kosul: () => S.sure >= 3600, odul: 2000 },
  { id: 'esya', ad: 'Alışverişkolik', acik: 'Bir buton tipi satın al', kosul: () => Object.keys(S.esyalar).length > 1, odul: 2500 },
  { id: 'kazi', ad: 'Şanslı Gün', acik: 'Bir kazı kazan kazı', kosul: () => S.kazilan >= 1, odul: 1000 },
  { id: 'ucCarpi', ad: 'Kara Kedi', acik: 'Kazı kazanda üç ✖ çıkar', kosul: () => S.ucCarpi >= 1, odul: 7500 },
  { id: 'dolar', ad: 'Döviz Bürosu', acik: 'Doları kârla sat', kosul: () => (S.piyasalar.dolar || {}).kar > 0, odul: 2500 },
  { id: 'jackpot', ad: 'JACKPOT', acik: 'Slotta üç aynı meyve tuttur', kosul: () => S.jackpot >= 1, odul: 5000 },
  { id: 'yumurta', ad: 'Ördek Çiftliği', acik: '10 ördek yumurtası topla', kosul: () => S.yumurta >= 10, odul: 10000 },
  { id: 'kripto', ad: 'Ay\'a Gidiyoruz', acik: 'Kriptoyu kârla sat', kosul: () => (S.piyasalar.kripto || {}).kar > 0, odul: 10000 },
  { id: 'duo10', ad: 'Baykuşun Gözdesi', acik: '10 Duolingo sorusunu doğru cevapla', kosul: () => S.duoDogru >= 10, odul: 2500 },
  { id: 'gece', ad: 'Gece Kuşu', acik: 'Gece oyna', kosul: () => { const s = new Date().getHours(); return s >= 23 || s < 6; }, odul: 500 },
];

function basarimKontrol() {
  if (!adet('basarim')) return;
  for (const b of BASARIMLAR) {
    if (!S.basarim[b.id] && b.kosul()) {
      S.basarim[b.id] = true;
      kazan(b.odul, 'basarim');
      bildirim('🏆 ' + b.ad, `${b.acik} · +${fmt(b.odul)} dopamin`);
      Ses.basari();
    }
  }
}

function bildirim(baslik, alt) {
  const d = document.createElement('div');
  d.className = 'bildirim';
  d.innerHTML = '<b></b><span></span>';
  d.querySelector('b').textContent = baslik;
  d.querySelector('span').textContent = alt;
  $('#bildirimler').appendChild(d);
  setTimeout(() => d.remove(), 4100);
}

// ============ uçan sayılar ============
function ucanSayi(x, y, yazi) {
  const s = document.createElement('div');
  s.className = 'ucan';
  s.textContent = yazi;
  s.style.left = x + rastgele(-14, 14) + 'px';
  s.style.top = y + 'px';
  $('#ucanlar').appendChild(s);
  setTimeout(() => s.remove(), 900);
}

// ============ dükkan: butonun üstündeki ikon rafı ============
const IKONLAR = {
  dvd: '📀', sekme: '🗂️', ucusan: '✨', sayac: '⏱️', buton: '🔴', dvdses: '🔊', subway: '🏃',
  sondakika: '📰', lofi: '🎧', yagmur: '🌧️', presHiz: '⏩', firildak: '🌀', pres: '🗜️', basarim: '🏆',
  gokgurultu: '⛈️', minecraft: '⛏️', slime: '🫧', technicolor: '🌈', yemek: '🍜', ekran: '📱',
  seviye: '⭐', radyo: '📻', otoPres: '🤖', kose: '📐', arayuz: '🎨', esya: '🛍️', kazi: '🎟️',
  dolar: '💵', duolingo: '🦉', slot: '🎰', gta: '🚗', whatsapp: '💬', asmr: '🎙️', dvdHiz1: '💨',
  subwaySes: '🔉', asmr2: '👂', sms: '✉️', fitness: '💪', jeton: '🪙', tepki: '🎥', kripto: '💹',
  guclendirme: '⚡', anlatici: '🗣️', tamEkran: '📺', kaldirac: '⚖️', ordek: '🦆', chat: '📡',
  dvdHiz2: '☄️', solucan: '🌌', okyanus: '🌊',
};

function gorunurMu(y) {
  if (y.gerek && !y.gerek.every(g => adet(g))) return false;
  if (!y.cokluAlim && adet(y.id)) return false;
  return true;
}

let sonImza = '';
let sonrakiGizli = null;

// Raftaki bir ikonun ipucunda görünecek bilgisi. "_" ile başlayanlar yükseltme değildir.
function kutucukBilgi(id) {
  if (id === '_esya') return { ad: 'Eşyalar', acik: 'Butonun için tipler ve sesler', fiyat: null };
  if (id === '_gizli') return { ad: '???', acik: 'Daha fazla dopamin topla', fiyat: sonrakiGizli ? fiyat(sonrakiGizli) : null };
  const y = YUKSELTMELER.find(x => x.id === id);
  return {
    ad: y.ad + (y.cokluAlim && adet(y.id) ? ` (×${adet(y.id)})` : ''),
    acik: typeof y.acik === 'function' ? y.acik() : y.acik,
    fiyat: fiyat(y),
  };
}

function kutucukTikla(id) {
  if (id === '_esya') Esya.panelAcKapa();
  else if (id !== '_gizli') satinAl(id);
}

// Yükseltmeler azar azar çıkar: rafta aynı anda en fazla RAF_SINIR alınmamış yükseltme olur.
// Yeni bir yükseltme, elindeki dopamin fiyatının %60'ına ulaşınca ortaya çıkar ve bir daha kaybolmaz.
// Her seferinde en fazla bir yenisi çıkar, böylece tek tek belirirler.
const RAF_SINIR = 5;
const ORTAYA_CIKMA = 0.6;

function dukkanCiz(zorla) {
  const adaylar = YUKSELTMELER.filter(gorunurMu).sort((a, b) => fiyat(a) - fiyat(b));
  const gorulenler = () => adaylar.filter(y => S.goruldu[y.id]);
  // Debug menüsünden "hepsini göster" seçildiyse sınır yok
  if (Debug.hepsiGorunsun) for (const y of adaylar) S.goruldu[y.id] = true;
  const sinir = Debug.hepsiGorunsun ? Infinity : RAF_SINIR;
  if (gorulenler().length < sinir) {
    const yeni = adaylar.find(y => !S.goruldu[y.id] && S.dopamin >= fiyat(y) * ORTAYA_CIKMA);
    if (yeni) {
      S.goruldu[yeni.id] = true;
      if (!zorla) Ses.belir();
    }
  }
  // Oyunun en başında da rafta bir şey olsun
  if (!gorulenler().length && adaylar.length) S.goruldu[adaylar[0].id] = true;
  const acik = gorulenler().slice(0, sinir);
  sonrakiGizli = adaylar.find(y => !acik.includes(y)) || null;

  const imza = (Esya.acik ? 'E|' : '') + acik.map(y => y.id + ':' + adet(y.id)).join('|') + '#' + (sonrakiGizli ? sonrakiGizli.id : '');
  if (zorla || imza !== sonImza) {
    sonImza = imza;
    const raf = $('#raf');
    // Belirme animasyonu sadece rafa yeni gelen ikonlarda oynasın
    const oncekiler = new Set([...raf.children].map(k => k.dataset.id));
    raf.innerHTML = '';
    const ekle = (id, ikon, sinif, rozet) => {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'kutucuk' + (sinif ? ' ' + sinif : '') + (oncekiler.has(id) ? '' : ' yeni');
      k.dataset.id = id;
      k.textContent = ikon;
      k.setAttribute('aria-label', kutucukBilgi(id).ad);
      if (rozet) {
        const r = document.createElement('span');
        r.className = 'rozet';
        r.textContent = rozet;
        k.appendChild(r);
      }
      raf.appendChild(k);
    };
    if (Esya.acik) ekle('_esya', '🛍️');
    for (const y of acik) ekle(y.id, IKONLAR[y.id] || '❔', '', y.cokluAlim && adet(y.id) ? adet(y.id) : '');
    if (sonrakiGizli) ekle('_gizli', '🔒', 'gizli');
  }
  // Alınabilenleri vurgula, pahalıları soluklaştır
  for (const k of document.querySelectorAll('#raf .kutucuk')) {
    if (k.dataset.id[0] === '_') continue;
    const y = YUKSELTMELER.find(x => x.id === k.dataset.id);
    const alinir = S.dopamin >= fiyat(y);
    k.classList.toggle('pahali', !alinir);
    k.classList.toggle('alinabilir', alinir);
  }
  Ipucu.guncelle();
}

// Üzerine gelince (telefonda ilk dokunuşta) açılan detay kutusu
const Ipucu = {
  id: null,
  goster(k) {
    this.id = k.dataset.id;
    this.guncelle();
  },
  gizle() {
    this.id = null;
    $('#ipucu').hidden = true;
  },
  guncelle() {
    if (!this.id) return;
    const k = document.querySelector(`#raf .kutucuk[data-id="${this.id}"]`);
    if (!k) { this.gizle(); return; }
    const bilgi = kutucukBilgi(this.id);
    const kutu = $('#ipucu');
    kutu.innerHTML = '<b></b><div class="ip-acik"></div><div class="ip-fiyat"></div>';
    kutu.querySelector('b').textContent = bilgi.ad;
    kutu.querySelector('.ip-acik').textContent = bilgi.acik;
    const f = kutu.querySelector('.ip-fiyat');
    if (bilgi.fiyat === null) f.remove();
    else {
      f.textContent = fmt(bilgi.fiyat) + ' dopamin';
      f.classList.toggle('pahali', S.dopamin < bilgi.fiyat);
    }
    kutu.hidden = false;
    const r = k.getBoundingClientRect();
    kutu.style.left = sinirla(r.left + r.width / 2 - kutu.offsetWidth / 2, 8, innerWidth - kutu.offsetWidth - 8) + 'px';
    const ustu = r.top - kutu.offsetHeight - 10;
    kutu.style.top = (ustu >= 8 ? ustu : r.bottom + 10) + 'px';
  },
};

// ============ ses ayarları paneli ============
const SES_KANALLARI = [
  ['ana', 'Ana ses'],
  ['efekt', 'Oyun sesleri'],
  ['ortam', 'Ortam (yağmur, kozmik ses)'],
  ['video', 'Videolar'],
  ['radyo', 'Radyo'],
  ['asmr', 'ASMR'],
  ['anlatici', 'Anlatıcı sesli okuma'],
];

const SesPaneli = {
  kur() {
    const kutu = $('#sesKaydiricilar');
    for (const [k, ad] of SES_KANALLARI) {
      const satir = document.createElement('label');
      satir.className = 'kaydirici';
      satir.innerHTML = `<span class="ad"></span><input type="range" min="0" max="100" step="1"><span class="deger"></span>`;
      satir.querySelector('.ad').textContent = ad;
      const girdi = satir.querySelector('input');
      const deger = satir.querySelector('.deger');
      girdi.value = Math.round(S.ses[k] * 100);
      deger.textContent = girdi.value;
      girdi.addEventListener('input', () => {
        S.ses[k] = girdi.value / 100;
        deger.textContent = girdi.value;
        Ses.ayarla();
      });
      girdi.addEventListener('change', kaydet);
      kutu.appendChild(satir);
    }
    const acik = $('#sesAcikKutu');
    acik.checked = S.sesAcik;
    acik.addEventListener('change', () => {
      S.sesAcik = acik.checked;
      Ses.baslat();
      Ses.ayarla();
      kaydet();
    });
  },
  acKapa() {
    const p = $('#sesPanel');
    p.hidden = !p.hidden;
  },
};

// ============ debug menüsü (F1) ============
const Debug = {
  hiz: 1,
  hepsiGorunsun: false,
  kur() {
    const el = $('#debugIcerik');
    const bolum = (baslik, html) => `<section><h4>${baslik}</h4>${html}</section>`;
    const secenekler = YUKSELTMELER.map(y => `<option value="${y.id}">${IKONLAR[y.id] || ''} ${y.ad} (${fmt(y.fiyat)})</option>`).join('');
    el.innerHTML = [
      bolum('Durum', '<div class="debug-bilgi" id="debugBilgi"></div>'),
      bolum('Dopamin', `
        <div class="debug-satir">
          <button data-para="1000">+1B</button><button data-para="100000">+100B</button>
          <button data-para="1000000">+1M</button><button data-para="100000000">+100M</button>
        </div>
        <div class="debug-satir">
          <input type="number" id="debugMiktar" placeholder="miktar" min="0">
          <button data-is="paraEkle">Ekle</button><button data-is="paraSifirla">Sıfırla</button>
        </div>
        <div class="debug-satir"><button data-is="jeton">+10 🪙</button><button data-is="slotHak">Slot hakkı doldur</button></div>`),
      bolum('Oyun hızı', `<div class="debug-satir" id="debugHiz">
          <button data-hiz="1" class="secili">1x</button><button data-hiz="2">2x</button>
          <button data-hiz="5">5x</button><button data-hiz="10">10x</button></div>`),
      bolum('Yükseltmeler', `
        <div class="debug-satir"><select id="debugYukseltme">${secenekler}</select><button data-is="ver">Ücretsiz al</button></div>
        <div class="debug-satir">
          <button data-is="hepsiniGoster">Rafta hepsini göster</button>
          <button data-is="hepsiniAl">Hepsini al (final hariç)</button>
        </div>`),
      bolum('Olayları tetikle', `<div class="debug-satir debug-izgara">
          <button data-olay="kazi">Kazı kazan</button><button data-olay="duo">Duolingo</button>
          <button data-olay="sms">SMS</button><button data-olay="wp">WhatsApp mesajı</button>
          <button data-olay="guc">Güçlendirme</button><button data-olay="para">Para at</button>
          <button data-olay="yumurta">Yumurta</button><button data-olay="doyur">Ördeği doyur</button>
          <button data-olay="gok">Gök gürültüsü</button><button data-olay="anlatici">Anlatıcı konuşsun</button>
          <button data-olay="son">Final ekranı</button></div>`),
      bolum('Kayıt', '<div class="debug-satir"><button data-is="kayitSil" class="tehlike">Kaydı sil ve baştan başla</button></div>'),
    ].join('');

    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.para) kazan(Number(b.dataset.para), 'debug');
      if (b.dataset.hiz) {
        this.hiz = Number(b.dataset.hiz);
        el.querySelectorAll('#debugHiz button').forEach(x => x.classList.toggle('secili', x === b));
      }
      if (b.dataset.olay) this.olay(b.dataset.olay);
      switch (b.dataset.is) {
        case 'paraEkle': kazan(Math.max(0, Number($('#debugMiktar').value) || 0), 'debug'); break;
        case 'paraSifirla': S.dopamin = 0; break;
        case 'jeton': S.jeton += 10; Jeton.ciz(); break;
        case 'slotHak': S.slotJeton = SLOT_JETON_EN_FAZLA; Slot.ciz(); break;
        case 'ver': this.ver($('#debugYukseltme').value); break;
        case 'hepsiniGoster': this.hepsiGorunsun = true; dukkanCiz(true); break;
        case 'hepsiniAl':
          for (const y of YUKSELTMELER) if (y.id !== 'okyanus' && (!adet(y.id) || y.cokluAlim)) this.ver(y.id);
          break;
        case 'kayitSil':
          if (!confirm('Bütün ilerleme silinsin mi?')) return;
          kayitKapali = true;
          try { localStorage.removeItem(KAYIT); } catch (err) { /* yoksay */ }
          location.reload();
          break;
      }
      kaydet();
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'F1') {
        e.preventDefault();
        const p = $('#debugPanel');
        p.hidden = !p.hidden;
        this.ciz();
      } else if (e.key === 'Escape') {
        $('#debugPanel').hidden = true;
        $('#sesPanel').hidden = true;
      }
    });
    for (const b of document.querySelectorAll('[data-kapat]')) {
      b.addEventListener('click', () => { $('#' + b.dataset.kapat).hidden = true; });
    }
  },
  // Gereklilikleri de dahil, bedava satın alır
  ver(id) {
    const y = YUKSELTMELER.find(x => x.id === id);
    if (!y || (adet(id) && !y.cokluAlim)) return;
    for (const g of y.gerek || []) if (!adet(g)) this.ver(g);
    S.alinan[id] = adet(id) + 1;
    S.goruldu[id] = true;
    if (ETKILER[id]) ETKILER[id]();
    if (ALINCA[id]) ALINCA[id]();
    dukkanCiz(true);
  },
  olay(ad) {
    const islemler = {
      kazi: () => Kazi.ac(),
      duo: () => Duo.ac(),
      sms: () => Sms.ac(),
      wp: () => { Whatsapp.kur(); Whatsapp.yeniMesaj(); },
      guc: () => Guc.ac(),
      para: () => Jeton.paraAt(),
      yumurta: () => { Ordek.kur(); Ordek.yumurtla(); },
      doyur: () => { S.ordekTok = 100; Ordek.ciz(); },
      gok: () => { const f = $('#flas'); f.classList.remove('cak'); void f.offsetWidth; f.classList.add('cak'); Ses.gok(); },
      anlatici: () => { Anlatici.acik = true; Anlatici.son = 0; Anlatici.bosLaf(); },
      son: () => Son.baslat(),
    };
    Ses.baslat();
    if (islemler[ad]) islemler[ad]();
  },
  ciz() {
    if ($('#debugPanel').hidden) return;
    $('#debugBilgi').innerHTML = [
      ['Dopamin', fmt(S.dopamin)],
      ['Toplam', fmt(S.toplam)],
      ['Saniyede (ölçülen)', fmt(Olcer.deger())],
      ['Saniyede (pasif)', fmt(saniyeBasi())],
      ['Tık', fmt(S.tik)],
      ['Süre', sureFmt(S.sure)],
      ['Yükseltme', `${YUKSELTMELER.filter(y => adet(y.id)).length} / ${YUKSELTMELER.length}`],
    ].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  },
};

// ============ ana döngü ============
let oncekiZaman = performance.now();
let yavasSayac = 0;
let saniyeSayac = 0;

function dongu(t) {
  const dt = Math.min(1, (t - oncekiZaman) / 1000) * Debug.hiz;
  oncekiZaman = t;

  // Oyun bitince sadece okyanus çizilir
  if (oyunBitti) {
    Son.ciz(dt);
    requestAnimationFrame(dongu);
    return;
  }

  for (const y of YUKSELTMELER) if (y.sps && adet(y.id)) kazan(y.sps * dt, y.id);
  S.sure += dt;
  Olcer.adim(dt);
  DVD.guncelle(dt);
  Yagmur.guncelle(dt);
  Yildiz.guncelle(dt);
  Pres.guncelle(dt);
  Slot.guncelle(dt);
  Dolar.guncelle(dt);
  Kripto.guncelle(dt);
  Ordek.guncelle(dt);
  Chat.guncelle(dt);

  cx.clearRect(0, 0, W, H);
  Yildiz.ciz();
  Yagmur.ciz();
  DVD.ciz();
  Pres.ciz();

  $('#miktar').textContent = fmt(S.dopamin);

  yavasSayac += dt;
  if (yavasSayac > 0.25) {
    yavasSayac = 0;
    if (adet('sayac')) $('#sps').textContent = 'saniyede ' + fmt(Olcer.deger());
    dukkanCiz(false);
    document.title = adet('sekme') ? `${fmt(S.dopamin)} dopamin` : 'Dopamin';
    basarimKontrol();
    Seviye.ciz();
    Guc.ciz();
    Debug.ciz();
  }
  saniyeSayac += dt;
  if (saniyeSayac > 1) {
    saniyeSayac = 0;
    Ekran.ciz();
    Esya.ciz();
    Slot.ciz();
    Jeton.ciz();
    Ordek.ciz();
  }
  requestAnimationFrame(dongu);
}

// ============ başlangıç ============
function baslat() {
  yukle();
  boyutla();
  window.addEventListener('resize', () => {
    boyutla();
    duzenle();
  });

  // Kayıttan gelen yükseltmelerin etkilerini geri kur (oyun bitmişse doğrudan okyanusa)
  if (S.bitti) {
    Son.baslat();
  } else {
    yukleniyor = true;
    for (const y of YUKSELTMELER) if (adet(y.id) && ETKILER[y.id]) ETKILER[y.id]();
    yukleniyor = false;
  }
  Esya.tak(S.butonTipi);
  duzenle();
  $('#yenidenBasla').addEventListener('click', () => {
    kayitKapali = true;
    try { localStorage.removeItem(KAYIT); } catch (e) { /* yoksay */ }
    location.reload();
  });

  // Raf: fareyle üzerine gelince ipucu, tıklayınca satın al.
  // Dokunmatikte ilk dokunuş ipucunu açar, aynı ikona ikinci dokunuş satın alır.
  const raf = $('#raf');
  let sonIsaretci = 'mouse';
  raf.addEventListener('pointerdown', e => { sonIsaretci = e.pointerType; });
  raf.addEventListener('pointerover', e => {
    const k = e.target.closest('.kutucuk');
    if (k && e.pointerType !== 'touch') Ipucu.goster(k);
  });
  raf.addEventListener('pointerout', e => {
    const k = e.target.closest('.kutucuk');
    if (k && e.pointerType !== 'touch' && !k.contains(e.relatedTarget)) Ipucu.gizle();
  });
  raf.addEventListener('click', e => {
    const k = e.target.closest('.kutucuk');
    if (!k) return;
    if (sonIsaretci === 'touch' && Ipucu.id !== k.dataset.id) { Ipucu.goster(k); return; }
    kutucukTikla(k.dataset.id);
  });
  // Rafın dışına dokununca ipucu ve eşya paneli kapanır
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('#rafKutu')) return;
    Ipucu.gizle();
    $('#esyaPanel').hidden = true;
  });

  const buton = $('#buton');
  buton.addEventListener('pointerdown', e => {
    e.preventDefault();
    Ses.baslat();
    S.tik++;
    const g = tikGucu();
    kazan(g, 'tik');
    Ses.tik();
    if (adet('ucusan')) ucanSayi(e.clientX, e.clientY - 20, '+' + fmt(g));
    buton.classList.add('basildi');
  });
  const birak = () => {
    if (buton.classList.contains('basildi')) Ses.tikBirak();
    buton.classList.remove('basildi');
  };
  buton.addEventListener('pointerup', birak);
  buton.addEventListener('pointerleave', birak);
  // Klavye ile tıklama (boşluk/enter) pointer olayı üretmez
  buton.addEventListener('keydown', e => {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
    e.preventDefault();
    const r = buton.getBoundingClientRect();
    buton.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    setTimeout(birak, 80);
  });

  // Tarayıcılar sesi ilk dokunuştan önce başlatmaya izin vermez
  window.addEventListener('pointerdown', () => { Ses.baslat(); Radyo.cal(); videoSesleriniAyarla(); }, { once: true });

  $('#sesBtn').addEventListener('click', () => {
    Ses.baslat();
    SesPaneli.acKapa();
  });
  SesPaneli.kur();
  Debug.kur();
  Ses.ayarla();

  $('#sifirla').addEventListener('click', () => {
    if (!confirm('Bütün ilerleme silinsin mi?')) return;
    kayitKapali = true;
    try { localStorage.removeItem(KAYIT); } catch (e) { /* yoksay */ }
    location.reload();
  });

  setInterval(kaydet, 5000);
  // YouTube bazen hareket eden ya da yeni açılan videoları durdurur; durmuş olanlar kendiliğinden devam etsin
  setInterval(() => {
    if (oyunBitti) return;
    for (const f of document.querySelectorAll('#pencereler iframe, #duvar iframe, #radyoGizli iframe')) ytKomut(f, 'playVideo');
  }, 5000);
  window.addEventListener('beforeunload', kaydet);
  document.addEventListener('visibilitychange', () => { if (document.hidden) kaydet(); });

  dukkanCiz(true);
  requestAnimationFrame(dongu);
}

baslat();

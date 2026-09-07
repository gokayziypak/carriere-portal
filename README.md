# Carriere Recruitment Atlas — Kurulum Kılavuzu

Bu klasördeki dosyaları gerçek, ücretsiz bir web sitesine dönüştürmek için aşağıdaki adımları sırayla uygula.

## 1) Firebase projesi oluştur (veritabanı + kullanıcı girişi)

1. https://console.firebase.google.com adresine git, Google hesabınla giriş yap.
2. **"Add project"** → proje adı gir (örn. `carriere-portal`) → devam et (Analytics'i kapatabilirsin, gerekli değil).
3. Sol menüden **Build > Authentication** → **Get started** → **Sign-in method** sekmesinden **Email/Password**'ü aktif et.
4. Sol menüden **Build > Firestore Database** → **Create database** → **Production mode** seç → sana yakın bir bölge seç → oluştur.
5. Firestore içinde **Rules** sekmesine git, bu klasördeki `firestore.rules` dosyasının içeriğini yapıştır ve **Publish** et.
6. Sol üstteki dişli ikonundan **Project settings** → aşağı kaydır, **"Your apps"** kısmında **Web (</>)** simgesine tıkla, bir takma ad ver, **kaydet**. Sana bir `firebaseConfig` objesi verecek — bu değerleri kopyala.
7. `index.html` dosyasını aç, en üstteki `window.FIREBASE_CONFIG = {...}` bloğunu, Firebase'in sana verdiği gerçek değerlerle değiştir.

## 2) Yönetici hesabını manuel oluştur

Firebase Authentication e-posta ile çalıştığı için, yönetici hesabını bir kereliğine elle oluşturman gerekiyor:

1. Firebase Console > **Authentication > Users** sekmesi > **Add user**.
2. E-posta: `gokayziypak@gmail.com`, Şifre: `gokay830` → **Add user**.
3. Oluşan kullanıcının **UID** değerini kopyala (satırın üzerine tıklayınca görünür).
4. Firestore Database > **Start collection** → Collection ID: `users` → Document ID: (kopyaladığın UID) → aşağıdaki alanları ekle:
   - `username` (string): `gokayziypak`
   - `name` (string): `Gökay`
   - `surname` (string): `Zıypak`
   - `email` (string): `gokayziypak@gmail.com`
   - `phone` (string): (boş bırakabilirsin)
   - `role` (string): `Yönetici`
   - `createdAt` (string): bugünün tarihi, herhangi bir metin
5. **Save**.

Artık `gokayziypak@gmail.com` / `gokay830` ile giriş yaptığında Yönetici olarak gireceksin.

## 3) Anthropic API anahtarı al (CV analizi için)

1. https://console.anthropic.com adresine git, hesap aç.
2. **API Keys** kısmından yeni bir anahtar oluştur, bir yere güvenli şekilde kopyala (bir daha gösterilmeyecek).
3. Bu, kullanım bazlı ücretlendirilen ayrı bir hesaptır — Claude.ai'deki ücretsiz kullanımdan farklıdır, CV analizi yaptıkça küçük bir maliyeti olur.

## 4) GitHub'a yükle

1. https://github.com üzerinden ücretsiz hesap aç (yoksa).
2. Yeni bir repository oluştur (örn. `carriere-portal`), **Private** seçebilirsin.
3. Bu klasördeki tüm dosyaları (`index.html`, `api/analyze-cv.js`, `package.json`, `firestore.rules`, `README.md`) o repoya yükle (GitHub'ın web arayüzünden "Add file > Upload files" ile sürükle-bırak yapabilirsin, komut satırı gerekmez).

## 5) Vercel'e bağla ve yayınla

1. https://vercel.com adresine git, **"Continue with GitHub"** ile giriş yap.
2. **Add New > Project** → az önce oluşturduğun repoyu seç → **Import**.
3. Ayarları değiştirmeden **Deploy** butonuna bas. Birkaç saniye içinde sana `carriere-portal.vercel.app` gibi gerçek bir link verecek.
4. Deploy bittikten sonra: **Project > Settings > Environment Variables** kısmına git.
   - Key: `ANTHROPIC_API_KEY`
   - Value: (3. adımda aldığın anahtar)
   - **Save**.
5. **Deployments** sekmesinden en son deployment'ın yanındaki **"..." > Redeploy** yap (environment variable'ın etkili olması için).

## 6) Test et

- Verilen linke git, `gokayziypak@gmail.com` / `gokay830` ile giriş yap.
- Client listesini kontrol et, yeni pozisyon ekleyip silmeyi dene.
- "Kayıt Ol" ile ikinci bir test hesabı oluştur, "Üye" rolüyle client ekleme butonunun görünmediğini doğrula.
- Yönetici Paneli'nden (şifre: `gokay830`) yeni üyeyi görebildiğini, rolünü değiştirebildiğini kontrol et.
- Bir PDF CV yükleyip analiz özelliğinin çalıştığını test et.

---

## Bilinmesi gereken sınırlamalar

- **Gerçek e-posta gönderimi yok.** Yeni kayıtlar Yönetici Paneli > "Kayıt Bildirimleri" sekmesinde listelenir ama gokayziypak@gmail.com adresine otomatik mail gitmez. Bunu eklemek istersen (örn. Resend veya SendGrid ile), `api/` klasörüne ikinci bir serverless fonksiyon eklememiz gerekir — istersen bir sonraki adımda bunu birlikte kurabiliriz.
- **Yönetici Paneli şifresi (`gokay830`) sadece arayüz tarafında kontrol ediliyor**, kriptografik olarak güvenli değil. Gerçek hassas veriler için ek bir sunucu tarafı kontrolü gerekir.
- **"Üyeliği Sil"** işlemi kişinin uygulama profilini (Firestore) siler; Firebase Authentication hesabının tamamen silinmesi için Firebase konsolundan elle silme veya Admin SDK ile bir Cloud Function gerekir.
- Firestore ve Vercel'in ücretsiz katmanları küçük/orta ölçekli kullanım için yeterlidir; kullanım arttıkça (çok yüksek trafik, çok fazla depolama) ücretli katmanlara geçmen gerekebilir.

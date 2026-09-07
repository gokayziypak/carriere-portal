// Vercel Serverless Function
// Facebook grupları için iş ilanı paylaşım metni üretir.
// Anthropic API anahtarı sadece burada, ortam değişkeni olarak kullanılır.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST metodu desteklenir.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil.' });
  }

  try {
    const { client, title, loc, hours, pay, notes, salaryInfo, accommodationInfo, transportInfo } = req.body;
    if (!client || !title) {
      return res.status(400).json({ error: 'client ve title alanları zorunludur.' });
    }

    const prompt = `Sen Carriere adlı işe alım ajansında çalışan, Facebook gruplarında iş ilanı paylaşan bir sosyal medya asistanısın. Aşağıdaki bilgilere göre, Facebook'ta bir iş ilanı grubuna paylaşılacak metni TÜRKÇE olarak hazırla.

CLIENT / POZİSYON BİLGİLERİ (kayıtlı veritabanından):
- Firma: ${client}
- Pozisyon: ${title}
- Lokasyon/Adres: ${loc}
- Çalışma saatleri (kayıtlı): ${hours}
- Maaş (kayıtlı referans): ${pay}
- Notlar / gereksinimler (kayıtlı): ${notes}

BU İLANA ÖZEL DEĞİŞKEN BİLGİLER (kullanıcı girdi, metnin EN ÜSTÜNDE ve belirgin olmalı):
- Maaş: ${salaryInfo || 'kayıtlı maaş bilgisini kullan'}
- Kalacak yer / konaklama: ${accommodationInfo || 'belirtilmemiş, bu satırı atla'}
- Ulaşım / araç: ${transportInfo || 'belirtilmemiş, bu satırı atla'}

BİÇİM VE İÇERİK KURALLARI:
1. Facebook için ne çok uzun ne çok kısa bir metin yaz (yaklaşık 180-320 kelime).
2. Metnin EN ÜSTÜNDE şu üç bilgi mutlaka, belirgin şekilde (madde başına ** ile kalın işaretli) yer alsın: Maaş, Kalacak yer, Ulaşım. Bu üstteki blok metnin en dikkat çeken kısmı olmalı.
3. Bu bloğun hemen altında: Pozisyon adı - Firma adı - Adres tek satırda.
4. Ardından "Çalışma Saatleri" başlığı altında: kaç vardiya (tek/2 vardiya), saat kaçtan kaça, haftalık/günlük kaç saat. Kayıtlı bilgiden yararlan, eksikse mantıklı ve gerçekçi bir varsayımla doldur ama uydurma spesifik sayı verme, genel ifade kullan (örn. "gündüz vardiyası" gibi).
5. "Aranan Nitelikler" başlığı altında: kayıtlı notlardaki gereksinimleri madde madde yaz. Eksik bilgi varsa bu meslek grubu için genel kabul gören makul gereksinimleri kendin ekle (dil seviyesi, teknik beceri vb.), ama bunları da gerçekçi ve abartısız tut.
6. Aranan niteliklere MUTLAKA şu şartı ekle (atlamadan): "Tüm adayların AB vatandaşı olması VEYA geçerli bir Hollanda ikamet/çalışma izni sahibi olması gerekmektedir."
7. "Firma Hakkında" kısa bir bölüm ekle: kayıtlı notlarda firma ile ilgili somut bilgi (kaç yıldır faaliyette, çalışan sayısı vb.) varsa onu kullan. YOKSA kesinlikle uydurma rakam/yıl verme; bunun yerine genel, gerçekçi ve tavsiye edici bir dille yaz (örn. "sektöründe köklü bir yapıya sahip", "profesyonel ve kurumsal bir çalışma ortamı sunuyor", "kariyerinde ilerlemek isteyenler için iyi bir fırsat" gibi ifadeler kullan, spesifik sayı uydurma).
8. "Biz Neler Sunuyoruz?" başlığı altında madde madde tekrar özetle: çalışma saatleri/vardiya, ulaşım, konaklama, ve ayrıca kariyer ilerleme fırsatı olduğunu belirt.
9. Metnin sonuna AYNEN şu iletişim bloğunu ekle (değiştirme):
"📩 Daha fazla bilgi için:
E-posta: g.ziypak@carriere.com
Telefon: +31 615086484
WhatsApp veya e-posta üzerinden bize ulaşabilirsiniz."
10. Şu terimleri/ifadeleri geçtikleri her yerde ** ile kalın işaretle (Facebook'ta öne çıkması gereken önemli bilgiler): maaş rakamları, "kalacak yer"/konaklama ifadesi, "ulaşım"/araç ifadesi, çalışma saatleri/vardiya ifadeleri, ve varsa İngilizce/dil seviyesi (örn. MBO seviyesi, B1/B2 İngilizce) ifadeleri.
11. Sade, sıcak, profesyonel bir dil kullan. Emoji kullanabilirsin ama abartma (başlıklarda 1 emoji yeterli).
12. Markdown başlık (#) kullanma, sadece **kalın** ve satır başları/madde işaretleri (-) kullan, düz metin akışında kalsın çünkü Facebook markdown render etmez.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1600,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Anthropic API hatası: ${errText}` });
    }

    const data = await response.json();
    const text = (data.content || []).map(b => b.text || '').join('\n');
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

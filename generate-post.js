// Vercel Serverless Function
// Facebook grupları için iş ilanı paylaşım metni üretir (İNGİLİZCE çıktı).
// Anthropic API anahtarı sadece burada, ortam değişkeni olarak kullanılır.
//
// 2 AŞAMALI DOĞRULAMA ZİNCİRİ:
// Aşama 1 (Analist, Sonnet 5): İlk ilan metnini İngilizce üretir.
// Aşama 2 (Critical, Opus 5): Farklı bir model olarak biçim kurallarına ve bilinen geçmiş
// hatalara karşı denetler, gerekirse düzeltir.

async function callClaude(apiKey, content, maxTokens, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }]
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API hatası: ${errText}`);
  }
  const data = await response.json();
  return (data.content || []).map(b => b.text || '').join('\n');
}

function parseStructured(raw) {
  const out = {};
  for (const f of ['HATA_VAR', 'HATA_ACIKLAMASI']) {
    const re = new RegExp(f + '\\s*:\\s*(.*)', 'i');
    const m = raw.match(re);
    out[f] = m ? m[1].trim() : '';
  }
  const bodyMatch = raw.match(/METIN\s*:\s*([\s\S]*)$/i);
  out.body = bodyMatch ? bodyMatch[1].trim() : raw.trim();
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST metodu desteklenir.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil.' });
  }

  try {
    const { client, title, loc, hours, pay, notes, salaryInfo, accommodationInfo, transportInfo, knownErrors } = req.body;
    if (!client || !title) {
      return res.status(400).json({ error: 'client ve title alanları zorunludur.' });
    }

    const prompt = `You are a social media assistant working for a recruitment agency called Carriere, posting job openings in Facebook groups. Based on the information below, write the text for a Facebook job posting in ENGLISH.

CLIENT / POSITION DATA (from our records):
- Company: ${client}
- Position: ${title}
- Location/Address: ${loc}
- Working hours (on record): ${hours}
- Salary (reference, on record): ${pay}
- Notes / requirements (on record): ${notes}

VARIABLE INFO SPECIFIC TO THIS POSTING (must appear at the very TOP of the text, prominently):
- Salary: ${salaryInfo || 'use the salary on record'}
- Accommodation: ${accommodationInfo || 'not specified, skip this line'}
- Transport: ${transportInfo || 'not specified, skip this line'}

FORMAT AND CONTENT RULES:
1. Write a Facebook post that is neither too long nor too short (roughly 180-320 words).
2. At the very TOP of the text, these three items MUST appear prominently (each bolded with **): Salary, Accommodation, Transport. This top block should be the most eye-catching part of the post.
3. Right below that block: Position title - Company name - Address, on one line, and bold (**) this entire line too, same as the salary/accommodation/transport lines.
4. Then, under a "Working Hours" heading: number of shifts (single/2-shift), what time to what time, weekly/daily hours. Use the data on record; if incomplete, fill in with a reasonable, realistic assumption but do not invent specific numbers — use a general phrase instead (e.g. "day shift").
5. Under a "Requirements" heading: list the requirements from the notes on record as bullet points. If information is missing, add reasonable, generally accepted requirements for this profession yourself (language level, technical skills, etc.), but keep them realistic and not exaggerated. When mentioning language level, do NOT use "basic/intermediate/advanced" — use the CEFR scale instead (e.g. "English level B1", "at least A2-B1 level English", using A1, A2, B1, B2, C1, C2).
6. ALWAYS include this requirement (never skip it): "All candidates must be EU citizens OR hold a valid Dutch residence/work permit."
7. Add a short "About the Company" section: if the notes on record contain concrete facts about the company (years in business, number of employees, etc.), use them. If NOT, do NOT invent specific numbers or years under any circumstance; instead write in a general, realistic, encouraging tone (e.g. "an established and professional company in its sector", "offers a professional and corporate working environment", "a great opportunity for those looking to grow their career" — general phrases, no fabricated statistics).
8. Under a "What We Offer" heading, summarize again as bullet points: working hours/shift, transport, accommodation, and also mention there is room for career growth. For the accommodation and transport bullets, use ONLY short labels like "Accommodation provided" and "Transport support provided" — do NOT add an explanatory extra sentence (e.g. "accommodation covered by the company") since this was already detailed in the top "Highlights" block; don't repeat the detail here.
9. Near the end, right before the contact info, write one motivating closing sentence (e.g. "We're looking for motivated, experienced candidates who don't want to miss this opportunity! Apply now and let us support you.") but do NOT add a rocket emoji (🚀) or any other emoji to this sentence — keep it plain.
10. At the very end, add EXACTLY this contact block (do not change it):
"📩 For more information:
Email: g.ziypak@carriere.com
Phone: +31 615086484
You can reach us via WhatsApp or email."
11. Bold (**) every occurrence of these terms/phrases, since they should stand out on Facebook: salary figures (including the monthly estimate in parentheses, if present), "accommodation" mentions, "transport" mentions, working hours/shift phrases, language level (A1-C2) mentions, and the "Position - Company - Address" line.
12. Use a simple, warm, professional tone. Emojis are fine but don't overdo it (1 emoji per heading is enough; no emoji in the closing sentence).
13. Do not use markdown headings (#) — only **bold** and bullet points (-), keep it as plain flowing text since Facebook does not render markdown.`;

    // ---- AŞAMA 1: Analist (Sonnet 5) ----
    const draft = await callClaude(apiKey, [{ type: 'text', text: prompt }], 1600, 'claude-sonnet-5');

    const knownErrorsText = (knownErrors && knownErrors.length)
      ? knownErrors.map(e => `- Hata: ${e.hata} | Düzeltme: ${e.duzeltme}`).join('\n')
      : 'Kayıtlı bilinen hata yok.';

    // ---- AŞAMA 2: Critical (Opus 5 — farklı model, bağımsız denetim) ----
    const criticInstruction = `Sen "Critical" adlı bağımsız bir denetim yapay zekasısın. Görevin, başka bir yapay zeka modelinin (Analist) ürettiği İngilizce Facebook ilan metnini kontrol etmek.

DAHA ÖNCE TESPİT EDİLMİŞ BİLİNEN HATALAR (varsa bu cevapta tekrarlanmadığından emin ol, tekrarlanmışsa düzelt):
${knownErrorsText}

ANALİST'İN GÖREV TALİMATI ŞUYDU:
${prompt}

ANALİST'İN ÜRETTİĞİ CEVAP:
${draft}

Bu cevabı denetle: metin gerçekten İngilizce mi (Türkçe kelime/cümle sızmış mı), biçim kurallarına uyulmuş mu (kalın işaretleme, iletişim bloğu aynen kopyalanmış mı, AB vatandaşlığı/oturum izni şartı var mı, uydurma rakam/yıl var mı, emoji kuralına uyulmuş mu, CEFR seviyesi doğru kullanılmış mı). Sadece şu formatta cevap ver, başka hiçbir şey yazma:
HATA_VAR: evet/hayır
HATA_ACIKLAMASI: <bulduğun hatayı kısa ve net (Türkçe), ileride tekrar yapılmaması için tarif et; hata yoksa boş bırak>
METIN:
<hata yoksa Analist'in cevabını AYNEN (İngilizce olarak) tekrar yaz; hata varsa düzeltilmiş tam cevabı İngilizce olarak yaz>`;

    const criticRaw = await callClaude(apiKey, [{ type: 'text', text: criticInstruction }], 1800, 'claude-opus-5');
    const critic = parseStructured(criticRaw);

    let aiErrorFound = (critic.HATA_VAR || '').toLowerCase().startsWith('evet');
    let errorDescription = critic.HATA_ACIKLAMASI || '';
    let text = critic.body || draft;

    // ---- GÜVENCE KATMANI: İletişim bloğu asla yapay zekaya bırakılmaz, her zaman kod
    // seviyesinde deterministik olarak eklenir. Böylece "iletişim bilgisi eksik geldi"
    // hatası bir daha teknik olarak oluşamaz, model ne yazarsa yazsın.
    const CONTACT_BLOCK = `📩 For more information:\nEmail: g.ziypak@carriere.com\nPhone: +31 615086484\nYou can reach us via WhatsApp or email.`;
    const marker = '📩';
    const markerIdx = text.indexOf(marker);
    const hadCorrectBlock = markerIdx >= 0 && text.slice(markerIdx).replace(/\s+/g,' ').trim().includes('g.ziypak@carriere.com');
    const bodyWithoutContact = (markerIdx >= 0 ? text.slice(0, markerIdx) : text).trim();
    text = `${bodyWithoutContact}\n\n${CONTACT_BLOCK}`;

    const errorFound = aiErrorFound || !hadCorrectBlock;
    if(!hadCorrectBlock && !aiErrorFound){
      errorDescription = errorDescription || 'İletişim bilgisi (e-posta/telefon) bloğu modelin çıktısında eksik veya hatalıydı; artık kod seviyesinde her zaman otomatik ekleniyor, bu hata bir daha oluşamaz.';
    }

    return res.status(200).json({ text, pipeline: { errorFound, errorDescription } });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

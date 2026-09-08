// Vercel Serverless Function
// Bu dosya tarayıcıda değil, Vercel'in sunucusunda çalışır.
// Anthropic API anahtarı (ANTHROPIC_API_KEY) sadece burada, ortam değişkeni olarak kullanılır
// ve hiçbir zaman tarayıcıya/istemci koduna gönderilmez.
// PDF dosyaları için doğrudan Anthropic 'document' bloğu kullanılır.
// DOCX/PPTX dosyaları tarayıcı tarafında metne çevrilip 'cvText' olarak gönderilir.
//
// 2 AŞAMALI DOĞRULAMA ZİNCİRİ:
// Aşama 1 (Analist, Sonnet 5): İlk CV analizini üretir.
// Aşama 2 (Critical, Opus 5): Farklı bir model olarak Analist'in cevabını CV'ye ve bilinen
// geçmiş hatalara karşı denetler, gerekirse düzeltir. Farklı model kullanmak, aynı modelin
// kendi hatasını fark edememe ("kör nokta") riskini azaltır.

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

function buildCvContentBlocks(fileBase64, cvText, extraText) {
  const blocks = [];
  if (fileBase64) {
    blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } });
  } else {
    blocks.push({ type: 'text', text: `--- CV METNİ (dosyadan çıkarıldı) ---\n${cvText}` });
  }
  blocks.push({ type: 'text', text: extraText });
  return blocks;
}

function parseStructured(raw, fields) {
  const out = {};
  for (const f of fields) {
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
    return res.status(500).json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil. Vercel > Project Settings > Environment Variables kısmından ekleyin.' });
  }

  try {
    const { fileBase64, cvText, prompt, knownErrors } = req.body;
    if (!prompt || (!fileBase64 && !cvText)) {
      return res.status(400).json({ error: 'prompt ve (fileBase64 veya cvText) alanlarından biri zorunludur.' });
    }

    const knownErrorsText = (knownErrors && knownErrors.length)
      ? knownErrors.map(e => `- Hata: ${e.hata} | Düzeltme: ${e.duzeltme}`).join('\n')
      : 'Kayıtlı bilinen hata yok.';

    // ---- AŞAMA 1: Analist (Sonnet 5) ----
    const draftContent = buildCvContentBlocks(fileBase64, cvText, prompt);
    const draft = await callClaude(apiKey, draftContent, 4000, 'claude-sonnet-5');

    // ---- AŞAMA 2: Critical (Opus 5 — farklı model, bağımsız denetim) ----
    const criticInstruction = `Sen "Critical" adlı bağımsız bir denetim yapay zekasısın. Görevin, başka bir yapay zeka modelinin (Analist) ürettiği CV analizini kontrol etmek.

DAHA ÖNCE TESPİT EDİLMİŞ BİLİNEN HATALAR (varsa bu cevapta tekrarlanmadığından emin ol, tekrarlanmışsa düzelt):
${knownErrorsText}

ANALİST'İN GÖREV TALİMATI ŞUYDU:
${prompt}

ANALİST'İN ÜRETTİĞİ CEVAP:
${draft}

Şimdi ekli CV'ye bakarak bu cevabı satır satır denetle: CV'den doğru bilgi çekilmiş mi, uydurma/halüsinasyon bilgi var mı, pozisyon eşleştirmesi mantıklı mı, sayılar/tarihler doğru mu, puanlar (score) tutarlı mı. EĞER Analist'in görev talimatı çıktının SADECE geçerli JSON olmasını istiyorsa: METIN alanına da SADECE geçerli, düzgün formatlı JSON yaz — markdown kod bloğu işareti (\`\`\`) veya JSON dışında hiçbir açıklama ekleme; JSON bozuksa/eksikse düzelt. Sadece şu formatta cevap ver, başka hiçbir şey yazma:
HATA_VAR: evet/hayır
HATA_ACIKLAMASI: <bulduğun hatayı kısa ve net, ileride tekrar yapılmaması için tarif et; hata yoksa boş bırak>
METIN:
<hata yoksa Analist'in cevabını AYNEN tekrar yaz; hata varsa düzeltilmiş tam cevabı yaz (görev JSON istiyorsa SADECE JSON)>`;

    const criticContent = buildCvContentBlocks(fileBase64, cvText, criticInstruction);
    const criticRaw = await callClaude(apiKey, criticContent, 4200, 'claude-opus-5');
    const critic = parseStructured(criticRaw, ['HATA_VAR', 'HATA_ACIKLAMASI']);

    const errorFound = (critic.HATA_VAR || '').toLowerCase().startsWith('evet');
    const errorDescription = critic.HATA_ACIKLAMASI || '';
    const finalText = critic.body || draft;

    return res.status(200).json({
      text: finalText,
      pipeline: { errorFound, errorDescription }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

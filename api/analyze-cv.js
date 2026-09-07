// Vercel Serverless Function
// Bu dosya tarayıcıda değil, Vercel'in sunucusunda çalışır.
// Anthropic API anahtarı (ANTHROPIC_API_KEY) sadece burada, ortam değişkeni olarak kullanılır
// ve hiçbir zaman tarayıcıya/istemci koduna gönderilmez.
// PDF dosyaları için doğrudan Anthropic 'document' bloğu kullanılır.
// DOCX/PPTX dosyaları tarayıcı tarafında metne çevrilip 'cvText' olarak gönderilir.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST metodu desteklenir.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil. Vercel > Project Settings > Environment Variables kısmından ekleyin.' });
  }

  try {
    const { fileBase64, cvText, prompt } = req.body;
    if (!prompt || (!fileBase64 && !cvText)) {
      return res.status(400).json({ error: 'prompt ve (fileBase64 veya cvText) alanlarından biri zorunludur.' });
    }

    let content;
    if (fileBase64) {
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } },
        { type: 'text', text: prompt }
      ];
    } else {
      content = [
        { type: 'text', text: `${prompt}\n\n--- CV METNİ (dosyadan çıkarıldı) ---\n${cvText}` }
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content }]
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

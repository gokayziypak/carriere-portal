export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST metodu desteklenir.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil. Vercel > Project Settings > Environment Variables kısmından ekleyin.' });
  }

  try {
    const { fileBase64, prompt } = req.body;
    if (!fileBase64 || !prompt) {
      return res.status(400).json({ error: 'fileBase64 ve prompt alanları zorunludur.' });
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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
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

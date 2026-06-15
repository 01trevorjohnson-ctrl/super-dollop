const router = require('express').Router();
const anthropic = require('../lib/anthropic');
const db = require('../lib/supabase');

// POST /api/chat
// Body: { ticker, form, accessionNumber, filingText, messages, sessionId }
router.post('/', async (req, res) => {
  const { ticker, form, accessionNumber, filingText, messages, sessionId } = req.body;

  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const contextNote = filingText
      ? `The following is the text of a ${form || 'SEC'} filing for ${ticker}. Use it as your primary source when answering questions. Cite specific figures, dates, and sections when relevant.

<filing>
${filingText.slice(0, 150000)}
</filing>`
      : `No filing document is loaded. Answer general questions about ${ticker || 'the company'}.`;

    const systemPrompt = `You are a financial analyst helping users understand SEC filings. Be precise with numbers and dates. If something is not in the filing, say so clearly rather than speculating.

${contextNote}`;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    let fullText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        send({ text: event.delta.text });
      }
    }

    send({ done: true });
    res.end();

    // Persist conversation history to Supabase
    if (db && sessionId) {
      const allMessages = [...messages, { role: 'assistant', content: fullText }];
      await db.from('conversations').upsert(
        {
          session_id: sessionId,
          ticker: ticker?.toUpperCase(),
          filing_accession: accessionNumber,
          messages: allMessages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );
    }
  } catch (err) {
    console.error(err);
    send({ error: err.message });
    res.end();
  }
});

module.exports = router;

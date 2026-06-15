const router = require('express').Router();
const { resolveTicker, getSubmissions, fetchDocument, stripToText } = require('../lib/edgar');
const db = require('../lib/supabase');

const TARGET_FORMS = new Set(['10-K', '10-Q', '8-K', 'DEF 14A', 'S-1', 'S-1/A', '20-F', '6-K']);

// GET /api/filings?ticker=AAPL
router.get('/', async (req, res) => {
  try {
    const ticker = req.query.ticker?.toUpperCase();
    if (!ticker) return res.status(400).json({ error: 'ticker required' });

    let info = null;

    if (db) {
      const { data } = await db.from('ticker_cik_map').select('*').eq('ticker', ticker).maybeSingle();
      if (data) info = { cik: data.cik, name: data.company_name };
    }

    if (!info) {
      info = await resolveTicker(ticker);
      if (!info) return res.status(404).json({ error: `Ticker "${ticker}" not found in EDGAR` });
      if (db) {
        await db.from('ticker_cik_map').upsert({ ticker, cik: info.cik, company_name: info.name });
      }
    }

    const submissions = await getSubmissions(info.cik);
    const r = submissions.filings.recent;

    const filings = [];
    for (let i = 0; i < r.form.length && filings.length < 30; i++) {
      if (TARGET_FORMS.has(r.form[i])) {
        filings.push({
          form: r.form[i],
          filingDate: r.filingDate[i],
          accessionNumber: r.accessionNumber[i],
          primaryDocument: r.primaryDocument[i],
          description: r.primaryDocDescription?.[i] ?? '',
          reportDate: r.reportDate?.[i] ?? '',
        });
      }
    }

    res.json({ ticker, cik: info.cik, company: info.name, filings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/filings/document?cik=...&accession=...&doc=...&ticker=...&form=...
router.get('/document', async (req, res) => {
  try {
    const { cik, accession, doc, ticker, form } = req.query;
    if (!cik || !accession || !doc) return res.status(400).json({ error: 'cik, accession, doc required' });

    if (db) {
      const { data } = await db
        .from('cached_filings')
        .select('document_text')
        .eq('accession_number', accession)
        .maybeSingle();
      if (data) return res.json({ text: data.document_text, fromCache: true });
    }

    const raw = await fetchDocument(cik, accession, doc);
    let text = doc.toLowerCase().endsWith('.txt') ? raw : stripToText(raw);

    // Cap at ~300k chars (~75k tokens) — leaves room for conversation + response
    if (text.length > 300000) {
      text = text.slice(0, 300000) + '\n\n[Document truncated at 300,000 characters]';
    }

    if (db) {
      await db.from('cached_filings').upsert({
        accession_number: accession,
        ticker: ticker?.toUpperCase(),
        form_type: form,
        document_text: text,
      });
    }

    res.json({ text, fromCache: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

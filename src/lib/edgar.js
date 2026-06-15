const UA = process.env.EDGAR_UA || 'super-dollop research@example.com';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const SUBMISSIONS = 'https://data.sec.gov/submissions';

let _tickerMap = null;

async function loadTickerMap() {
  if (_tickerMap) return _tickerMap;
  const r = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) throw new Error(`EDGAR ticker map fetch failed: ${r.status}`);
  const raw = await r.json();
  _tickerMap = {};
  for (const v of Object.values(raw)) {
    _tickerMap[v.ticker.toUpperCase()] = {
      cik: String(v.cik_str).padStart(10, '0'),
      name: v.title,
    };
  }
  return _tickerMap;
}

async function resolveTicker(ticker) {
  const map = await loadTickerMap();
  return map[ticker.toUpperCase()] ?? null;
}

async function getSubmissions(paddedCik) {
  const r = await fetch(`${SUBMISSIONS}/CIK${paddedCik}.json`, {
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) throw new Error(`EDGAR submissions fetch failed: ${r.status}`);
  return r.json();
}

async function fetchDocument(cik, accessionNumber, filename) {
  const cikInt = parseInt(cik, 10);
  const accNoDash = accessionNumber.replace(/-/g, '');
  const url = `${ARCHIVES}/${cikInt}/${accNoDash}/${filename}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`EDGAR document fetch failed: ${r.status} — ${url}`);
  return r.text();
}

function stripToText(raw) {
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(\r?\n){3,}/g, '\n\n')
    .trim();
}

module.exports = { resolveTicker, getSubmissions, fetchDocument, stripToText };

const router = require('express').Router();

let _yf = null;
async function getYF() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    _yf = mod.default;
    _yf.suppressNotices(['yahooSurvey', 'ripHistorical']);
  }
  return _yf;
}

// GET /api/quotes?ticker=AAPL
router.get('/', async (req, res) => {
  const ticker = req.query.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  try {
    const yahooFinance = await getYF();
    const q = await yahooFinance.quote(ticker, {}, { validateResult: false });
    res.json({
      symbol: q.symbol,
      name: q.longName || q.shortName,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      marketCap: q.marketCap,
      volume: q.regularMarketVolume,
      open: q.regularMarketOpen,
      high: q.regularMarketDayHigh,
      low: q.regularMarketDayLow,
      pe: q.trailingPE,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      exchange: q.fullExchangeName,
      currency: q.currency,
      marketState: q.marketState,
    });
  } catch (err) {
    res.status(404).json({ error: `Quote not available for ${ticker}: ${err.message}` });
  }
});

module.exports = router;

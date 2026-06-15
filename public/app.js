'use strict';

const SESSION_ID = (() => {
  let id = localStorage.getItem('sd_session');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('sd_session', id); }
  return id;
})();

const state = {
  ticker: null,
  cik: null,
  company: null,
  filings: [],
  filing: null,
  filingText: null,
  messages: [],
  streaming: false,
};

// -- DOM refs --
const $ = (id) => document.getElementById(id);
const tickerInput   = $('ticker-input');
const searchBtn     = $('search-btn');
const loadingBar    = $('loading-bar');
const loadingMsg    = $('loading-msg');
const companyInfoEl = $('company-info');
const filingsListEl = $('filings-list');
const quoteBarEl    = $('quote-bar');
const filingHeader  = $('filing-header');
const messagesEl    = $('messages');
const chatInput     = $('chat-input');
const sendBtn       = $('send-btn');

// -- Utilities --
function fmt(n, decimals = 2) {
  return n != null ? n.toFixed(decimals) : '--';
}

function fmtLarge(n) {
  if (n == null) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function setLoading(on, msg = '') {
  loadingBar.hidden = !on;
  loadingMsg.textContent = msg;
  searchBtn.disabled = on;
}

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  chatInput.placeholder = enabled
    ? 'Ask anything about this filing… (Enter to send, Shift+Enter for newline)'
    : 'Load a filing to start asking questions…';
}

// -- Render helpers --
function renderCompany(data) {
  companyInfoEl.innerHTML = `
    <div class="company-name">${escHtml(data.company)}</div>
    <div class="company-ticker">${data.ticker}</div>
  `;
}

function renderFilings(filings) {
  if (filings.length === 0) {
    filingsListEl.innerHTML = '<div class="empty">No filings found</div>';
    return;
  }

  // Group by form type
  const groups = {};
  for (const f of filings) {
    if (!groups[f.form]) groups[f.form] = [];
    groups[f.form].push(f);
  }

  filingsListEl.innerHTML = Object.entries(groups).map(([form, items]) => `
    <div class="filing-group">
      <div class="filing-group-label">${form}</div>
      ${items.map(f => `
        <div class="filing-item" data-accession="${f.accessionNumber}">
          <span class="filing-date">${f.filingDate}</span>
          ${f.reportDate ? `<span class="filing-period">Period: ${f.reportDate}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('');

  filingsListEl.querySelectorAll('.filing-item').forEach(el => {
    el.addEventListener('click', () => {
      const filing = state.filings.find(f => f.accessionNumber === el.dataset.accession);
      if (filing) selectFiling(filing);
    });
  });
}

function renderQuote(q) {
  if (!q || !q.price) { quoteBarEl.hidden = true; return; }
  const sign = q.change >= 0 ? '+' : '';
  const cls  = q.change >= 0 ? 'up' : 'down';

  const stats = [
    q.marketCap  ? `Mkt Cap: ${fmtLarge(q.marketCap)}` : null,
    q.pe         ? `P/E: ${fmt(q.pe, 1)}` : null,
    q.volume     ? `Vol: ${(q.volume / 1e6).toFixed(2)}M` : null,
    q.fiftyTwoWeekHigh ? `52wk: ${fmt(q.fiftyTwoWeekLow)}–${fmt(q.fiftyTwoWeekHigh)}` : null,
    q.exchange   ? q.exchange : null,
  ].filter(Boolean);

  quoteBarEl.hidden = false;
  quoteBarEl.innerHTML = `
    <span class="q-price">$${fmt(q.price)}</span>
    <span class="q-change ${cls}">${sign}${fmt(q.change)} (${sign}${fmt(q.changePct)}%)</span>
    ${stats.map(s => `<span class="q-stat">${s}</span>`).join('')}
    ${q.marketState !== 'REGULAR' ? `<span class="q-stat" style="color:#fbbf24">${q.marketState}</span>` : ''}
  `;
}

function renderFilingHeader(filing, loading = true) {
  filingHeader.innerHTML = `
    <div class="filing-title">
      <span class="form-badge">${filing.form}</span>
      <span>${escHtml(filing.description || filing.form + ' Filing')}</span>
    </div>
    <div class="filing-meta">
      Filed: ${filing.filingDate}
      ${filing.reportDate ? ` &bull; Period: ${filing.reportDate}` : ''}
    </div>
    <div id="doc-status" class="doc-status">${loading ? 'Loading document…' : ''}</div>
  `;
}

function addMessage(role, content, streaming = false) {
  const div = document.createElement('div');
  div.className = `message ${role}${streaming ? ' streaming' : ''}`;
  if (streaming) div.id = 'streaming-msg';
  div.innerHTML = `
    <div class="msg-role">${role === 'user' ? 'You' : 'Claude'}</div>
    <div class="msg-content">${content ? escHtml(content) : ''}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function addNote(text) {
  const div = document.createElement('div');
  div.className = 'system-note';
  div.textContent = text;
  messagesEl.appendChild(div);
}

// -- API calls --
async function apiFetch(url) {
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(body.error || r.statusText);
  }
  return r.json();
}

// -- Actions --
async function handleSearch() {
  const ticker = tickerInput.value.trim().toUpperCase();
  if (!ticker) return;

  setLoading(true, 'Looking up EDGAR…');
  companyInfoEl.innerHTML = '';
  filingsListEl.innerHTML = '';
  filingHeader.innerHTML = '<span class="placeholder-text">Select a filing from the list</span>';
  quoteBarEl.hidden = true;
  messagesEl.innerHTML = '';
  state.filings = [];
  state.filing = null;
  state.filingText = null;
  state.messages = [];
  setChatEnabled(false);

  try {
    const data = await apiFetch(`/api/filings?ticker=${encodeURIComponent(ticker)}`);
    state.ticker  = data.ticker;
    state.cik     = data.cik;
    state.company = data.company;
    state.filings = data.filings;

    renderCompany(data);
    renderFilings(data.filings);

    // Load quote in background — non-critical
    apiFetch(`/api/quotes?ticker=${encodeURIComponent(ticker)}`)
      .then(q => renderQuote(q))
      .catch(() => {});
  } catch (err) {
    companyInfoEl.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`;
  } finally {
    setLoading(false);
  }
}

async function selectFiling(filing) {
  // Highlight selected item
  document.querySelectorAll('.filing-item').forEach(el => el.classList.remove('selected'));
  document.querySelector(`[data-accession="${filing.accessionNumber}"]`)?.classList.add('selected');

  state.filing = filing;
  state.filingText = null;
  state.messages = [];
  messagesEl.innerHTML = '';
  setChatEnabled(false);

  renderFilingHeader(filing, true);

  try {
    const params = new URLSearchParams({
      cik: state.cik,
      accession: filing.accessionNumber,
      doc: filing.primaryDocument,
      ticker: state.ticker,
      form: filing.form,
    });
    const result = await apiFetch(`/api/filings/document?${params}`);
    state.filingText = result.text;

    const statusEl = $('doc-status');
    if (statusEl) {
      const chars = (result.text.length / 1000).toFixed(0);
      statusEl.textContent = `${chars}k chars loaded${result.fromCache ? ' (cached)' : ''}`;
      statusEl.className = 'doc-status ready';
    }

    addNote(`${filing.form} filing loaded. Ask anything about it.`);
    setChatEnabled(true);
    chatInput.focus();
  } catch (err) {
    const statusEl = $('doc-status');
    if (statusEl) {
      statusEl.textContent = `Failed to load: ${err.message}`;
      statusEl.className = 'doc-status error';
    }
  }
}

async function handleSend() {
  const content = chatInput.value.trim();
  if (!content || state.streaming) return;
  chatInput.value = '';
  autoResize();
  await streamChat(content);
}

async function streamChat(userContent) {
  state.messages.push({ role: 'user', content: userContent });
  addMessage('user', userContent);

  state.streaming = true;
  setChatEnabled(false);
  sendBtn.disabled = true;

  const msgDiv = addMessage('assistant', '', true);
  const contentEl = msgDiv.querySelector('.msg-content');
  let fullText = '';

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: state.ticker,
        form: state.filing?.form,
        accessionNumber: state.filing?.accessionNumber,
        filingText: state.filingText,
        messages: state.messages,
        sessionId: SESSION_ID,
      }),
    });

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || r.statusText);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by \n\n
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // hold incomplete trailing chunk

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        let payload;
        try { payload = JSON.parse(line.slice(6)); } catch { continue; }
        if (payload.error) throw new Error(payload.error);
        if (payload.text) {
          fullText += payload.text;
          contentEl.innerHTML = escHtml(fullText);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        if (payload.done) break;
      }
    }

    msgDiv.classList.remove('streaming');
    msgDiv.removeAttribute('id');
    state.messages.push({ role: 'assistant', content: fullText });
  } catch (err) {
    contentEl.innerHTML = `<em>Error: ${escHtml(err.message)}</em>`;
    msgDiv.classList.add('error');
    msgDiv.classList.remove('streaming');
  } finally {
    state.streaming = false;
    setChatEnabled(!!state.filing && !!state.filingText);
  }
}

// Auto-resize textarea
function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
}

// -- Event listeners --
searchBtn.addEventListener('click', handleSearch);
tickerInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
sendBtn.addEventListener('click', handleSend);
chatInput.addEventListener('input', autoResize);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

setChatEnabled(false);

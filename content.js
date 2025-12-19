// ═══════════════════════════════════════════════════════════════
// APPLIQUEER — Content Script
// Injects the sidepanel UI into webpages
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  if (document.getElementById('appliqueer-root')) return;

  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  const state = {
    isExpanded: false,
    isLoading: false,
    question: '',
    additionalContext: '',
    response: '',
    error: null,
    hasApiKey: false
  };

  // ─────────────────────────────────────────────────────────────
  // Icons — Using the Appliqueer brand logo
  // ─────────────────────────────────────────────────────────────
  const icons = {
    logo: `<img src="${chrome.runtime.getURL('icons/Appliqueer PNG.png')}" alt="Appliqueer" style="width: 100%; height: 100%; object-fit: contain;">`,

    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,

    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>`,

    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>`,

    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>`,

    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,

    sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
    </svg>`
  };

  // ─────────────────────────────────────────────────────────────
  // Create UI
  // ─────────────────────────────────────────────────────────────
  function createRoot() {
    const root = document.createElement('div');
    root.id = 'appliqueer-root';
    root.innerHTML = `
      <button class="aq-floating-btn" id="aq-toggle-btn" aria-label="Open Appliqueer">
        <div class="aq-btn-icon-wrapper">
          <span class="aq-btn-icon">${icons.logo}</span>
        </div>
      </button>
      <div class="aq-shortcut-hint"></div>

      <div class="aq-panel" id="aq-panel">
        <header class="aq-header">
          <div class="aq-logo">
            <span class="aq-logo-text">Appliqueer</span>
            <p class="aq-logo-subtitle">AI Resume Assistant</p>
          </div>
          <button class="aq-close-btn" id="aq-close-btn" aria-label="Close">
            ${icons.close}
          </button>
        </header>

        <div class="aq-body">
          <div class="aq-input-group">
            <label class="aq-input-label">Your Question</label>
            <textarea
              class="aq-textarea"
              id="aq-question"
              placeholder="Ask about your resume, career, or job applications..."
            ></textarea>
          </div>

          <div class="aq-input-group">
            <label class="aq-input-label">Context (optional)</label>
            <textarea
              class="aq-textarea aq-textarea--small"
              id="aq-context"
              placeholder="Paste a job description or relevant details..."
            ></textarea>
          </div>

          <button class="aq-submit-btn" id="aq-submit-btn">
            <span>Get Answer</span>
            ${icons.send}
          </button>

          <div class="aq-response">
            <div class="aq-response-header">
              <span class="aq-label">Response</span>
              <button class="aq-copy-btn" id="aq-copy-btn" style="display: none;">
                ${icons.copy}
                <span>Copy</span>
              </button>
            </div>
            <div class="aq-response-content" id="aq-response-content">
              <div class="aq-response-placeholder">
                ${icons.sparkle}
                <span>Your answer will appear here</span>
              </div>
            </div>
          </div>
        </div>

        <footer class="aq-footer">
          <button class="aq-settings-link" id="aq-settings-btn">
            ${icons.settings}
            <span>Settings</span>
          </button>
          <div class="aq-status">
            <span class="aq-status-dot" id="aq-status-dot"></span>
            <span id="aq-status-text">Ready</span>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  // ─────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────
  function init() {
    const root = createRoot();
    bindEvents(root);
    checkApiKeyStatus();
  }

  async function checkApiKeyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_STATUS' });
      state.hasApiKey = response?.hasApiKey || false;
      updateStatusIndicator();
    } catch (err) {
      console.error('Appliqueer: Status check failed', err);
    }
  }

  function updateStatusIndicator() {
    const dot = document.getElementById('aq-status-dot');
    const text = document.getElementById('aq-status-text');

    if (!state.hasApiKey) {
      dot.classList.add('aq-status-dot--warning');
      text.textContent = 'Configure API key';
    } else {
      dot.classList.remove('aq-status-dot--warning', 'aq-status-dot--error');
      text.textContent = 'Ready';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────
  function bindEvents(root) {
    const toggleBtn = root.querySelector('#aq-toggle-btn');
    const closeBtn = root.querySelector('#aq-close-btn');
    const panel = root.querySelector('#aq-panel');
    const submitBtn = root.querySelector('#aq-submit-btn');
    const questionInput = root.querySelector('#aq-question');
    const contextInput = root.querySelector('#aq-context');
    const copyBtn = root.querySelector('#aq-copy-btn');
    const settingsBtn = root.querySelector('#aq-settings-btn');

    toggleBtn.addEventListener('click', () => togglePanel(panel, toggleBtn));
    closeBtn.addEventListener('click', () => togglePanel(panel, toggleBtn));
    submitBtn.addEventListener('click', handleSubmit);
    copyBtn.addEventListener('click', copyResponse);

    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });

    questionInput.addEventListener('input', (e) => state.question = e.target.value);
    contextInput.addEventListener('input', (e) => state.additionalContext = e.target.value);

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (state.isExpanded && !panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        togglePanel(panel, toggleBtn);
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        togglePanel(panel, toggleBtn);
      }
      if (e.key === 'Escape' && state.isExpanded) {
        togglePanel(panel, toggleBtn);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.isExpanded) {
        e.preventDefault();
        handleSubmit();
      }
    });
  }

  function togglePanel(panel, toggleBtn) {
    state.isExpanded = !state.isExpanded;
    panel.classList.toggle('aq-panel--open', state.isExpanded);
    toggleBtn.style.opacity = state.isExpanded ? '0' : '1';
    toggleBtn.style.pointerEvents = state.isExpanded ? 'none' : 'auto';

    if (state.isExpanded) {
      setTimeout(() => document.getElementById('aq-question')?.focus(), 350);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Submit & Response
  // ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (state.isLoading || !state.question.trim()) return;

    state.isLoading = true;
    state.error = null;
    updateUI();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ASK_AI',
        question: state.question.trim(),
        additionalContext: state.additionalContext.trim()
      });

      if (response.error) {
        state.error = response.error;
        state.response = '';
      } else {
        state.response = response.answer || 'No response received.';
        state.error = null;
      }
    } catch (err) {
      state.error = 'Failed to get response. Please try again.';
      state.response = '';
    } finally {
      state.isLoading = false;
      updateUI();
    }
  }

  function updateUI() {
    const submitBtn = document.getElementById('aq-submit-btn');
    const responseContent = document.getElementById('aq-response-content');
    const copyBtn = document.getElementById('aq-copy-btn');

    if (state.isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="aq-spinner"></div><span>Thinking...</span>`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Get Answer</span>${icons.send}`;
    }

    if (state.error) {
      responseContent.innerHTML = `<div class="aq-error">${escapeHtml(state.error)}</div>`;
      copyBtn.style.display = 'none';
    } else if (state.response) {
      responseContent.innerHTML = formatResponse(state.response);
      copyBtn.style.display = 'flex';
    } else if (!state.isLoading) {
      responseContent.innerHTML = `
        <div class="aq-response-placeholder">
          ${icons.sparkle}
          <span>Your answer will appear here</span>
        </div>
      `;
      copyBtn.style.display = 'none';
    }
  }

  function formatResponse(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>'.replace(/<p><\/p>/g, '');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(state.response);
      const copyBtn = document.getElementById('aq-copy-btn');
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `${icons.check}<span>Copied!</span>`;
      setTimeout(() => copyBtn.innerHTML = original, 2000);
    } catch (err) {
      console.error('Appliqueer: Copy failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

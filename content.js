// Appliqueer - Content Script
// Injects the floating panel into every webpage

(function() {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('appliqueer-root')) return;

  // State management
  const state = {
    isExpanded: false,
    isLoading: false,
    question: '',
    additionalContext: '',
    response: '',
    error: null,
    hasApiKey: false
  };

  // SVG Icons
  const icons = {
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#e6ff00" stroke-width="2"/>
      <path d="M12 6v12M6 12h12M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#e6ff00" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>`
  };

  // Create the root container
  function createRoot() {
    const root = document.createElement('div');
    root.id = 'appliqueer-root';
    root.innerHTML = `
      <!-- Floating Button -->
      <button class="aq-floating-btn" id="aq-toggle-btn" aria-label="Open Appliqueer">
        <span class="aq-btn-icon">${icons.logo}</span>
      </button>
      <div class="aq-shortcut-hint">Ctrl+Shift+A</div>

      <!-- Expanded Panel -->
      <div class="aq-panel" id="aq-panel">
        <header class="aq-header">
          <div class="aq-logo">
            <span class="aq-logo-icon">${icons.logo}</span>
            <span class="aq-logo-text">Appliqueer</span>
          </div>
          <button class="aq-close-btn" id="aq-close-btn" aria-label="Close panel">
            ${icons.close}
          </button>
        </header>

        <div class="aq-body">
          <!-- Question Card -->
          <div class="aq-card">
            <div class="aq-card-header">
              <div class="aq-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <span class="aq-card-title">Ask a Question</span>
            </div>
            <div class="aq-card-body">
              <textarea 
                class="aq-textarea" 
                id="aq-question" 
                placeholder="What would you like to know about your job search, resume, or career?"
              ></textarea>
            </div>
          </div>

          <!-- Context Card -->
          <div class="aq-card">
            <div class="aq-card-header">
              <div class="aq-card-icon aq-card-icon--secondary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <span class="aq-card-title">Additional Context</span>
            </div>
            <div class="aq-card-body">
              <textarea 
                class="aq-textarea aq-textarea--small" 
                id="aq-context" 
                placeholder="Paste job description, company details, or any relevant info..."
              ></textarea>
            </div>
          </div>

          <button class="aq-submit-btn" id="aq-submit-btn">
            ${icons.send}
            <span>Get Answer</span>
          </button>

          <!-- Response Section -->
          <div class="aq-response">
            <div class="aq-response-header">
              <span class="aq-label">AI Response</span>
              <button class="aq-copy-btn" id="aq-copy-btn" style="display: none;">
                ${icons.copy}
                <span>Copy</span>
              </button>
            </div>
            <div class="aq-response-content" id="aq-response-content">
              <div class="aq-response-placeholder" id="aq-placeholder">
                ${icons.sparkles}
                <span>Your personalized answer will appear here</span>
              </div>
            </div>
          </div>
        </div>

        <footer class="aq-footer">
          <button class="aq-settings-link" id="aq-settings-btn">
            ${icons.settings}
            <span>Settings</span>
          </button>
          <div class="aq-status" id="aq-status">
            <span class="aq-status-dot" id="aq-status-dot"></span>
            <span id="aq-status-text">Ready</span>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  // Initialize the extension
  function init() {
    const root = createRoot();
    bindEvents(root);
    checkApiKeyStatus();
  }

  // Check if API key is configured
  async function checkApiKeyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_STATUS' });
      state.hasApiKey = response?.hasApiKey || false;
      updateStatusIndicator();
    } catch (error) {
      console.error('Appliqueer: Failed to check status', error);
    }
  }

  // Update status indicator
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

  // Bind event listeners
  function bindEvents(root) {
    const toggleBtn = root.querySelector('#aq-toggle-btn');
    const closeBtn = root.querySelector('#aq-close-btn');
    const panel = root.querySelector('#aq-panel');
    const submitBtn = root.querySelector('#aq-submit-btn');
    const questionInput = root.querySelector('#aq-question');
    const contextInput = root.querySelector('#aq-context');
    const copyBtn = root.querySelector('#aq-copy-btn');
    const settingsBtn = root.querySelector('#aq-settings-btn');

    // Toggle panel
    toggleBtn.addEventListener('click', () => togglePanel(panel, toggleBtn));
    closeBtn.addEventListener('click', () => togglePanel(panel, toggleBtn));

    // Submit question
    submitBtn.addEventListener('click', () => handleSubmit());

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + A to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        togglePanel(panel, toggleBtn);
      }
      // Escape to close
      if (e.key === 'Escape' && state.isExpanded) {
        togglePanel(panel, toggleBtn);
      }
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.isExpanded) {
        e.preventDefault();
        handleSubmit();
      }
    });

    // Track input changes
    questionInput.addEventListener('input', (e) => {
      state.question = e.target.value;
    });
    contextInput.addEventListener('input', (e) => {
      state.additionalContext = e.target.value;
    });

    // Copy response
    copyBtn.addEventListener('click', () => copyResponse());

    // Open settings
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });
  }

  // Toggle panel visibility
  function togglePanel(panel, toggleBtn) {
    state.isExpanded = !state.isExpanded;
    panel.classList.toggle('aq-panel--open', state.isExpanded);
    toggleBtn.style.opacity = state.isExpanded ? '0' : '1';
    toggleBtn.style.pointerEvents = state.isExpanded ? 'none' : 'auto';

    if (state.isExpanded) {
      // Focus question input when opening
      setTimeout(() => {
        document.getElementById('aq-question')?.focus();
      }, 300);
    }
  }

  // Handle form submission
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
    } catch (error) {
      console.error('Appliqueer: Error getting response', error);
      state.error = 'Failed to get response. Please try again.';
      state.response = '';
    } finally {
      state.isLoading = false;
      updateUI();
    }
  }

  // Update UI based on state
  function updateUI() {
    const submitBtn = document.getElementById('aq-submit-btn');
    const responseContent = document.getElementById('aq-response-content');
    const placeholder = document.getElementById('aq-placeholder');
    const copyBtn = document.getElementById('aq-copy-btn');

    // Update submit button
    if (state.isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="aq-spinner"></div><span>Thinking...</span>`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icons.send}<span>Get Answer</span>`;
    }

    // Update response area
    if (state.error) {
      responseContent.innerHTML = `<div class="aq-error">${escapeHtml(state.error)}</div>`;
      copyBtn.style.display = 'none';
    } else if (state.response) {
      responseContent.innerHTML = formatResponse(state.response);
      copyBtn.style.display = 'flex';
    } else if (!state.isLoading) {
      responseContent.innerHTML = `
        <div class="aq-response-placeholder">
          ${icons.sparkles}
          <span>Your AI-powered answer will appear here</span>
        </div>
      `;
      copyBtn.style.display = 'none';
    }
  }

  // Format response with basic markdown
  function formatResponse(text) {
    // Escape HTML first
    let html = escapeHtml(text);
    
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Code blocks: ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraph
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Copy response to clipboard
  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(state.response);
      const copyBtn = document.getElementById('aq-copy-btn');
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `${icons.check}<span>Copied!</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
      }, 2000);
    } catch (error) {
      console.error('Appliqueer: Failed to copy', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

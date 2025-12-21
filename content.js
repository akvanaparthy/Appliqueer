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
    questions: [''],  // Array of questions
    jobDescription: '',
    additionalContext: '',
    responses: [],    // Array of {question, answer} objects
    error: null,
    hasApiKey: false,
    responseLength: 'concise',  // concise | medium | detailed
    isDarkMode: false,
    autoClose: true  // Auto-close on click outside
  };

  // Drag state
  const dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startRight: 0,
    longPressTimer: null,
    hasMoved: false
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

    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
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
    </svg>`,

    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,

    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,

    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,

    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,

    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`,

    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"/>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
    </svg>`,

    move: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="5 9 2 12 5 15"/>
      <polyline points="9 5 12 2 15 5"/>
      <polyline points="15 19 12 22 9 19"/>
      <polyline points="19 9 22 12 19 15"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="12" y1="2" x2="12" y2="22"/>
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
        <span class="aq-move-icon">${icons.move}</span>
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
          <div class="aq-questions-section">
            <div class="aq-section-header">
              <label class="aq-input-label">Your Questions</label>
              <button class="aq-add-question-btn" id="aq-add-question" title="Add another question">
                ${icons.plus}
              </button>
            </div>
            <div class="aq-questions-list" id="aq-questions-list">
              <div class="aq-question-item" data-question-index="0">
                <textarea
                  class="aq-textarea aq-textarea--question"
                  placeholder="Ask about your resume, career, or job applications..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="aq-input-group">
            <label class="aq-input-label">Job Description (optional)</label>
            <textarea
              class="aq-textarea aq-textarea--small"
              id="aq-job-description"
              placeholder="Paste the job posting or requirements here..."
            ></textarea>
          </div>

          <div class="aq-input-group">
            <label class="aq-input-label">Focus / Instructions (optional)</label>
            <textarea
              class="aq-textarea aq-textarea--small"
              id="aq-context"
              placeholder="What to highlight from your resume, preferred response style..."
            ></textarea>
          </div>

          <div class="aq-input-group aq-length-group">
            <label class="aq-input-label">Response Length</label>
            <div class="aq-length-options" id="aq-length-options">
              <button class="aq-length-btn aq-length-btn--active" data-length="concise">Concise</button>
              <button class="aq-length-btn" data-length="medium">Medium</button>
              <button class="aq-length-btn" data-length="detailed">Detailed</button>
            </div>
          </div>

          <button class="aq-submit-btn" id="aq-submit-btn">
            <span>Get Answer</span>
            ${icons.send}
          </button>

          <div id="aq-responses-container"></div>
        </div>

        <footer class="aq-footer">
          <div class="aq-footer-actions">
            <button class="aq-settings-link" id="aq-settings-btn">
              ${icons.settings}
              <span>Settings</span>
            </button>
            <button class="aq-theme-toggle" id="aq-theme-toggle" aria-label="Toggle dark mode">
              ${icons.moon}
            </button>
            <button class="aq-pin-toggle" id="aq-pin-toggle" aria-label="Toggle pin panel">
              ${icons.pin}
            </button>
          </div>
          <div class="aq-status">
            <span class="aq-status-dot" id="aq-status-dot"></span>
            <span id="aq-status-text">Ready</span>
          </div>
        </footer>
      </div>
      
      <!-- External close button (visible when pinned/auto-close disabled) -->
      <button class="aq-external-close" id="aq-external-close" aria-label="Close panel">
        ${icons.chevronRight}
      </button>
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
    loadDarkModePreference();
    loadAutoClosePreference();
    loadButtonPosition();
  }

  async function checkApiKeyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_STATUS' });
      state.hasApiKey = response?.hasApiKey || false;
      updateStatusIndicator();
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) {
        console.warn('Appliqueer: Extension was reloaded. Please refresh this page.');
        return;
      }
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

  async function loadDarkModePreference() {
    try {
      const result = await chrome.storage.local.get(['darkMode']);
      state.isDarkMode = result.darkMode || false;
      applyDarkMode();
    } catch (err) {
      console.error('Appliqueer: Failed to load dark mode preference', err);
    }
  }

  function applyDarkMode() {
    const root = document.getElementById('appliqueer-root');
    const themeToggle = document.getElementById('aq-theme-toggle');

    if (state.isDarkMode) {
      root.classList.add('aq-dark-mode');
      if (themeToggle) themeToggle.innerHTML = icons.sun;
    } else {
      root.classList.remove('aq-dark-mode');
      if (themeToggle) themeToggle.innerHTML = icons.moon;
    }
  }

  async function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    applyDarkMode();

    try {
      await chrome.storage.local.set({ darkMode: state.isDarkMode });
    } catch (err) {
      console.error('Appliqueer: Failed to save dark mode preference', err);
    }
  }

  async function loadAutoClosePreference() {
    try {
      const result = await chrome.storage.local.get(['autoClose']);
      state.autoClose = result.autoClose !== undefined ? result.autoClose : true;
      applyAutoClose();
    } catch (err) {
      console.error('Appliqueer: Failed to load auto-close preference', err);
    }
  }

  function applyAutoClose() {
    const root = document.getElementById('appliqueer-root');
    const pinToggle = document.getElementById('aq-pin-toggle');
    const externalClose = document.getElementById('aq-external-close');

    if (state.autoClose) {
      // Auto-close enabled: hide external button, remove pinned class
      root.classList.remove('aq-pinned');
      if (pinToggle) pinToggle.classList.remove('aq-pin-toggle--active');
      if (externalClose) externalClose.style.display = 'none';
    } else {
      // Auto-close disabled (pinned): show external button
      root.classList.add('aq-pinned');
      if (pinToggle) pinToggle.classList.add('aq-pin-toggle--active');
      if (externalClose) externalClose.style.display = 'flex';
    }
  }

  async function toggleAutoClose() {
    state.autoClose = !state.autoClose;
    applyAutoClose();

    try {
      await chrome.storage.local.set({ autoClose: state.autoClose });
    } catch (err) {
      console.error('Appliqueer: Failed to save auto-close preference', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Button Position & Dragging
  // ─────────────────────────────────────────────────────────────
  async function loadButtonPosition() {
    try {
      const result = await chrome.storage.local.get(['buttonPosition']);
      if (result.buttonPosition) {
        const toggleBtn = document.getElementById('aq-toggle-btn');
        if (toggleBtn) {
          // Only set position if it's on the right half
          if (result.buttonPosition.right !== undefined) {
            toggleBtn.style.top = result.buttonPosition.top;
            toggleBtn.style.right = result.buttonPosition.right;
            toggleBtn.style.bottom = 'auto';
          }
        }
      }
    } catch (err) {
      console.error('Appliqueer: Failed to load button position', err);
    }
  }

  async function saveButtonPosition(top, right) {
    try {
      await chrome.storage.local.set({
        buttonPosition: { top, right }
      });
    } catch (err) {
      console.error('Appliqueer: Failed to save button position', err);
    }
  }

  function startDrag(e, toggleBtn) {
    // Prevent default to avoid text selection
    e.preventDefault();

    const touch = e.type.includes('touch') ? e.touches[0] : e;

    // Get current position
    const rect = toggleBtn.getBoundingClientRect();

    dragState.startX = touch.clientX;
    dragState.startY = touch.clientY;
    dragState.startTop = rect.top;
    dragState.startRight = window.innerWidth - rect.right;
    dragState.hasMoved = false;

    // Start long press timer (150ms)
    dragState.longPressTimer = setTimeout(() => {
      dragState.isDragging = true;
      toggleBtn.classList.add('aq-floating-btn--dragging');
      document.body.style.userSelect = 'none';
    }, 150);
  }

  function onDrag(e, toggleBtn) {
    if (!dragState.isDragging && dragState.longPressTimer) {
      const touch = e.type.includes('touch') ? e.touches[0] : e;
      const moved = Math.abs(touch.clientX - dragState.startX) > 5 ||
                    Math.abs(touch.clientY - dragState.startY) > 5;

      // If moved before long press completes, cancel the long press
      if (moved) {
        clearTimeout(dragState.longPressTimer);
        dragState.longPressTimer = null;
      }
    }

    if (!dragState.isDragging) return;

    e.preventDefault();
    dragState.hasMoved = true;

    const touch = e.type.includes('touch') ? e.touches[0] : e;

    // Calculate new position
    const deltaX = touch.clientX - dragState.startX;
    const deltaY = touch.clientY - dragState.startY;

    let newTop = dragState.startTop + deltaY;
    let newRight = dragState.startRight - deltaX;

    // Constrain to right side of screen (right half)
    const btnRect = toggleBtn.getBoundingClientRect();
    const minRight = 16; // Minimum distance from right edge
    const maxRight = window.innerWidth / 2 - btnRect.width; // Keep on right side
    const minTop = 16; // Minimum distance from top
    const maxTop = window.innerHeight - btnRect.height - 16; // Maximum distance from top

    newRight = Math.max(minRight, Math.min(maxRight, newRight));
    newTop = Math.max(minTop, Math.min(maxTop, newTop));

    // Apply position
    toggleBtn.style.top = `${newTop}px`;
    toggleBtn.style.right = `${newRight}px`;
    toggleBtn.style.bottom = 'auto';
  }

  function endDrag(e, toggleBtn) {
    if (dragState.longPressTimer) {
      clearTimeout(dragState.longPressTimer);
      dragState.longPressTimer = null;
    }

    if (dragState.isDragging) {
      e.preventDefault();
      e.stopPropagation();

      dragState.isDragging = false;
      toggleBtn.classList.remove('aq-floating-btn--dragging');
      document.body.style.userSelect = '';

      // Save position
      const currentTop = toggleBtn.style.top;
      const currentRight = toggleBtn.style.right;
      saveButtonPosition(currentTop, currentRight);

      // If we dragged, prevent the click event
      if (dragState.hasMoved) {
        setTimeout(() => {
          dragState.hasMoved = false;
        }, 10);
      }
    }
  }

  function setupDragging(toggleBtn) {
    // Mouse events
    toggleBtn.addEventListener('mousedown', (e) => startDrag(e, toggleBtn));
    document.addEventListener('mousemove', (e) => onDrag(e, toggleBtn));
    document.addEventListener('mouseup', (e) => endDrag(e, toggleBtn));

    // Touch events
    toggleBtn.addEventListener('touchstart', (e) => startDrag(e, toggleBtn), { passive: false });
    document.addEventListener('touchmove', (e) => onDrag(e, toggleBtn), { passive: false });
    document.addEventListener('touchend', (e) => endDrag(e, toggleBtn));
  }

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────
  function bindEvents(root) {
    const toggleBtn = root.querySelector('#aq-toggle-btn');
    const closeBtn = root.querySelector('#aq-close-btn');
    const panel = root.querySelector('#aq-panel');
    const submitBtn = root.querySelector('#aq-submit-btn');
    const questionsList = root.querySelector('#aq-questions-list');
    const addQuestionBtn = root.querySelector('#aq-add-question');
    const jobDescInput = root.querySelector('#aq-job-description');
    const contextInput = root.querySelector('#aq-context');
    const settingsBtn = root.querySelector('#aq-settings-btn');
    const themeToggle = root.querySelector('#aq-theme-toggle');
    const lengthOptions = root.querySelector('#aq-length-options');

    // Setup dragging
    setupDragging(toggleBtn);

    toggleBtn.addEventListener('click', (e) => {
      // Don't toggle if we just finished dragging
      if (dragState.hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      togglePanel(panel, toggleBtn);
    });
    closeBtn.addEventListener('click', () => togglePanel(panel, toggleBtn));
    submitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSubmit();
    });

    // Add question button
    addQuestionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addQuestion();
    });

    // Question input handling (event delegation)
    questionsList.addEventListener('input', (e) => {
      if (e.target.classList.contains('aq-textarea--question')) {
        const item = e.target.closest('.aq-question-item');
        const index = parseInt(item.dataset.questionIndex);
        state.questions[index] = e.target.value;
      }
    });

    // Remove question button (event delegation)
    questionsList.addEventListener('click', (e) => {
      e.stopPropagation();
      const removeBtn = e.target.closest('.aq-remove-question-btn');
      if (removeBtn) {
        const item = removeBtn.closest('.aq-question-item');
        const index = parseInt(item.dataset.questionIndex);
        removeQuestion(index);
      }
    });

    // Length option toggle
    lengthOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('.aq-length-btn');
      if (!btn) return;
      
      // Update active state
      lengthOptions.querySelectorAll('.aq-length-btn').forEach(b => 
        b.classList.remove('aq-length-btn--active'));
      btn.classList.add('aq-length-btn--active');
      
      // Store selection
      state.responseLength = btn.dataset.length;
    });

    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });

    themeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDarkMode();
    });

    // Pin toggle (auto-close control)
    const pinToggle = root.querySelector('#aq-pin-toggle');
    pinToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAutoClose();
    });

    // External close button
    const externalClose = root.querySelector('#aq-external-close');
    externalClose.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(panel, toggleBtn);
    });

    jobDescInput.addEventListener('input', (e) => state.jobDescription = e.target.value);
    contextInput.addEventListener('input', (e) => state.additionalContext = e.target.value);

    // Click outside to close (only if autoClose is enabled)
    document.addEventListener('click', (e) => {
      if (state.isExpanded && state.autoClose && !panel.contains(e.target) && !toggleBtn.contains(e.target)) {
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
      setTimeout(() => {
        const firstQuestion = document.querySelector('.aq-textarea--question');
        firstQuestion?.focus();
      }, 350);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Question Management
  // ─────────────────────────────────────────────────────────────
  function addQuestion() {
    state.questions.push('');
    renderQuestions();
  }

  function removeQuestion(index) {
    if (state.questions.length <= 1) return; // Keep at least one
    state.questions.splice(index, 1);
    renderQuestions();
  }

  function renderQuestions() {
    const container = document.getElementById('aq-questions-list');
    container.innerHTML = state.questions.map((q, i) => `
      <div class="aq-question-item" data-question-index="${i}">
        <textarea
          class="aq-textarea aq-textarea--question"
          placeholder="${i === 0 ? 'Ask about your resume, career, or job applications...' : 'Another question...'}"
        >${escapeHtml(q)}</textarea>
        ${state.questions.length > 1 ? `
          <button class="aq-remove-question-btn" title="Remove question">
            ${icons.minus}
          </button>
        ` : ''}
      </div>
    `).join('');
  }

  // ─────────────────────────────────────────────────────────────
  // Submit & Response
  // ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    // Filter out empty questions
    const validQuestions = state.questions.filter(q => q.trim());
    if (state.isLoading || validQuestions.length === 0) return;

    state.isLoading = true;
    state.error = null;
    state.responses = [];
    updateUI();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ASK_AI',
        questions: validQuestions.map(q => q.trim()),
        jobDescription: state.jobDescription.trim(),
        additionalContext: state.additionalContext.trim(),
        responseLength: state.responseLength
      });

      if (response.error) {
        state.error = response.error;
        state.responses = [];
      } else {
        // Parse JSON response with multiple answers
        let answers = response.answers || [];
        if (typeof response.answer === 'string') {
          // Fallback: try to parse single answer as JSON with responses array
          try {
            const parsed = JSON.parse(response.answer);
            if (parsed.responses && Array.isArray(parsed.responses)) {
              answers = parsed.responses;
            } else if (parsed.response) {
              answers = [{ question: validQuestions[0], answer: parsed.response }];
            }
          } catch (e) {
            answers = [{ question: validQuestions[0], answer: response.answer }];
          }
        }
        state.responses = answers;
        state.error = null;
      }
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) {
        state.error = 'Extension was reloaded. Please refresh this page to continue.';
      } else {
        state.error = 'Failed to get response. Please try again.';
      }
      state.responses = [];
    } finally {
      state.isLoading = false;
      updateUI();
    }
  }

  function updateUI() {
    const submitBtn = document.getElementById('aq-submit-btn');
    const responsesContainer = document.getElementById('aq-responses-container');

    if (state.isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="aq-spinner"></div><span>Thinking...</span>`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Get Answers</span>${icons.send}`;
    }

    if (state.error) {
      responsesContainer.innerHTML = `
        <div class="aq-card">
          <div class="aq-error">${escapeHtml(state.error)}</div>
        </div>
      `;
    } else if (state.responses.length > 0) {
      // Render each response as its own card
      responsesContainer.innerHTML = state.responses.map((r, i) => `
        <div class="aq-card aq-response-card">
          <div class="aq-response-header">
            <div class="aq-response-question">
              <span class="aq-response-number">Q${i + 1}</span>
              <span class="aq-response-question-text">${escapeHtml(r.question)}</span>
            </div>
            <button class="aq-copy-single-btn" data-index="${i}" title="Copy this answer">
              ${icons.copy}
            </button>
          </div>
          <div class="aq-response-body">
            ${formatResponse(r.answer)}
          </div>
        </div>
      `).join('');

      // Bind copy buttons for individual responses
      responsesContainer.querySelectorAll('.aq-copy-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          copySingleResponse(index);
        });
      });
    } else if (!state.isLoading) {
      responsesContainer.innerHTML = '';
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

  async function copyAllResponses() {
    try {
      const text = state.responses.map((r, i) => 
        `Q${i + 1}: ${r.question}\n\n${r.answer}`
      ).join('\n\n---\n\n');
      await navigator.clipboard.writeText(text);
      const copyBtn = document.getElementById('aq-copy-btn');
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `${icons.check}<span>Copied!</span>`;
      setTimeout(() => copyBtn.innerHTML = original, 2000);
    } catch (err) {
      console.error('Appliqueer: Copy failed', err);
    }
  }

  async function copySingleResponse(index) {
    try {
      const response = state.responses[index];
      if (!response) return;
      
      await navigator.clipboard.writeText(response.answer);
      
      // Show feedback on the specific button
      const btn = document.querySelector(`.aq-copy-single-btn[data-index="${index}"]`);
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = icons.check;
        btn.classList.add('aq-copy-single-btn--copied');
        setTimeout(() => {
          btn.innerHTML = original;
          btn.classList.remove('aq-copy-single-btn--copied');
        }, 1500);
      }
    } catch (err) {
      console.error('Appliqueer: Copy single failed', err);
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

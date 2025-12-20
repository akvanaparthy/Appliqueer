// Appliqueer Options Page Script

// API key help text
const API_HELP = {
  openai: 'Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Dashboard</a>',
  anthropic: 'Get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic Console</a>',
  gemini: 'Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>'
};

// State
let settings = {
  apiKey: '',
  provider: 'openai',
  resume: '',
  resumeFile: null, // {name, size, type, addedAt}
  additionalFiles: [],
  general: {
    model: '',
    maxTokens: 1024,
    temperature: 0.7
  }
};

let hasUnsavedChanges = false;
let isLoadingModels = false;
let loadedModels = [];
let isDarkMode = true; // Default to dark mode

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  await loadSettings();
  await loadThemePreference();
  bindEvents();
  updateUI();
  updateFetchButtonState();
});

// Cache DOM elements
function cacheElements() {
  elements.provider = document.getElementById('api-provider');
  elements.apiKey = document.getElementById('api-key');
  elements.apiKeyHelp = document.getElementById('api-key-help');
  elements.toggleApiKey = document.getElementById('toggle-api-key');
  elements.modelSelect = document.getElementById('model-select');
  elements.resumeDropzone = document.getElementById('resume-dropzone');
  elements.resumeFileInput = document.getElementById('resume-file');
  elements.resumeContent = document.getElementById('resume-content');
  elements.resumeDisplayGroup = document.getElementById('resume-display-group');
  elements.resumeFileDisplay = document.getElementById('resume-file-display');
  elements.fileList = document.getElementById('file-list');
  elements.addFileBtn = document.getElementById('add-file-btn');
  elements.additionalFile = document.getElementById('additional-file');
  elements.advancedCard = document.getElementById('advanced-card');
  elements.advancedToggle = document.getElementById('advanced-toggle');
  elements.maxTokens = document.getElementById('max-tokens');
  elements.temperature = document.getElementById('temperature');
  elements.temperatureValue = document.getElementById('temperature-value');
  elements.saveBtn = document.getElementById('save-btn');
  elements.resetBtn = document.getElementById('reset-btn');
  elements.saveIndicator = document.getElementById('save-indicator');
  elements.fetchModelsBtn = document.getElementById('fetch-models-btn');
  elements.resumeStatus = document.getElementById('resume-status');
  elements.themeToggle = document.getElementById('theme-toggle');
}

// Load settings from storage
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (response && !response.error) {
      settings = { ...settings, ...response };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Load theme preference from storage
async function loadThemePreference() {
  try {
    const result = await chrome.storage.local.get(['darkMode']);
    isDarkMode = result.darkMode !== undefined ? result.darkMode : true;
    applyTheme();
  } catch (error) {
    console.error('Failed to load theme preference:', error);
  }
}

// Apply theme
function applyTheme() {
  if (isDarkMode) {
    document.body.classList.remove('light-mode');
    elements.themeToggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    `;
  } else {
    document.body.classList.add('light-mode');
    elements.themeToggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  }
}

// Toggle theme
async function toggleTheme() {
  isDarkMode = !isDarkMode;
  applyTheme();
  try {
    await chrome.storage.local.set({ darkMode: isDarkMode });
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}

// Bind event listeners
function bindEvents() {
  // Provider change - refetch models for new provider
  elements.provider.addEventListener('change', (e) => {
    settings.provider = e.target.value;
    settings.general.model = ''; // Reset model selection
    updateApiKeyHelp();
    updateFetchButtonState();
    markChanged();
  });

  // API Key - update button state on change
  elements.apiKey.addEventListener('input', (e) => {
    settings.apiKey = e.target.value;
    updateFetchButtonState();
    markChanged();
  });

  elements.toggleApiKey.addEventListener('click', () => {
    const isPassword = elements.apiKey.type === 'password';
    elements.apiKey.type = isPassword ? 'text' : 'password';
  });

  // Fetch models button
  elements.fetchModelsBtn.addEventListener('click', async () => {
    await saveApiKeyAndFetchModels();
  });

  // Model selection
  elements.modelSelect.addEventListener('change', (e) => {
    settings.general.model = e.target.value;
    markChanged();
  });

  // Resume file upload
  elements.resumeDropzone.addEventListener('click', () => {
    elements.resumeFileInput.click();
  });

  elements.resumeDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.resumeDropzone.classList.add('dragover');
  });

  elements.resumeDropzone.addEventListener('dragleave', () => {
    elements.resumeDropzone.classList.remove('dragover');
  });

  elements.resumeDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.resumeDropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleResumeFile(file);
  });

  elements.resumeFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleResumeFile(file);
  });

  // Additional files
  elements.addFileBtn.addEventListener('click', () => {
    elements.additionalFile.click();
  });

  elements.additionalFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleAdditionalFile(file);
  });

  // Advanced settings toggle
  elements.advancedToggle.addEventListener('click', () => {
    elements.advancedCard.classList.toggle('aq-card--collapsed');
  });

  // Max tokens
  elements.maxTokens.addEventListener('input', (e) => {
    settings.general.maxTokens = parseInt(e.target.value) || 1024;
    markChanged();
  });

  // Temperature
  elements.temperature.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    settings.general.temperature = value;
    elements.temperatureValue.textContent = value.toFixed(1);
    markChanged();
  });

  // Save button
  elements.saveBtn.addEventListener('click', saveSettings);

  // Reset button
  elements.resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
      await chrome.storage.local.clear();
      location.reload();
    }
  });

  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);

  // Warn about unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// Update UI with current settings
function updateUI() {
  elements.provider.value = settings.provider;
  elements.apiKey.value = settings.apiKey;
  elements.resumeContent.value = settings.resume;
  elements.maxTokens.value = settings.general.maxTokens;
  elements.temperature.value = settings.general.temperature;
  elements.temperatureValue.textContent = settings.general.temperature.toFixed(1);

  // Only fetch models if API key exists
  if (settings.apiKey && settings.apiKey.length > 10) {
    fetchModelsFromAPI();
  } else {
    elements.modelSelect.innerHTML = '<option value="">Add API key to load models</option>';
    elements.modelSelect.disabled = true;
  }

  updateApiKeyHelp();
  renderResumeDisplay();
  updateResumeStatus();
  renderFileList();
}

// Update resume status indicator
function updateResumeStatus() {
  const hasResume = settings.resume && settings.resume.trim().length > 0;
  const charCount = settings.resume ? settings.resume.length : 0;
  
  if (hasResume) {
    elements.resumeStatus.className = 'aq-resume-status aq-resume-status--uploaded';
    elements.resumeStatus.innerHTML = `
      <span class="aq-resume-status-dot"></span>
      <span class="aq-resume-status-text">Uploaded (${charCount.toLocaleString()} chars)</span>
    `;
  } else {
    elements.resumeStatus.className = 'aq-resume-status aq-resume-status--empty';
    elements.resumeStatus.innerHTML = `
      <span class="aq-resume-status-dot"></span>
      <span class="aq-resume-status-text">No resume</span>
    `;
  }
}

// Update fetch models button state
function updateFetchButtonState() {
  const hasValidKey = settings.apiKey && settings.apiKey.length > 10;
  elements.fetchModelsBtn.disabled = !hasValidKey;

  if (!hasValidKey) {
    elements.fetchModelsBtn.style.opacity = '0.5';
    elements.fetchModelsBtn.style.cursor = 'not-allowed';
  } else {
    elements.fetchModelsBtn.style.opacity = '1';
    elements.fetchModelsBtn.style.cursor = 'pointer';
  }
}

// Save API key and fetch models
async function saveApiKeyAndFetchModels() {
  if (!settings.apiKey || settings.apiKey.length < 10) {
    alert('Please enter a valid API key');
    return;
  }

  try {
    // Disable button and show loading
    elements.fetchModelsBtn.disabled = true;
    const originalText = elements.fetchModelsBtn.innerHTML;
    elements.fetchModelsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width: 16px; height: 16px; animation: spin 1s linear infinite;">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      Saving & Fetching Models...
    `;

    // Save API key and provider first
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: {
        apiKey: settings.apiKey,
        provider: settings.provider
      }
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Now fetch models
    await fetchModelsFromAPI();

    // Show success indicator
    showSaveIndicator();

  } catch (error) {
    alert('Failed to save API key or fetch models: ' + error.message);
  } finally {
    // Restore button
    elements.fetchModelsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width: 16px; height: 16px;">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      Save API Key & Fetch Models
    `;
    updateFetchButtonState();
  }
}

// Fetch models dynamically from API
async function fetchModelsFromAPI() {
  if (isLoadingModels) return;
  
  // Show loading state
  isLoadingModels = true;
  elements.modelSelect.innerHTML = '<option value="">Loading models...</option>';
  elements.modelSelect.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_MODELS',
      apiKey: settings.apiKey,
      provider: settings.provider
    });

    if (response.models && response.models.length > 0) {
      loadedModels = response.models;
      renderModelOptions();
    } else {
      elements.modelSelect.innerHTML = '<option value="">No models available - check API key</option>';
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    elements.modelSelect.innerHTML = '<option value="">Failed to load models</option>';
  } finally {
    isLoadingModels = false;
    elements.modelSelect.disabled = false;
  }
}

// Render model options in select
function renderModelOptions() {
  elements.modelSelect.innerHTML = loadedModels
    .map(m => `<option value="${m.id}">${m.displayName}</option>`)
    .join('');
  
  // Set current model or default to first option
  const currentModel = settings.general.model;
  const modelExists = loadedModels.some(m => m.id === currentModel);
  
  if (modelExists) {
    elements.modelSelect.value = currentModel;
  } else if (loadedModels.length > 0) {
    elements.modelSelect.value = loadedModels[0].id;
    settings.general.model = loadedModels[0].id;
  }
}

// Update API key help text
function updateApiKeyHelp() {
  elements.apiKeyHelp.innerHTML = API_HELP[settings.provider] || 'Enter your API key';
}

// Handle resume file
async function handleResumeFile(file) {
  try {
    console.log('Appliqueer: Reading resume file:', file.name);
    
    // Show loading state
    elements.resumeDropzone.style.opacity = '0.5';
    elements.resumeDropzone.style.pointerEvents = 'none';
    
    const content = await readFileContent(file);
    console.log('Appliqueer: Resume content length:', content.length);
    
    // Store both content and file metadata
    settings.resume = content;
    settings.resumeFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      addedAt: Date.now()
    };
    
    // Store in hidden textarea for form compatibility
    elements.resumeContent.value = content;
    
    // Update UI
    renderResumeDisplay();
    updateResumeStatus();
    markChanged();
    
  } catch (error) {
    console.error('Appliqueer: Failed to read resume file', error);
    alert('Failed to read file: ' + error.message);
  } finally {
    elements.resumeDropzone.style.opacity = '';
    elements.resumeDropzone.style.pointerEvents = '';
  }
}

// Render resume file display
function renderResumeDisplay() {
  if (!settings.resumeFile) {
    elements.resumeDisplayGroup.style.display = 'none';
    return;
  }
  
  elements.resumeDisplayGroup.style.display = 'block';
  
  const file = settings.resumeFile;
  const sizeKB = (file.size / 1024).toFixed(1);
  const charCount = settings.resume ? settings.resume.length : 0;
  
  elements.resumeFileDisplay.innerHTML = `
    <div class="aq-file-item-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
    <div class="aq-file-item-info">
      <div class="aq-file-item-name">${escapeHtml(file.name)}</div>
      <div class="aq-file-item-size">${sizeKB} KB • ${charCount.toLocaleString()} chars</div>
    </div>
    <button class="aq-file-item-remove" onclick="removeResume()" title="Remove resume">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
}

// Remove resume
function removeResume() {
  settings.resume = '';
  settings.resumeFile = null;
  elements.resumeContent.value = '';
  renderResumeDisplay();
  updateResumeStatus();
  markChanged();
}

// Make removeResume available globally for onclick
window.removeResume = removeResume;

// Handle additional file
async function handleAdditionalFile(file) {
  try {
    const content = await readFileContent(file);
    settings.additionalFiles.push({
      name: file.name,
      size: file.size,
      content: content,
      addedAt: Date.now()
    });
    renderFileList();
    markChanged();
  } catch (error) {
    alert('Failed to read file: ' + error.message);
  }
}

// Read file content (supports text files and PDFs)
async function readFileContent(file) {
  if (file.type === 'application/pdf') {
    return await extractTextFromPDF(file);
  }
  
  // Text-based files
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Extract text from PDF using pdf.js
async function extractTextFromPDF(file) {
  // Dynamically load pdf.js if not already loaded
  if (!window.pdfjsLib) {
    await loadPDFJS();
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        
        resolve(fullText.trim());
      } catch (error) {
        reject(new Error('Failed to parse PDF: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF file'));
    reader.readAsArrayBuffer(file);
  });
}

// Initialize pdf.js library (already loaded via script tag)
function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (!window.pdfjsLib) {
      reject(new Error('PDF.js library not loaded'));
      return;
    }
    
    // Set worker source to local file
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    console.log('Appliqueer: PDF.js worker initialized');
    resolve();
  });
}

// Render file list
function renderFileList() {
  if (settings.additionalFiles.length === 0) {
    elements.fileList.innerHTML = `
      <p style="color: var(--aq-text-muted); font-size: 13px; text-align: center; padding: 16px;">
        No additional documents added yet
      </p>
    `;
    return;
  }

  elements.fileList.innerHTML = settings.additionalFiles.map((file, index) => `
    <div class="aq-file-item">
      <div class="aq-file-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="aq-file-item-info">
        <div class="aq-file-item-name">${escapeHtml(file.name)}</div>
        <div class="aq-file-item-size">${formatFileSize(file.size)}</div>
      </div>
      <button class="aq-file-item-remove" data-index="${index}" title="Remove file">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Add remove handlers
  elements.fileList.querySelectorAll('.aq-file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      settings.additionalFiles.splice(index, 1);
      renderFileList();
      markChanged();
    });
  });
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Mark as having unsaved changes
function markChanged() {
  hasUnsavedChanges = true;
}

// Save settings
async function saveSettings() {
  try {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    console.log('Appliqueer: Saving settings...', {
      hasApiKey: !!settings.apiKey,
      provider: settings.provider,
      resumeLength: settings.resume ? settings.resume.length : 0,
      additionalFilesCount: settings.additionalFiles.length,
      model: settings.general.model
    });

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: settings
    });

    if (response.error) {
      throw new Error(response.error);
    }

    console.log('Appliqueer: Settings saved successfully');
    hasUnsavedChanges = false;
    showSaveIndicator();

  } catch (error) {
    console.error('Appliqueer: Failed to save settings', error);
    alert('Failed to save settings: ' + error.message);
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Save Changes';
  }
}

// Show save indicator
function showSaveIndicator() {
  elements.saveIndicator.classList.add('visible');
  setTimeout(() => {
    elements.saveIndicator.classList.remove('visible');
  }, 2000);
}

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

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  await loadSettings();
  bindEvents();
  updateUI();
});

// Cache DOM elements
function cacheElements() {
  elements.provider = document.getElementById('api-provider');
  elements.apiKey = document.getElementById('api-key');
  elements.apiKeyHelp = document.getElementById('api-key-help');
  elements.toggleApiKey = document.getElementById('toggle-api-key');
  elements.modelSelect = document.getElementById('model-select');
  elements.resumeDropzone = document.getElementById('resume-dropzone');
  elements.resumeFile = document.getElementById('resume-file');
  elements.resumeContent = document.getElementById('resume-content');
  elements.resumeCharCount = document.getElementById('resume-char-count');
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
  elements.exportBtn = document.getElementById('export-btn');
  elements.saveIndicator = document.getElementById('save-indicator');
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

// Bind event listeners
function bindEvents() {
  // Provider change - refetch models for new provider
  elements.provider.addEventListener('change', (e) => {
    settings.provider = e.target.value;
    settings.general.model = ''; // Reset model selection
    fetchModelsFromAPI();
    updateApiKeyHelp();
    markChanged();
  });

  // API Key - debounced fetch models on change
  let apiKeyTimeout;
  elements.apiKey.addEventListener('input', (e) => {
    settings.apiKey = e.target.value;
    markChanged();
    
    // Debounce API key input to avoid excessive API calls
    clearTimeout(apiKeyTimeout);
    apiKeyTimeout = setTimeout(() => {
      if (settings.apiKey.length > 10) {
        fetchModelsFromAPI();
      }
    }, 1000);
  });

  elements.toggleApiKey.addEventListener('click', () => {
    const isPassword = elements.apiKey.type === 'password';
    elements.apiKey.type = isPassword ? 'text' : 'password';
  });

  // Model selection
  elements.modelSelect.addEventListener('change', (e) => {
    settings.general.model = e.target.value;
    markChanged();
  });

  // Resume file upload
  elements.resumeDropzone.addEventListener('click', () => {
    elements.resumeFile.click();
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

  elements.resumeFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleResumeFile(file);
  });

  // Resume content
  elements.resumeContent.addEventListener('input', (e) => {
    settings.resume = e.target.value;
    updateCharCount();
    markChanged();
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

  // Export button
  elements.exportBtn.addEventListener('click', exportSettings);

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

  fetchModelsFromAPI();
  updateApiKeyHelp();
  updateCharCount();
  renderFileList();
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

// Update character count
function updateCharCount() {
  const count = settings.resume.length;
  const max = 50000;
  elements.resumeCharCount.textContent = `${count.toLocaleString()} / ${max.toLocaleString()}`;
  
  if (count > max) {
    elements.resumeCharCount.style.color = 'var(--aq-danger)';
  } else {
    elements.resumeCharCount.style.color = '';
  }
}

// Handle resume file
async function handleResumeFile(file) {
  try {
    const content = await readFileContent(file);
    settings.resume = content;
    elements.resumeContent.value = content;
    updateCharCount();
    markChanged();
  } catch (error) {
    alert('Failed to read file: ' + error.message);
  }
}

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

// Read file content
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    // For now, only support text files
    if (file.type === 'application/pdf') {
      reject(new Error('PDF files are not yet supported. Please paste the text content directly.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
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

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: settings
    });

    if (response.error) {
      throw new Error(response.error);
    }

    hasUnsavedChanges = false;
    showSaveIndicator();

  } catch (error) {
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

// Export settings
function exportSettings() {
  const exportData = {
    ...settings,
    apiKey: '***REDACTED***', // Don't export API key
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appliqueer-settings.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

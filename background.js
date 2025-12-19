// Appliqueer - Background Service Worker
// Handles API calls and storage management

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'appliqueer_api_key',
  API_PROVIDER: 'appliqueer_api_provider',
  RESUME: 'appliqueer_resume',
  ADDITIONAL_FILES: 'appliqueer_additional_files',
  SETTINGS: 'appliqueer_settings'
};

// Default settings
const DEFAULT_SETTINGS = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  maxTokens: 1024,
  temperature: 0.7
};

// API Endpoints
const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Appliqueer: Message handling error', error);
      sendResponse({ error: error.message || 'An unexpected error occurred' });
    });
  return true; // Async response
});

// Message handler
async function handleMessage(request, sender) {
  switch (request.type) {
    case 'ASK_AI':
      return await handleAskAI(request.question, request.additionalContext);
    
    case 'CHECK_STATUS':
      return await checkStatus();
    
    case 'OPEN_OPTIONS':
      await chrome.runtime.openOptionsPage();
      return { success: true };
    
    case 'SAVE_SETTINGS':
      return await saveSettings(request.settings);
    
    case 'GET_SETTINGS':
      return await getSettings();
    
    default:
      return { error: 'Unknown message type' };
  }
}

// Check if extension is properly configured
async function checkStatus() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEY, STORAGE_KEYS.RESUME]);
    return {
      hasApiKey: !!result[STORAGE_KEYS.API_KEY],
      hasResume: !!result[STORAGE_KEYS.RESUME]
    };
  } catch (error) {
    console.error('Appliqueer: Status check failed', error);
    return { hasApiKey: false, hasResume: false };
  }
}

// Handle AI question
async function handleAskAI(question, additionalContext) {
  try {
    // Load configuration
    const config = await chrome.storage.local.get([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.API_PROVIDER,
      STORAGE_KEYS.RESUME,
      STORAGE_KEYS.ADDITIONAL_FILES,
      STORAGE_KEYS.SETTINGS
    ]);

    const apiKey = config[STORAGE_KEYS.API_KEY];
    const provider = config[STORAGE_KEYS.API_PROVIDER] || 'openai';
    const resume = config[STORAGE_KEYS.RESUME] || '';
    const additionalFiles = config[STORAGE_KEYS.ADDITIONAL_FILES] || [];
    const settings = { ...DEFAULT_SETTINGS, ...config[STORAGE_KEYS.SETTINGS] };

    // Validate API key
    if (!apiKey) {
      return { error: 'Please configure your API key in the extension settings.' };
    }

    // Build prompt
    const prompt = buildPrompt(question, additionalContext, resume, additionalFiles);

    // Call appropriate API
    let answer;
    switch (provider) {
      case 'openai':
        answer = await callOpenAI(apiKey, prompt, settings);
        break;
      case 'anthropic':
        answer = await callAnthropic(apiKey, prompt, settings);
        break;
      case 'gemini':
        answer = await callGemini(apiKey, prompt, settings);
        break;
      default:
        return { error: `Unsupported provider: ${provider}` };
    }

    return { answer };

  } catch (error) {
    console.error('Appliqueer: AI request failed', error);
    return { error: error.message || 'Failed to get AI response' };
  }
}

// Build the prompt with context
function buildPrompt(question, additionalContext, resume, additionalFiles) {
  let context = '';

  // Add resume if available
  if (resume && resume.trim()) {
    context += `## User's Resume/Profile:\n${resume.trim()}\n\n`;
  }

  // Add additional files if available
  if (additionalFiles && additionalFiles.length > 0) {
    context += `## Additional Documents:\n`;
    additionalFiles.forEach((file, index) => {
      if (file.content) {
        context += `### Document ${index + 1}: ${file.name || 'Untitled'}\n${file.content}\n\n`;
      }
    });
  }

  // Add user's additional context
  if (additionalContext && additionalContext.trim()) {
    context += `## Additional Context Provided:\n${additionalContext.trim()}\n\n`;
  }

  // Build final prompt
  const systemPrompt = `You are Appliqueer, an AI assistant specialized in helping with job applications, career advice, and professional communication. You have access to the user's resume and any additional documents they've provided.

Your responses should be:
- Tailored to the user's background and experience
- Professional and actionable
- Concise but comprehensive
- Formatted with markdown when helpful (bullet points, bold for emphasis)

${context ? 'Here is the context about the user:\n\n' + context : 'Note: The user has not provided their resume yet. Encourage them to add it in settings for personalized responses.'}`;

  return {
    system: systemPrompt,
    user: question
  };
}

// OpenAI API call
async function callOpenAI(apiKey, prompt, settings) {
  const response = await fetch(API_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: settings.maxTokens || 1024,
      temperature: settings.temperature || 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated';
}

// Anthropic API call
async function callAnthropic(apiKey, prompt, settings) {
  const response = await fetch(API_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: settings.model || 'claude-3-haiku-20240307',
      max_tokens: settings.maxTokens || 1024,
      system: prompt.system,
      messages: [
        { role: 'user', content: prompt.user }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No response generated';
}

// Google Gemini API call
async function callGemini(apiKey, prompt, settings) {
  const model = settings.model || 'gemini-1.5-flash';
  const url = `${API_ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${prompt.system}\n\n---\n\nUser Question: ${prompt.user}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: settings.maxTokens || 1024,
        temperature: settings.temperature || 0.7
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
}

// Save settings
async function saveSettings(settings) {
  try {
    const updates = {};
    
    if (settings.apiKey !== undefined) {
      updates[STORAGE_KEYS.API_KEY] = settings.apiKey;
    }
    if (settings.provider !== undefined) {
      updates[STORAGE_KEYS.API_PROVIDER] = settings.provider;
    }
    if (settings.resume !== undefined) {
      updates[STORAGE_KEYS.RESUME] = settings.resume;
    }
    if (settings.additionalFiles !== undefined) {
      updates[STORAGE_KEYS.ADDITIONAL_FILES] = settings.additionalFiles;
    }
    if (settings.general !== undefined) {
      updates[STORAGE_KEYS.SETTINGS] = settings.general;
    }

    await chrome.storage.local.set(updates);
    return { success: true };

  } catch (error) {
    console.error('Appliqueer: Save settings failed', error);
    return { error: error.message };
  }
}

// Get settings
async function getSettings() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.API_PROVIDER,
      STORAGE_KEYS.RESUME,
      STORAGE_KEYS.ADDITIONAL_FILES,
      STORAGE_KEYS.SETTINGS
    ]);

    return {
      apiKey: result[STORAGE_KEYS.API_KEY] || '',
      provider: result[STORAGE_KEYS.API_PROVIDER] || 'openai',
      resume: result[STORAGE_KEYS.RESUME] || '',
      additionalFiles: result[STORAGE_KEYS.ADDITIONAL_FILES] || [],
      general: { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] }
    };

  } catch (error) {
    console.error('Appliqueer: Get settings failed', error);
    return { error: error.message };
  }
}

// Log extension startup
console.log('Appliqueer: Background service worker initialized');

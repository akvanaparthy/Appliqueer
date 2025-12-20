// Appliqueer - Background Service Worker
// Handles API calls and storage management

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'appliqueer_api_key',
  API_PROVIDER: 'appliqueer_api_provider',
  RESUME: 'appliqueer_resume',
  RESUME_FILE: 'appliqueer_resume_file',
  ADDITIONAL_FILES: 'appliqueer_additional_files',
  SETTINGS: 'appliqueer_settings',
  CACHED_MODELS: 'appliqueer_cached_models'
};

// Default settings
const DEFAULT_SETTINGS = {
  provider: 'openai',
  model: '',  // Will be set dynamically
  maxTokens: 1024,
  temperature: 0.7
};

// API Endpoints
const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openaiModels: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/messages',
  anthropicModels: 'https://api.anthropic.com/v1/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Cache duration (10 minutes)
const MODEL_CACHE_DURATION = 10 * 60 * 1000;

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
      return await handleAskAI(request.question, request.jobDescription, request.additionalContext, request.responseLength);
    
    case 'CHECK_STATUS':
      return await checkStatus();
    
    case 'OPEN_OPTIONS':
      await chrome.runtime.openOptionsPage();
      return { success: true };
    
    case 'SAVE_SETTINGS':
      return await saveSettings(request.settings);
    
    case 'GET_SETTINGS':
      return await getSettings();
    
    case 'FETCH_MODELS':
      return await fetchModels(request.apiKey, request.provider);
    
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
async function handleAskAI(question, jobDescription, additionalContext, responseLength = 'concise') {
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
    const prompt = buildPrompt(question, jobDescription, additionalContext, resume, additionalFiles, responseLength);

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
function buildPrompt(question, jobDescription, additionalContext, resume, additionalFiles, responseLength = 'concise') {
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

  // Add job description if provided
  if (jobDescription && jobDescription.trim()) {
    context += `## Job Description / Requirements:\n${jobDescription.trim()}\n\n`;
  }

  // Add user's focus/instructions
  if (additionalContext && additionalContext.trim()) {
    context += `## User's Focus / Instructions:\n${additionalContext.trim()}\n\n`;
  }

  // Response length guidance
  const lengthGuidance = {
    concise: '2-3 short paragraphs, straight to the point',
    medium: '4-5 paragraphs with reasonable detail',
    detailed: 'comprehensive response with full details, examples if relevant'
  };

  // Build final prompt with JSON response format
  const systemPrompt = `Answer this as my POV based on my resume. Don't include any fake or false information - only respond according to my resume and other additional files provided.

Response length: ${lengthGuidance[responseLength] || lengthGuidance.concise}

IMPORTANT: 
- Return your response as a JSON object with this exact structure:
{"response": "your answer here with \\n for new paragraphs"}
- No fabricated information, only provide from the context provided
- Only answer in paragraphs, no bullets, no points, no long dashes. Write as person, the resume and context provided are yours, they are your experiences, acheievements or whatsoever provided in the context.
- If a job description is provided, tailor the response to match the job requirements using relevant experience from the resume.
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
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
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
    if (settings.resumeFile !== undefined) {
      updates[STORAGE_KEYS.RESUME_FILE] = settings.resumeFile;
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
      STORAGE_KEYS.RESUME_FILE,
      STORAGE_KEYS.ADDITIONAL_FILES,
      STORAGE_KEYS.SETTINGS
    ]);

    return {
      apiKey: result[STORAGE_KEYS.API_KEY] || '',
      provider: result[STORAGE_KEYS.API_PROVIDER] || 'openai',
      resume: result[STORAGE_KEYS.RESUME] || '',
      resumeFile: result[STORAGE_KEYS.RESUME_FILE] || null,
      additionalFiles: result[STORAGE_KEYS.ADDITIONAL_FILES] || [],
      general: { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] }
    };

  } catch (error) {
    console.error('Appliqueer: Get settings failed', error);
    return { error: error.message };
  }
}

// Fetch available models from API
async function fetchModels(apiKey, provider) {
  try {
    if (!apiKey) {
      return { error: 'API key is required to fetch models' };
    }

    // Check cache first
    const cacheKey = `${STORAGE_KEYS.CACHED_MODELS}_${provider}`;
    const cached = await chrome.storage.local.get([cacheKey]);
    const cachedData = cached[cacheKey];
    
    if (cachedData && (Date.now() - cachedData.timestamp) < MODEL_CACHE_DURATION) {
      return { models: cachedData.models };
    }

    // Fetch from API
    let models = [];
    
    switch (provider) {
      case 'openai':
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'anthropic':
        models = await fetchAnthropicModels(apiKey);
        break;
      case 'gemini':
        models = await fetchGeminiModels(apiKey);
        break;
      default:
        return { error: `Unknown provider: ${provider}` };
    }

    // Cache the results
    if (models.length > 0) {
      await chrome.storage.local.set({
        [cacheKey]: {
          models: models,
          timestamp: Date.now()
        }
      });
    }

    return { models };

  } catch (error) {
    console.error('Appliqueer: Fetch models failed', error);
    return { models: [], error: error.message };
  }
}

// Fetch OpenAI models
async function fetchOpenAIModels(apiKey) {
  try {
    const response = await fetch(API_ENDPOINTS.openaiModels, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter for main GPT models
    const allowedModels = [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 
      'gpt-3.5-turbo', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18'
    ];
    
    return data.data
      .filter(m => allowedModels.some(allowed => m.id.startsWith(allowed) || m.id === allowed))
      .map(m => ({
        id: m.id,
        displayName: formatModelName(m.id)
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

  } catch (error) {
    console.error('Appliqueer: OpenAI fetch failed', error);
    throw error;
  }
}

// Fetch Anthropic models
async function fetchAnthropicModels(apiKey) {
  try {
    const response = await fetch(API_ENDPOINTS.anthropicModels, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map(model => ({
      id: model.id,
      displayName: model.display_name || formatModelName(model.id)
    }));
  } catch (error) {
    console.error('Appliqueer: Anthropic fetch failed', error);
    throw error;
  }
}

// Fetch Gemini models
async function fetchGeminiModels(apiKey) {
  try {
    const response = await fetch(`${API_ENDPOINTS.gemini}?key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.models) {
      // Filter for chat-capable models
      return data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => ({
          id: m.name.replace('models/', ''),
          displayName: m.displayName || formatModelName(m.name.replace('models/', ''))
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
  } catch (error) {
    console.error('Appliqueer: Gemini fetch failed', error);
    throw error;
  }
}

// Format model name to display name
function formatModelName(id) {
  return id
    .replace(/-/g, ' ')
    .replace(/(\d{4})(\d{2})(\d{2})/g, '') // Remove date suffixes
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// No fallback models - we want errors to be clear
// Removed getFallbackModels function to make API validation explicit

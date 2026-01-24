// Rephrase styles configuration
const REPHRASE_STYLES = [
  { id: 'formal', title: 'Formal', prompt: 'Rephrase this text in a formal, professional tone suitable for official documents or business communication' },
  { id: 'professional', title: 'Professional', prompt: 'Rephrase this text in a professional, polished tone suitable for workplace communication' },
  { id: 'casual', title: 'Casual', prompt: 'Rephrase this text in a casual, friendly, conversational tone' },
  { id: 'sarcastic', title: 'Sarcastic', prompt: 'Rephrase this text with a sarcastic, witty tone while keeping the core meaning' },
  { id: 'friendly', title: 'Friendly', prompt: 'Rephrase this text in a warm, friendly, and approachable tone' },
  { id: 'persuasive', title: 'Persuasive', prompt: 'Rephrase this text to be more persuasive and compelling' },
  { id: 'concise', title: 'Concise', prompt: 'Rephrase this text to be shorter and more concise while keeping the main points' },
  { id: 'elaborate', title: 'Elaborate', prompt: 'Rephrase this text with more detail and elaboration' },
  { id: 'simple', title: 'Simple', prompt: 'Rephrase this text using simple, easy-to-understand language' },
  { id: 'confident', title: 'Confident', prompt: 'Rephrase this text to sound more confident and assertive' }
];

// Using Google Gemini API (FREE tier: 15 RPM, 1M tokens/month)

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rephrase-it',
    title: 'Rephrase It',
    contexts: ['selection']
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'retry' && sender.tab) {
    handleRephrase(sender.tab.id, message.originalText, message.styleId);
  }
  if (message.action === 'customRephrase' && sender.tab) {
    handleCustomRephrase(sender.tab.id, message.originalText, message.customPrompt);
  }
});

// Handle custom prompt rephrasing
async function handleCustomRephrase(tabId, text, customPrompt) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  
  if (!apiKey) {
    await sendMessageToTab(tabId, {
      action: 'showError',
      message: 'Please set your Google Gemini API key in the extension settings.'
    });
    return;
  }

  await sendMessageToTab(tabId, {
    action: 'showLoading',
    originalText: text,
    styleId: 'custom'
  });

  try {
    const rephrasedText = await rephraseText(text, customPrompt, apiKey);
    await sendMessageToTab(tabId, {
      action: 'showResult',
      originalText: text,
      rephrasedText: rephrasedText,
      style: 'Custom'
    });
  } catch (error) {
    await sendMessageToTab(tabId, {
      action: 'showError',
      message: error.message || 'Failed to rephrase text. Please try again.'
    });
  }
}

// Handle rephrasing (used for both initial and retry)
async function handleRephrase(tabId, text, styleId) {
  const style = REPHRASE_STYLES.find(s => s.id === styleId);
  if (!style) return;

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  
  if (!apiKey) {
    await sendMessageToTab(tabId, {
      action: 'showError',
      message: 'Please set your Google Gemini API key in the extension settings.'
    });
    return;
  }

  await sendMessageToTab(tabId, {
    action: 'showLoading',
    originalText: text,
    styleId: styleId
  });

  try {
    const rephrasedText = await rephraseText(text, style.prompt, apiKey);
    await sendMessageToTab(tabId, {
      action: 'showResult',
      originalText: text,
      rephrasedText: rephrasedText,
      style: style.title
    });
  } catch (error) {
    await sendMessageToTab(tabId, {
      action: 'showError',
      message: error.message || 'Failed to rephrase text. Please try again.'
    });
  }
}

// Helper function to ensure content script is injected and send message
async function sendMessageToTab(tabId, message) {
  // First, try to inject the content script (it will be skipped if already present)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content.css']
    });
  } catch (injectError) {
    // Script might already be injected or page doesn't allow it
    console.log('[Rephrase It] Script injection:', injectError.message);
  }
  
  // Small delay to let script initialize
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // Now send the message
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error('[Rephrase It] Failed to send message:', error);
    
    if (error.message.includes('Receiving end does not exist') || 
        error.message.includes('Could not establish connection')) {
      throw new Error('Cannot run on this page. Try refreshing or use a regular webpage.');
    }
    throw error;
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'rephrase-it') return;
  if (!info.selectionText) return;

  // Check if we can run on this tab
  if (!tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) {
    console.log('Cannot run on this page');
    return;
  }

  // Show the unified popup with style options
  await sendMessageToTab(tab.id, {
    action: 'showCustomPrompt',
    originalText: info.selectionText
  });
});

// Available models with fallbacks
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'];

// Function to call Google Gemini API (FREE!)
async function rephraseText(text, prompt, apiKey) {
  const requestBody = {
    contents: [{
      parts: [{
        text: `You are a helpful writing assistant. ${prompt}. Only output the rephrased text, nothing else. Do not include quotes around the text.\n\nText to rephrase: ${text}`
      }]
    }]
  };

  // Try each model until one works
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    console.log(`[Rephrase It] Trying model: ${model}`);
    console.log(`[Rephrase It] URL: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.log(`[Rephrase It] Model ${model} error:`, JSON.stringify(data, null, 2));
        
        const errorMsg = data.error?.message || '';
        const errorCode = data.error?.code;
        
        // If model not found, try next model
        if (errorCode === 404) {
          console.log(`[Rephrase It] Model ${model} not found, trying next...`);
          continue;
        }
        
        // Check for quota/rate limit errors
        if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorCode === 429) {
          const retryMatch = errorMsg.match(/retry in ([\d.]+)s/i);
          const retryTime = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
          throw new Error(`Rate limit reached. Please wait ${retryTime} seconds and try again.`);
        }
        
        // Check for invalid API key
        if (errorMsg.includes('API key') || errorCode === 400 || errorCode === 401 || errorCode === 403) {
          throw new Error('Invalid API key. Please check your Gemini API key in the extension settings.');
        }
        
        // Other error - try next model
        continue;
      }
      
      // Success!
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        console.log(`[Rephrase It] Success with model: ${model}`);
        return data.candidates[0].content.parts[0].text.trim();
      }
      
      // Check for safety blocks
      if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'SAFETY') {
        throw new Error('Content was blocked by safety filters. Try different text.');
      }
      
    } catch (e) {
      // If it's a user-facing error (rate limit, API key), throw it
      if (e.message.includes('Rate limit') || e.message.includes('Invalid API') || e.message.includes('blocked')) {
        throw e;
      }
      console.log(`[Rephrase It] Error with ${model}:`, e.message);
      // Otherwise try next model
    }
  }
  
  throw new Error('No available models. Please check your API key or try again later.');
}

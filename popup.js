// Rephrase It - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleVisibility = document.getElementById('toggleVisibility');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load saved API key
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }

  // Toggle password visibility
  toggleVisibility.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleVisibility.textContent = type === 'password' ? 'Show' : 'Hide';
  });

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter your API key', 'error');
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      showStatus('Invalid API key format. It should start with "AIza"', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ apiKey });
      showStatus('API key saved successfully', 'success');
    } catch (error) {
      showStatus('Failed to save API key. Please try again.', 'error');
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    
    // Auto-hide success message after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        status.className = 'status';
      }, 3000);
    }
  }

  // Handle Enter key in input
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });
});

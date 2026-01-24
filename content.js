// Content script for Rephrase It extension

if (!window.rephraseItInitialized) {
  window.rephraseItInitialized = true;
  
  let currentPopup = null;
  let currentData = null;
  let showingHistory = false;
  
  const STYLES = [
    { id: 'formal', label: 'Formal' },
    { id: 'professional', label: 'Professional' },
    { id: 'casual', label: 'Casual' },
    { id: 'sarcastic', label: 'Sarcastic' },
    { id: 'friendly', label: 'Friendly' },
    { id: 'persuasive', label: 'Persuasive' },
    { id: 'concise', label: 'Concise' },
    { id: 'elaborate', label: 'Elaborate' },
    { id: 'simple', label: 'Simple' },
    { id: 'confident', label: 'Confident' }
  ];

  // Save to history (max 2 items)
  async function saveToHistory(original, rephrased, style) {
    try {
      const { history = [] } = await chrome.storage.local.get('history');
      const newItem = { original, rephrased, style, time: Date.now() };
      const newHistory = [newItem, ...history.filter(h => h.original !== original)].slice(0, 2);
      await chrome.storage.local.set({ history: newHistory });
    } catch (e) {
      console.log('[Rephrase It] Could not save history:', e);
    }
  }

  // Get history
  async function getHistory() {
    try {
      const { history = [] } = await chrome.storage.local.get('history');
      return history;
    } catch (e) {
      return [];
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    currentData = { ...currentData, ...message };
    
    switch (message.action) {
      case 'showLoading':
        currentData.originalText = message.originalText;
        currentData.styleId = message.styleId;
        showUnifiedPopup('loading');
        break;
      case 'showResult':
        currentData.rephrasedText = message.rephrasedText;
        currentData.style = message.style;
        saveToHistory(currentData.originalText, message.rephrasedText, message.style);
        showUnifiedPopup('result');
        break;
      case 'showError':
        currentData.errorMessage = message.message;
        showUnifiedPopup('error');
        break;
      case 'showCustomPrompt':
        currentData.originalText = message.originalText;
        showUnifiedPopup('input');
        break;
    }
    sendResponse({ success: true });
    return false;
  });

  function showUnifiedPopup(state) {
    showingHistory = false;
    if (!currentPopup) {
      createPopup();
    }
    updatePopupState(state);
  }

  function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'rephrase-it-popup';
    popup.style.cssText = `
      position: fixed; z-index: 2147483647; width: 400px; max-width: calc(100vw - 32px);
      background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0; transform: translateY(-6px); transition: opacity 0.15s, transform 0.15s;
    `;

    popup.innerHTML = `
      <div id="rp-header" style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; background: linear-gradient(135deg, #faf8ff 0%, #f5f3ff 100%); border-radius: 12px 12px 0 0; cursor: grab; user-select: none;">
        <span style="font-size: 13px; font-weight: 600; color: #5b21b6;">Rephrase It</span>
        <span id="rp-loading-indicator" style="display: none; align-items: center; gap: 6px; font-size: 11px; color: #7c3aed;">
          <span style="width: 12px; height: 12px; border: 2px solid #ede9fe; border-top-color: #7c3aed; border-radius: 50%; animation: rp-spin 0.6s linear infinite; display: inline-block;"></span>
          Rephrasing...
        </span>
        <span style="flex-grow: 1;"></span>
        <span id="rp-style-badge" style="font-size: 10px; padding: 3px 8px; background: #ede9fe; border-radius: 4px; color: #7c3aed; font-weight: 500; display: none;"></span>
        <button id="rp-history-btn" title="History" style="width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        </button>
        <button id="rp-close" style="width: 24px; height: 24px; border: none; background: transparent; color: #999; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px;">&times;</button>
      </div>
      
      <div id="rp-body" style="padding: 14px 16px;">
        <!-- History Panel -->
        <div id="rp-history-panel" style="display: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <label style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999;">Recent</label>
            <button id="rp-history-back" style="font-size: 11px; color: #666; background: none; border: none; cursor: pointer; text-decoration: underline;">Back</button>
          </div>
          <div id="rp-history-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          <p id="rp-history-empty" style="display: none; color: #999; font-size: 12px; text-align: center; padding: 20px 0;">No history yet</p>
        </div>
        
        <!-- Main Content -->
        <div id="rp-main-content">
          <!-- Error State -->
          <div id="rp-error" style="display: none;">
            <p id="rp-error-msg" style="color: #c00; font-size: 12px; line-height: 1.5; margin: 0 0 12px; padding: 10px 12px; background: #fff5f5; border-radius: 6px; border: 1px solid #fdd;"></p>
          </div>
          
          <!-- Original Text (Editable) -->
          <div id="rp-original-section" style="margin-bottom: 12px; display: none;">
            <label style="display: block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 4px;">Original <span style="font-weight: 400; color: #bbb;">(editable)</span></label>
            <textarea id="rp-original" style="width: 100%; padding: 10px 12px; background: #f8f8f8; border: 1px solid #eee; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #444; min-height: 60px; max-height: 100px; resize: none; font-family: inherit; box-sizing: border-box; outline: none;" spellcheck="false"></textarea>
          </div>
          
          <!-- Rephrased Text -->
          <div id="rp-result-section" style="margin-bottom: 12px; display: none;">
            <label style="display: block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 4px;">Rephrased</label>
            <div id="rp-result" style="padding: 10px 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #1a1a1a; max-height: 100px; overflow-y: auto;"></div>
          </div>
          
          <!-- Action Buttons -->
          <div id="rp-actions" style="display: none; gap: 8px; margin-bottom: 12px;">
            <button id="rp-copy" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; background: #fff; color: #333;">Copy</button>
            <button id="rp-replace" style="flex: 1; padding: 8px 12px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: #fff;">Replace</button>
          </div>
          
          <!-- Divider -->
          <div id="rp-divider" style="display: none; height: 1px; background: #f0f0f0; margin: 12px 0;"></div>
          
          <!-- Style Selector -->
          <div id="rp-styles-section" style="display: none;">
            <label style="display: block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 6px;">Style</label>
            <div id="rp-styles" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
          </div>
          
          <!-- Custom Prompt -->
          <div id="rp-custom-section" style="margin-top: 10px; display: none;">
            <label style="display: block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 4px;">Custom</label>
            <div style="display: flex; gap: 8px;">
              <input id="rp-custom-input" type="text" placeholder="e.g., like a pirate, in French..." style="flex: 1; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; outline: none;">
              <button id="rp-custom-go" style="padding: 8px 14px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: #fff;">Go</button>
            </div>
          </div>
          
          <!-- Retry for errors -->
          <div id="rp-retry-section" style="display: none; margin-top: 10px;">
            <button id="rp-retry" style="width: 100%; padding: 8px 12px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: #fff;">Try Again</button>
          </div>
        </div>
      </div>
      
      <style>@keyframes rp-spin { to { transform: rotate(360deg); } }</style>
    `;

    document.body.appendChild(popup);
    currentPopup = popup;
    
    // Event Listeners
    popup.querySelector('#rp-close').onclick = () => closePopup();
    
    popup.querySelector('#rp-history-btn').onclick = () => toggleHistory();
    popup.querySelector('#rp-history-back').onclick = () => toggleHistory();
    
    popup.querySelector('#rp-copy').onclick = () => {
      navigator.clipboard.writeText(currentData.rephrasedText);
      const btn = popup.querySelector('#rp-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    };
    
    popup.querySelector('#rp-replace').onclick = () => {
      replaceSelectedText(currentData.rephrasedText);
      closePopup();
    };
    
    popup.querySelector('#rp-retry').onclick = () => {
      chrome.runtime.sendMessage({
        action: 'retry',
        originalText: currentData.originalText,
        styleId: currentData.styleId || 'formal'
      });
    };
    
    popup.querySelector('#rp-custom-go').onclick = () => {
      const input = popup.querySelector('#rp-custom-input');
      if (input.value.trim()) {
        chrome.runtime.sendMessage({
          action: 'customRephrase',
          originalText: currentData.originalText,
          customPrompt: input.value.trim()
        });
        input.value = '';
      }
    };
    
    popup.querySelector('#rp-custom-input').onkeydown = (e) => {
      if (e.key === 'Enter') popup.querySelector('#rp-custom-go').click();
    };
    
    // Build style buttons
    const stylesContainer = popup.querySelector('#rp-styles');
    STYLES.forEach(style => {
      const btn = document.createElement('button');
      btn.textContent = style.label;
      btn.style.cssText = `padding: 5px 10px; border: 1px solid #e5e0f0; border-radius: 4px; font-size: 11px; cursor: pointer; background: #fff; color: #555; transition: all 0.1s;`;
      btn.onmouseenter = () => { btn.style.background = '#f5f3ff'; btn.style.borderColor = '#c4b5fd'; btn.style.color = '#7c3aed'; };
      btn.onmouseleave = () => { btn.style.background = '#fff'; btn.style.borderColor = '#e5e0f0'; btn.style.color = '#555'; };
      btn.onclick = () => {
        chrome.runtime.sendMessage({
          action: 'retry',
          originalText: currentData.originalText,
          styleId: style.id
        });
      };
      stylesContainer.appendChild(btn);
    });
    
    // Add hover effects
    ['#rp-copy', '#rp-replace', '#rp-custom-go', '#rp-retry'].forEach(sel => {
      const btn = popup.querySelector(sel);
      if (btn) {
        btn.onmouseenter = () => { 
          if (sel === '#rp-copy') btn.style.background = '#f5f3ff';
          else btn.style.background = '#6d28d9';
        };
        btn.onmouseleave = () => { 
          if (sel === '#rp-copy') btn.style.background = '#fff';
          else btn.style.background = '#7c3aed';
        };
      }
    });
    
    popup.querySelector('#rp-close').onmouseenter = function() { this.style.background = '#eee'; this.style.color = '#333'; };
    popup.querySelector('#rp-close').onmouseleave = function() { this.style.background = 'transparent'; this.style.color = '#999'; };
    
    popup.querySelector('#rp-history-btn').onmouseenter = function() { 
      this.style.background = '#f5f3ff'; 
      this.querySelector('svg').style.stroke = '#7c3aed'; 
    };
    popup.querySelector('#rp-history-btn').onmouseleave = function() { 
      this.style.background = 'transparent'; 
      this.querySelector('svg').style.stroke = '#a78bfa'; 
    };
    
    positionPopup(popup);
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'translateY(0)';
    });
    
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    
    // Make popup draggable by header
    const header = popup.querySelector('#rp-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on buttons
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      
      isDragging = true;
      header.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = popup.offsetLeft;
      initialTop = popup.offsetTop;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;
      
      // Keep within viewport
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - popup.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - popup.offsetHeight));
      
      popup.style.left = newLeft + 'px';
      popup.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });
  }

  async function toggleHistory() {
    if (!currentPopup) return;
    
    showingHistory = !showingHistory;
    const historyPanel = currentPopup.querySelector('#rp-history-panel');
    const mainContent = currentPopup.querySelector('#rp-main-content');
    const historyBtn = currentPopup.querySelector('#rp-history-btn');
    
    if (showingHistory) {
      mainContent.style.display = 'none';
      historyPanel.style.display = 'block';
      historyBtn.style.background = '#f5f3ff';
      historyBtn.querySelector('svg').style.stroke = '#7c3aed';
      
      // Load history
      const history = await getHistory();
      const listEl = currentPopup.querySelector('#rp-history-list');
      const emptyEl = currentPopup.querySelector('#rp-history-empty');
      
      listEl.innerHTML = '';
      
      if (history.length === 0) {
        emptyEl.style.display = 'block';
      } else {
        emptyEl.style.display = 'none';
        history.forEach((item, idx) => {
          const itemEl = document.createElement('div');
          itemEl.style.cssText = `padding: 10px 12px; background: #f8f8f8; border-radius: 6px; border: 1px solid #eee;`;
          itemEl.innerHTML = `
            <div style="font-size: 10px; color: #999; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>${item.style || 'Custom'}</span>
              <button class="rp-history-copy" data-idx="${idx}" style="font-size: 10px; color: #666; background: none; border: none; cursor: pointer; text-decoration: underline;">Copy</button>
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 4px; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.original.substring(0, 60))}${item.original.length > 60 ? '...' : ''}</div>
            <div style="font-size: 12px; color: #333; max-height: 50px; overflow: hidden;">${escapeHtml(item.rephrased.substring(0, 80))}${item.rephrased.length > 80 ? '...' : ''}</div>
          `;
          listEl.appendChild(itemEl);
          
          // Copy button for this item
          itemEl.querySelector('.rp-history-copy').onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.rephrased);
            e.target.textContent = 'Copied!';
            setTimeout(() => e.target.textContent = 'Copy', 1500);
          };
        });
      }
    } else {
      mainContent.style.display = 'block';
      historyPanel.style.display = 'none';
      historyBtn.style.background = 'transparent';
      historyBtn.querySelector('svg').style.stroke = '#a78bfa';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updatePopupState(state) {
    if (!currentPopup) return;
    
    // Make sure we're showing main content, not history
    currentPopup.querySelector('#rp-history-panel').style.display = 'none';
    currentPopup.querySelector('#rp-main-content').style.display = 'block';
    
    const $ = (sel) => currentPopup.querySelector(sel);
    const isLoading = state === 'loading';
    
    // Reset visibility
    $('#rp-loading-indicator').style.display = 'none';
    $('#rp-error').style.display = 'none';
    $('#rp-result-section').style.display = 'none';
    $('#rp-actions').style.display = 'none';
    $('#rp-retry-section').style.display = 'none';
    $('#rp-style-badge').style.display = 'none';
    
    // Always show these
    $('#rp-original-section').style.display = 'block';
    $('#rp-original').value = currentData.originalText;
    
    // Update currentData when user edits original text
    $('#rp-original').oninput = () => {
      currentData.originalText = $('#rp-original').value;
    };
    $('#rp-divider').style.display = 'block';
    $('#rp-styles-section').style.display = 'block';
    $('#rp-custom-section').style.display = 'block';
    
    // Update header based on state
    const header = $('#rp-header');
    header.style.background = state === 'error' ? '#fff5f5' : '#fafafa';
    header.style.borderBottomColor = state === 'error' ? '#fdd' : '#f0f0f0';
    
    // Disable/enable during loading
    currentPopup.querySelectorAll('#rp-styles button').forEach(btn => {
      btn.style.opacity = isLoading ? '0.5' : '1';
      btn.style.pointerEvents = isLoading ? 'none' : 'auto';
    });
    $('#rp-custom-input').disabled = isLoading;
    $('#rp-original').disabled = isLoading;
    $('#rp-original').style.opacity = isLoading ? '0.7' : '1';
    $('#rp-custom-go').style.opacity = isLoading ? '0.5' : '1';
    $('#rp-custom-go').style.pointerEvents = isLoading ? 'none' : 'auto';
    $('#rp-history-btn').style.opacity = isLoading ? '0.5' : '1';
    $('#rp-history-btn').style.pointerEvents = isLoading ? 'none' : 'auto';
    
    switch (state) {
      case 'loading':
        $('#rp-loading-indicator').style.display = 'flex';
        break;
        
      case 'error':
        $('#rp-error').style.display = 'block';
        $('#rp-error-msg').textContent = currentData.errorMessage;
        $('#rp-retry-section').style.display = 'block';
        break;
        
      case 'result':
        $('#rp-style-badge').style.display = 'inline';
        $('#rp-style-badge').textContent = currentData.style;
        $('#rp-result-section').style.display = 'block';
        $('#rp-result').textContent = currentData.rephrasedText;
        $('#rp-actions').style.display = 'flex';
        break;
        
      case 'input':
        setTimeout(() => $('#rp-custom-input').focus(), 50);
        break;
    }
  }

  function closePopup() {
    if (currentPopup) {
      currentPopup.style.opacity = '0';
      currentPopup.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        currentPopup?.remove();
        currentPopup = null;
        currentData = null;
        showingHistory = false;
      }, 150);
    }
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
  }

  function handleOutsideClick(e) {
    if (currentPopup && !currentPopup.contains(e.target)) {
      closePopup();
    }
  }

  function handleEscape(e) {
    if (e.key === 'Escape') closePopup();
  }

  function positionPopup(popup) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      // Use viewport coordinates for fixed positioning
      let left = rect.left;
      let top = rect.bottom + 8;
      if (left + 400 > window.innerWidth) left = window.innerWidth - 420;
      if (left < 10) left = 10;
      if (top + 350 > window.innerHeight) top = rect.top - 360;
      if (top < 10) top = 10;
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    }
  }

  function replaceSelectedText(newText) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const s = el.selectionStart, e = el.selectionEnd;
        el.value = el.value.substring(0, s) + newText + el.value.substring(e);
        el.setSelectionRange(s, s + newText.length);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (el?.isContentEditable) {
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
      } else {
        try { range.deleteContents(); range.insertNode(document.createTextNode(newText)); } catch(e) {}
      }
    }
  }

  console.log('[Rephrase It] Initialized');
}

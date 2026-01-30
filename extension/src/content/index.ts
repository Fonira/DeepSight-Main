/**
 * DeepSight Content Script
 * Injects the analysis button and panel into YouTube pages
 */

import { extractVideoId } from '../services/api';
import './styles.css';

// State
let currentVideoId: string | null = null;
let isInjected = false;
let panelElement: HTMLElement | null = null;
let buttonElement: HTMLElement | null = null;

// YouTube theme detection
function isDarkTheme(): boolean {
  const html = document.documentElement;
  return html.getAttribute('dark') === 'true' || 
         document.body.classList.contains('dark') ||
         getComputedStyle(document.body).backgroundColor.includes('rgb(15,');
}

// Create DeepSight button
function createAnalyzeButton(): HTMLElement {
  const button = document.createElement('button');
  button.id = 'deepsight-analyze-btn';
  button.className = `deepsight-btn ${isDarkTheme() ? 'dark' : 'light'}`;
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    <span>DeepSight</span>
  `;
  
  button.addEventListener('click', handleAnalyzeClick);
  
  return button;
}

// Create side panel
function createSidePanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'deepsight-panel';
  panel.className = `deepsight-panel ${isDarkTheme() ? 'dark' : 'light'}`;
  panel.innerHTML = `
    <div class="deepsight-panel-header">
      <div class="deepsight-panel-title">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span>DeepSight</span>
      </div>
      <button class="deepsight-panel-close" id="deepsight-close">×</button>
    </div>
    <div class="deepsight-panel-content" id="deepsight-content">
      <div class="deepsight-loading">
        <div class="deepsight-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    </div>
  `;
  
  // Close button handler
  const closeBtn = panel.querySelector('#deepsight-close');
  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
  });
  
  return panel;
}

// Handle button click
async function handleAnalyzeClick() {
  if (!panelElement) return;
  
  // Toggle panel
  panelElement.classList.toggle('open');
  
  if (!panelElement.classList.contains('open')) return;
  
  const contentEl = document.getElementById('deepsight-content');
  if (!contentEl) return;
  
  // Check auth
  contentEl.innerHTML = `
    <div class="deepsight-loading">
      <div class="deepsight-spinner"></div>
      <p>Checking authentication...</p>
    </div>
  `;
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHECK_AUTH' });
    
    if (!response.authenticated) {
      showLoginPrompt(contentEl);
      return;
    }
    
    // Show analysis UI
    showAnalysisUI(contentEl, response.user);
  } catch (error) {
    contentEl.innerHTML = `
      <div class="deepsight-error">
        <p>❌ Error: ${(error as Error).message}</p>
        <button class="deepsight-btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Show login prompt
function showLoginPrompt(container: HTMLElement) {
  container.innerHTML = `
    <div class="deepsight-auth">
      <div class="deepsight-auth-icon">🔐</div>
      <h3>Sign in to DeepSight</h3>
      <p>Analyze this video with AI-powered insights</p>
      <button class="deepsight-btn-primary" id="deepsight-login">
        Sign in to DeepSight
      </button>
      <p class="deepsight-auth-note">
        Don't have an account? 
        <a href="https://deepsight.vercel.app/register" target="_blank">Sign up free</a>
      </p>
    </div>
  `;
  
  document.getElementById('deepsight-login')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_POPUP' });
    window.open('https://deepsight.vercel.app/login', '_blank', 'width=500,height=600');
  });
}

// Show analysis UI
function showAnalysisUI(container: HTMLElement, user: { credits: number; plan: string }) {
  const videoUrl = window.location.href;
  
  container.innerHTML = `
    <div class="deepsight-analysis-ui">
      <div class="deepsight-user-info">
        <span class="deepsight-credits">${user.credits} credits</span>
        <span class="deepsight-plan">${user.plan}</span>
      </div>
      
      <div class="deepsight-options">
        <label class="deepsight-option">
          <span>Analysis Mode</span>
          <select id="deepsight-mode">
            <option value="accessible">📖 Accessible</option>
            <option value="standard" selected>📋 Standard</option>
            <option value="expert">🎓 Expert</option>
          </select>
        </label>
        
        <label class="deepsight-option">
          <span>Language</span>
          <select id="deepsight-lang">
            <option value="fr">🇫🇷 French</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="de">🇩🇪 German</option>
          </select>
        </label>
      </div>
      
      <button class="deepsight-btn-primary deepsight-btn-full" id="deepsight-start">
        🚀 Analyze Video
      </button>
      
      <div id="deepsight-result" class="deepsight-result hidden"></div>
    </div>
  `;
  
  // Analyze button handler
  document.getElementById('deepsight-start')?.addEventListener('click', async () => {
    const mode = (document.getElementById('deepsight-mode') as HTMLSelectElement).value;
    const lang = (document.getElementById('deepsight-lang') as HTMLSelectElement).value;
    
    await startAnalysis(videoUrl, { mode, lang });
  });
}

// Start analysis
async function startAnalysis(url: string, options: { mode: string; lang: string }) {
  const resultEl = document.getElementById('deepsight-result');
  const startBtn = document.getElementById('deepsight-start') as HTMLButtonElement;
  
  if (!resultEl || !startBtn) return;
  
  // Disable button and show progress
  startBtn.disabled = true;
  startBtn.innerHTML = '<div class="deepsight-spinner-small"></div> Analyzing...';
  
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="deepsight-progress">
      <div class="deepsight-progress-bar" id="deepsight-progress-bar" style="width: 0%"></div>
    </div>
    <p class="deepsight-progress-text" id="deepsight-progress-text">Starting analysis...</p>
  `;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ANALYZE_VIDEO',
      data: { url, options },
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    const result = response.result;
    
    if (result.status === 'completed' && result.result?.summary_id) {
      // Show success and load summary
      showSummaryResult(result.result.summary_id);
    } else if (result.status === 'failed') {
      throw new Error(result.error || 'Analysis failed');
    }
  } catch (error) {
    resultEl.innerHTML = `
      <div class="deepsight-error">
        <p>❌ ${(error as Error).message}</p>
        <button class="deepsight-btn-secondary" onclick="document.getElementById('deepsight-start').click()">
          Retry
        </button>
      </div>
    `;
    startBtn.disabled = false;
    startBtn.innerHTML = '🚀 Analyze Video';
  }
}

// Show summary result
async function showSummaryResult(summaryId: number) {
  const resultEl = document.getElementById('deepsight-result');
  const startBtn = document.getElementById('deepsight-start') as HTMLButtonElement;
  
  if (!resultEl || !startBtn) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_SUMMARY',
      data: { summaryId },
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    const summary = response.summary;
    
    // Extract timestamps from content
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    let processedContent = summary.summary_content;
    
    // Replace timestamps with clickable links
    processedContent = processedContent.replace(timestampRegex, (_match: string, time: string) => {
      const seconds = timeToSeconds(time);
      return `<a href="#" class="deepsight-timestamp" data-time="${seconds}">[${time}]</a>`;
    });
    
    resultEl.innerHTML = `
      <div class="deepsight-summary">
        <div class="deepsight-summary-header">
          <h3>✅ Analysis Complete</h3>
          <div class="deepsight-summary-meta">
            <span class="deepsight-category">${getCategoryIcon(summary.category)} ${summary.category}</span>
            <span class="deepsight-reliability" title="Reliability Score">
              ${getReliabilityIcon(summary.reliability_score)} ${summary.reliability_score}%
            </span>
          </div>
        </div>
        
        <div class="deepsight-summary-content">
          ${processedContent}
        </div>
        
        <div class="deepsight-summary-actions">
          <button class="deepsight-btn-secondary" id="deepsight-chat">
            💬 Chat with video
          </button>
          <a href="https://deepsight.vercel.app/summary/${summaryId}" 
             target="_blank" 
             class="deepsight-btn-secondary">
            📖 Full view
          </a>
        </div>
      </div>
    `;
    
    // Add timestamp click handlers
    resultEl.querySelectorAll('.deepsight-timestamp').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const time = parseInt((el as HTMLElement).dataset.time || '0');
        seekToTime(time);
      });
    });
    
    // Chat button handler
    document.getElementById('deepsight-chat')?.addEventListener('click', () => {
      showChatUI(summaryId, summary.video_title);
    });
    
    startBtn.disabled = false;
    startBtn.innerHTML = '🔄 Re-analyze';
  } catch (error) {
    resultEl.innerHTML = `
      <div class="deepsight-error">
        <p>❌ Failed to load summary: ${(error as Error).message}</p>
      </div>
    `;
    startBtn.disabled = false;
    startBtn.innerHTML = '🚀 Analyze Video';
  }
}

// Show chat UI
function showChatUI(summaryId: number, videoTitle: string) {
  const contentEl = document.getElementById('deepsight-content');
  if (!contentEl) return;
  
  contentEl.innerHTML = `
    <div class="deepsight-chat">
      <div class="deepsight-chat-header">
        <button class="deepsight-back" id="deepsight-back">← Back</button>
        <h3>Chat with "${videoTitle.substring(0, 30)}..."</h3>
      </div>
      
      <div class="deepsight-chat-messages" id="deepsight-messages">
        <div class="deepsight-chat-message assistant">
          <p>👋 Hi! Ask me anything about this video.</p>
        </div>
      </div>
      
      <form class="deepsight-chat-input" id="deepsight-chat-form">
        <input type="text" 
               id="deepsight-question" 
               placeholder="Ask a question..."
               autocomplete="off" />
        <button type="submit" class="deepsight-btn-primary">Send</button>
      </form>
    </div>
  `;
  
  // Back button
  document.getElementById('deepsight-back')?.addEventListener('click', () => {
    handleAnalyzeClick();
  });
  
  // Chat form
  document.getElementById('deepsight-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('deepsight-question') as HTMLInputElement;
    const question = input.value.trim();
    if (!question) return;
    
    input.value = '';
    await sendChatMessage(summaryId, question);
  });
}

// Send chat message
async function sendChatMessage(summaryId: number, question: string) {
  const messagesEl = document.getElementById('deepsight-messages');
  if (!messagesEl) return;
  
  // Add user message
  messagesEl.innerHTML += `
    <div class="deepsight-chat-message user">
      <p>${escapeHtml(question)}</p>
    </div>
  `;
  
  // Add loading indicator
  messagesEl.innerHTML += `
    <div class="deepsight-chat-message assistant loading" id="deepsight-loading">
      <div class="deepsight-spinner-small"></div>
    </div>
  `;
  
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ASK_QUESTION',
      data: { summaryId, question },
    });
    
    // Remove loading
    document.getElementById('deepsight-loading')?.remove();
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    // Add assistant response
    messagesEl.innerHTML += `
      <div class="deepsight-chat-message assistant">
        <p>${formatChatResponse(response.result.response)}</p>
        ${response.result.web_search_used ? '<span class="deepsight-web-badge">🌐 Web enriched</span>' : ''}
      </div>
    `;
    
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (error) {
    document.getElementById('deepsight-loading')?.remove();
    messagesEl.innerHTML += `
      <div class="deepsight-chat-message error">
        <p>❌ ${(error as Error).message}</p>
      </div>
    `;
  }
}

// Helper functions
function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

function seekToTime(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    tech: '💻',
    science: '🔬',
    education: '📚',
    news: '📰',
    entertainment: '🎬',
    gaming: '🎮',
    music: '🎵',
    sports: '⚽',
    business: '💼',
    lifestyle: '🌟',
    other: '📋',
  };
  return icons[category] || '📋';
}

function getReliabilityIcon(score: number): string {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  return '❓';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatChatResponse(text: string): string {
  // Basic markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'ANALYSIS_PROGRESS') {
    const progressBar = document.getElementById('deepsight-progress-bar');
    const progressText = document.getElementById('deepsight-progress-text');
    
    if (progressBar && progressText) {
      progressBar.style.width = `${message.data.progress}%`;
      progressText.textContent = message.data.message;
    }
  }
});

// Inject UI elements
function injectUI() {
  if (isInjected) return;
  
  const videoId = extractVideoId(window.location.href);
  if (!videoId) return;
  
  // Wait for YouTube player controls
  const checkInterval = setInterval(() => {
    const actionsContainer = document.querySelector('#top-level-buttons-computed, #menu-container');
    
    if (actionsContainer && !document.getElementById('deepsight-analyze-btn')) {
      clearInterval(checkInterval);
      
      // Create and inject button
      buttonElement = createAnalyzeButton();
      actionsContainer.insertBefore(buttonElement, actionsContainer.firstChild);
      
      // Create and inject panel
      panelElement = createSidePanel();
      document.body.appendChild(panelElement);
      
      isInjected = true;
      currentVideoId = videoId;
      
      console.log('[DeepSight] UI injected for video:', videoId);
    }
  }, 1000);
  
  // Stop checking after 30 seconds
  setTimeout(() => clearInterval(checkInterval), 30000);
}

// Handle YouTube SPA navigation
function handleNavigation() {
  const videoId = extractVideoId(window.location.href);
  
  if (videoId !== currentVideoId) {
    // Reset state
    isInjected = false;
    buttonElement?.remove();
    panelElement?.remove();
    buttonElement = null;
    panelElement = null;
    
    // Inject for new video
    if (videoId) {
      setTimeout(injectUI, 1000);
    }
  }
}

// Watch for theme changes
function watchThemeChanges() {
  const observer = new MutationObserver(() => {
    const dark = isDarkTheme();
    buttonElement?.classList.toggle('dark', dark);
    buttonElement?.classList.toggle('light', !dark);
    panelElement?.classList.toggle('dark', dark);
    panelElement?.classList.toggle('light', !dark);
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dark', 'class'],
  });
}

// Initialize
function init() {
  console.log('[DeepSight] Content script loaded');
  
  // Initial injection
  injectUI();
  
  // Watch for navigation
  const pushState = history.pushState;
  history.pushState = function(...args) {
    pushState.apply(history, args);
    setTimeout(handleNavigation, 500);
  };
  
  window.addEventListener('popstate', () => {
    setTimeout(handleNavigation, 500);
  });
  
  // YouTube uses yt-navigate-finish for SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(handleNavigation, 500);
  });
  
  // Watch theme changes
  watchThemeChanges();
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

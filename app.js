/* ==========================================================================
   Aero Market 24h Forms - Javascript Application
   Logics: Form Flow, Passcode Keypad, Charts Dashboard, Mock Data & CSV Export
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Safe Lucide helper to prevent crashes if CDN is delayed or blocked
  function safeCreateIcons() {
    try {
      if (typeof lucide !== 'undefined' && lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    } catch (err) {
      console.warn('Erro ao processar Lucide Icons:', err);
    }
  }

  // Initialise Lucide Icons
  safeCreateIcons();

  // APP STATE
  let currentStep = 0;
  const totalSteps = 18; // Questions from 1 to 18
  
  // Safe localStorage loading to prevent crashes from corrupt browser cache
  let responses = [];
  try {
    const stored = localStorage.getItem('aero_market_responses');
    if (stored) {
      responses = JSON.parse(stored);
      if (!Array.isArray(responses)) responses = [];
    }
  } catch (err) {
    console.error('Erro ao carregar respostas do localStorage:', err);
    responses = [];
  }

  let theme = 'dark';
  try {
    theme = localStorage.getItem('aero_market_theme') || 'dark';
  } catch (err) {
    console.error('Erro ao carregar tema do localStorage:', err);
    theme = 'dark';
  }

  // Global Chart.js Instances (to destroy/rebuild on reload)
  let charts = {};

  // PIN Access Code for Admin Panel
  const CORRECT_PIN = '2424';
  let enteredPin = '';

  // URL padrão do webhook do Google Planilhas (Cole aqui a URL do Sheets se quiser deixar fixa para todos os celulares)
  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyN7VT_s9-4_gY5-ZVuIgZuarDvcvzOf-IItMvl7fEYVb99vRekB9X4EMtdvV4P8FkwEQ/exec';

  // Theme Initialisation
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    updateThemeIcon('light');
  }

  // ==========================================================================
  // ELEMENT SELECTORS
  // ==========================================================================
  
  // Views
  const formView = document.getElementById('form-view');
  const adminView = document.getElementById('admin-view');
  
  // Navigation
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const progressBar = document.getElementById('form-progress-bar');
  const progressText = document.getElementById('progress-step-text');
  const progressPct = document.getElementById('progress-percentage');
  const startSurveyBtn = document.getElementById('start-survey-btn');
  const restartFormBtn = document.getElementById('restart-form-btn');
  
  // Headers Actions
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const adminTriggerBtn = document.getElementById('admin-trigger-btn');
  
  // Passcode Modal Elements
  const adminGateModal = document.getElementById('admin-gate-modal');
  const closeGateBtn = document.getElementById('close-gate-btn');
  const pinDots = document.querySelectorAll('.pin-dot');
  const keypadButtons = document.querySelectorAll('.key-btn[data-val]');
  const keyClear = document.getElementById('key-clear');
  const keySubmit = document.getElementById('key-submit');
  
  // Admin Action Buttons
  const exitAdminBtn = document.getElementById('exit-admin-btn');
  const injectMockBtn = document.getElementById('inject-mock-btn');
  const clearDbBtn = document.getElementById('clear-db-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');

  // ==========================================================================
  // VIEW TRANSITIONS & STEP NAVIGATION
  // ==========================================================================

  function showStep(stepIndex) {
    // Hide all step cards
    const stepCards = document.querySelectorAll('.step-card');
    stepCards.forEach(card => card.classList.remove('active'));

    // Show the active step card
    const activeCard = document.querySelector(`.step-card[data-step="${stepIndex}"]`);
    if (activeCard) {
      activeCard.classList.add('active');
    }

    // Scroll to the very top of the page so header/progress are visible
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Focus on first input if text screen, but skip on mobile to prevent intrusive keyboard popup
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isMobile) {
      if (stepIndex === 4) {
        document.getElementById('q3-lack').focus();
      } else if (stepIndex === 9) {
        document.getElementById('q8-external').focus();
      } else if (stepIndex === 18) {
        document.getElementById('q16-feedback').focus();
      }
    }

    // Toggle class to hide progress & navigation in CSS as a fail-safe
    if (formView) {
      if (stepIndex === 0 || stepIndex === 19) {
        formView.classList.add('hide-progress');
      } else {
        formView.classList.remove('hide-progress');
      }
    }

    updateControls(stepIndex);
  }

  function updateControls(stepIndex) {
    const navControls = document.getElementById('navigation-controls');
    const progressContainer = document.querySelector('.progress-container');

    // Hide controls altogether on welcome step (0) and success step (19)
    if (stepIndex === 0 || stepIndex === 19) {
      navControls.style.display = 'none';
      progressContainer.style.display = 'none';
      return;
    } else {
      navControls.style.display = 'flex';
      progressContainer.style.display = 'block';
    }

    // Previous Button disabled on step 1
    if (stepIndex === 1) {
      prevBtn.classList.add('disabled');
      prevBtn.disabled = true;
    } else {
      prevBtn.classList.remove('disabled');
      prevBtn.disabled = false;
    }

    // Next Button becomes "Enviar Pesquisa" on the last question step (16)
    if (stepIndex === totalSteps) {
      nextBtn.innerHTML = '<span>Enviar Pesquisa</span><i data-lucide="send"></i>';
    } else {
      nextBtn.innerHTML = '<span>Avançar</span><i data-lucide="chevron-right"></i>';
    }
    safeCreateIcons();

    // Hide validation messages when switching steps
    const activeCard = document.querySelector(`.step-card[data-step="${stepIndex}"]`);
    const validationMsg = activeCard.querySelector('.validation-msg');
    if (validationMsg) {
      validationMsg.style.display = 'none';
    }

    // Progress Calculation
    const pct = Math.round(((stepIndex - 1) / totalSteps) * 100);
    progressBar.style.width = `${pct}%`;
    progressPct.innerText = `${pct}%`;
    progressText.innerText = `Pergunta ${stepIndex} de ${totalSteps}`;
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      if (currentStep === totalSteps) {
        saveResponse();
        currentStep = 19; // Success Screen
        showStep(currentStep);
      } else {
        currentStep++;
        showStep(currentStep);
      }
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  }

  // ==========================================================================
  // SELECTIONS & CARD CLICK HANDLERS
  // ==========================================================================

  // Handle choice cards click actions
  document.querySelectorAll('.options-grid').forEach(grid => {
    const isMultiple = grid.getAttribute('data-type') === 'multiple';

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.option-card');
      if (!card) return;

      const activeCard = document.querySelector(`.step-card[data-step="${currentStep}"]`);
      const validationMsg = activeCard.querySelector('.validation-msg');
      if (validationMsg) validationMsg.style.display = 'none';

      if (isMultiple) {
        card.classList.toggle('selected');
        
        // Q8 Outros slide check
        if (currentStep === 8 && card.id === 'favorite-other-card') {
          const wrapper = document.getElementById('favorites-other-wrapper');
          if (card.classList.contains('selected')) {
            wrapper.classList.add('show');
            wrapper.style.display = 'block';
            setTimeout(() => {
              const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
              if (!isMobile) {
                document.getElementById('q8-favorites-other').focus();
              }
            }, 100);
          } else {
            wrapper.classList.remove('show');
            setTimeout(() => {
              wrapper.style.display = 'none';
            }, 300);
            document.getElementById('q8-favorites-other').value = '';
          }
        }
      } else {
        // Single Select
        grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        // Auto-advance with small visual delay so user sees selection (250ms)
        setTimeout(() => {
          nextStep();
        }, 250);
      }
    });
  });

  // Handle aspect rating buttons grid (Q5 aspects rating grid)
  document.querySelectorAll('.aspect-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('.aspect-choice-btn');
      if (!btn) return;

      row.querySelectorAll('.aspect-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const card = btn.closest('.step-card');
      const validationMsg = card.querySelector('.validation-msg');
      if (validationMsg) validationMsg.style.display = 'none';

      // Removed auto-advance; wait for click on next button
    });
  });

  // Handle rating buttons grid Q13 (0-10 Score)
  const ratingGrid = document.querySelector('.rating-grid');
  if (ratingGrid) {
    ratingGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.rating-btn');
      if (!btn) return;

      ratingGrid.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const activeCard = document.querySelector(`.step-card[data-step="${currentStep}"]`);
      const validationMsg = activeCard.querySelector('.validation-msg');
      if (validationMsg) validationMsg.style.display = 'none';

      // Auto-advance rating after delay
      setTimeout(() => {
        nextStep();
      }, 300);
    });
  }

  // Keyboard navigation for text inputs
  document.querySelectorAll('input.input-field').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      }
    });
  });

  // ==========================================================================
  // FORM VALIDATION LOGIC
  // ==========================================================================

  function validateStep(stepIndex) {
    // Welcome screen or text screens (which are optional)
    if (stepIndex === 0 || stepIndex === 4 || stepIndex === 9 || stepIndex === 18 || stepIndex === 19) {
      return true;
    }

    const card = document.querySelector(`.step-card[data-step="${stepIndex}"]`);
    const validationMsg = card.querySelector('.validation-msg');

    // Q5: Aspect rating grid validation (all 4 aspects must be rated)
    if (stepIndex === 5) {
      const varietySelected = card.querySelector('.aspect-row[data-aspect="variety"] .aspect-choice-btn.selected');
      const priceSelected = card.querySelector('.aspect-row[data-aspect="price"] .aspect-choice-btn.selected');
      const organizationSelected = card.querySelector('.aspect-row[data-aspect="organization"] .aspect-choice-btn.selected');
      const supplySelected = card.querySelector('.aspect-row[data-aspect="supply"] .aspect-choice-btn.selected');
      
      if (!varietySelected || !priceSelected || !organizationSelected || !supplySelected) {
        if (validationMsg) validationMsg.style.display = 'block';
        return false;
      }
      return true;
    }

    if (stepIndex === 16) {
      // Rating Q16 (NPS 0-10 score, was step 15)
      const selectedRating = card.querySelector('.rating-btn.selected');
      if (!selectedRating) {
        if (validationMsg) validationMsg.style.display = 'block';
        return false;
      }
      return true;
    }

    const grid = card.querySelector('.options-grid');
    const selectedOptions = grid.querySelectorAll('.option-card.selected');

    // Default choice screens
    if (selectedOptions.length === 0) {
      if (validationMsg) validationMsg.style.display = 'block';
      return false;
    }

    return true;
  }

  // ==========================================================================
  // DATA STORAGE (LOCALSTORAGE DATABASE)
  // ==========================================================================

  function saveResponse() {
    const aspectCard = document.querySelector('.step-card[data-step="5"]');
    
    const data = {
      id: 'resp_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      
      // Question 1: Loja
      q1_store: getSelectedValue(1),
      
      // Question 2: Frequência
      q2_freq: getSelectedValue(2),
      
      // Question 3: Setores
      q3_sectors: getSelectedValues(3),
      
      // Question 4: Falta na loja
      q4_lack: document.getElementById('q3-lack').value.trim(),
      
      // Question 5: Aspectos avaliados (Grade de aspectos)
      q5_aspect_variety: aspectCard.querySelector('.aspect-row[data-aspect="variety"] .aspect-choice-btn.selected') ? parseInt(aspectCard.querySelector('.aspect-row[data-aspect="variety"] .aspect-choice-btn.selected').getAttribute('data-value')) : "",
      q5_aspect_price: aspectCard.querySelector('.aspect-row[data-aspect="price"] .aspect-choice-btn.selected') ? parseInt(aspectCard.querySelector('.aspect-row[data-aspect="price"] .aspect-choice-btn.selected').getAttribute('data-value')) : "",
      q5_aspect_organization: aspectCard.querySelector('.aspect-row[data-aspect="organization"] .aspect-choice-btn.selected') ? parseInt(aspectCard.querySelector('.aspect-row[data-aspect="organization"] .aspect-choice-btn.selected').getAttribute('data-value')) : "",
      q5_aspect_supply: aspectCard.querySelector('.aspect-row[data-aspect="supply"] .aspect-choice-btn.selected') ? parseInt(aspectCard.querySelector('.aspect-row[data-aspect="supply"] .aspect-choice-btn.selected').getAttribute('data-value')) : "",
      
      // Question 6: Ver mais
      q6_see_more: getSelectedValues(6),
      
      // Question 7: Horário
      q7_hour: getSelectedValue(7),
      
      // Question 8: Produtos favoritos
      q8_favorites: getSelectedValues(8),
      q8_favorites_other: document.getElementById('q8-favorites-other').value.trim(),
      
      // Question 9: Mercado externo
      q9_external: document.getElementById('q8-external').value.trim(),
      
      // Question 10: Consumo de vinhos
      q10_wine_type: getSelectedValue(10),
      
      // Question 11: Preço habitual do vinho
      q11_wine_price: getSelectedValue(11),
      
      // Question 12: Promoções semanais (now Step 13)
      q12_promo_interest: getSelectedValue(13),
      
      // Question 13: Tipo promoção (now Step 14)
      q13_promo_type: getSelectedValues(14),
      
      // Question 14: Conveniente (now Step 15)
      q14_convenient: getSelectedValue(15),
      
      // Question 15: Nota (now Step 16)
      q15_rating: parseInt(document.querySelector('.step-card[data-step="16"] .rating-btn.selected').getAttribute('data-value')),
      
      // Question 16: Indicaria (now Step 17)
      q16_nps_recommend: getSelectedValue(17),
      
      // Question 17: Fatores de Influência (now Step 12)
      q12_influence_factor: getSelectedValue(12),
      
      // Question 18: Sugestão livre
      q18_feedback: document.getElementById('q16-feedback').value.trim()
    };

    responses.push(data);
    localStorage.setItem('aero_market_responses', JSON.stringify(responses));
    
    // Webhook Integration (Fetch to Google Apps Script - Opcional)
    const sheetsWebhookUrl = localStorage.getItem('aero_market_webhook_url') || DEFAULT_WEBHOOK_URL;
    if (sheetsWebhookUrl) {
      fetch(sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err => console.log('Envio ao sheets falhou: ', err));
    }
  }

  function getSelectedValue(stepIndex) {
    const card = document.querySelector(`.step-card[data-step="${stepIndex}"]`);
    const selected = card.querySelector('.option-card.selected');
    return selected ? selected.getAttribute('data-value') : '';
  }

  function getSelectedValues(stepIndex) {
    const card = document.querySelector(`.step-card[data-step="${stepIndex}"]`);
    const selected = card.querySelectorAll('.option-card.selected');
    const values = [];
    selected.forEach(el => values.push(el.getAttribute('data-value')));
    return values;
  }

  function resetFormFields() {
    // Clear selected cards
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.aspect-choice-btn').forEach(b => b.classList.remove('selected'));
    
    // Clear inputs
    document.getElementById('q3-lack').value = '';
    document.getElementById('q8-external').value = '';
    document.getElementById('q16-feedback').value = '';
    document.getElementById('q8-favorites-other').value = '';
    
    // Reset Outros favorites sliding wrapper
    const favOtherWrapper = document.getElementById('favorites-other-wrapper');
    if (favOtherWrapper) {
      favOtherWrapper.classList.remove('show');
      favOtherWrapper.style.display = 'none';
    }
    
    currentStep = 0;
    showStep(currentStep);
  }

  // ==========================================================================
  // PASSWORD LOCK PAD SYSTEM (ADMIN SYSTEM)
  // ==========================================================================

  adminTriggerBtn.addEventListener('click', () => {
    // Toggle back if already in admin panel
    if (adminView.classList.contains('view-hidden') === false) {
      exitAdmin();
    } else {
      openPinModal();
    }
  });

  closeGateBtn.addEventListener('click', closePinModal);

  function openPinModal() {
    enteredPin = '';
    updatePinDots();
    adminGateModal.style.display = 'flex';
  }

  function closePinModal() {
    adminGateModal.style.display = 'none';
  }

  keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (enteredPin.length < 4) {
        enteredPin += btn.getAttribute('data-val');
        updatePinDots();
        
        // Auto-submit when length reaches 4
        if (enteredPin.length === 4) {
          setTimeout(submitPin, 300);
        }
      }
    });
  });

  keyClear.addEventListener('click', () => {
    enteredPin = '';
    updatePinDots();
  });

  keySubmit.addEventListener('click', submitPin);

  function updatePinDots() {
    pinDots.forEach((dot, index) => {
      if (index < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  function submitPin() {
    if (enteredPin === CORRECT_PIN) {
      closePinModal();
      enterAdmin();
    } else {
      // Fail effect: shake card
      const modal = document.querySelector('.modal-card');
      modal.classList.add('shake-fail');
      
      // Play brief sound or vibration
      if (navigator.vibrate) navigator.vibrate(200);

      setTimeout(() => {
        modal.classList.remove('shake-fail');
        enteredPin = '';
        updatePinDots();
      }, 500);
    }
  }

  // CSS for shaking modal
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
    .shake-fail {
      animation: shake 0.4s ease-in-out;
      border-color: var(--danger) !important;
    }
  `;
  document.head.appendChild(style);

  // ==========================================================================
  // ADMIN DASHBOARD LOGICS & CHARTS (CHART.JS)
  // ==========================================================================

  function enterAdmin() {
    formView.classList.remove('active-view');
    formView.classList.add('view-hidden');
    adminView.classList.remove('view-hidden');
    
    loadWebhookUrl();
    
    // Fetch consolidated data from Google Sheets if a webhook URL is configured
    const url = localStorage.getItem('aero_market_webhook_url') || DEFAULT_WEBHOOK_URL;
    if (url) {
      updateSyncStatus('syncing');
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Override local memory database with the real-time Google Sheets array
            responses = data;
            localStorage.setItem('aero_market_responses', JSON.stringify(responses));
            updateSyncStatus('success');
            renderDashboard();
          } else if (data && data.status === 'error') {
            console.error('Erro retornado do script do Sheets:', data.message);
            updateSyncStatus('error');
            renderDashboard();
          } else {
            console.error('Dados de resposta inválidos do Sheets:', data);
            updateSyncStatus('local');
            renderDashboard();
          }
        })
        .catch(err => {
          console.error('Falha de conexão com o Google Sheets:', err);
          updateSyncStatus('error');
          renderDashboard();
        });
    } else {
      updateSyncStatus('local');
      renderDashboard();
    }
  }

  function updateSyncStatus(status) {
    const statusEl = document.getElementById('sheets-sync-status');
    if (!statusEl) return;
    
    if (status === 'syncing') {
      statusEl.className = 'sync-badge syncing';
      statusEl.innerHTML = '<i data-lucide="refresh-cw" class="spin-icon"></i> Sincronizando...';
    } else if (status === 'success') {
      statusEl.className = 'sync-badge success';
      statusEl.innerHTML = '<i data-lucide="cloud-check"></i> Sincronizado';
    } else if (status === 'local') {
      statusEl.className = 'sync-badge local';
      statusEl.innerHTML = '<i data-lucide="database"></i> Cache Local';
    } else if (status === 'error') {
      statusEl.className = 'sync-badge error';
      statusEl.innerHTML = '<i data-lucide="cloud-off"></i> Offline';
    }
    
    safeCreateIcons();
  }

  function exitAdmin() {
    adminView.classList.add('view-hidden');
    formView.classList.remove('view-hidden');
    formView.classList.add('active-view');
    
    // Reset steps to whatever it was
    showStep(currentStep);
  }

  exitAdminBtn.addEventListener('click', exitAdmin);

  function renderDashboard() {
    const filterStore = document.getElementById('store-filter-select').value;
    let filteredResponses = responses;
    if (filterStore !== 'all') {
      filteredResponses = responses.filter(r => r.q1_store === filterStore);
    }

    // Update KPI metrics
    const totalCount = filteredResponses.length;
    document.getElementById('kpi-total-responses').innerText = totalCount;

    if (totalCount === 0) {
      document.getElementById('kpi-nps').innerText = '--';
      document.getElementById('kpi-nps-status').innerText = 'Sem dados suficientes';
      document.getElementById('kpi-nps-color').className = 'kpi-icon-box bg-rose';
      document.getElementById('kpi-avg-rating').innerText = '0.0';
      document.getElementById('kpi-peak-hour').innerText = '--';
      
      // Clear charts
      destroyAllCharts();
      renderEmptyCharts();
      renderFeedbacks([]);
      return;
    }

    // 1. Calculate Average Rating (Q15)
    let sum = 0;
    let validRatingsCount = 0;
    filteredResponses.forEach(r => {
      let ratingVal = undefined;
      if (r.q15_rating !== undefined && r.q15_rating !== null && r.q15_rating !== "") {
        ratingVal = r.q15_rating;
      } else if (r.q14_rating !== undefined && r.q14_rating !== null && r.q14_rating !== "") {
        ratingVal = r.q14_rating;
      } else if (r.q13_rating !== undefined && r.q13_rating !== null && r.q13_rating !== "") {
        ratingVal = r.q13_rating;
      }
      
      const rating = Number(ratingVal);
      if (!isNaN(rating)) {
        sum += rating;
        validRatingsCount++;
      }
    });
    const avg = validRatingsCount > 0 ? (sum / validRatingsCount).toFixed(1) : '0.0';
    document.getElementById('kpi-avg-rating').innerText = avg;

    // 2. Calculate NPS (Net Promoter Score)
    // 9-10 Promoters, 7-8 Passives, 0-6 Detractors
    let promoters = 0;
    let detractors = 0;
    let validNpsCount = 0;
    filteredResponses.forEach(r => {
      let ratingVal = undefined;
      if (r.q15_rating !== undefined && r.q15_rating !== null && r.q15_rating !== "") {
        ratingVal = r.q15_rating;
      } else if (r.q14_rating !== undefined && r.q14_rating !== null && r.q14_rating !== "") {
        ratingVal = r.q14_rating;
      } else if (r.q13_rating !== undefined && r.q13_rating !== null && r.q13_rating !== "") {
        ratingVal = r.q13_rating;
      }
      
      const rating = Number(ratingVal);
      if (!isNaN(rating)) {
        validNpsCount++;
        if (rating >= 9) promoters++;
        else if (rating <= 6) detractors++;
      }
    });
    
    const pctPromoters = validNpsCount > 0 ? (promoters / validNpsCount) * 100 : 0;
    const pctDetractors = validNpsCount > 0 ? (detractors / validNpsCount) * 100 : 0;
    const nps = Math.round(pctPromoters - pctDetractors);
    
    const npsEl = document.getElementById('kpi-nps');
    const npsStatusEl = document.getElementById('kpi-nps-status');
    const npsColorEl = document.getElementById('kpi-nps-color');
    
    npsEl.innerText = (nps > 0 ? '+' : '') + nps;
    
    if (nps >= 50) {
      npsStatusEl.innerText = 'Excelente!';
      npsColorEl.className = 'kpi-icon-box bg-emerald';
    } else if (nps >= 0) {
      npsStatusEl.innerText = 'Zona de Qualidade';
      npsColorEl.className = 'kpi-icon-box bg-indigo';
    } else {
      npsStatusEl.innerText = 'Zona Crítica (Melhorar)';
      npsColorEl.className = 'kpi-icon-box bg-rose';
    }

    // 3. Peak Hour (Q7)
    const hourCounts = countValues(filteredResponses, 'q7_hour');
    let maxHourVal = 0;
    let peakHour = '--';
    for (const h in hourCounts) {
      if (hourCounts[h] > maxHourVal) {
        maxHourVal = hourCounts[h];
        peakHour = h;
      }
    }
    document.getElementById('kpi-peak-hour').innerText = peakHour;

    // 4. Render Chart.js
    destroyAllCharts();
    buildCharts(filteredResponses, hourCounts);
    
    // 5. Render Lists (Feedbacks)
    renderFeedbacks(filteredResponses);
  }

  function destroyAllCharts() {
    for (const key in charts) {
      if (charts[key]) {
        charts[key].destroy();
      }
    }
    charts = {};
  }

  // Counter helper
  function countValues(arr, key) {
    const counts = {};
    arr.forEach(item => {
      const val = item[key];
      if (val) {
        counts[val] = (counts[val] || 0) + 1;
      }
    });
    return counts;
  }

  // Array elements counter helper
  function countArrayValues(arr, key) {
    const counts = {};
    arr.forEach(item => {
      const vals = item[key];
      if (Array.isArray(vals)) {
        vals.forEach(val => {
          counts[val] = (counts[val] || 0) + 1;
        });
      }
    });
    return counts;
  }

  // Charts builder
  function buildCharts(dataset, hourCounts) {
    // Fonts & styling based on theme variables
    const isDark = !document.body.classList.contains('light-theme');
    const fontColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    Chart.defaults.color = fontColor;
    Chart.defaults.font.family = 'Plus Jakarta Sans, sans-serif';

    // A) Frequency (Pizza/Doughnut)
    const freqCounts = countValues(dataset, 'q2_freq');
    charts.frequency = new Chart(document.getElementById('chart-frequency'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(freqCounts),
        datasets: [{
          data: Object.values(freqCounts),
          backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
        }
      }
    });

    // B) Aspect Ratings (Bar Chart from 1.0 to 5.0)
    let varietySum = 0, varietyCount = 0;
    let priceSum = 0, priceCount = 0;
    let organizationSum = 0, organizationCount = 0;
    let supplySum = 0, supplyCount = 0;
    
    dataset.forEach(r => {
      // Variedade
      if (r.q5_aspect_variety !== undefined && r.q5_aspect_variety !== null && r.q5_aspect_variety !== "") {
        const val = Number(r.q5_aspect_variety);
        if (!isNaN(val)) { varietySum += val; varietyCount++; }
      }
      // Preço
      if (r.q5_aspect_price !== undefined && r.q5_aspect_price !== null && r.q5_aspect_price !== "") {
        const val = Number(r.q5_aspect_price);
        if (!isNaN(val)) { priceSum += val; priceCount++; }
      }
      // Organização
      if (r.q5_aspect_organization !== undefined && r.q5_aspect_organization !== null && r.q5_aspect_organization !== "") {
        const val = Number(r.q5_aspect_organization);
        if (!isNaN(val)) { organizationSum += val; organizationCount++; }
      }
      // Frequência de abastecimento
      if (r.q5_aspect_supply !== undefined && r.q5_aspect_supply !== null && r.q5_aspect_supply !== "") {
        const val = Number(r.q5_aspect_supply);
        if (!isNaN(val)) { supplySum += val; supplyCount++; }
      }
    });
    
    const aspectAverages = [
      varietyCount > 0 ? (varietySum / varietyCount) : 0,
      priceCount > 0 ? (priceSum / priceCount) : 0,
      organizationCount > 0 ? (organizationSum / organizationCount) : 0,
      supplyCount > 0 ? (supplySum / supplyCount) : 0
    ];
    
    charts.prices = new Chart(document.getElementById('chart-prices'), {
      type: 'bar',
      data: {
        labels: ['Variedade', 'Preço', 'Organização', 'Abastecimento'],
        datasets: [{
          label: 'Média de Nota',
          data: aspectAverages,
          backgroundColor: ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { 
            grid: { color: gridColor }, 
            min: 1,
            max: 5,
            ticks: { stepSize: 1, precision: 1 } 
          }
        }
      }
    });

    // C) Favorite Products (Horizontal Bar Chart)
    const favCounts = countArrayValues(dataset, 'q8_favorites');
    
    // Add custom "Others" responses to the count if any
    let otherFavCount = 0;
    dataset.forEach(r => {
      if (r.q8_favorites_other && r.q8_favorites_other.trim() !== '') {
        favCounts[r.q8_favorites_other] = (favCounts[r.q8_favorites_other] || 0) + 1;
        otherFavCount++;
      }
    });
    
    const sortedFavs = Object.entries(favCounts).sort((a,b) => b[1] - a[1]);
    
    charts.supply = new Chart(document.getElementById('chart-supply'), {
      type: 'bar',
      data: {
        labels: sortedFavs.map(x => x[0]),
        datasets: [{
          label: 'Mencionados',
          data: sortedFavs.map(x => x[1]),
          backgroundColor: '#6366f1',
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });

    // D) Wine Type (Doughnut Chart)
    const wineCounts = countValues(dataset, 'q10_wine_type');
    charts.beers = new Chart(document.getElementById('chart-beers'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(wineCounts),
        datasets: [{
          data: Object.values(wineCounts),
          backgroundColor: ['#b91c1c', '#fef08a', '#e11d48', '#fb7185', '#f472b6', '#94a3b8'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
        }
      }
    });

    // E) Wine Bottle Price (Vertical Bar Chart)
    const winePriceCounts = countValues(dataset, 'q11_wine_price');
    const winePriceKeys = ['Até R$20', 'R$20 a R$30', 'R$30 a R$40', 'R$40 a R$50', 'R$50 a R$100', 'Acima de R$100'];
    const winePriceValues = winePriceKeys.map(k => winePriceCounts[k] || 0);
    
    charts.winePrice = new Chart(document.getElementById('chart-wine-price'), {
      type: 'bar',
      data: {
        labels: winePriceKeys,
        datasets: [{
          label: 'Votos',
          data: winePriceValues,
          backgroundColor: ['#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#fb923c', '#e11d48'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: gridColor }, ticks: { precision: 0 } }
        }
      }
    });

    // F) Promo interest (Doughnut)
    const promoCounts = countValues(dataset, 'q12_promo_interest');
    charts.promoInterest = new Chart(document.getElementById('chart-promo-interest'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(promoCounts),
        datasets: [{
          data: Object.values(promoCounts),
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12 } }
        }
      }
    });

    // G) Sectors (Horizontal Bar)
    const sectorCounts = countArrayValues(dataset, 'q3_sectors');
    const sortedSectors = Object.entries(sectorCounts).sort((a,b) => b[1] - a[1]);
    charts.sectors = new Chart(document.getElementById('chart-sectors'), {
      type: 'bar',
      data: {
        labels: sortedSectors.map(x => x[0]),
        datasets: [{
          label: 'Mencionados',
          data: sortedSectors.map(x => x[1]),
          backgroundColor: '#6366f1',
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });

    // H) Fatores de Influência (Doughnut Chart, was Gelados)
    const influenceCounts = countValues(dataset, 'q12_influence_factor');
    charts.coldItems = new Chart(document.getElementById('chart-cold-items'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(influenceCounts),
        datasets: [{
          data: Object.values(influenceCounts),
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
        }
      }
    });
  }

  function renderEmptyCharts() {
    const ctxs = ['chart-frequency', 'chart-prices', 'chart-supply', 'chart-beers', 'chart-wine-price', 'chart-promo-interest', 'chart-sectors', 'chart-cold-items'];
    ctxs.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const ctx = el.getContext('2d');
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhum dado cadastrado para renderizar gráficos.', el.width / 2, el.height / 2);
    });
  }

  // Render Feedbacks lists (Q4, Q9, Q18)
  function renderFeedbacks(dataset) {
    const listLack = document.getElementById('list-lack');
    const listExternal = document.getElementById('list-external');
    const listFeedback = document.getElementById('list-feedback');

    listLack.innerHTML = '';
    listExternal.innerHTML = '';
    listFeedback.innerHTML = '';

    let lackCount = 0;
    let externalCount = 0;
    let feedbackCount = 0;

    // Show newer responses first
    const sortedResponses = [...dataset].reverse();

    sortedResponses.forEach(r => {
      const date = new Date(r.timestamp);
      const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

      // Q4 Lack items
      if (r.q4_lack && r.q4_lack.trim() !== '') {
        const li = document.createElement('li');
        li.innerHTML = `<span class="meta-date">${dateStr}</span><p><strong>[${escapeHTML(r.q1_store)}]</strong> ${escapeHTML(r.q4_lack)}</p>`;
        listLack.appendChild(li);
        lackCount++;
      }

      // Q9 External purchases
      if (r.q9_external && r.q9_external.trim() !== '') {
        const li = document.createElement('li');
        li.innerHTML = `<span class="meta-date">${dateStr}</span><p><strong>[${escapeHTML(r.q1_store)}]</strong> ${escapeHTML(r.q9_external)}</p>`;
        listExternal.appendChild(li);
        externalCount++;
      }

      // Q18 General comments & suggestion (with legacy compatibility check)
      const feedbackText = r.q18_feedback || r.q17_feedback;
      if (feedbackText && feedbackText.trim() !== '') {
        const li = document.createElement('li');
        li.innerHTML = `<span class="meta-date">${dateStr}</span><p><strong>[${escapeHTML(r.q1_store)}]</strong> ${escapeHTML(feedbackText)}</p>`;
        listFeedback.appendChild(li);
        feedbackCount++;
      }
    });

    if (lackCount === 0) listLack.innerHTML = '<li class="no-feedback">Nenhum feedback de produto em falta ainda.</li>';
    if (externalCount === 0) listExternal.innerHTML = '<li class="no-feedback">Nenhum registro de compras externas ainda.</li>';
    if (feedbackCount === 0) listFeedback.innerHTML = '<li class="no-feedback">Nenhuma sugestão enviada ainda.</li>';
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // ==========================================================================
  // INJECT REALISTIC MOCK DATA (FOR IMMEDIATE WOW EFFECT ON DASHBOARD)
  // ==========================================================================

  injectMockBtn.addEventListener('click', () => {
    const mockResponses = generateMockResponses(25);
    responses = responses.concat(mockResponses);
    localStorage.setItem('aero_market_responses', JSON.stringify(responses));
    
    // Rerender dashboard
    renderDashboard();
    
    // Soft notification
    alert('25 Respostas de teste injetadas com sucesso! Veja os novos gráficos.');
  });

  function generateMockResponses(count) {
    const stores = ['Acquarela', 'Barcas', 'CHAS', 'Jardine', 'Serrambi 2', 'Ecoville 1', 'Sun Towers'];
    const freqs = ['Todos os dias', '3 a 5 vezes por semana', '1 a 2 vezes por semana', 'Raramente'];
    const sectors = ['Bebidas', 'Cervejas', 'Sorvetes', 'Congelados', 'Snacks', 'Doces', 'Produtos básicos do dia a dia', 'Higiene/Limpeza'];
    const seeMores = ['Produtos fitness', 'Congelados rápidos', 'Bebidas geladas', 'Cervejas especiais', 'Produtos infantis', 'Café da manhã', 'Doces e chocolates', 'Produtos premium', 'Itens baratos do dia a dia'];
    const hours = ['Manhã', 'Tarde', 'Noite', 'Madrugada'];
    const favoritesList = ['Dindim Gourmet', 'Marmitas congeladas', 'Pastel Dom Coutinho', 'Cacau Show', 'Batata Chips Caipira', 'Barra Whey Ovomaltine', 'Kinder Bueno', 'Pudim no Copo', 'Crepe'];
    const wineTypesList = ['Tinto', 'Branco', 'Espumante Brut', 'Espumante Moscatel', 'Rosé', 'Outro'];
    const winePricesList = ['Até R$20', 'R$20 a R$30', 'R$30 a R$40', 'R$40 a R$50', 'R$50 a R$100', 'Acima de R$100'];
    const promosVal = ['Sim', 'Talvez', 'Não faz diferença'];
    const promoTypes = ['Combo cerveja + snack', 'Desconto progressivo', 'Promoção relâmpago', 'Produtos do dia', 'Combos família', 'Sorvete em promoção'];
    const convenients = ['Sim, muito', 'Sim', 'Mais ou menos', 'Pouco'];
    const influencesList = [
      'A marca e a qualidade do produto',
      'O preço mais baixo, independentemente da marca',
      'A necessidade do momento',
      'Novidades e produtos diferentes disponíveis'
    ];

    const itemsFaltaList = [
      'Pão integral da marca Wickbold', 'Iogurte grego zero lactose', 'Suco de uva integral 1L',
      'Sabão em pó Omo 1kg', 'Cerveja IPA artesanal', 'Refrigerante Coca Zero lata',
      'Queijo coalho para churrasco', 'Chocolate Milka', 'Comida congelada saudável / fit',
      'Leite desnatado Piracanjuba', 'Capsula de café Nespresso', 'Batata palha fina',
      'Hambúrguer bovino premium', 'Sorvete Ben & Jerry’s', 'Energético Monster zero açúcar'
    ];

    const itemsCompradosFora = [
      'Pão francês quentinho', 'Carne fresca / Bife', 'Fralda descartável infantil',
      'Legumes e Verduras frescas', 'Queijo muçarela fatiado', 'Água sanitária de 2 litros',
      'Sorvete de massa pote grande', 'Cerveja Spaten lata mais barata', 'Carvão vegetal bag'
    ];

    const feedbacksList = [
      'A loja é excelente e super conveniente no condomínio. Preço um pouco alto mas aceitável pela comodidade.',
      'Sinto que às vezes no final de semana faltam as cervejas geladas mais vendidas (Heineken e Spaten).',
      'Muito prático! Adoraria se tivesse um terminal de pão francês que reabastecesse de manhã cedo.',
      'Excelente iniciativa da pesquisa. O minimercado é ótimo, mas o preço dos snacks podia ser melhor.',
      'Adoro fazer compras na madrugada quando volto do trabalho. Sempre limpo e iluminado. Parabéns!',
      'Gostaria de ver marcas melhores de vinho na prateleira. Adorei a nova seção de vinhos!',
      'Faltam opções saudáveis e whey pronto gelado na geladeira para quem treina à noite.'
    ];

    const mockDataList = [];

    for (let i = 0; i < count; i++) {
      const q15 = randomNPSScore();
      
      // Random dates in the last 7 days
      const daysAgo = Math.floor(Math.random() * 7);
      const hourOffset = Math.floor(Math.random() * 24);
      const minOffset = Math.floor(Math.random() * 60);
      const respDate = new Date();
      respDate.setDate(respDate.getDate() - daysAgo);
      respDate.setHours(hourOffset, minOffset, 0, 0);

      // Random sets
      const chosenSectors = selectRandomElements(sectors, 1, 4);
      const chosenSeeMore = selectRandomElements(seeMores, 1, 3);
      const chosenFavorites = selectRandomElements(favoritesList, 1, 3);
      const chosenPromoType = selectRandomElements(promoTypes, 1, 2);

      // We'll sometimes include Outros in favorites
      if (Math.random() > 0.8) {
        chosenFavorites.push('Outros');
      }

      mockDataList.push({
        id: 'mock_' + Math.floor(Math.random() * 10000000),
        timestamp: respDate.toISOString(),
        q1_store: randomElement(stores),
        q2_freq: randomElement(freqs),
        q3_sectors: chosenSectors,
        q4_lack: Math.random() > 0.4 ? randomElement(itemsFaltaList) : '',
        
        // Q5 Aspect ratings (3-5 positive bias, 2-4 prices slightly lower)
        q5_aspect_variety: Math.floor(Math.random() * 3) + 3,
        q5_aspect_price: Math.floor(Math.random() * 3) + 2,
        q5_aspect_organization: Math.floor(Math.random() * 2) + 4,
        q5_aspect_supply: Math.floor(Math.random() * 3) + 3,
        
        q6_see_more: chosenSeeMore,
        q7_hour: randomElement(hours),
        
        q8_favorites: chosenFavorites.filter(x => x !== 'Outros'),
        q8_favorites_other: chosenFavorites.includes('Outros') ? 'Dindim sabor Coco Queimado' : '',
        
        q9_external: Math.random() > 0.5 ? randomElement(itemsCompradosFora) : '',
        q10_wine_type: randomElement(wineTypesList),
        q11_wine_price: randomElement(winePricesList),
        q12_promo_interest: randomElement(promosVal),
        q13_promo_type: chosenPromoType,
        q14_convenient: randomElement(convenients),
        q15_rating: q15,
        q16_nps_recommend: q15 >= 8 ? 'Sim' : (q15 >= 6 ? 'Talvez' : 'Não'),
        q12_influence_factor: randomElement(influencesList),
        q18_feedback: Math.random() > 0.65 ? randomElement(feedbacksList) : ''
      });
    }

    return mockDataList;
  }

  // Weight random score to simulate a positive bias condominium market (majority 7-10 scores)
  function randomNPSScore() {
    const rand = Math.random();
    if (rand < 0.35) return 10;
    if (rand < 0.65) return 9;
    if (rand < 0.82) return 8;
    if (rand < 0.92) return 7;
    if (rand < 0.96) return 6;
    return Math.floor(Math.random() * 6); // 0 to 5
  }

  function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function selectRandomElements(arr, min, max) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    return shuffled.slice(0, count);
  }

  // ==========================================================================
  // EXPORT EXCEL DATA (CSV GENERATOR WITH BOM SUPPORT)
  // ==========================================================================

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (responses.length === 0) {
        alert('Nenhum dado para exportar.');
        return;
      }

      const headers = [
        'ID da Resposta', 'Data e Hora', 'Loja', 'Frequência de Visita', 'Setores Mais Utilizados',
        'O que mais sente falta', 'Avaliação - Variedade', 'Avaliação - Preço', 
        'Avaliação - Organização', 'Avaliação - Abastecimento', 'Deseja ver mais de',
        'Horário que mais compra', 'Produtos Favoritos', 'Produtos Favoritos (Outros)',
        'Compra fora do condomínio', 'Tipo de Vinho mais consumido', 'Preço médio do Vinho',
        'Compraria com Promoções', 'Promoções que chamam atenção',
        'Conveniente para saídas rápidas', 'Nota do Minimercado (0-10)', 'Indicaria para outros condomínios',
        'O que mais influencia a escolha', 'Sugestões Livres de Melhoria'
      ];

      const rows = responses.map(r => [
        r.id,
        new Date(r.timestamp).toLocaleString('pt-BR'),
        r.q1_store || '',
        r.q2_freq || '',
        (r.q3_sectors || []).join('; '),
        r.q4_lack || '',
        r.q5_aspect_variety !== undefined ? r.q5_aspect_variety : '',
        r.q5_aspect_price !== undefined ? r.q5_aspect_price : '',
        r.q5_aspect_organization !== undefined ? r.q5_aspect_organization : '',
        r.q5_aspect_supply !== undefined ? r.q5_aspect_supply : '',
        (r.q6_see_more || []).join('; '),
        r.q7_hour || '',
        (r.q8_favorites || []).join('; '),
        r.q8_favorites_other || '',
        r.q9_external || '',
        r.q10_wine_type || '',
        r.q11_wine_price || '',
        r.q12_promo_interest || '',
        (r.q13_promo_type || []).join('; '),
        r.q14_convenient || '',
        r.q15_rating !== undefined ? r.q15_rating : '',
        r.q16_nps_recommend || '',
        r.q12_influence_factor || '',
        r.q18_feedback || r.q17_feedback || ''
      ]);

      // CSV format assembly (semi-colon separated for Brazilian Excel standard compatibility)
      let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\r\n';
      
      rows.forEach(row => {
        csvContent += row.map(val => {
          const textVal = String(val);
          return `"${textVal.replace(/"/g, '""')}"`;
        }).join(';') + '\r\n';
      });

      // Add UTF-8 BOM to ensure accents show up properly in Brazilian Excel
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `pesquisa_aero_market_24h_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // ==========================================================================
  // CLEAR DATABASE
  // ==========================================================================

  if (clearDbBtn) {
    clearDbBtn.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja apagar permanentemente todas as respostas coletadas do sistema? Essa ação não pode ser desfeita.')) {
        responses = [];
        localStorage.removeItem('aero_market_responses');
        renderDashboard();
        alert('Banco de dados zerado com sucesso.');
      }
    });
  }

  // ==========================================================================
  // THEME SWITCH TOGGLE LOGIC
  // ==========================================================================

  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('aero_market_theme', 'dark');
      updateThemeIcon('dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('aero_market_theme', 'light');
      updateThemeIcon('light');
    }
    
    // Redraw charts if we are in admin view (since grid colors might change)
    if (!adminView.classList.contains('view-hidden')) {
      renderDashboard();
    }
  });

  function updateThemeIcon(mode) {
    const iconContainer = themeToggleBtn;
    if (mode === 'light') {
      iconContainer.innerHTML = '<i data-lucide="moon"></i>';
    } else {
      iconContainer.innerHTML = '<i data-lucide="sun"></i>';
    }
    safeCreateIcons();
  }

  // ==========================================================================
  // GOOGLE WEBHOOK CONFIGURATION HANDLERS
  // ==========================================================================
  const configHeaderToggle = document.getElementById('config-header-toggle');
  const configContentBody = document.getElementById('config-content-body');
  const configChevronIcon = document.getElementById('config-chevron-icon');
  const webhookUrlInput = document.getElementById('webhook-url-input');
  const saveWebhookBtn = document.getElementById('save-webhook-btn');
  const testWebhookBtn = document.getElementById('test-webhook-btn');
  const webhookStatusMsg = document.getElementById('webhook-status-msg');

  // Toggle Collapse config card
  configHeaderToggle.addEventListener('click', () => {
    configContentBody.classList.toggle('collapsed');
    configChevronIcon.classList.toggle('open');
  });

  // Load URL on admin page load
  function loadWebhookUrl() {
    let url = DEFAULT_WEBHOOK_URL;
    try {
      url = localStorage.getItem('aero_market_webhook_url') || DEFAULT_WEBHOOK_URL;
    } catch (err) {
      console.error(err);
    }
    webhookUrlInput.value = url;
  }

  saveWebhookBtn.addEventListener('click', () => {
    const url = webhookUrlInput.value.trim();
    if (url === '') {
      localStorage.removeItem('aero_market_webhook_url');
      showStatus('URL da planilha removida.', 'success');
    } else if (url.startsWith('https://script.google.com/')) {
      localStorage.setItem('aero_market_webhook_url', url);
      showStatus('URL do Google Sheets salva com sucesso!', 'success');
    } else {
      showStatus('URL inválida. Deve iniciar com https://script.google.com/', 'error');
    }
  });

  testWebhookBtn.addEventListener('click', () => {
    const url = localStorage.getItem('aero_market_webhook_url') || DEFAULT_WEBHOOK_URL;
    if (!url) {
      showStatus('Por favor, salve uma URL antes de testar a conexão.', 'error');
      return;
    }

    showStatus('Enviando dados de teste...', 'info');

    const testPayload = {
      id: 'test_connection',
      timestamp: new Date().toISOString(),
      q1_store: 'Jardine',
      q2_freq: 'Todos os dias',
      q3_sectors: ['Bebidas', 'Cervejas'],
      q4_lack: 'PRODUTO TESTE DE CONEXÃO',
      q5_aspect_variety: 5,
      q5_aspect_price: 4,
      q5_aspect_organization: 5,
      q5_aspect_supply: 4,
      q6_see_more: ['Produtos fitness'],
      q7_hour: 'Noite',
      q8_favorites: ['Dindim Gourmet', 'Cacau Show'],
      q8_favorites_other: 'Outro doce',
      q9_external: 'Item de teste',
      q10_wine_type: 'Tinto',
      q11_wine_price: 'R$30 a R$40',
      q12_promo_interest: 'Sim',
      q13_promo_type: ['Desconto progressivo'],
      q14_convenient: 'Sim, muito',
      q15_rating: 10,
      q16_nps_recommend: 'Sim',
      q17_cold_items: ['Água'],
      q18_feedback: 'Teste de conexão efetuado com sucesso a partir do painel admin.'
    };

    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    })
    .then(() => {
      showStatus('Conexão testada! Verifique se uma nova linha foi adicionada na sua planilha.', 'success');
    })
    .catch(err => {
      showStatus('Erro na requisição. Verifique a URL e as permissões de acesso do script.', 'error');
      console.error(err);
    });
  });

  function showStatus(msg, type) {
    webhookStatusMsg.innerText = msg;
    webhookStatusMsg.className = `webhook-status status-${type}`;
    webhookStatusMsg.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
      webhookStatusMsg.style.display = 'none';
    }, 5000);
  }

  // ==========================================================================
  // ADMIN TAB BUTTONS INTERACTION
  // ==========================================================================
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');

      // Hide all tab contents
      const targetId = btn.getAttribute('data-target');
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });

      // Show targeted tab content
      document.getElementById(targetId).classList.add('active');
    });
  });

  // ==========================================================================
  // EVENT LISTENERS FOR THE GENERAL WORKFLOW
  // ==========================================================================

  startSurveyBtn.addEventListener('click', () => {
    currentStep = 1;
    showStep(currentStep);
  });

  restartFormBtn.addEventListener('click', () => {
    resetFormFields();
  });

  prevBtn.addEventListener('click', prevStep);
  nextBtn.addEventListener('click', nextStep);

  // Store Filter Select Handler
  document.getElementById('store-filter-select').addEventListener('change', () => {
    renderDashboard();
  });

  // Initial render
  showStep(currentStep);
});

// GLOBAL HELPER: Search filter for Admin tabs text responses
window.filterList = function(listId, filterText) {
  const list = document.getElementById(listId);
  const items = list.getElementsByTagName('li');
  const text = filterText.toLowerCase();

  for (let i = 0; i < items.length; i++) {
    if (items[i].classList.contains('no-feedback')) continue;
    const content = items[i].getElementsByTagName('p')[0].innerText.toLowerCase();
    if (content.indexOf(text) > -1) {
      items[i].style.display = '';
    } else {
      items[i].style.display = 'none';
    }
  }
};

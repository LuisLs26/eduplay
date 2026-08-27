document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyCqbEQWT_m9U7fH2ynRV9ZzFSz_W-gMOJg",
        authDomain: "eduplay-a7679.firebaseapp.com",
        projectId: "eduplay-a7679",
        storageBucket: "eduplay-a7679.firebasestorage.app",
        messagingSenderId: "778803522493",
        appId: "1:778803522493:web:5a12641d39ae1475e3c0d4",
        measurementId: "G-V2RKYBMGRQ"
    };

    // Solo inicializar si no se ha inicializado ya (buena práctica)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }


    const db = firebase.firestore();
    try {
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code !== 'unimplemented' && err.code !== 'failed-precondition') {
                console.warn("Firestore persistence warning:", err.code);
            }
        });
    } catch (e) {}
    const auth = firebase.auth();

    // Flag para evitar que checkUrlParams se ejecute más de una vez
    let urlParamsChecked = false;

    // Función para comprimir imágenes y evitar exceder límite de Firestore
    function compressImage(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_DIM = 800; // Máximo 800px para mantener tamaño bajo
                if (width > height) {
                    if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
                } else {
                    if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.6)); // Compresión a JPEG 60%
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');
    const createForm = document.getElementById('create-form');
    const activitiesContainer = document.getElementById('activities-container');
    const typeInput = document.getElementById('activity-type');

    // UI elements for the form
    const questionsContainer = document.getElementById('questions-container');
    const btnAddQuestion = document.getElementById('btn-add-question');

    // New UI elements
    const btnBackToTypes = document.getElementById('btn-back-to-types');
    const btnSaveActivity = document.getElementById('btn-save-activity');
    const btnSaveMobile = document.getElementById('btn-save-mobile');
    const editingActivityId = document.getElementById('editing-activity-id');
    const activityDescription = document.getElementById('activity-description');
    const livePreviewPanel = document.getElementById('live-preview-panel');
    const livePreviewQuestion = document.getElementById('live-preview-question');
    const livePreviewOptions = document.getElementById('live-preview-options');
    const livePreviewCounter = document.getElementById('live-preview-counter');
    const titleCounter = document.getElementById('title-counter');
    const descCounter = document.getElementById('desc-counter');
    const editorTypeIcon = document.getElementById('editor-type-icon');
    const editorTypeTitle = document.getElementById('editor-type-title');
    const editorTypeDesc = document.getElementById('editor-type-desc');

    // UI elements for preview (card de inicio antes del overlay)
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const gameContainer = document.getElementById('game-container');
    const startScreen = document.getElementById('start-screen');
    const startTitle = document.getElementById('start-title');
    const startType = document.getElementById('start-type');
    const btnStartPlay = document.getElementById('btn-start-play');

    const gameMainTitle = document.getElementById('game-main-title');
    const gameMainSubtitle = document.getElementById('game-main-subtitle');
    const shareButtonsContainer = document.getElementById('share-buttons-container');
    const btnCopyLink = document.getElementById('btn-copy-link');
    const btnWhatsappShare = document.getElementById('btn-whatsapp-share');
    const toastNotification = document.getElementById('toast-notification');

    // Helper para notificaciones flotantes con control de timeout
    let toastTimeout = null;
    function showToast(msg, duration = 3000) {
        if (!toastNotification) return;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastNotification.textContent = msg;
        toastNotification.classList.add('show');
        toastTimeout = setTimeout(() => {
            toastNotification.classList.remove('show');
            toastTimeout = null;
        }, duration);
    }

    // Helper para normalizar caracteres y acentos en juegos
    function normalizeChar(ch) {
        if (!ch) return '';
        return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    }

    // --- Web Audio API: Sonidos Sintetizados Nativos (0 dependencias) ---
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1, startTime = 0) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
            gain.gain.setValueAtTime(gainVal, ctx.currentTime + startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + duration);
        } catch (e) {}
    }

    function playCorrectSound() {
        playTone(523.25, 'sine', 0.12, 0.1, 0);       // C5
        playTone(659.25, 'sine', 0.12, 0.1, 0.08);    // E5
        playTone(783.99, 'sine', 0.22, 0.12, 0.16);   // G5
    }

    function playIncorrectSound() {
        playTone(220, 'triangle', 0.18, 0.12, 0);
        playTone(185, 'triangle', 0.22, 0.1, 0.07);
    }

    function playSnapSound() {
        playTone(880, 'square', 0.04, 0.06, 0);
    }

    function playVictorySound() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            playTone(freq, 'triangle', 0.22, 0.12, idx * 0.09);
        });
    }

    // Animación de puntos rodantes con Anime.js y destello elástico
    function animateScoreIncrease(newScore) {
        if (!overlayScoreDisp) return;
        const currentVal = score;
        score = newScore;
        if (typeof anime !== 'undefined') {
            const countObj = { val: currentVal };
            anime({
                targets: countObj,
                val: newScore,
                round: 1,
                duration: 550,
                easing: 'easeOutExpo',
                update: function() {
                    overlayScoreDisp.textContent = `Puntos: ${countObj.val}`;
                }
            });
            anime({
                targets: overlayScoreDisp,
                scale: [1, 1.2, 1],
                duration: 380,
                easing: 'cubicBezier(0.34, 1.56, 0.64, 1)'
            });
        } else {
            overlayScoreDisp.textContent = `Puntos: ${newScore}`;
        }
    }

    // --- Efecto Confeti (con soporte canvas-confetti o fallback Canvas 2D nativo) ---
    function triggerConfetti() {
        if (typeof window.confetti === 'function') {
            window.confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
            setTimeout(() => {
                window.confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 }
                });
                window.confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 }
                });
            }, 250);
            return;
        }

        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        canvas.style.display = 'block';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const colors = ['#6C5CE7', '#818CF8', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#3B82F6'];
        const particles = [];
        const count = 75;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * 50,
                w: 8 + Math.random() * 8,
                h: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 4,
                vy: 3 + Math.random() * 4,
                rot: Math.random() * 360,
                vrot: (Math.random() - 0.5) * 10
            });
        }

        let animationFrame = null;
        let startTime = Date.now();

        function render() {
            const elapsed = Date.now() - startTime;
            if (elapsed > 3200) {
                canvas.style.display = 'none';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vrot;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rot * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            animationFrame = requestAnimationFrame(render);
        }

        render();
    }

    // --- OVERLAY refs --------------------------------------------------
    const gameOverlay        = document.getElementById('game-overlay');
    const overlayBar         = document.querySelector('.game-overlay-bar');
    const overlayProgressBar = document.getElementById('overlay-progress-bar');
    const overlayQCounter    = document.getElementById('overlay-question-counter');
    const overlayScoreDisp   = document.getElementById('overlay-score-display');
    const btnExitGame        = document.getElementById('btn-exit-game');

    const overlayStartScreen = document.getElementById('overlay-start-screen');
    const overlayStartType   = document.getElementById('overlay-start-type');
    const overlayStartTitle  = document.getElementById('overlay-start-title');
    const btnOverlayPlay     = document.getElementById('btn-overlay-play');

    const overlayGameBody    = document.getElementById('overlay-game-body');
    const overlayQuestionCard = document.getElementById('overlay-question-card');
    const overlayQMedia      = document.getElementById('overlay-question-media');
    const overlayGameImage   = document.getElementById('overlay-game-image');
    const overlayQText       = document.getElementById('overlay-question-text');
    const overlayOptionsGrid = document.getElementById('overlay-options-grid');
    const overlayMatchGrid   = document.getElementById('overlay-match-grid');
    const overlayMatchLeft   = document.getElementById('overlay-match-col-left');
    const overlayMatchRight  = document.getElementById('overlay-match-col-right');
    const overlayPuzzleWrap  = document.getElementById('overlay-puzzle-wrap');
    const overlayPuzzleGrid  = document.getElementById('overlay-puzzle-grid');
    const overlayFeedback    = document.getElementById('overlay-game-feedback');
    const overlayFeedbackTxt = document.getElementById('overlay-feedback-text');
    const overlayBtnNext     = document.getElementById('overlay-btn-next');

    const overlayFloatingFeedback = document.getElementById('overlay-floating-feedback');
    const feedbackBadge           = document.getElementById('feedback-badge');
    const feedbackIcon            = document.getElementById('feedback-icon');
    const feedbackMsg             = document.getElementById('feedback-msg');
    const overlayAccuracyPercent  = document.getElementById('overlay-accuracy-percent');
    const resultsHeadline         = document.getElementById('results-headline');
    const resultsSubtitle         = document.getElementById('results-subtitle');

    const questionsSectionTitle   = document.getElementById('questions-section-title');
    const btnAddQuestionText      = document.getElementById('btn-add-question-text');

    const overlayResults     = document.getElementById('overlay-results');
    const overlayFinalScore  = document.getElementById('overlay-final-score');
    const overlayTotalScore  = document.getElementById('overlay-total-score');
    const overlayBtnRestart  = document.getElementById('overlay-btn-restart');
    const overlayBtnExitRes  = document.getElementById('overlay-btn-exit-results');

    // Carga inmediata de enlace compartido sin esperar a Firebase Auth
    if (window.location.search.includes('id=') && !urlParamsChecked) {
        urlParamsChecked = true;
        checkUrlParams();
    }

    let feedbackTimeout = null;
    function showFloatingFeedback(isCorrect, msg, duration = 1200) {
        if (!overlayFloatingFeedback || !feedbackBadge) return;
        if (feedbackTimeout) clearTimeout(feedbackTimeout);

        feedbackBadge.className = 'feedback-badge ' + (isCorrect ? 'correct' : 'incorrect');
        if (feedbackIcon) feedbackIcon.textContent = isCorrect ? '✓' : '✕';
        if (feedbackMsg)  feedbackMsg.textContent  = msg || (isCorrect ? '¡Correcto!' : '¡Incorrecto!');

        overlayFloatingFeedback.style.display = 'block';
        void overlayFloatingFeedback.offsetWidth;
        overlayFloatingFeedback.classList.add('show');

        feedbackTimeout = setTimeout(() => {
            overlayFloatingFeedback.classList.remove('show');
            setTimeout(() => {
                overlayFloatingFeedback.style.display = 'none';
            }, 250);
        }, duration);
    }

    // Referencias para peek modal de rompecabezas
    const btnPeekPuzzle      = document.getElementById('btn-peek-puzzle-img');
    const puzzlePeekModal    = document.getElementById('puzzle-peek-modal');
    const btnClosePeek       = document.getElementById('btn-close-peek-modal');
    const puzzlePeekBackdrop = document.getElementById('puzzle-peek-backdrop');
    const puzzlePeekImg      = document.getElementById('puzzle-peek-img');

    if (btnPeekPuzzle && puzzlePeekModal) {
        btnPeekPuzzle.addEventListener('click', () => {
            if (currentActivity && currentActivity.puzzleImage && puzzlePeekImg) {
                puzzlePeekImg.src = currentActivity.puzzleImage;
                puzzlePeekModal.style.display = 'flex';
            }
        });
    }
    if (btnClosePeek && puzzlePeekModal) {
        btnClosePeek.addEventListener('click', () => {
            puzzlePeekModal.style.display = 'none';
        });
    }
    if (puzzlePeekBackdrop && puzzlePeekModal) {
        puzzlePeekBackdrop.addEventListener('click', () => {
            puzzlePeekModal.style.display = 'none';
        });
    }

    // Alias para que el código de hangman/match pueda seguir usando estos nombres
    const questionCounter = overlayQCounter;
    const scoreDisplay    = overlayScoreDisp;
    const gameContentArea = overlayGameBody;
    const questionMedia   = overlayQMedia;
    const gameImage       = overlayGameImage;
    const questionText    = overlayQText;
    const optionsGrid     = overlayOptionsGrid;
    const matchGrid       = overlayMatchGrid;
    const matchColLeft    = overlayMatchLeft;
    const matchColRight   = overlayMatchRight;
    const gameFeedback    = overlayFeedback;
    const feedbackText    = overlayFeedbackTxt;
    const btnNextQuestion = overlayBtnNext;
    const finalScoreText  = overlayFinalScore;
    const totalScoreText  = overlayTotalScore;
    const btnRestartGame  = overlayBtnRestart;

    // Game state
    let currentActivity = null;
    let currentQuestionIndex = 0;
    let score = 0;
    let isAnswered = false;

    let currentImageTarget = null;

    // Match Game state
    let matchSelectedLeft = null;
    let matchSelectedRight = null;
    let matchedPairsCount = 0;

    // Hangman state
    let hangmanWord = '';
    let hangmanGuessed = new Set();
    let hangmanMistakes = 0;
    let hangmanKeyboardPool = [];

    // Auth UI refs
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    // 0. Navegación
    function navigateTo(targetId, pushHistory = true) {
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) view.classList.add('active');
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.target === targetId) link.classList.add('active');
            if (targetId === 'edit-view' && link.dataset.target === 'create-view') link.classList.add('active');
        });
        if (livePreviewPanel) {
            if (targetId === 'edit-view') livePreviewPanel.classList.add('visible');
            else livePreviewPanel.classList.remove('visible');
        }
        if (btnSaveActivity) btnSaveActivity.style.display = targetId === 'edit-view' ? 'flex' : 'none';
        if (btnBackToTypes)  btnBackToTypes.style.display  = targetId === 'edit-view' ? 'flex' : 'none';
        // Reset la card de inicio si salimos de preview
        if (targetId !== 'preview-view') {
            if (gameContainer)      gameContainer.style.display = 'none';
            if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
        }
        document.body.classList.toggle('in-editor', targetId === 'edit-view');
        window.scrollTo(0, 0);

        if (pushHistory) {
            history.pushState({ view: targetId }, '', window.location.pathname + window.location.search);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            if (targetId) navigateTo(targetId);
        });
    });

    // Type card selection
    const typeIconsSVG = {
        'Opción múltiple': '<svg width="52" height="52" viewBox="0 0 60 60" fill="none"><rect x="6" y="6" width="22" height="22" rx="7" fill="#6366F1"/><rect x="32" y="6" width="22" height="22" rx="7" fill="#818CF8"/><rect x="6" y="32" width="22" height="22" rx="7" fill="#818CF8"/><rect x="32" y="32" width="22" height="22" rx="7" fill="#A5B4FC"/><text x="17" y="21" fill="white" font-size="12" font-weight="900" text-anchor="middle" font-family="sans-serif">A</text><text x="43" y="21" fill="white" font-size="12" font-weight="900" text-anchor="middle" font-family="sans-serif">B</text><text x="17" y="47" fill="white" font-size="12" font-weight="900" text-anchor="middle" font-family="sans-serif">C</text><text x="43" y="47" fill="white" font-size="12" font-weight="900" text-anchor="middle" font-family="sans-serif">D</text></svg>',
        'Verdadero/Falso': '<svg width="52" height="52" viewBox="0 0 60 60" fill="none"><circle cx="21" cy="30" r="17" fill="#10B981"/><path d="M14 30 L19 35 L28 24" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="41" cy="30" r="15" fill="#EF4444"/><path d="M35 24 L47 36 M47 24 L35 36" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>',
        'Emparejar': '<svg width="52" height="52" viewBox="0 0 60 60" fill="none"><rect x="5" y="10" width="18" height="16" rx="6" fill="#F59E0B"/><rect x="37" y="10" width="18" height="16" rx="6" fill="#6366F1"/><path d="M23 18 C30 18, 30 42, 37 42" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/><rect x="5" y="34" width="18" height="16" rx="6" fill="#818CF8"/><rect x="37" y="34" width="18" height="16" rx="6" fill="#FBBF24"/><path d="M23 42 C30 42, 30 18, 37 18" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 3"/></svg>',
        'Ahorcado': '<svg width="52" height="52" viewBox="0 0 60 60" fill="none"><rect x="8" y="10" width="44" height="42" rx="10" fill="#F43F5E"/><path d="M16 42 L24 42 M20 42 L20 20 L30 20 L30 24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="27" r="3" stroke="white" stroke-width="2"/><rect x="27" y="34" width="9" height="11" rx="3" fill="white"/><rect x="38" y="34" width="9" height="11" rx="3" fill="white"/><text x="31.5" y="42.5" fill="#E11D48" font-size="8" font-weight="900" text-anchor="middle" font-family="sans-serif">A</text><text x="42.5" y="42.5" fill="#E11D48" font-size="8" font-weight="900" text-anchor="middle" font-family="sans-serif">B</text></svg>',
        'Rompecabezas': '<svg width="52" height="52" viewBox="0 0 60 60" fill="none"><path d="M12 12 H28 C28 16 32 16 32 12 H48 V28 C44 28 44 32 48 32 V48 H32 C32 44 28 44 28 48 H12 V32 C16 32 16 28 12 28 Z" fill="#06B6D4"/><path d="M28 20 C28 24 32 24 32 20" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'
    };
    const typeDescs = {
        'Opción múltiple': 'Crea preguntas con varias alternativas de respuesta.',
        'Verdadero/Falso': 'El estudiante decide si la afirmación es verdadera o falsa.',
        'Emparejar': 'Relaciona elementos de una columna con otra.',
        'Ahorcado': 'Adivina la palabra oculta letra por letra.',
        'Rompecabezas': 'Ordena las piezas de una imagen para ganar.'
    };

    function updateEditorTypeHeader(type) {
        if (editorTypeIcon) editorTypeIcon.innerHTML = typeIconsSVG[type] || '';
        if (editorTypeTitle) editorTypeTitle.textContent = type === 'Verdadero/Falso' ? 'Verdadero o falso' : type === 'Emparejar' ? 'Emparejar elementos' : type;
        if (editorTypeDesc) editorTypeDesc.textContent = typeDescs[type] || '';

        if (questionsSectionTitle) {
            if (type === 'Emparejar') {
                questionsSectionTitle.textContent = 'Parejas de elementos';
            } else if (type === 'Ahorcado') {
                questionsSectionTitle.textContent = 'Palabras y Pistas';
            } else if (type === 'Verdadero/Falso') {
                questionsSectionTitle.textContent = 'Afirmaciones';
            } else {
                questionsSectionTitle.textContent = 'Preguntas y Respuestas';
            }
        }

        if (btnAddQuestionText) {
            if (type === 'Emparejar') {
                btnAddQuestionText.textContent = 'Agregar otra pareja';
            } else if (type === 'Ahorcado') {
                btnAddQuestionText.textContent = 'Agregar otra palabra';
            } else if (type === 'Verdadero/Falso') {
                btnAddQuestionText.textContent = 'Agregar otra afirmación';
            } else {
                btnAddQuestionText.textContent = 'Agregar otra pregunta';
            }
        }
    }

    function switchToActivityType(type, addDefaultBlock = false) {
        document.querySelectorAll('.type-card').forEach(c => {
            if (c.dataset.type === type) c.classList.add('selected');
            else c.classList.remove('selected');
        });
        if (typeInput) typeInput.value = type;
        if (editingActivityId) editingActivityId.value = '';
        updateEditorTypeHeader(type);
        if (questionsContainer) questionsContainer.innerHTML = '';
        questionCount = 0;

        const puzzleSection = document.getElementById('puzzle-config-section');
        const questionsSection = document.getElementById('questions-section');
        const btnAiEditor = document.getElementById('btn-open-ai-modal-editor');
        if (type === 'Rompecabezas') {
            if (questionsSection) questionsSection.style.display = 'none';
            if (puzzleSection) puzzleSection.style.display = 'block';
            if (btnAiEditor) btnAiEditor.style.display = 'none';
            const diffEl = document.getElementById('puzzle-difficulty');
            if (diffEl) diffEl.value = '3';
        } else {
            if (puzzleSection) puzzleSection.style.display = 'none';
            if (questionsSection) questionsSection.style.display = 'block';
            if (btnAiEditor) btnAiEditor.style.display = 'inline-flex';
            if (addDefaultBlock) addQuestionBlock();
        }

        navigateTo('edit-view');
        updateLivePreview();
    }

    document.querySelectorAll('.type-card').forEach(card => {
        const btn = card.querySelector('.btn-select-type');
        function selectType() {
            const type = card.dataset.type;
            if (document.getElementById('activity-title')) document.getElementById('activity-title').value = '';
            if (activityDescription) activityDescription.value = '';
            switchToActivityType(type, true);
        }
        if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); selectType(); });
        card.addEventListener('click', selectType);
    });

    // --- AI Generator Modal & Engine (Asistente Inteligente Rápido) ---
    const aiModal             = document.getElementById('ai-generator-modal');
    const aiModalBackdrop     = document.getElementById('ai-modal-backdrop');
    const btnOpenAiModalEditor= document.getElementById('btn-open-ai-modal-editor');
    const btnCloseAiModal     = document.getElementById('btn-close-ai-modal');
    const btnCancelAi         = document.getElementById('btn-cancel-ai');
    const btnGenerateAiAction = document.getElementById('btn-generate-ai-action');
    const aiActivityType      = document.getElementById('ai-activity-type');
    const aiTopicInput        = document.getElementById('ai-topic-input');
    const aiCountSelect       = document.getElementById('ai-count-select');
    const aiTypeLabel         = document.getElementById('ai-type-label');
    const aiLoadingState      = document.getElementById('ai-loading-state');

    function openAiModal() {
        if (!aiModal) return;
        if (typeInput && typeInput.value) {
            if (aiActivityType) aiActivityType.value = typeInput.value;
            if (aiTypeLabel) aiTypeLabel.textContent = typeInput.value;
        }
        if (aiLoadingState) aiLoadingState.style.display = 'none';
        if (btnGenerateAiAction) btnGenerateAiAction.disabled = false;
        aiModal.style.display = 'flex';
        if (aiTopicInput) {
            aiTopicInput.focus();
        }
    }

    function closeAiModal() {
        if (!aiModal) return;
        aiModal.style.display = 'none';
        if (aiLoadingState) aiLoadingState.style.display = 'none';
        if (btnGenerateAiAction) btnGenerateAiAction.disabled = false;
    }


    if (btnOpenAiModalEditor) btnOpenAiModalEditor.addEventListener('click', openAiModal);
    if (btnCloseAiModal)      btnCloseAiModal.addEventListener('click', closeAiModal);
    if (btnCancelAi)          btnCancelAi.addEventListener('click', closeAiModal);
    if (aiModalBackdrop)      aiModalBackdrop.addEventListener('click', closeAiModal);

    // Mezclador de opciones para que la respuesta correcta nunca quede fija en "A"
    function shuffleMultipleChoice(qList) {
        return qList.map(q => {
            if (!Array.isArray(q.options) || q.options.length < 2) return q;
            const correctText = q.options[q.correctIndex !== undefined ? q.correctIndex : 0];
            const shuffled = [...q.options].sort(() => Math.random() - 0.5);
            const newIndex = shuffled.indexOf(correctText);
            return {
                text: q.text,
                options: shuffled,
                correctIndex: newIndex >= 0 ? newIndex : 0
            };
        });
    }

    // Motor de Generación con Preguntas Fáciles, Claras y Naturales
    function generateSmartCurriculum(type, topic, count) {
        const cleanTopic = topic.trim();
        const capitalizedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
        const title = capitalizedTopic;
        const description = `Aprende y repasa sobre ${cleanTopic}.`;

        const tLower = cleanTopic.toLowerCase();
        let questions = [];

        // Detección de Temas con preguntas sencillas
        if (tLower.includes('solar') || tLower.includes('planeta') || tLower.includes('espacio') || tLower.includes('universo') || tLower.includes('estrella')) {
            if (type === 'Opción múltiple') {
                questions = shuffleMultipleChoice([
                    { text: "¿Cuál es la estrella en el centro de nuestro sistema solar?", options: ["El Sol", "La Luna", "Marte", "Júpiter"], correctIndex: 0 },
                    { text: "¿Cuál es conocido como el 'Planeta Rojo'?", options: ["Marte", "Venus", "Saturno", "Mercurio"], correctIndex: 0 },
                    { text: "¿En qué planeta vivimos?", options: ["Tierra", "Júpiter", "Neptuno", "Venus"], correctIndex: 0 },
                    { text: "¿Cuál es el planeta más grande de todos?", options: ["Júpiter", "Tierra", "Marte", "Mercurio"], correctIndex: 0 },
                    { text: "¿Qué planeta tiene anillos famosos a su alrededor?", options: ["Saturno", "Mercurio", "Venus", "Marte"], correctIndex: 0 },
                    { text: "¿Qué vemos brillando en el cielo durante la noche?", options: ["La Luna y las estrellas", "El Sol", "El arcoíris", "Las nubes de lluvia"], correctIndex: 0 }
                ]);
            } else if (type === 'Verdadero/Falso') {
                questions = [
                    { text: "El Sol es una estrella que nos da luz y calor.", correctIndex: 0 },
                    { text: "La Tierra es el planeta más grande del sistema solar.", correctIndex: 1 },
                    { text: "La Luna gira alrededor de la Tierra.", correctIndex: 0 },
                    { text: "Marte es llamado el planeta rojo.", correctIndex: 0 },
                    { text: "Todos los planetas están hechos de agua.", correctIndex: 1 },
                    { text: "Saturno tiene anillos a su alrededor.", correctIndex: 0 }
                ];
            } else if (type === 'Emparejar') {
                questions = [
                    { leftText: "Sol", rightText: "Estrella que da luz y calor" },
                    { leftText: "Tierra", rightText: "Planeta donde vivimos" },
                    { leftText: "Marte", rightText: "Planeta rojo" },
                    { leftText: "Saturno", rightText: "Planeta con anillos" },
                    { leftText: "Luna", rightText: "Satélite natural de la noche" },
                    { leftText: "Júpiter", rightText: "El planeta más grande" }
                ];
            } else if (type === 'Ahorcado') {
                questions = [
                    { word: "SOL", hint: "Estrella en el centro del sistema solar" },
                    { word: "TIERRA", hint: "El planeta donde vivimos" },
                    { word: "MARTE", hint: "El planeta rojo" },
                    { word: "LUNA", hint: "Satélite que vemos de noche" },
                    { word: "JUPITER", hint: "El planeta más grande" },
                    { word: "SATURNO", hint: "Famoso por sus anillos" }
                ];
            }
        } else if (tLower.includes('animal') || tLower.includes('selva') || tLower.includes('granja') || tLower.includes('mamifero') || tLower.includes('perro') || tLower.includes('gato')) {
            if (type === 'Opción múltiple') {
                questions = shuffleMultipleChoice([
                    { text: "¿Qué animal es conocido como el rey de la selva?", options: ["El León", "El Elefante", "El Mono", "La Jirafa"], correctIndex: 0 },
                    { text: "¿Qué animal produce leche en la granja?", options: ["La Vaca", "El Perro", "El Pájaro", "El Gato"], correctIndex: 0 },
                    { text: "¿Cuál de estos animales puede volar en el cielo?", options: ["El Águila", "El Tigre", "El Cocodrilo", "El Perro"], correctIndex: 0 },
                    { text: "¿Dónde viven los peces?", options: ["En el agua", "En los árboles", "En el desierto", "En las casas"], correctIndex: 0 },
                    { text: "¿Qué animal tiene una trompa muy larga?", options: ["El Elefante", "El Caballo", "El Ratón", "La Oveja"], correctIndex: 0 }
                ]);
            } else if (type === 'Verdadero/Falso') {
                questions = [
                    { text: "Las aves tienen plumas y ponen huevos.", correctIndex: 0 },
                    { text: "Los peces pueden vivir y respirar fuera del agua.", correctIndex: 1 },
                    { text: "Los perros y los gatos son animales mamíferos.", correctIndex: 0 },
                    { text: "Los elefantes son los animales más pequeños del mundo.", correctIndex: 1 },
                    { text: "Las abejas producen miel dulce.", correctIndex: 0 }
                ];
            } else if (type === 'Emparejar') {
                questions = [
                    { leftText: "Perro", rightText: "Ladra y cuida la casa" },
                    { leftText: "Gato", rightText: "Maúlla y es ágil" },
                    { leftText: "Vaca", rightText: "Da leche fresca" },
                    { leftText: "Pájaro", rightText: "Tiene plumas y vuela" },
                    { leftText: "Pez", rightText: "Nada en el agua" }
                ];
            } else if (type === 'Ahorcado') {
                questions = [
                    { word: "LEON", hint: "El rey de la selva" },
                    { word: "PERRO", hint: "El mejor amigo del hombre" },
                    { word: "GATO", hint: "Mascota que maúlla" },
                    { word: "ELEFANTE", hint: "Tiene trompa larga" },
                    { word: "DELFIN", hint: "Animal acuático muy amigable" }
                ];
            }
        } else if (tLower.includes('cuerpo') || tLower.includes('salud') || tLower.includes('humano') || tLower.includes('organo')) {
            if (type === 'Opción múltiple') {
                questions = shuffleMultipleChoice([
                    { text: "¿Qué órgano bombea sangre a todo nuestro cuerpo?", options: ["El Corazón", "El Estómago", "Los Pulmones", "Los Dientes"], correctIndex: 0 },
                    { text: "¿Qué parte del cuerpo usamos para pensar y aprender?", options: ["El Cerebro", "El Codo", "La Rodilla", "Las Uñas"], correctIndex: 0 },
                    { text: "¿Con qué órganos respiramos el aire?", options: ["Los Pulmones", "Los Ojos", "Las Piernas", "El Cuello"], correctIndex: 0 },
                    { text: "¿Qué sentido nos permite ver los colores y formas?", options: ["La Vista", "El Oído", "El Olfato", "El Gusto"], correctIndex: 0 },
                    { text: "¿Cuántos dedos tenemos en total en las dos manos?", options: ["Diez", "Cinco", "Ocho", "Doce"], correctIndex: 0 }
                ]);
            } else if (type === 'Verdadero/Falso') {
                questions = [
                    { text: "El corazón late para enviar sangre a todo el cuerpo.", correctIndex: 0 },
                    { text: "Los ojos sirven para escuchar música.", correctIndex: 1 },
                    { text: "Lavarse las manos ayuda a mantenernos saludables.", correctIndex: 0 },
                    { text: "Los huesos forman el esqueleto que sostiene nuestro cuerpo.", correctIndex: 0 },
                    { text: "Dormir bien no es necesario para el cuerpo.", correctIndex: 1 }
                ];
            } else if (type === 'Emparejar') {
                questions = [
                    { leftText: "Ojos", rightText: "Sentido de la vista" },
                    { leftText: "Oídos", rightText: "Sentido del oído" },
                    { leftText: "Nariz", rightText: "Sentido del olfato" },
                    { leftText: "Lengua", rightText: "Sentido del gusto" },
                    { leftText: "Manos", rightText: "Sentido del tacto" }
                ];
            } else if (type === 'Ahorcado') {
                questions = [
                    { word: "CORAZON", hint: "Bombea sangre a todo el cuerpo" },
                    { word: "CEREBRO", hint: "Órgano con el que pensamos" },
                    { word: "PULMON", hint: "Nos permite respirar aire" },
                    { word: "HUESO", hint: "Parte dura del esqueleto" },
                    { word: "DIENTES", hint: "Nos ayudan a masticar comida" }
                ];
            }
        } else {
            // Generador general claro y fácil para cualquier otro tema
            if (type === 'Opción múltiple') {
                questions = shuffleMultipleChoice([
                    { text: `¿Qué es lo más importante de ${cleanTopic}?`, options: [`Es un tema entretenido y fácil de aprender`, `No tiene ningún uso`, `Es un objeto invisible`, `No existe`], correctIndex: 0 },
                    { text: `¿Para qué sirve aprender sobre ${cleanTopic}?`, options: [`Para mejorar nuestros conocimientos y habilidades`, `Para olvidar las cosas`, `Para perder el tiempo`, `Para nada`], correctIndex: 0 },
                    { text: `¿Cuál de las siguientes opciones se relaciona con ${cleanTopic}?`, options: [`Concepto básico de ${cleanTopic}`, `Una idea contraria`, `Un número inventado`, `Ninguna de las anteriores`], correctIndex: 0 },
                    { text: `¿Dónde podemos ver o estudiar sobre ${cleanTopic}?`, options: [`En la escuela y en la vida diaria`, `En ninguna parte`, `Solo en sueños`, `Bajo el suelo`], correctIndex: 0 },
                    { text: `¿Cómo podemos recordar mejor ${cleanTopic}?`, options: [`Practicando y repasando las actividades`, `Sin prestar atención`, `Cerrando los ojos`, `Haciendo otra cosa`], correctIndex: 0 },
                    { text: `¿Cuál es una característica de ${cleanTopic}?`, options: [`Tiene reglas y conceptos sencillos`, `Es imposible de comprender`, `Cambia sin sentido`, `No tiene nombre`], correctIndex: 0 }
                ]);
            } else if (type === 'Verdadero/Falso') {
                questions = [
                    { text: `${capitalizedTopic} es un tema fácil e interesante para aprender.`, correctIndex: 0 },
                    { text: `Aprender sobre ${cleanTopic} es imposible para cualquier persona.`, correctIndex: 1 },
                    { text: `Practicar actividades nos ayuda a dominar ${cleanTopic}.`, correctIndex: 0 },
                    { text: `${capitalizedTopic} no tiene ninguna importancia en el estudio.`, correctIndex: 1 },
                    { text: `Conocer sobre ${cleanTopic} es útil para la vida diaria.`, correctIndex: 0 },
                    { text: `${capitalizedTopic} fue creado por accidente la semana pasada.`, correctIndex: 1 }
                ];
            } else if (type === 'Emparejar') {
                questions = [
                    { leftText: `Concepto principal`, rightText: `Idea clave de ${cleanTopic}` },
                    { leftText: `Ejemplo sencillo`, rightText: `Aplicación fácil` },
                    { leftText: `Función importante`, rightText: `Uso en la práctica` },
                    { leftText: `Beneficio`, rightText: `Aprender más rápido` },
                    { leftText: `Repaso`, rightText: `Consolidar conocimientos` }
                ];
            } else if (type === 'Ahorcado') {
                const rawWords = cleanTopic.split(/\s+/).filter(w => w.length >= 3);
                const fallbackWords = ["APRENDER", "SISTEMA", "CIENCIA", "ESTUDIO", "MEMORIA", "PALABRA"];
                const wordsList = (rawWords.length >= count ? rawWords : [...rawWords, ...fallbackWords]).slice(0, count);

                questions = wordsList.map((w, idx) => {
                    const cleanW = w.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-ZÑ]/g, "");
                    return {
                        word: cleanW || "EDUCACION",
                        hint: `Palabra ${idx + 1} sobre ${cleanTopic}`
                    };
                });
            }
        }

        if (type === 'Rompecabezas') {
            return {
                title: `${capitalizedTopic}`,
                description: description,
                difficulty: 3
            };
        }

        return {
            title: title,
            description: description,
            questions: questions.slice(0, count)
        };
    }

    async function handleGenerateAi() {
        const topic = aiTopicInput ? aiTopicInput.value.trim() : '';
        if (!topic) {
            alert('Por favor, escribe un tema para generar la actividad.');
            if (aiTopicInput) aiTopicInput.focus();
            return;
        }

        const selectedType = aiActivityType ? aiActivityType.value : (typeInput ? typeInput.value : 'Opción múltiple');
        const count = aiCountSelect ? parseInt(aiCountSelect.value, 10) || 5 : 5;

        if (aiLoadingState) aiLoadingState.style.display = 'block';
        if (btnGenerateAiAction) btnGenerateAiAction.disabled = true;

        try {
            let data = null;
            const apiKey = window.EDUPLAY_GEMINI_KEY || localStorage.getItem('eduplay_gemini_api_key') || '';

            const prompt = `Eres un docente creando actividades educativas para EduPlay.
Genera una actividad sobre el tema: "${topic}".
Tipo de actividad: "${selectedType}".
Cantidad de elementos/preguntas: ${count}.
Regla: Preguntas claras, fáciles y educativas en español.
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura según el tipo:

Si es "Opción múltiple":
{
  "title": "Título conciso",
  "description": "Descripción breve",
  "questions": [
    {
      "text": "¿Pregunta clara?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctIndex": 0
    }
  ]
}
(importante: reparte correctIndex aleatoriamente entre 0, 1, 2 y 3 para que no siempre sea la primera opción)

Si es "Verdadero/Falso":
{
  "title": "Título",
  "description": "Descripción",
  "questions": [
    { "text": "Afirmación para evaluar", "correctIndex": 0 }
  ]
}
(correctIndex: 0 es Verdadero, 1 es Falso)

Si es "Emparejar":
{
  "title": "Título",
  "description": "Descripción",
  "questions": [
    { "leftText": "Concepto o pregunta", "rightText": "Definición o respuesta correspondiente" }
  ]
}

Si es "Ahorcado":
{
  "title": "Título",
  "description": "Descripción",
  "questions": [
    { "word": "PALABRA", "hint": "Pista breve" }
  ]
}
(palabras en mayúsculas, solo letras sin acentos ni espacios)
`;

            if (apiKey) {
                try {
                    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: 'application/json' }
                        })
                    });

                    if (gRes.ok) {
                        const gJson = await gRes.json();
                        if (gJson.candidates && gJson.candidates[0] && gJson.candidates[0].content) {
                            const rawText = gJson.candidates[0].content.parts[0].text;
                            const match = rawText.match(/\{[\s\S]*\}/);
                            if (match) data = JSON.parse(match[0]);
                        }
                    }
                } catch (apiErr) {
                    console.warn('Gemini API error, usando generador de respaldo:', apiErr);
                }
            }

            if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
                data = generateSmartCurriculum(selectedType, topic, count);
            }

            // Cambiar o asegurar el tipo de actividad seleccionado
            switchToActivityType(selectedType, false);

            // Rellenar Título y Descripción
            if (titleInput && data.title) {
                titleInput.value = data.title;
                if (titleCounter) titleCounter.textContent = data.title.length;
            }
            if (activityDescription && data.description) {
                activityDescription.value = data.description;
                if (descCounter) descCounter.textContent = data.description.length;
            }

            // Rellenar preguntas según el tipo
            if (selectedType !== 'Rompecabezas' && Array.isArray(data.questions) && data.questions.length > 0) {
                if (questionsContainer) questionsContainer.innerHTML = '';
                questionCount = 0;

                data.questions.slice(0, count).forEach((qData) => {
                    addQuestionBlock();
                    const allBlocks = questionsContainer.querySelectorAll('.question-block');
                    const lastBlock = allBlocks[allBlocks.length - 1];
                    if (!lastBlock) return;

                    if (selectedType === 'Opción múltiple') {
                        const qTextEl = lastBlock.querySelector('.q-text');
                        if (qTextEl && qData.text) qTextEl.value = qData.text;

                        const optInputs = lastBlock.querySelectorAll('.opt-text');
                        if (Array.isArray(qData.options)) {
                            qData.options.forEach((optStr, idx) => {
                                if (optInputs[idx]) optInputs[idx].value = optStr;
                            });
                        }
                        const corrIdx = typeof qData.correctIndex === 'number' ? qData.correctIndex : Math.floor(Math.random() * 4);
                        const radios = lastBlock.querySelectorAll('input[type="radio"]');
                        if (radios[corrIdx]) radios[corrIdx].checked = true;

                    } else if (selectedType === 'Verdadero/Falso') {
                        const qTextEl = lastBlock.querySelector('.q-text');
                        if (qTextEl && qData.text) qTextEl.value = qData.text;

                        const corrIdx = (qData.correctIndex === 1) ? 1 : 0;
                        const radios = lastBlock.querySelectorAll('input[type="radio"]');
                        if (radios[corrIdx]) radios[corrIdx].checked = true;

                    } else if (selectedType === 'Emparejar') {
                        const leftEl = lastBlock.querySelector('.q-left');
                        const rightEl = lastBlock.querySelector('.q-right');
                        if (leftEl && qData.leftText) leftEl.value = qData.leftText;
                        if (rightEl && qData.rightText) rightEl.value = qData.rightText;

                    } else if (selectedType === 'Ahorcado') {
                        const wordEl = lastBlock.querySelector('.q-word');
                        const hintEl = lastBlock.querySelector('.q-hint');
                        if (wordEl && qData.word) wordEl.value = qData.word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-ZÑ ]/g, "");
                        if (hintEl && qData.hint) hintEl.value = qData.hint;
                    }
                });
            }

            updateLivePreview();
            closeAiModal();
            showToast('Generado', 2500);
            playCorrectSound();

        } catch (err) {
            console.error('Error generando actividad:', err);
        } finally {
            if (aiLoadingState) aiLoadingState.style.display = 'none';
            if (btnGenerateAiAction) btnGenerateAiAction.disabled = false;
        }
    }

    if (btnGenerateAiAction) {
        btnGenerateAiAction.addEventListener('click', handleGenerateAi);
    }

    // Back button
    if (btnBackToTypes) {
        btnBackToTypes.addEventListener('click', () => navigateTo('create-view'));
    }

    // Save button triggers form submit
    if (btnSaveActivity) {
        btnSaveActivity.addEventListener('click', () => {
            if (createForm) createForm.requestSubmit();
        });
    }
    if (btnSaveMobile) {
        btnSaveMobile.addEventListener('click', () => {
            if (createForm) createForm.requestSubmit();
        });
    }

    // Character counters
    const titleInput = document.getElementById('activity-title');
    if (titleInput && titleCounter) {
        titleInput.addEventListener('input', () => { titleCounter.textContent = titleInput.value.length; updateLivePreview(); });
    }
    if (activityDescription && descCounter) {
        activityDescription.addEventListener('input', () => { descCounter.textContent = activityDescription.value.length; });
    }

    // Live Preview Update
    function updateLivePreview() {
        const livePreviewTitle = document.getElementById('live-preview-title');
        const titleEl = document.getElementById('activity-title');

        if (livePreviewTitle && titleEl) {
            livePreviewTitle.textContent = titleEl.value.trim() || 'Título de la actividad';
        }

        const currentType = typeInput ? typeInput.value : '';
        const puzzleMock = document.getElementById('live-preview-mock-puzzle');
        const cardMock = document.getElementById('live-preview-mock-card');
        const noteMock = document.getElementById('live-preview-footer-note');

        if (currentType === 'Rompecabezas') {
            if (cardMock) cardMock.style.display = 'none';
            if (noteMock) noteMock.style.display = 'none';
            if (puzzleMock) puzzleMock.style.display = 'block';

            const pGrid = document.getElementById('live-preview-puzzle-grid');
            const pUrl = document.getElementById('puzzle-image-url').value;
            const diffEl = document.getElementById('puzzle-difficulty');
            const pDiff = diffEl ? parseInt(diffEl.value) : 3;

            if (pGrid) {
                pGrid.innerHTML = '';
                pGrid.style.gridTemplateColumns = `repeat(${pDiff}, 1fr)`;
                pGrid.style.gridTemplateRows = `repeat(${pDiff}, 1fr)`;
                if (pUrl) {
                    for (let i = 0; i < pDiff * pDiff; i++) {
                        const row = Math.floor(i / pDiff);
                        const col = i % pDiff;
                        const piece = document.createElement('div');
                        piece.style.backgroundImage = `url(${pUrl})`;
                        piece.style.backgroundSize = `${pDiff * 100}% ${pDiff * 100}%`;
                        piece.style.backgroundPosition = `${(col * 100) / (pDiff - 1 || 1)}% ${(row * 100) / (pDiff - 1 || 1)}%`;
                        piece.style.border = '1px dashed rgba(255,255,255,0.4)';
                        pGrid.appendChild(piece);
                    }
                } else {
                    pGrid.style.background = 'var(--bg-surface)';
                    pGrid.innerHTML = '<div style="grid-column: 1/-1; grid-row: 1/-1; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); padding: 10px;">Sube una imagen para ver la cuadrícula</div>';
                }
            }
            return;
        } else {
            if (cardMock) cardMock.style.display = 'block';
            if (noteMock) noteMock.style.display = 'flex';
            if (puzzleMock) puzzleMock.style.display = 'none';
        }

        const blocks = questionsContainer ? questionsContainer.querySelectorAll('.question-block') : [];
        if (blocks.length === 0 || !currentType) {
            if (livePreviewQuestion) livePreviewQuestion.textContent = '¿Escribe tu pregunta aquí?';
            if (livePreviewCounter) livePreviewCounter.textContent = 'Pregunta 1 de 1';
            if (livePreviewOptions) livePreviewOptions.innerHTML = '';
            return;
        }
        const first = blocks[0];
        if (livePreviewCounter) livePreviewCounter.textContent = `Pregunta 1 de ${blocks.length}`;
        if (currentType === 'Opción múltiple' || currentType === 'Verdadero/Falso') {
            const qText = first.querySelector('.q-text');
            if (livePreviewQuestion) livePreviewQuestion.textContent = (qText && qText.value.trim()) || '¿Escribe tu pregunta aquí?';
            const opts = first.querySelectorAll('.opt-text');
            const radios = first.querySelectorAll('input[type="radio"]');
            if (livePreviewOptions) {
                livePreviewOptions.innerHTML = '';
                const labels = ['A', 'B', 'C', 'D'];
                opts.forEach((opt, i) => {
                    const isCorrect = radios[i] && radios[i].checked;
                    const div = document.createElement('div');
                    div.className = 'preview-option' + (isCorrect ? ' correct' : '');
                    div.innerHTML = `<span class="option-letter${isCorrect ? ' correct' : ''}">${labels[i]}</span><span>${opt.value || 'Opción ' + labels[i]}</span>${isCorrect ? '<span class="option-check"><svg width="14" height="14" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}`;
                    livePreviewOptions.appendChild(div);
                });
            }
        } else if (currentType === 'Emparejar') {
            const left = first.querySelector('.q-left');
            const right = first.querySelector('.q-right');
            if (livePreviewQuestion) livePreviewQuestion.textContent = 'Emparejar elementos';
            if (livePreviewOptions) {
                livePreviewOptions.innerHTML = `<div class="preview-option"><span class="option-letter">1</span><span>${(left && left.value) || 'Elemento 1'} ↔ ${(right && right.value) || 'Elemento 2'}</span></div>`;
            }
        } else if (currentType === 'Ahorcado') {
            const word = first.querySelector('.q-word');
            const hint = first.querySelector('.q-hint');
            if (livePreviewQuestion) livePreviewQuestion.textContent = (hint && hint.value) ? `Pista: ${hint.value}` : 'Adivina la palabra';
            if (livePreviewOptions) {
                const w = (word && word.value.trim()) || 'PALABRA';
                let wordHTML = '<div style="display:flex; gap:4px; justify-content:center; margin-bottom: 12px;">';
                for (let i = 0; i < Math.min(w.length, 10); i++) {
                    wordHTML += `<div style="border-bottom: 2px solid var(--text-primary); width: 20px; height: 24px; display:flex; align-items:flex-end; justify-content:center; font-weight:bold;">${w[i].toUpperCase()}</div>`;
                }
                if (w.length > 10) wordHTML += '...';
                wordHTML += '</div><div style="text-align:center; font-size:0.8rem; color:var(--text-secondary);">Teclado virtual aquí</div>';
                livePreviewOptions.innerHTML = wordHTML;
            }
        }
    }

    // 1. Renderizar lista (Firestore)
    async function renderActivities() {
        if (activitiesContainer) activitiesContainer.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Cargando actividades...</p>';

        const user = auth.currentUser;
        if (!user) {
            if (activitiesContainer) activitiesContainer.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Inicia sesión con Google para ver y crear tus actividades.</p>';
            return;
        }

        try {
            const snapshot = await db.collection("activities")
                .where("uid", "==", user.uid)
                .get();

            let currentActivities = [];
            snapshot.forEach(doc => {
                const docData = doc.data();
                const act = JSON.parse(docData.data);
                act.id = doc.id; // Asignamos el ID de Firestore
                act.createdAt = docData.createdAt ? docData.createdAt.toMillis() : 0;
                act.plays = docData.plays || 0;
                currentActivities.push(act);
            });

            // Ordenar localmente de más reciente a más antiguo
            currentActivities.sort((a, b) => b.createdAt - a.createdAt);

            if (activitiesContainer) activitiesContainer.innerHTML = '';

            if (currentActivities.length === 0) {
                if (activitiesContainer) activitiesContainer.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No tienes actividades creadas aún.</p>';
                return;
            }

            currentActivities.forEach(act => {
                const card = document.createElement('div');
                card.className = 'activity-card';
                let numPreguntasText = act.questions ? `${act.questions.length} Qs/Pares` : '0 Qs/Pares';
                if (act.type === 'Rompecabezas') {
                    numPreguntasText = `1 Puzle`;
                }

                card.innerHTML = `
                    <div class="card-header">
                        <h3>${act.title}</h3>
                        <div class="card-actions">
                            <span class="plays-badge" style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:var(--text-secondary); margin-right:8px;" title="Veces jugado">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                ${act.plays}
                            </span>
                            <button class="card-action-btn edit-btn" title="Editar"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="card-action-btn share-btn" title="Compartir"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></button>
                            <button class="card-action-btn whatsapp-btn" title="Compartir por WhatsApp"><svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.45 17.5 2 12.04 2ZM17.86 16.01C17.62 16.69 16.43 17.3 15.9 17.38C15.4 17.45 14.76 17.48 14.07 17.27C13.65 17.13 13.11 16.95 12.42 16.64C9.51 15.35 7.62 12.42 7.48 12.22C7.33 12.02 6.3 10.65 6.3 9.23C6.3 7.8 7.05 7.1 7.31 6.81C7.58 6.51 7.89 6.44 8.09 6.44C8.28 6.44 8.48 6.44 8.65 6.45C8.83 6.46 9.07 6.38 9.31 6.95C9.55 7.52 10.14 8.96 10.21 9.11C10.28 9.26 10.33 9.43 10.23 9.62C10.13 9.82 10.08 9.94 9.94 10.11C9.79 10.28 9.63 10.48 9.5 10.61C9.35 10.76 9.2 10.92 9.37 11.21C9.54 11.51 10.14 12.48 11.02 13.27C12.16 14.28 13.12 14.59 13.42 14.74C13.72 14.89 13.89 14.87 14.07 14.66C14.24 14.46 14.82 13.78 15.02 13.48C15.22 13.18 15.42 13.23 15.7 13.33C15.97 13.43 17.44 14.15 17.74 14.3C18.04 14.45 18.24 14.52 18.31 14.65C18.38 14.77 18.38 15.36 18.14 16.04L17.86 16.01Z"/></svg></button>
                            <button class="card-action-btn delete-btn" data-id="${act.id}" title="Eliminar"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <span class="type-badge">${act.type}</span>
                        <span class="type-badge" style="background:rgba(34,197,94,0.15);color:#22c55e;">${numPreguntasText}</span>
                    </div>
                `;

                // Play on card click
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.card-action-btn')) return;
                    if ((act.questions && act.questions.length > 0) || act.type === 'Rompecabezas') {
                        playActivity(act);
                        openOverlay();
                        startOverlayGame();
                    } else { alert('Esta actividad está vacía.'); }
                });

                // Edit button
                card.querySelector('.edit-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadActivityForEditing(act);
                });

                // Share button
                card.querySelector('.share-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!act.id) { alert('Actividad sin ID.'); return; }
                    const link = `${window.location.origin}${window.location.pathname}?id=${act.id}`;
                    const copied = await copyToClipboard(link);
                    showToast(copied ? 'Enlace copiado al portapapeles' : 'Enlace: ' + link);
                });

                // WhatsApp button
                card.querySelector('.whatsapp-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!act.id) { alert('Actividad sin ID.'); return; }
                    const link = `${window.location.origin}${window.location.pathname}?id=${act.id}`;
                    const text = encodeURIComponent(`Resuelve esta actividad: ${link}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                });

                // Delete button
                const deleteBtn = card.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Seguro que deseas eliminar "${act.title}"?`)) {
                        deleteBtn.disabled = true;
                        try {
                            await db.collection("activities").doc(act.id).delete();
                            renderActivities();
                            if (currentActivity && currentActivity.id === act.id) currentActivity = null;
                        } catch (err) {
                            console.error("Error eliminando:", err);
                            alert("Error al eliminar.");
                            deleteBtn.disabled = false;
                        }
                    }
                });

                if (activitiesContainer) activitiesContainer.appendChild(card);
            });
        } catch (error) {
            console.error("Error cargando actividades desde Firestore:", error);
            if (activitiesContainer) activitiesContainer.innerHTML = '<p style="color: var(--error); grid-column: 1/-1;">Hubo un error al cargar tus actividades.</p>';
        }
    }

    // Load activity for editing
    function loadActivityForEditing(act) {
        if (typeInput) typeInput.value = act.type;
        if (editingActivityId) editingActivityId.value = act.id || '';
        updateEditorTypeHeader(act.type);
        const titleEl = document.getElementById('activity-title');
        if (titleEl) { titleEl.value = act.title || ''; if (titleCounter) titleCounter.textContent = titleEl.value.length; }
        if (activityDescription) { activityDescription.value = act.description || ''; if (descCounter) descCounter.textContent = activityDescription.value.length; }

        const puzzleSection = document.getElementById('puzzle-config-section');
        const questionsSection = document.getElementById('questions-section');

        if (act.type === 'Rompecabezas') {
            if (questionsSection) questionsSection.style.display = 'none';
            if (puzzleSection) puzzleSection.style.display = 'block';

            const pDiff = document.getElementById('puzzle-difficulty');
            const pUrl = document.getElementById('puzzle-image-url');
            const pPreview = document.getElementById('puzzle-image-preview');
            const pPreviewContainer = document.getElementById('puzzle-image-preview-container');
            const pUploadArea = document.getElementById('puzzle-upload-area');

            if (pDiff) pDiff.value = act.difficulty || 3;
            if (pUrl && act.puzzleImage) {
                pUrl.value = act.puzzleImage;
                if (pPreview) pPreview.src = act.puzzleImage;
                if (pPreviewContainer) pPreviewContainer.style.display = 'block';
                if (pUploadArea) pUploadArea.style.display = 'none';
            } else {
                if (pUrl) pUrl.value = '';
                if (pPreviewContainer) pPreviewContainer.style.display = 'none';
                if (pUploadArea) pUploadArea.style.display = 'flex';
            }
            if (questionsContainer) questionsContainer.innerHTML = '';
            questionCount = 0;
        } else {
            if (puzzleSection) puzzleSection.style.display = 'none';
            if (questionsSection) questionsSection.style.display = 'block';

            if (questionsContainer) questionsContainer.innerHTML = '';
            questionCount = 0;
            if (act.questions && act.questions.length > 0) {
                act.questions.forEach(q => {
                    addQuestionBlock();
                    const block = questionsContainer.lastElementChild;
                    if (!block) return;
                    if (q.imageUrl) {
                        const ii = block.querySelector('.q-image-url');
                        const ip = block.querySelector('.image-preview-container img');
                        const ic = block.querySelector('.image-preview-container');
                        const ua = block.querySelector('.upload-area');
                        if (ii) ii.value = q.imageUrl;
                        if (ip) ip.src = q.imageUrl;
                        if (ic) ic.style.display = 'block';
                        if (ua) ua.style.display = 'none';
                    }
                    if (act.type === 'Opción múltiple' || act.type === 'Verdadero/Falso') {
                        const qText = block.querySelector('.q-text');
                        if (qText) qText.value = q.text || '';
                        const opts = block.querySelectorAll('.opt-text');
                        const radios = block.querySelectorAll('input[type="radio"]');
                        if (q.options) q.options.forEach((o, i) => { if (opts[i]) opts[i].value = o; });
                        if (radios[q.correctIndex]) radios[q.correctIndex].checked = true;
                    } else if (act.type === 'Emparejar') {
                        const left = block.querySelector('.q-left');
                        const right = block.querySelector('.q-right');
                        if (left) left.value = q.leftText || '';
                        if (right) right.value = q.rightText || '';
                    } else if (act.type === 'Ahorcado') {
                        const wordInput = block.querySelector('.q-word');
                        const hintInput = block.querySelector('.q-hint');
                        if (wordInput) wordInput.value = q.word || '';
                        if (hintInput) hintInput.value = q.hint || '';
                    }
                });
            }
        }
        navigateTo('edit-view');
        updateLivePreview();
    }

    // 5. Formulario Dinámico según Tipo
    let questionCount = 0;

    if (typeInput) {
        typeInput.addEventListener('change', () => {
            if (questionsContainer) questionsContainer.innerHTML = '';
            questionCount = 0;
            addQuestionBlock();
        });
    }

    function addQuestionBlock() {
        const currentType = typeInput.value;
        if (!currentType) return;

        questionCount++;
        const qId = Date.now() + '-' + Math.floor(Math.random() * 1000);

        const block = document.createElement('div');
        block.className = 'question-block';

        let headerTitle = 'Pregunta';
        if (currentType === 'Emparejar') headerTitle = 'Pareja';
        else if (currentType === 'Ahorcado') headerTitle = 'Palabra';
        else if (currentType === 'Verdadero/Falso') headerTitle = 'Afirmación';
        else if (currentType === 'Rompecabezas') headerTitle = 'Rompecabezas';

        const showImageUpload = (currentType !== 'Ahorcado');
        const uploadLabelText = (currentType === 'Emparejar') ? 'Subir imagen para la izquierda (opcional)' : 'Subir imagen (opcional)';

        let innerHTML = `
            <div class="question-block-header">
                <h4>${headerTitle} ${questionCount}</h4>
                <button type="button" class="btn-remove-question" title="Eliminar"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Eliminar</button>
            </div>
            ${showImageUpload ? `
            <div class="form-group image-url-group">
                <input type="hidden" class="q-image-url">
                <div class="upload-area question-upload">
                    <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    <span class="upload-label">${uploadLabelText}</span>
                    <input type="file" class="q-image-file" accept="image/jpeg,image/png,image/webp" hidden>
                </div>
                <div class="image-preview-container" style="display:none;text-align:center;margin-top:10px;">
                    <img src="" alt="Vista previa" style="max-height:150px;border-radius:8px;">
                    <button type="button" class="btn-remove-img">Quitar imagen</button>
                </div>
            </div>` : ''}
        `;

        if (currentType === 'Opción múltiple') {
            innerHTML += `
                <div class="form-group">
                    <input type="text" class="q-text" placeholder="Escribe la pregunta aquí..." required>
                </div>
                <div class="options-container">
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="0" required checked title="Marcar como correcta">
                        <input type="text" class="opt-text" placeholder="Opción A" required>
                    </div>
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="1" required title="Marcar como correcta">
                        <input type="text" class="opt-text" placeholder="Opción B" required>
                    </div>
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="2" required title="Marcar como correcta">
                        <input type="text" class="opt-text" placeholder="Opción C" required>
                    </div>
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="3" required title="Marcar como correcta">
                        <input type="text" class="opt-text" placeholder="Opción D" required>
                    </div>
                </div>
            `;
        } else if (currentType === 'Verdadero/Falso') {
            innerHTML += `
                <div class="form-group">
                    <input type="text" class="q-text" placeholder="Escribe la afirmación aquí... (ej: El Sol es una estrella)" required>
                </div>
                <div class="options-container">
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="0" required checked title="Verdadero es la respuesta correcta">
                        <input type="text" class="opt-text" value="Verdadero" readonly style="background: rgba(255,255,255,0.05); cursor: default;">
                    </div>
                    <div class="option-row">
                        <input type="radio" name="correct-${qId}" value="1" required title="Falso es la respuesta correcta">
                        <input type="text" class="opt-text" value="Falso" readonly style="background: rgba(255,255,255,0.05); cursor: default;">
                    </div>
                </div>
            `;
        } else if (currentType === 'Emparejar') {
            innerHTML += `
                <div class="options-container">
                    <div class="option-row">
                        <span style="min-width: 90px; font-weight:700;">Izquierda:</span>
                        <input type="text" class="q-left" placeholder="Ej: Perro" required>
                    </div>
                    <div class="option-row">
                        <span style="min-width: 90px; font-weight:700;">Derecha:</span>
                        <input type="text" class="q-right" placeholder="Ej: Guau" required>
                    </div>
                </div>
            `;
        } else if (currentType === 'Ahorcado') {
            innerHTML += `
                <div class="options-container">
                    <div class="option-row">
                        <span style="min-width: 120px; font-weight:700;">Palabra oculta:</span>
                        <input type="text" class="q-word" placeholder="Ej: JIRAFA" required pattern="[A-Za-zÁÉÍÓÚáéíóúÑñ ]+" title="Solo letras y espacios">
                    </div>
                    <div class="option-row">
                        <span style="min-width: 120px; font-weight:700;">Pista opcional:</span>
                        <input type="text" class="q-hint" placeholder="Ej: Animal con cuello largo">
                    </div>
                </div>
            `;
        }


        block.innerHTML = innerHTML;

        const imgInput = block.querySelector('.q-image-url');
        const imgContainer = block.querySelector('.image-preview-container');
        const imgPreview = block.querySelector('.image-preview-container img');
        const uploadArea = block.querySelector('.upload-area');
        const fileInput = block.querySelector('.q-image-file');
        const btnRemoveImg = block.querySelector('.btn-remove-img');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());

            // Drag and drop events
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) handleImageFile(file);
            });

            fileInput.addEventListener('change', (ev) => {
                const file = ev.target.files[0];
                if (file) handleImageFile(file);
            });

            function handleImageFile(file) {
                if (!file.type.startsWith('image/')) { alert('Por favor sube un archivo de imagen válido.'); return; }
                compressImage(file, (compressedDataUrl) => {
                    imgInput.value = compressedDataUrl;
                    imgPreview.src = compressedDataUrl;
                    imgContainer.style.display = 'block';
                    uploadArea.style.display = 'none';
                    updateLivePreview();
                });
            }
        }

        if (btnRemoveImg) {
            btnRemoveImg.addEventListener('click', () => {
                imgInput.value = '';
                imgPreview.src = '';
                imgContainer.style.display = 'none';
                if (uploadArea) uploadArea.style.display = 'flex';
                updateLivePreview();
            });
        }

        block.querySelector('.btn-remove-question').addEventListener('click', () => {
            block.remove();
            updateLivePreview();
        });

        // Add input listeners for live preview
        block.querySelectorAll('.q-text, .opt-text, .q-left, .q-right, .q-word, .q-hint').forEach(inp => {
            inp.addEventListener('input', () => updateLivePreview());
        });
        block.querySelectorAll('input[type="radio"]').forEach(r => {
            r.addEventListener('change', () => updateLivePreview());
        });

        if (questionsContainer) questionsContainer.appendChild(block);
        updateLivePreview();
    }

    if (btnAddQuestion) {
        btnAddQuestion.addEventListener('click', () => {
            if (typeInput && !typeInput.value) {
                alert("Primero selecciona el Tipo de actividad.");
                return;
            }
            addQuestionBlock();
        });
    }

    // Setup puzzle image upload listener
    const puzzleUploadArea = document.getElementById('puzzle-upload-area');
    const puzzleFileInput = document.getElementById('puzzle-image-file');
    const btnRemovePuzzleImg = document.getElementById('btn-remove-puzzle-img');
    const diffSelect = document.getElementById('puzzle-difficulty');

    if (puzzleUploadArea && puzzleFileInput) {
        puzzleUploadArea.addEventListener('click', () => puzzleFileInput.click());

        function handlePuzzleImage(file) {
            if (!file || !file.type.startsWith('image/')) {
                alert('Por favor sube un archivo de imagen válido.');
                return;
            }
            compressImage(file, (compressedDataUrl) => {
                document.getElementById('puzzle-image-url').value = compressedDataUrl;
                document.getElementById('puzzle-image-preview').src = compressedDataUrl;
                document.getElementById('puzzle-image-preview-container').style.display = 'block';
                puzzleUploadArea.style.display = 'none';
                updateLivePreview();
            });
        }

        puzzleFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) handlePuzzleImage(file);
            this.value = '';
        });

        // Drag and drop events para puzzle
        puzzleUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            puzzleUploadArea.classList.add('dragover');
        });
        puzzleUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            puzzleUploadArea.classList.remove('dragover');
        });
        puzzleUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            puzzleUploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handlePuzzleImage(file);
        });
    }
    if (btnRemovePuzzleImg) {
        btnRemovePuzzleImg.addEventListener('click', () => {
            document.getElementById('puzzle-image-url').value = '';
            document.getElementById('puzzle-image-preview-container').style.display = 'none';
            document.getElementById('puzzle-upload-area').style.display = 'flex';
            updateLivePreview();
        });
    }
    if (diffSelect) {
        diffSelect.addEventListener('change', updateLivePreview);
    }

    // 6. Guardar actividad
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentType = typeInput ? typeInput.value : '';
            const titleEl = document.getElementById('activity-title');
            const title = titleEl ? titleEl.value.trim() : '';

            if (!title) {
                alert('El título no puede estar vacío.');
                return;
            }

            let questionsArray = [];
            let puzzleImage = '';
            let puzzleDifficulty = 3;
            let hasErrors = false;

            if (currentType === 'Rompecabezas') {
                const imgUrl = document.getElementById('puzzle-image-url').value;
                const diff = document.getElementById('puzzle-difficulty').value;
                if (!imgUrl) hasErrors = true;
                puzzleImage = imgUrl;
                puzzleDifficulty = parseInt(diff);
            } else {
                const questionBlocks = questionsContainer ? questionsContainer.querySelectorAll('.question-block') : [];
                if (questionBlocks.length === 0) {
                    alert('Debes agregar al menos un elemento.');
                    return;
                }

                questionBlocks.forEach(block => {
                    const imgUrlEl = block.querySelector('.q-image-url');
                    const imgUrl = imgUrlEl ? imgUrlEl.value.trim() : '';

                    if (currentType === 'Opción múltiple' || currentType === 'Verdadero/Falso') {
                        const textEl = block.querySelector('.q-text');
                        const text = textEl ? textEl.value.trim() : '';
                        const opts = block.querySelectorAll('.opt-text');
                        const radios = block.querySelectorAll('input[type="radio"]');

                        let correctIndex = 0;
                        let optionsArray = [];

                        opts.forEach((opt, index) => {
                            optionsArray.push(opt.value.trim());
                            if (radios[index] && radios[index].checked) correctIndex = index;
                        });

                        if (!text || optionsArray.some(o => o === '')) hasErrors = true;

                        questionsArray.push({
                            text: text,
                            imageUrl: imgUrl,
                            options: optionsArray,
                            correctIndex: correctIndex
                        });
                    } else if (currentType === 'Emparejar') {
                        const leftEl = block.querySelector('.q-left');
                        const rightEl = block.querySelector('.q-right');
                        const left = leftEl ? leftEl.value.trim() : '';
                        const right = rightEl ? rightEl.value.trim() : '';

                        if (!left || !right) hasErrors = true;

                        questionsArray.push({
                            leftText: left,
                            imageUrl: imgUrl,
                            rightText: right
                        });
                    } else if (currentType === 'Ahorcado') {
                        const wordEl = block.querySelector('.q-word');
                        const hintEl = block.querySelector('.q-hint');
                        const word = wordEl ? wordEl.value.trim().toUpperCase() : '';
                        const hint = hintEl ? hintEl.value.trim() : '';

                        if (!word) hasErrors = true;

                        questionsArray.push({
                            word: word,
                            imageUrl: imgUrl,
                            hint: hint
                        });
                    }
                });
            }

            if (hasErrors) {
                alert('Por favor completa todos los campos requeridos y asegúrate de subir la imagen si la actividad lo requiere.');
                return;
            }

            // Guard: require login to save
            // En móvil, auth.currentUser puede tardar en restaurarse.
            // Esperamos hasta 5 segundos a que Firebase resuelva el estado de auth.
            let user = auth.currentUser;
            if (!user) {
                // Intentar esperar a que Firebase restaure la sesión
                user = await new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(null), 5000);
                    const unsub = auth.onAuthStateChanged((u) => {
                        clearTimeout(timeout);
                        unsub();
                        resolve(u);
                    });
                });
            }

            if (!user) {
                alert('Debes iniciar sesión con Google para crear actividades.');
                return;
            }

            const newActivity = {
                title: title,
                type: currentType,
                description: activityDescription ? activityDescription.value.trim() : '',
                coverImage: ''
            };

            if (currentType === 'Rompecabezas') {
                newActivity.puzzleImage = puzzleImage;
                newActivity.difficulty = puzzleDifficulty;
            } else {
                newActivity.questions = questionsArray;
            }

            const isMobile = window.innerWidth <= 768;
            const savingBtn = isMobile ? (btnSaveMobile || btnSaveActivity) : (btnSaveActivity || createForm.querySelector('button[type="submit"]'));
            let originalBtnText = '';
            if (savingBtn) { originalBtnText = savingBtn.innerHTML; savingBtn.innerHTML = 'Guardando...'; savingBtn.disabled = true; }

            try {
                const editId = editingActivityId ? editingActivityId.value : '';
                const uid = user.uid;
                if (editId) {
                    await db.collection("activities").doc(editId).update({ data: JSON.stringify(newActivity) });
                } else {
                    await db.collection("activities").add({
                        data: JSON.stringify(newActivity),
                        uid: uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                createForm.reset();
                if (editingActivityId) editingActivityId.value = '';
                if (questionsContainer) questionsContainer.innerHTML = '';
                await renderActivities();
                navigateTo('list-view');
            } catch (err) {
                console.error("Error guardando actividad:", err.code, err.message);
                if (err.code === 'permission-denied') {
                    alert('Error de permisos: asegúrate de estar correctamente logueado con Google.');
                } else if (err.code === 'unavailable' || err.message.includes('network')) {
                    alert('Error de red. Verifica tu conexión a internet e intenta de nuevo.');
                } else {
                    alert('Error al guardar la actividad: ' + (err.message || 'Error desconocido'));
                }
            } finally {
                if (savingBtn) { savingBtn.innerHTML = originalBtnText; savingBtn.disabled = false; }
            }
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // OVERLAY: abrir / cerrar / iniciar juego
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const isMobileDevice = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

    function openOverlay(pushHistory = true) {
        if (!gameOverlay) return;
        gameOverlay.style.display = 'flex';
        // Mostrar start screen, ocultar cuerpo y resultados
        if (overlayStartScreen) overlayStartScreen.style.display = 'flex';
        if (overlayGameBody)    overlayGameBody.style.display    = 'none';
        if (overlayResults)     overlayResults.style.display     = 'none';
        if (overlayFeedback)    overlayFeedback.style.display    = 'none';
        // Barra superior oculta en start screen
        if (overlayBar) overlayBar.style.display = 'none';

        if (pushHistory) {
            history.pushState({ overlay: true }, '', window.location.pathname + window.location.search);
        }
    }

    function startOverlayGame() {
        if (!currentActivity) {
            console.warn("La actividad aún se está cargando...");
            return;
        }
        if (overlayStartScreen) overlayStartScreen.style.display = 'none';
        if (overlayGameBody)    overlayGameBody.style.display    = 'flex';
        if (overlayResults)     overlayResults.style.display     = 'none';
        if (overlayBar)         overlayBar.style.display         = 'flex';

        renderQuestion();
    }

    function exitGame(popHistory = true) {
        // Ocultar overlay
        if (gameOverlay) gameOverlay.style.display = 'none';
        if (puzzlePeekModal) puzzlePeekModal.style.display = 'none';

        // Si estamos en modo compartido, salir navegando a la página principal de EduPlay
        if (document.body.classList.contains('shared-mode')) {
            document.body.classList.remove('shared-mode');
            window.location.href = window.location.origin + window.location.pathname;
            return;
        }

        // Si estamos en modo editor/normal, volver a la vista de lista o preview
        navigateTo('list-view', false);

        if (popHistory && history.state && history.state.overlay) {
            history.back();
        }
    }

    // Soporte para botón "Atrás" de Android / Navegador (evita cerrar la web)
    window.addEventListener('popstate', (e) => {
        if (puzzlePeekModal && puzzlePeekModal.style.display === 'flex') {
            puzzlePeekModal.style.display = 'none';
            return;
        }
        if (gameOverlay && gameOverlay.style.display === 'flex') {
            exitGame(false);
            return;
        }
        const state = e.state;
        if (state && state.view) {
            navigateTo(state.view, false);
        } else {
            navigateTo('create-view', false);
        }
    });

    // Listeners de botones del overlay
    if (btnExitGame)      btnExitGame.addEventListener('click', () => exitGame(true));
    if (overlayBtnExitRes) overlayBtnExitRes.addEventListener('click', () => exitGame(true));

    if (btnOverlayPlay) {
        btnOverlayPlay.addEventListener('click', startOverlayGame);
    }
    // El botón "Jugar" de la card de inicio (preview-view) abre el overlay
    if (btnStartPlay) {
        btnStartPlay.addEventListener('click', () => {
            openOverlay();
            // Poblar datos en el overlay start screen
            if (currentActivity) {
                if (overlayStartTitle) overlayStartTitle.textContent = currentActivity.title;
                if (overlayStartType)  overlayStartType.textContent  = currentActivity.type;
            }
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // MOTOR DE JUEGO
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function fadeTransition(callback) {
        if (overlayGameBody) {
            overlayGameBody.classList.remove('fade-in');
            overlayGameBody.classList.add('fade-out');
        }
        setTimeout(() => {
            callback();
            if (overlayGameBody) {
                overlayGameBody.classList.remove('fade-out');
                overlayGameBody.classList.add('fade-in');
            }
        }, 300);
    }

    function playActivity(activity) {
        currentActivity = activity;
        currentQuestionIndex = 0;
        score = 0;

        if (gameMainTitle)    gameMainTitle.textContent    = `Jugando: ${activity.title}`;
        if (gameMainSubtitle) gameMainSubtitle.textContent = `Tipo: ${activity.type}`;
        if (shareButtonsContainer) shareButtonsContainer.style.display = 'flex';

        // Mostrar card de inicio (antes del overlay)
        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        if (gameContainer)      gameContainer.style.display = 'block';
        if (startTitle) startTitle.textContent = activity.title;
        if (startType)  startType.textContent  = activity.type;

        // Preparar overlay start screen
        if (overlayStartTitle) overlayStartTitle.textContent = activity.title;
        if (overlayStartType)  overlayStartType.textContent  = activity.type;
    }

    function renderQuestion() {
        isAnswered = false;
        if (overlayFeedback)  overlayFeedback.style.display  = 'none';
        if (overlayBtnNext)   overlayBtnNext.style.display   = 'none';

        // Actualizar barra de progreso superior
        if (overlayProgressBar) {
            const totalQ = (currentActivity && currentActivity.questions) ? currentActivity.questions.length : 1;
            const pct = Math.min(100, Math.round(((currentQuestionIndex + 1) / totalQ) * 100));
            overlayProgressBar.style.width = `${pct}%`;
        }

        // Limpiar y ocultar todos los contenedores para evitar mezclar vistas
        if (overlayQuestionCard) overlayQuestionCard.style.display = 'none';
        if (overlayQText)       overlayQText.style.display       = 'none';
        if (overlayQMedia)      overlayQMedia.style.display      = 'none';
        if (overlayOptionsGrid) { overlayOptionsGrid.style.display = 'none'; overlayOptionsGrid.innerHTML = ''; }
        if (overlayMatchGrid)   overlayMatchGrid.style.display   = 'none';
        if (overlayPuzzleWrap)  overlayPuzzleWrap.style.display  = 'none';

        // Limpiar ahorcado previo si existe
        const existingHangman = overlayGameBody ? overlayGameBody.querySelector('.hangman-layout') : null;
        if (existingHangman) existingHangman.remove();

        const type = currentActivity.type;

        if (type === 'Opción múltiple' || type === 'Verdadero/Falso') {
            const currentQ = currentActivity.questions[currentQuestionIndex];
            const isVF = (type === 'Verdadero/Falso');
            if (overlayQCounter) overlayQCounter.textContent = `${isVF ? 'Afirmación' : 'Pregunta'} ${currentQuestionIndex + 1} de ${currentActivity.questions.length}`;
            if (overlayScoreDisp) overlayScoreDisp.textContent = `Puntos: ${score}`;

            if (overlayQuestionCard) {
                overlayQuestionCard.style.display = 'block';
                if (!currentQ.imageUrl) {
                    overlayQuestionCard.classList.add('no-media');
                } else {
                    overlayQuestionCard.classList.remove('no-media');
                }
            }
            if (overlayQText)       { overlayQText.style.display = 'block'; overlayQText.textContent = currentQ.text; }
            if (overlayOptionsGrid) {
                overlayOptionsGrid.style.display = 'grid';
                overlayOptionsGrid.innerHTML = '';
                if (currentQ.options && currentQ.options.length === 2) {
                    overlayOptionsGrid.classList.add('two-options');
                } else {
                    overlayOptionsGrid.classList.remove('two-options');
                }
            }
            if (overlayMatchGrid)   overlayMatchGrid.style.display = 'none';
            if (overlayPuzzleWrap)  overlayPuzzleWrap.style.display = 'none';

            if (currentQ.imageUrl) {
                if (overlayGameImage) overlayGameImage.src = currentQ.imageUrl;
                if (overlayQMedia)    overlayQMedia.style.display = 'block';
            } else {
                if (overlayQMedia) overlayQMedia.style.display = 'none';
            }

            const optionColors = ['option-violet', 'option-cyan', 'option-amber', 'option-rose'];
            currentQ.options.forEach((optText, index) => {
                const btn = document.createElement('button');
                const colorClass = optionColors[index % optionColors.length];
                btn.className = `btn-option ${colorClass}`;
                const letter = String.fromCharCode(65 + index);
                btn.innerHTML = `<span class="option-badge">${letter}</span><span class="option-text">${optText}</span>`;
                btn.addEventListener('click', () => {
                    if (!isAnswered) checkAnswer(index, currentQ.correctIndex);
                });
                if (overlayOptionsGrid) overlayOptionsGrid.appendChild(btn);
            });

            // Animación cinematográfica elástica de entrada con Anime.js
            if (typeof anime !== 'undefined') {
                if (overlayQuestionCard) {
                    anime({
                        targets: overlayQuestionCard,
                        opacity: [0, 1],
                        translateY: [12, 0],
                        duration: 350,
                        easing: 'cubicBezier(0.34, 1.56, 0.64, 1)'
                    });
                }
                if (overlayOptionsGrid) {
                    anime({
                        targets: overlayOptionsGrid.querySelectorAll('.btn-option'),
                        opacity: [0, 1],
                        translateY: [16, 0],
                        scale: [0.97, 1],
                        delay: anime.stagger(50),
                        duration: 360,
                        easing: 'cubicBezier(0.34, 1.56, 0.64, 1)'
                    });
                }
            }

        } else if (type === 'Emparejar') {
            if (overlayQuestionCard) overlayQuestionCard.style.display = 'none';
            if (overlayQCounter)  overlayQCounter.textContent  = `Par 0 de ${currentActivity.questions.length}`;
            if (overlayScoreDisp) overlayScoreDisp.textContent = `Puntos: ${score}`;

            if (overlayQText)       overlayQText.style.display       = 'none';
            if (overlayQMedia)      overlayQMedia.style.display      = 'none';
            if (overlayOptionsGrid) overlayOptionsGrid.style.display = 'none';
            if (overlayMatchGrid)   overlayMatchGrid.style.display   = 'grid';
            if (overlayPuzzleWrap)  overlayPuzzleWrap.style.display  = 'none';

            if (overlayMatchLeft)  overlayMatchLeft.innerHTML  = '';
            if (overlayMatchRight) overlayMatchRight.innerHTML = '';

            matchedPairsCount  = 0;
            matchSelectedLeft  = null;
            matchSelectedRight = null;

            let leftItems = [];
            let rightItems = [];
            currentActivity.questions.forEach((q, idx) => {
                leftItems.push({ id: idx, text: q.leftText, imageUrl: q.imageUrl });
                rightItems.push({ id: idx, text: q.rightText });
            });
            function shuffleArr(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} }
            shuffleArr(leftItems);
            shuffleArr(rightItems);

            leftItems.forEach((item, i) => {
                const btn = document.createElement('button');
                btn.className = 'match-item';
                let inner = item.imageUrl ? `<img src="${item.imageUrl}" alt="Media">` : '';
                inner += `<span>${item.text}</span>`;
                btn.innerHTML = inner;
                btn.dataset.id = item.id; btn.dataset.side = 'left';
                btn.addEventListener('click', () => handleMatchClick(btn, 'left'));
                if (overlayMatchLeft) overlayMatchLeft.appendChild(btn);
            });
            rightItems.forEach((item, i) => {
                const btn = document.createElement('button');
                btn.className = 'match-item';
                btn.innerHTML = `<span>${item.text}</span>`;
                btn.dataset.id = item.id; btn.dataset.side = 'right';
                btn.addEventListener('click', () => handleMatchClick(btn, 'right'));
                if (overlayMatchRight) overlayMatchRight.appendChild(btn);
            });

        } else if (type === 'Ahorcado') {
            const currentQ = currentActivity.questions[currentQuestionIndex];
            if (overlayQCounter)  overlayQCounter.textContent  = `Palabra ${currentQuestionIndex + 1} de ${currentActivity.questions.length}`;
            if (overlayScoreDisp) overlayScoreDisp.textContent = `Puntos: ${score}`;

            if (overlayQuestionCard) overlayQuestionCard.style.display = 'none';
            if (overlayQText)       overlayQText.style.display       = 'none';
            if (overlayQMedia)      overlayQMedia.style.display      = 'none';
            if (overlayOptionsGrid) overlayOptionsGrid.style.display = 'none';
            if (overlayMatchGrid)   overlayMatchGrid.style.display   = 'none';
            if (overlayPuzzleWrap)  overlayPuzzleWrap.style.display  = 'none';

            hangmanWord = currentQ.word.trim().toUpperCase();
            hangmanGuessed.clear();
            hangmanMistakes = 0;

            // Alfabeto español completo (27 letras: 3 filas de 9)
            hangmanKeyboardPool = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

            const hintText = currentQ.hint ? `Pista: ${currentQ.hint}` : 'Adivina la palabra oculta';
            const hangHTML = `<div class="hangman-layout">
                <div class="hangman-stage-card">
                    <div class="hangman-hint-badge">${hintText}</div>
                    <div class="hangman-drawing-container" id="hangman-drawing"></div>
                    <div class="hangman-word-container" id="hangman-word-display"></div>
                </div>
                <div class="hangman-keyboard" id="hangman-keyboard"></div>
            </div>`;
            const tmp = document.createElement('div');
            tmp.innerHTML = hangHTML;
            if (overlayGameBody) overlayGameBody.appendChild(tmp.firstElementChild);

            renderHangmanDrawing();
            renderHangmanWord();
            renderHangmanKeyboard();

        } else if (type === 'Rompecabezas') {
            if (overlayQuestionCard) overlayQuestionCard.style.display = 'none';
            if (overlayQCounter)  overlayQCounter.textContent  = 'Rompecabezas';
            if (overlayScoreDisp) overlayScoreDisp.textContent = `Puntos: ${score}`;

            if (overlayQText)       overlayQText.style.display       = 'none';
            if (overlayQMedia)      overlayQMedia.style.display      = 'none';
            if (overlayOptionsGrid) overlayOptionsGrid.style.display = 'none';
            if (overlayMatchGrid)   overlayMatchGrid.style.display   = 'none';
            if (overlayPuzzleWrap)  overlayPuzzleWrap.style.display  = 'flex';

            if (overlayPuzzleGrid) {
                overlayPuzzleGrid.innerHTML = '';
                overlayPuzzleGrid.className = 'puzzle-grid';
                buildJigsawPuzzle(overlayPuzzleGrid, currentActivity);
            }
        }
    }


    // â”€â”€ buildJigsawPuzzle: drag & drop con snap magnético â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function buildJigsawPuzzle(puzzleGrid, activity) {
        const diff = activity.difficulty || 3;
        const availW = Math.min(
            window.innerWidth  <= 600 ? window.innerWidth  - 56 : 380,
            window.innerHeight <= 600 ? window.innerHeight - 190 : 380
        );
        const gridSize = Math.max(180, availW);
        puzzleGrid.style.width  = `${gridSize}px`;
        puzzleGrid.style.height = `${gridSize}px`;
        puzzleGrid.style.display = 'block';

        const blueprint = document.getElementById('puzzle-blueprint');
        if (blueprint) {
            blueprint.style.width  = `${gridSize}px`;
            blueprint.style.height = `${gridSize}px`;
        }

        const logSize  = gridSize / diff;          // tamaño lógico de cada celda
        const TAB      = logSize * 0.28;           // altura/ancho del tab jigsaw
        const EXTRA    = TAB;                       // padding extra por cada lado
        const pieceBox = logSize + 2 * EXTRA;      // tamaño real del div de pieza

        // Generar tabs (1=saliente, -1=entrante) para bordes interiores
        const hTabs = Array.from({length: diff}, () =>
            Array.from({length: diff - 1}, () => Math.random() > 0.5 ? 1 : -1));
        const vTabs = Array.from({length: diff - 1}, () =>
            Array.from({length: diff}, () => Math.random() > 0.5 ? 1 : -1));

        // Función que genera el path jigsaw en coordenadas 0..pieceBox
        function makePath(r, c) {
            const T = EXTRA; // offset del origen lógico dentro del div de pieza
            const S = logSize;
            const tb = TAB;
            // Tabs de este lado respecto al viewport de la pieza
            const topDir    = r === 0         ? 0 : -vTabs[r-1][c];
            const botDir    = r === diff-1    ? 0 :  vTabs[r][c];
            const leftDir   = c === 0         ? 0 : -hTabs[r][c-1];
            const rightDir  = c === diff-1    ? 0 :  hTabs[r][c];

            // Esquinas del área lógica en el espacio del div
            const x0 = T, y0 = T, x1 = T + S, y1 = T + S;
            const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;

            let d = `M ${x0},${y0} `;
            // Top edge (izq → der)
            if (topDir === 0) { d += `L ${x1},${y0} `; }
            else {
                const ty = y0 - topDir * tb;
                d += `L ${mx - S*0.15},${y0} C ${mx - S*0.15},${ty} ${mx + S*0.15},${ty} ${mx + S*0.15},${y0} L ${x1},${y0} `;
            }
            // Right edge (arriba → abajo)
            if (rightDir === 0) { d += `L ${x1},${y1} `; }
            else {
                const rx = x1 + rightDir * tb;
                d += `L ${x1},${my - S*0.15} C ${rx},${my - S*0.15} ${rx},${my + S*0.15} ${x1},${my + S*0.15} L ${x1},${y1} `;
            }
            // Bottom edge (der → izq)
            if (botDir === 0) { d += `L ${x0},${y1} `; }
            else {
                const by = y1 + botDir * tb;
                d += `L ${mx + S*0.15},${y1} C ${mx + S*0.15},${by} ${mx - S*0.15},${by} ${mx - S*0.15},${y1} L ${x0},${y1} `;
            }
            // Left edge (abajo → arriba)
            if (leftDir === 0) { d += `L ${x0},${y0} `; }
            else {
                const lx = x0 - leftDir * tb;
                d += `L ${x0},${my + S*0.15} C ${lx},${my + S*0.15} ${lx},${my - S*0.15} ${x0},${my - S*0.15} L ${x0},${y0} `;
            }
            d += 'Z';
            return d;
        }

        // Crear datos de piezas, mezclar posiciones
        const pieces = [];
        for (let i = 0; i < diff * diff; i++) {
            const r = Math.floor(i / diff), c = i % diff;
            pieces.push({ correctR: r, correctC: c, curR: r, curC: c });
        }
        // Fisher-Yates sobre posiciones
        const positions = pieces.map((_, i) => i);
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        // Colocar cada pieza en su posición mezclada
        pieces.forEach((piece, idx) => {
            const pos = positions[idx];
            piece.curR = Math.floor(pos / diff);
            piece.curC = pos % diff;
        });

        const SNAP_THRESHOLD = logSize * 0.38;

        function getPixelPos(r, c) {
            return { x: c * logSize - EXTRA, y: r * logSize - EXTRA };
        }

        function checkAllWin() {
            const all = Array.from(puzzleGrid.querySelectorAll('.puzzle-piece'));
            const won = all.every(p => p.dataset.locked === '1');
            if (won) {
                playVictorySound();
                triggerConfetti();
                puzzleGrid.classList.add('won');
                // Mostrar imagen completa
                const winImg = document.createElement('div');
                winImg.style.cssText = `position:absolute;inset:0;background-image:url(${activity.puzzleImage});background-size:100% 100%;opacity:0;transition:opacity 0.8s;z-index:5;border-radius:12px;`;
                puzzleGrid.appendChild(winImg);
                setTimeout(() => winImg.style.opacity = '1', 80);

                isAnswered = true;
                animateScoreIncrease(1);
                showFloatingFeedback(true, '¡Rompecabezas completado!', 1500);

                setTimeout(() => {
                    fadeTransition(() => {
                        showResults();
                    });
                }, 1600);
            }
        }

        // Construir cada div de pieza
        pieces.forEach((piece) => {
            const div = document.createElement('div');
            div.className = 'puzzle-piece';
            const { x, y } = getPixelPos(piece.curR, piece.curC);
            div.style.width  = `${pieceBox}px`;
            div.style.height = `${pieceBox}px`;
            div.style.left   = `${x}px`;
            div.style.top    = `${y}px`;
            div.style.zIndex = '2';

            const d = makePath(piece.correctR, piece.correctC);
            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pieceBox} ${pieceBox}"><path d="${d}" fill="black"/></svg>`;
            const maskUrl = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}')`;

            div.style.backgroundImage    = `url(${activity.puzzleImage})`;
            div.style.backgroundSize     = `${gridSize}px ${gridSize}px`;
            div.style.backgroundPosition = `${-(piece.correctC * logSize - EXTRA)}px ${-(piece.correctR * logSize - EXTRA)}px`;
            div.style.webkitMaskImage    = maskUrl;
            div.style.maskImage          = maskUrl;
            div.style.webkitMaskSize     = '100% 100%';
            div.style.maskSize           = '100% 100%';

            div.dataset.correctR = piece.correctR;
            div.dataset.correctC = piece.correctC;
            div.dataset.locked   = '0';

            // ── Drag & Drop (mouse + touch) ───────────────────────
            let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

            function onMouseMove(e) {
                if (dragging) onDragMove(e.clientX, e.clientY);
            }
            function onMouseUp() {
                if (dragging) onDragEnd();
            }
            function onTouchMove(e) {
                if (dragging && e.touches[0]) {
                    e.preventDefault();
                    onDragMove(e.touches[0].clientX, e.touches[0].clientY);
                }
            }
            function onTouchEnd() {
                if (dragging) onDragEnd();
            }

            function onDragStart(clientX, clientY) {
                if (div.dataset.locked === '1') return;
                dragging = true;
                startX = clientX; startY = clientY;
                origLeft = parseFloat(div.style.left);
                origTop  = parseFloat(div.style.top);
                div.classList.add('piece-dragging');
                div.style.zIndex = '50';
                div.style.transition = 'none';

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
                window.addEventListener('touchmove', onTouchMove, { passive: false });
                window.addEventListener('touchend', onTouchEnd);
                window.addEventListener('touchcancel', onTouchEnd);
            }

            function onDragMove(clientX, clientY) {
                if (!dragging) return;
                const dx = clientX - startX, dy = clientY - startY;
                div.style.left = `${origLeft + dx}px`;
                div.style.top  = `${origTop  + dy}px`;
            }

            function onDragEnd() {
                if (!dragging) return;
                dragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
                window.removeEventListener('touchcancel', onTouchEnd);

                div.classList.remove('piece-dragging');
                div.style.zIndex = '2';

                const curLeft = parseFloat(div.style.left);
                const curTop  = parseFloat(div.style.top);
                const targetC = parseInt(div.dataset.correctC);
                const targetR = parseInt(div.dataset.correctR);
                const { x: snapX, y: snapY } = getPixelPos(targetR, targetC);

                const dist = Math.hypot(curLeft - snapX, curTop - snapY);
                if (dist < SNAP_THRESHOLD) {
                    playSnapSound();
                    // Snap magnético
                    div.classList.add('piece-snapping');
                    div.style.left   = `${snapX}px`;
                    div.style.top    = `${snapY}px`;
                    div.dataset.locked = '1';
                    div.classList.add('piece-locked');
                    div.style.zIndex = '1'; // Pegada debajo de todo
                    div.style.pointerEvents = 'none'; // Ya no se puede seleccionar
                    setTimeout(() => div.classList.remove('piece-snapping'), 400);
                    checkAllWin();
                }
            }

            // Mouse
            div.addEventListener('mousedown', e => {
                e.preventDefault();
                onDragStart(e.clientX, e.clientY);
            });

            // Touch
            div.addEventListener('touchstart', e => {
                if (e.touches[0]) {
                    onDragStart(e.touches[0].clientX, e.touches[0].clientY);
                }
            }, { passive: true });

            puzzleGrid.appendChild(div);
        });
    }


    // Single Question Logic
    function checkAnswer(selectedIndex, actualCorrectIndex) {
        isAnswered = true;
        const isCorrect = (selectedIndex === actualCorrectIndex);

        if (overlayOptionsGrid) {
            const allBtns = overlayOptionsGrid.querySelectorAll('.btn-option');
            allBtns.forEach((btn, idx) => {
                btn.disabled = true;
                if (idx === actualCorrectIndex) {
                    btn.classList.add('correct');
                } else if (idx === selectedIndex && !isCorrect) {
                    btn.classList.add('incorrect');
                }
            });
        }

        if (isCorrect) {
            playCorrectSound();
            animateScoreIncrease(score + 1);
            showFloatingFeedback(true, '¡Excelente!');
        } else {
            playIncorrectSound();
            showFloatingFeedback(false, '¡Ups! Incorrecto');
        }

        const isLastQuestion = (currentQuestionIndex >= currentActivity.questions.length - 1);
        if (isLastQuestion) {
            setTimeout(() => {
                fadeTransition(() => {
                    showResults();
                });
            }, 1200);
        } else {
            setTimeout(() => {
                currentQuestionIndex++;
                fadeTransition(() => {
                    renderQuestion();
                });
            }, 1300);
        }
    }

    // Match Board Logic
    function handleMatchClick(btn, side) {
        if (btn.classList.contains('match-matched')) return;

        if (side === 'left') {
            if (matchSelectedLeft) matchSelectedLeft.classList.remove('match-selected');
            matchSelectedLeft = btn;
            btn.classList.add('match-selected');
        } else {
            if (matchSelectedRight) matchSelectedRight.classList.remove('match-selected');
            matchSelectedRight = btn;
            btn.classList.add('match-selected');
        }

        if (matchSelectedLeft && matchSelectedRight) {
            checkMatchPair();
        }
    }

    function checkMatchPair() {
        const leftId = matchSelectedLeft.dataset.id;
        const rightId = matchSelectedRight.dataset.id;

        const btnL = matchSelectedLeft;
        const btnR = matchSelectedRight;

        if (leftId === rightId) {
            playCorrectSound();
            btnL.classList.remove('match-selected');
            btnR.classList.remove('match-selected');
            btnL.classList.add('match-matched');
            btnR.classList.add('match-matched');
            btnL.disabled = true;
            btnR.disabled = true;

            matchedPairsCount++;
            animateScoreIncrease(score + 1);

            if (overlayQCounter) overlayQCounter.textContent = `Par ${matchedPairsCount} de ${currentActivity.questions.length}`;

            showFloatingFeedback(true, '¡Pareja correcta!');

            if (matchedPairsCount === currentActivity.questions.length) {
                setTimeout(() => {
                    showFloatingFeedback(true, '¡Completado!', 1200);
                    setTimeout(() => {
                        fadeTransition(() => {
                            showResults();
                        });
                    }, 1200);
                }, 300);
            }

        } else {
            playIncorrectSound();
            btnL.classList.add('match-error');
            btnR.classList.add('match-error');
            showFloatingFeedback(false, 'No coinciden');

            setTimeout(() => {
                btnL.classList.remove('match-error', 'match-selected');
                btnR.classList.remove('match-error', 'match-selected');
            }, 500);
        }

        // Reset selections
        matchSelectedLeft = null;
        matchSelectedRight = null;
    }

    // Hangman Logic
    function renderHangmanDrawing() {
        const drawingContainer = document.getElementById('hangman-drawing');
        if (!drawingContainer) return;

        const parts = [
            `<path d="M20 195 L220 195" stroke="#64748b" stroke-width="8" fill="none" stroke-linecap="round"/>
             <path d="M65 195 L65 20 L175 20 L175 48" stroke="#64748b" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M65 60 L105 20" stroke="#94a3b8" stroke-width="6" fill="none" stroke-linecap="round"/>`,
            `<circle cx="175" cy="70" r="20" stroke="#ef4444" stroke-width="5" fill="#fee2e2"/>`,
            `<path d="M175 90 L175 140" stroke="#ef4444" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            `<path d="M175 105 L145 130" stroke="#ef4444" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            `<path d="M175 105 L205 130" stroke="#ef4444" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            `<path d="M175 140 L145 180" stroke="#ef4444" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            `<path d="M175 140 L205 180" stroke="#ef4444" stroke-width="5" fill="none" stroke-linecap="round"/>`
        ];

        let svgHtml = `<svg width="240" height="210" viewBox="0 0 240 210">`;
        svgHtml += parts[0];
        for (let i = 1; i <= hangmanMistakes; i++) {
            if (parts[i]) svgHtml += parts[i];
        }
        svgHtml += `</svg>`;
        drawingContainer.innerHTML = svgHtml;
    }

    function renderHangmanWord() {
        const wordContainer = document.getElementById('hangman-word-display');
        if (!wordContainer) return;

        const words = hangmanWord.split(' ');
        let html = '';
        words.forEach(word => {
            html += `<div class="hangman-word-group">`;
            for (let i = 0; i < word.length; i++) {
                const letter = word[i];
                const norm = normalizeChar(letter);
                const showLetter = hangmanGuessed.has(norm) || hangmanMistakes >= 6;
                const revClass = showLetter ? ' revealed' : '';
                html += `<div class="hangman-letter${revClass}">${showLetter ? letter : ''}</div>`;
            }
            html += `</div>`;
        });
        wordContainer.innerHTML = html;
    }

    function renderHangmanKeyboard() {
        const keyboard = document.getElementById('hangman-keyboard');
        if (!keyboard) return;
        keyboard.innerHTML = '';
        const wordNormalizedLetters = new Set([...hangmanWord].map(normalizeChar));

        for (let i = 0; i < hangmanKeyboardPool.length; i++) {
            const letter = hangmanKeyboardPool[i];
            const btn = document.createElement('button');
            btn.className = 'hangman-key';
            btn.textContent = letter;

            if (hangmanGuessed.has(letter)) {
                btn.disabled = true;
                if (wordNormalizedLetters.has(letter)) {
                    btn.classList.add('correct');
                } else {
                    btn.classList.add('incorrect');
                }
            }
            if (isAnswered || hangmanMistakes >= 6) {
                btn.disabled = true;
            }

            btn.addEventListener('click', () => handleHangmanKeyClick(letter));
            keyboard.appendChild(btn);
        }
    }

    function handleHangmanKeyClick(letter) {
        if (isAnswered || hangmanMistakes >= 6 || hangmanGuessed.has(letter)) return;

        hangmanGuessed.add(letter);
        const wordNormalizedLetters = new Set([...hangmanWord].map(normalizeChar));

        if (!wordNormalizedLetters.has(letter)) {
            playIncorrectSound();
            hangmanMistakes++;
        } else {
            playCorrectSound();
        }

        renderHangmanDrawing();
        renderHangmanWord();
        renderHangmanKeyboard();

        checkHangmanWin();
    }

    function checkHangmanWin() {
        let won = true;
        for (let i = 0; i < hangmanWord.length; i++) {
            const letter = hangmanWord[i];
            if (letter !== ' ' && !hangmanGuessed.has(normalizeChar(letter))) {
                won = false;
                break;
            }
        }

        if (won) {
            isAnswered = true;
            animateScoreIncrease(score + 1);
            playCorrectSound();
            showFloatingFeedback(true, '¡Palabra encontrada!');
            renderHangmanKeyboard();

            const isLastWord = (currentQuestionIndex >= currentActivity.questions.length - 1);
            if (isLastWord) {
                setTimeout(() => {
                    fadeTransition(() => {
                        showResults();
                    });
                }, 1300);
            } else {
                setTimeout(() => {
                    currentQuestionIndex++;
                    fadeTransition(() => {
                        renderQuestion();
                    });
                }, 1400);
            }

        } else if (hangmanMistakes >= 6) {
            isAnswered = true;
            playIncorrectSound();
            showFloatingFeedback(false, '¡Agotaste los intentos!');
            renderHangmanKeyboard();
            renderHangmanWord();

            const isLastWord = (currentQuestionIndex >= currentActivity.questions.length - 1);
            if (isLastWord) {
                setTimeout(() => {
                    fadeTransition(() => {
                        showResults();
                    });
                }, 1500);
            } else {
                setTimeout(() => {
                    currentQuestionIndex++;
                    fadeTransition(() => {
                        renderQuestion();
                    });
                }, 1500);
            }
        }
    }

    if (btnNextQuestion) {
        btnNextQuestion.addEventListener('click', () => {
            if (currentActivity.type === 'Emparejar' || currentActivity.type === 'Rompecabezas' || currentQuestionIndex >= currentActivity.questions.length - 1) {
                fadeTransition(() => {
                    showResults();
                });
            } else {
                currentQuestionIndex++;
                fadeTransition(() => {
                    renderQuestion();
                });
            }
        });
    }

    function showResults() {
        if (overlayGameBody)  overlayGameBody.style.display  = 'none';
        if (overlayResults)   overlayResults.style.display   = 'flex';
        if (overlayFeedback)  overlayFeedback.style.display  = 'none';
        if (overlayFloatingFeedback) overlayFloatingFeedback.style.display = 'none';
        if (overlayBar)       overlayBar.style.display       = 'none';

        let total = 1;
        if (currentActivity.type === 'Rompecabezas') {
            total = 1;
        } else if (currentActivity.type === 'Emparejar') {
            total = currentActivity.questions ? currentActivity.questions.length : 1;
        } else {
            total = currentActivity.questions ? currentActivity.questions.length : 1;
        }

        if (overlayTotalScore) overlayTotalScore.textContent = total;

        const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((score / total) * 100))) : 100;

        // Animar números progresivamente con Anime.js (CountUp)
        if (typeof anime !== 'undefined') {
            const scoreCount = { val: 0 };
            anime({
                targets: scoreCount,
                val: score,
                round: 1,
                duration: 800,
                easing: 'easeOutExpo',
                update: function() {
                    if (overlayFinalScore) overlayFinalScore.textContent = scoreCount.val;
                }
            });

            const accCount = { val: 0 };
            anime({
                targets: accCount,
                val: percent,
                round: 1,
                duration: 1100,
                easing: 'easeOutExpo',
                update: function() {
                    if (overlayAccuracyPercent) overlayAccuracyPercent.textContent = accCount.val;
                }
            });
        } else {
            if (overlayFinalScore) overlayFinalScore.textContent = score;
            if (overlayAccuracyPercent) overlayAccuracyPercent.textContent = percent;
        }

        // Reiniciar animación Lottie del trofeo si existe
        const lottiePlayer = document.getElementById('results-lottie-player');
        if (lottiePlayer && typeof lottiePlayer.stop === 'function' && typeof lottiePlayer.play === 'function') {
            lottiePlayer.stop();
            lottiePlayer.play();
        }

        if (resultsHeadline) {
            if (percent === 100) resultsHeadline.textContent = '¡Puntaje Perfecto!';
            else if (percent >= 70) resultsHeadline.textContent = '¡Excelente trabajo!';
            else if (percent >= 40) resultsHeadline.textContent = '¡Buen intento!';
            else resultsHeadline.textContent = '¡Sigue practicando!';
        }

        if (resultsSubtitle) {
            if (percent === 100) resultsSubtitle.textContent = '¡Acertaste todas las respuestas!';
            else if (percent >= 70) resultsSubtitle.textContent = '¡Has demostrado un gran dominio!';
            else resultsSubtitle.textContent = 'Puedes volver a jugar para mejorar tu puntaje.';
        }

        playVictorySound();
        triggerConfetti();
    }

    if (overlayBtnRestart) {
        overlayBtnRestart.addEventListener('click', () => {
            currentQuestionIndex = 0;
            score = 0;
            if (overlayResults)     overlayResults.style.display     = 'none';
            if (overlayStartScreen) overlayStartScreen.style.display  = 'none';
            if (overlayGameBody)    overlayGameBody.style.display     = 'flex';
            if (overlayBar)         overlayBar.style.display          = 'flex';
            if (scoreDisplay)       scoreDisplay.textContent         = 'Puntos: 0';
            renderQuestion();
        });
    }
    // Compat: btn antiguo del DOM (si existe)
    if (btnRestartGame && btnRestartGame !== overlayBtnRestart) {
        btnRestartGame.addEventListener('click', () => playActivity(currentActivity));
    }

    // Image Search Modal removed - using file upload instead
    // (btnCloseModal section removed to fix ReferenceError)

    // Lógica para Compartir con Firestore
    async function getDirectLink() {
        if (!currentActivity) return '';

        if (!currentActivity.id) {
            alert('La actividad debe estar guardada en la nube para compartirse.');
            throw new Error('La actividad no tiene un ID en la nube válido.');
        }

        return `${window.location.origin}${window.location.pathname}?id=${currentActivity.id}`;
    }

    // Función para copiar texto compatible con móvil
    async function copyToClipboard(text) {
        // Método moderno (requiere HTTPS)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn('navigator.clipboard falló, usando fallback:', e);
            }
        }
        // Fallback para móviles con browsers restrictivos
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.top = '0';
            textarea.style.left = '0';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            // Intentar execCommand (legacy pero funciona en Android WebView)
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (success) return true;
        } catch (e) {
            console.warn('execCommand falló:', e);
        }
        return false;
    }

    if (btnCopyLink) {
        btnCopyLink.addEventListener('click', async () => {
            if (!currentActivity) return;

            const originalText = btnCopyLink.innerHTML;
            btnCopyLink.innerHTML = 'Generando enlace...';
            btnCopyLink.disabled = true;

            try {
                const link = await getDirectLink();
                const copied = await copyToClipboard(link);

                showToast(copied ? "Enlace copiado al portapapeles" : "Enlace: " + link, copied ? 3000 : 6000);
            } catch (e) {
                console.error("Error copiando enlace:", e);
                showToast("Error al generar el enlace", 3000);
            } finally {
                btnCopyLink.innerHTML = originalText;
                btnCopyLink.disabled = false;
            }
        });
    }

    if (btnWhatsappShare) {
        btnWhatsappShare.addEventListener('click', async () => {
            if (!currentActivity) return;

            const originalText = btnWhatsappShare.innerHTML;
            btnWhatsappShare.innerHTML = 'Preparando WhatsApp...';
            btnWhatsappShare.disabled = true;

            try {
                const link = await getDirectLink();
                const text = encodeURIComponent(`Resuelve esta actividad: ${link}`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
            } catch (e) {
                console.error("Error compartiendo en WhatsApp:", e);
                alert("Hubo un error al generar el enlace.");
            } finally {
                btnWhatsappShare.innerHTML = originalText;
                btnWhatsappShare.disabled = false;
            }
        });
    }

    // Inicialización y Carga ultra-rápida desde URL con Firestore y Caché
    async function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedId = urlParams.get('id');

        if (sharedId) {
            document.body.classList.add('shared-mode');

            // Mostrar inmediatamente pantalla de carga en el overlay sin esperar
            if (gameOverlay) gameOverlay.style.display = 'flex';
            if (overlayStartScreen) overlayStartScreen.style.display = 'flex';
            if (overlayGameBody) overlayGameBody.style.display = 'none';
            if (overlayResults) overlayResults.style.display = 'none';
            if (overlayBar) overlayBar.style.display = 'none';
            if (overlayStartTitle) overlayStartTitle.textContent = 'Cargando actividad...';
            if (overlayStartType) overlayStartType.textContent = 'EduPlay';
            if (btnOverlayPlay) {
                btnOverlayPlay.disabled = true;
                btnOverlayPlay.style.opacity = '0.7';
                btnOverlayPlay.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;"></span>Cargando...';
            }

            if (document.getElementById('activities-container')) {
                document.getElementById('activities-container').innerHTML = '';
            }

            // 1. Revisar caché local primero para carga instantánea en 0ms
            const cachedRaw = sessionStorage.getItem('shared_act_' + sharedId);
            if (cachedRaw) {
                try {
                    const cachedAct = JSON.parse(cachedRaw);
                    playActivity(cachedAct);
                    if (overlayStartTitle) overlayStartTitle.textContent = cachedAct.title;
                    if (overlayStartType) overlayStartType.textContent = cachedAct.type;
                    if (btnOverlayPlay) {
                        btnOverlayPlay.disabled = false;
                        btnOverlayPlay.style.opacity = '1';
                        btnOverlayPlay.innerHTML = '<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" style="margin-right:8px;"><path d="M8 5v14l11-7z"/></svg> Jugar';
                    }
                } catch (e) {
                    console.warn("Error leyendo caché:", e);
                }
            }

            try {
                const doc = await db.collection("activities").doc(sharedId).get();

                if (doc.exists) {
                    const rawData = doc.data().data;
                    sessionStorage.setItem('shared_act_' + sharedId, rawData);
                    const sharedActivity = JSON.parse(rawData);

                    // Registrar la jugada en Firestore de forma silenciosa
                    db.collection("activities").doc(sharedId).update({
                        plays: firebase.firestore.FieldValue.increment(1)
                    }).catch(() => {});

                    window.history.replaceState({}, document.title, window.location.pathname);

                    playActivity(sharedActivity);
                    if (overlayStartTitle) overlayStartTitle.textContent = sharedActivity.title;
                    if (overlayStartType)  overlayStartType.textContent  = sharedActivity.type;
                    if (btnOverlayPlay) {
                        btnOverlayPlay.disabled = false;
                        btnOverlayPlay.style.opacity = '1';
                        btnOverlayPlay.innerHTML = '<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" style="margin-right:8px;"><path d="M8 5v14l11-7z"/></svg> Jugar';
                    }

                } else {
                    if (!cachedRaw) {
                        alert("La actividad no existe o ha sido eliminada.");
                        document.body.classList.remove('shared-mode');
                        if (gameOverlay) gameOverlay.style.display = 'none';
                        renderActivities();
                    }
                }
            } catch (e) {
                console.error("Error cargando actividad desde Firestore:", e.code, e.message);
                if (!cachedRaw) {
                    if (e.code !== 'permission-denied') {
                        alert("Hubo un error al cargar la actividad. Cargando inicio normal.");
                    }
                    document.body.classList.remove('shared-mode');
                    if (gameOverlay) gameOverlay.style.display = 'none';
                    window.history.replaceState({}, document.title, window.location.pathname);
                    renderActivities();
                }
            }
        } else {
            renderActivities();
        }
    }

    // â”€â”€ Auth: Google Login / Logout / State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Contenido original del botón para restaurarlo después
    const loginBtnOriginalHTML = btnLogin ? btnLogin.innerHTML : '';

    // Función para mostrar estado de carga en el botón
    function setLoginLoading(loading) {
        if (!btnLogin) return;
        if (loading) {
            btnLogin.disabled = true;
            btnLogin.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"/>
                </svg>
                Conectando...
            `;
        } else {
            btnLogin.disabled = false;
            btnLogin.innerHTML = loginBtnOriginalHTML;
        }
    }

    // Si estamos volviendo de un redirect, mostrar loading inmediatamente
    if (sessionStorage.getItem('eduplay_auth_redirect') === '1') {
        setLoginLoading(true);
    }

    // Procesar resultado de redirect ANTES de todo lo demás
    let redirectHandled = false;
    auth.getRedirectResult().then(result => {
        redirectHandled = true;
        sessionStorage.removeItem('eduplay_auth_redirect');
        if (result && result.user) {
            console.log("[Auth] Redirect exitoso:", result.user.displayName);
        } else if (!auth.currentUser) {
            setLoginLoading(false);
        }
    }).catch(err => {
        redirectHandled = true;
        sessionStorage.removeItem('eduplay_auth_redirect');
        if (err.code && err.code !== 'auth/credential-already-in-use') {
            console.error("Error al obtener resultado de redirect:", err);
        }
        setLoginLoading(false);
    });

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            setLoginLoading(true);

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            } catch (err) {
                console.error("Error seteando persistencia:", err);
            }

            try {
                const result = await auth.signInWithPopup(provider);
                console.log("[Auth] Popup exitoso:", result.user.displayName);
            } catch (e) {
                console.warn('Popup falló:', e.code || e.message);
                // Si el popup fue bloqueado por Safari / iPadOS / iOS, usar redirect automáticamente sin mostrar error
                if (e.code === 'auth/popup-blocked') {
                    sessionStorage.setItem('eduplay_auth_redirect', '1');
                    try {
                        await auth.signInWithRedirect(provider);
                        return;
                    } catch (redirectErr) {
                        console.error('Error en fallback signInWithRedirect:', redirectErr);
                        sessionStorage.removeItem('eduplay_auth_redirect');
                    }
                }
                if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-blocked') {
                    alert('Error al conectar con Google: ' + e.message);
                }
                setLoginLoading(false);
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await auth.signOut();
            } catch (e) {
                console.error('Error en logout:', e);
            }
        });
    }

    // Función auxiliar: extraer solo el primer nombre
    function getFirstName(fullName) {
        if (!fullName) return 'Usuario';
        return fullName.trim().split(' ')[0];
    }

    // Listener único de estado de autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            // Login exitoso: mostrar info del usuario
            if (btnLogin) btnLogin.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userName) userName.textContent = getFirstName(user.displayName);
            if (userPhoto) {
                userPhoto.src = user.photoURL || '';
                userPhoto.style.display = user.photoURL ? 'block' : 'none';
            }
            sessionStorage.removeItem('eduplay_auth_redirect');
        } else {
            // No hay usuario: mostrar botón de login
            if (btnLogin) {
                btnLogin.style.display = 'flex';
                // Solo restaurar si no estamos esperando un redirect
                if (sessionStorage.getItem('eduplay_auth_redirect') !== '1') {
                    setLoginLoading(false);
                }
            }
            if (userInfo) userInfo.style.display = 'none';
        }
        // Verificar URL params solo una vez
        if (!urlParamsChecked) {
            urlParamsChecked = true;
            checkUrlParams();
        } else {
            // Actualizar vista de actividades al cambiar de cuenta o hacer logout
            renderActivities();
        }
    });
    // Preview panel starts hidden (create-view is default, not edit-view)
});

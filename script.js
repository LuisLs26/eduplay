document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyCqbEQWT_m9U7fH2ynRV9ZzFSz_W-gMOJg",
        authDomain: "eduplay-a7679.firebaseapp.com",
        projectId: "eduplay-a7679",
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    auth.getRedirectResult().then((result) => {
        if (result.user) {
            console.log("Usuario logueado via redirect:", result.user);
        }
    }).catch((error) => {
        console.error("Error en redirect:", error);
    });
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');
    const createForm = document.getElementById('create-form');
    const activitiesContainer = document.getElementById('activities-container');
    const typeInput = document.getElementById('activity-type');

    // UI elements for the form
    const questionsContainer = document.getElementById('questions-container');
    const btnAddQuestion = document.getElementById('btn-add-question');

    // UI elements for preview
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const gameContainer = document.getElementById('game-container');
    const resultsContainer = document.getElementById('results-container');

    const gameMainTitle = document.getElementById('game-main-title');
    const gameMainSubtitle = document.getElementById('game-main-subtitle');
    const shareButtonsContainer = document.getElementById('share-buttons-container');
    const btnCopyLink = document.getElementById('btn-copy-link');
    const btnWhatsappShare = document.getElementById('btn-whatsapp-share');
    const toastNotification = document.getElementById('toast-notification');

    const questionCounter = document.getElementById('question-counter');
    const scoreDisplay = document.getElementById('score-display');

    // Game Content Area
    const gameContentArea = document.getElementById('game-content-area');
    const questionMedia = document.getElementById('question-media');
    const gameImage = document.getElementById('game-image');

    const questionText = document.getElementById('question-text');
    const optionsGrid = document.getElementById('options-grid');

    // Match Grid specific
    const matchGrid = document.getElementById('match-grid');
    const matchColLeft = document.getElementById('match-col-left');
    const matchColRight = document.getElementById('match-col-right');

    const gameFeedback = document.getElementById('game-feedback');
    const feedbackText = document.getElementById('feedback-text');
    const btnNextQuestion = document.getElementById('btn-next-question');

    const finalScoreText = document.getElementById('final-score-text');
    const totalScoreText = document.getElementById('total-score-text');
    const btnRestartGame = document.getElementById('btn-restart-game');

    // Game state
    let currentActivity = null;
    let currentQuestionIndex = 0;
    let score = 0;
    let isAnswered = false;

    // Image Search Modal
    const searchModal = document.getElementById('image-search-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const searchInput = document.getElementById('image-search-input');
    const btnSearchExecute = document.getElementById('btn-search-execute');
    const searchLoader = document.getElementById('image-search-loader');
    const searchResultsGrid = document.getElementById('image-search-results');
    let currentImageTarget = null;

    // Match Game state
    let matchSelectedLeft = null;
    let matchSelectedRight = null;
    let matchedPairsCount = 0;

    // Auth UI refs
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    // 1. Obtener actividades
    function getActivities() {
        try {
            const data = localStorage.getItem('eduplay_activities');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error leyendo de localStorage", e);
            return [];
        }
    }

    // 2. Guardar en localStorage
    function saveActivities(activitiesArray) {
        localStorage.setItem('eduplay_activities', JSON.stringify(activitiesArray));
    }

    // 3. Navegación SPA
    function navigateTo(targetId) {
        navLinks.forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        if (targetId === 'list-view') {
            renderActivities();
        } else if (targetId === 'preview-view' && !currentActivity) {
            if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
            if (gameContainer) gameContainer.style.display = 'none';
            if (resultsContainer) resultsContainer.style.display = 'none';
            if (gameMainTitle) gameMainTitle.textContent = "Vista previa";
            if (gameMainSubtitle) gameMainSubtitle.textContent = "Prueba tu actividad antes de compartirla.";
            if (shareButtonsContainer) shareButtonsContainer.style.display = 'none';
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.target);
        });
    });

    // 4. Renderizar lista
    function renderActivities() {
        const currentActivities = getActivities();
        if (activitiesContainer) activitiesContainer.innerHTML = '';

        if (currentActivities.length === 0) {
            if (activitiesContainer) activitiesContainer.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No tienes actividades creadas aún.</p>';
            return;
        }

        currentActivities.forEach(act => {
            const card = document.createElement('div');
            card.className = 'activity-card';
            const numPreguntas = act.questions ? act.questions.length : 0;

            card.innerHTML = `
                <div class="card-header">
                    <h3>${act.title}</h3>
                    <button class="btn-delete" data-id="${act.id}" title="Eliminar actividad">🗑️</button>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <span class="type-badge">${act.type}</span>
                    <span class="type-badge" style="background: rgba(34, 197, 94, 0.15); color: #22c55e;">${numPreguntas} Qs/Pares</span>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete')) return;
                if (act.questions && act.questions.length > 0) {
                    playActivity(act);
                    navigateTo('preview-view');
                } else {
                    alert('Esta actividad está vacía.');
                }
            });

            const deleteBtn = card.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`¿Seguro que deseas eliminar la actividad "${act.title}"?`)) {
                    let freshActivities = getActivities();
                    freshActivities = freshActivities.filter(a => a.id !== act.id);
                    saveActivities(freshActivities);
                    renderActivities();
                    if (currentActivity && currentActivity.id === act.id) {
                        currentActivity = null;
                    }
                }
            });

            if (activitiesContainer) activitiesContainer.appendChild(card);
        });
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

        let headerTitle = currentType === 'Emparejar' ? 'Par' : 'Pregunta';

        let innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 style="margin: 0; color: var(--text-primary);">${headerTitle} ${questionCount}</h4>
                <button type="button" class="btn-remove-question" title="Eliminar">🗑️</button>
            </div>
            <div class="form-group image-url-group">
                <input type="hidden" class="q-image-url">
                <button type="button" class="btn-search-img">🖼️ Buscar imagen</button>
                <div class="image-preview-container" style="display: none; text-align: center; margin-top: 10px;">
                    <img src="" alt="Vista previa" style="max-height: 150px; border-radius: 8px;">
                    <button type="button" class="btn-remove-img" style="display: block; margin: 8px auto 0; background: none; border: none; color: #ef4444; cursor: pointer; text-decoration: underline; font-size: 0.9rem;">Quitar imagen</button>
                </div>
            </div>
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
                    <input type="text" class="q-text" placeholder="Escribe la afirmación aquí..." required>
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
                        <span style="min-width: 80px;">Elemento 1:</span>
                        <input type="text" class="q-left" placeholder="Ej: Perro" required>
                    </div>
                    <div class="option-row">
                        <span style="min-width: 80px;">Elemento 2:</span>
                        <input type="text" class="q-right" placeholder="Ej: Guau" required>
                    </div>
                </div>
            `;
        }

        block.innerHTML = innerHTML;

        const imgInput = block.querySelector('.q-image-url');
        const imgContainer = block.querySelector('.image-preview-container');
        const imgPreview = block.querySelector('.image-preview-container img');
        const btnSearch = block.querySelector('.btn-search-img');
        const btnRemoveImg = block.querySelector('.btn-remove-img');

        btnSearch.addEventListener('click', () => {
            currentImageTarget = { input: imgInput, preview: imgPreview, container: imgContainer };
            searchModal.style.display = 'flex';
            searchInput.value = '';
            searchResultsGrid.innerHTML = '';
            searchInput.focus();
        });

        btnRemoveImg.addEventListener('click', () => {
            imgInput.value = '';
            imgPreview.src = '';
            imgContainer.style.display = 'none';
        });

        block.querySelector('.btn-remove-question').addEventListener('click', () => {
            block.remove();
        });

        if (questionsContainer) questionsContainer.appendChild(block);
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

    // 6. Guardar actividad
    if (createForm) {
        createForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const currentType = typeInput ? typeInput.value : '';
            const titleEl = document.getElementById('activity-title');
            const title = titleEl ? titleEl.value.trim() : '';

            if (!title) {
                alert('El título no puede estar vacío.');
                return;
            }

            const questionBlocks = questionsContainer ? questionsContainer.querySelectorAll('.question-block') : [];
            if (questionBlocks.length === 0) {
                alert('Debes agregar al menos un elemento.');
                return;
            }

            const questionsArray = [];
            let hasErrors = false;

            questionBlocks.forEach(block => {
                const imgUrl = block.querySelector('.q-image-url').value.trim();

                if (currentType === 'Opción múltiple' || currentType === 'Verdadero/Falso') {
                    const text = block.querySelector('.q-text').value.trim();
                    const opts = block.querySelectorAll('.opt-text');
                    const radios = block.querySelectorAll('input[type="radio"]');

                    let correctIndex = 0;
                    let optionsArray = [];

                    opts.forEach((opt, index) => {
                        optionsArray.push(opt.value.trim());
                        if (radios[index].checked) correctIndex = index;
                    });

                    if (!text || optionsArray.some(o => o === '')) hasErrors = true;

                    questionsArray.push({
                        text: text,
                        imageUrl: imgUrl,
                        options: optionsArray,
                        correctIndex: correctIndex
                    });
                } else if (currentType === 'Emparejar') {
                    const left = block.querySelector('.q-left').value.trim();
                    const right = block.querySelector('.q-right').value.trim();

                    if (!left || !right) hasErrors = true;

                    questionsArray.push({
                        leftText: left,
                        imageUrl: imgUrl,
                        rightText: right
                    });
                }
            });

            if (hasErrors) {
                alert('Por favor completa todos los campos de texto requeridos.');
                return;
            }

            // Guard: require login to save
            const user = auth.currentUser;
            if (!user) {
                alert('Debes iniciar sesión con Google para crear actividades.');
                return;
            }

            const newActivity = {
                id: Date.now(),
                title: title,
                type: currentType,
                questions: questionsArray
            };

            const latestActivities = getActivities();
            latestActivities.unshift(newActivity);
            saveActivities(latestActivities);

            createForm.reset();
            if (questionsContainer) questionsContainer.innerHTML = '';

            navigateTo('list-view');
        });
    }

    // 7. Motor de Juego Dinámico y Transiciones
    function fadeTransition(callback) {
        if (gameContentArea) {
            gameContentArea.classList.remove('fade-in');
            gameContentArea.classList.add('fade-out');
        }

        setTimeout(() => {
            callback();
            if (gameContentArea) {
                gameContentArea.classList.remove('fade-out');
                gameContentArea.classList.add('fade-in');
            }
        }, 300);
    }

    function playActivity(activity) {
        currentActivity = activity;
        currentQuestionIndex = 0;
        score = 0;

        if (gameMainTitle) gameMainTitle.textContent = `Jugando: ${activity.title}`;
        if (gameMainSubtitle) gameMainSubtitle.textContent = `Tipo: ${activity.type}`;
        if (shareButtonsContainer) shareButtonsContainer.style.display = 'flex';

        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (gameContainer) gameContainer.style.display = 'block';

        if (gameContentArea) {
            gameContentArea.classList.remove('fade-out');
            gameContentArea.classList.add('fade-in');
        }

        renderQuestion();
    }

    function renderQuestion() {
        isAnswered = false;
        if (gameFeedback) gameFeedback.style.display = 'none';
        if (btnNextQuestion) btnNextQuestion.style.display = 'none';

        const type = currentActivity.type;

        if (type === 'Opción múltiple' || type === 'Verdadero/Falso') {
            const currentQ = currentActivity.questions[currentQuestionIndex];
            if (questionCounter) questionCounter.textContent = `Pregunta ${currentQuestionIndex + 1} de ${currentActivity.questions.length}`;
            if (scoreDisplay) scoreDisplay.textContent = `Puntos: ${score}`;

            if (questionText) questionText.style.display = 'block';
            if (optionsGrid) {
                optionsGrid.style.display = 'grid';
                optionsGrid.innerHTML = '';
            }
            if (matchGrid) matchGrid.style.display = 'none';

            if (currentQ.imageUrl) {
                if (gameImage) gameImage.src = currentQ.imageUrl;
                if (questionMedia) questionMedia.style.display = 'block';
            } else {
                if (gameImage) gameImage.src = '';
                if (questionMedia) questionMedia.style.display = 'none';
            }

            if (questionText) questionText.textContent = currentQ.text;

            currentQ.options.forEach((optText, index) => {
                const btn = document.createElement('button');
                btn.className = 'btn-option';
                btn.textContent = optText;

                btn.addEventListener('click', () => {
                    if (!isAnswered) checkAnswer(index, currentQ.correctIndex);
                });
                if (optionsGrid) optionsGrid.appendChild(btn);
            });

        } else if (type === 'Emparejar') {
            // Setup dual column match board
            if (questionCounter) questionCounter.textContent = `Par 0 de ${currentActivity.questions.length}`;
            if (scoreDisplay) scoreDisplay.textContent = `Puntos: ${score}`;

            if (questionText) questionText.style.display = 'none';
            if (questionMedia) questionMedia.style.display = 'none';
            if (optionsGrid) optionsGrid.style.display = 'none';
            if (matchGrid) matchGrid.style.display = 'grid';

            if (matchColLeft) matchColLeft.innerHTML = '';
            if (matchColRight) matchColRight.innerHTML = '';

            matchedPairsCount = 0;
            matchSelectedLeft = null;
            matchSelectedRight = null;

            let leftItems = [];
            let rightItems = [];

            currentActivity.questions.forEach((q, idx) => {
                leftItems.push({ id: idx, text: q.leftText, imageUrl: q.imageUrl });
                rightItems.push({ id: idx, text: q.rightText });
            });

            function shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
            }

            shuffleArray(leftItems);
            shuffleArray(rightItems);

            leftItems.forEach((item, i) => {
                const btn = document.createElement('button');
                btn.className = 'match-item';
                btn.style.animationDelay = `${i * 0.05}s`;

                let inner = '';
                if (item.imageUrl) {
                    inner += `<img src="${item.imageUrl}" alt="Media">`;
                }
                inner += `<span>${item.text}</span>`;
                btn.innerHTML = inner;

                btn.dataset.id = item.id;
                btn.dataset.side = 'left';

                btn.addEventListener('click', () => handleMatchClick(btn, 'left'));
                if (matchColLeft) matchColLeft.appendChild(btn);
            });

            rightItems.forEach((item, i) => {
                const btn = document.createElement('button');
                btn.className = 'match-item';
                btn.style.animationDelay = `${i * 0.05}s`;
                btn.innerHTML = `<span>${item.text}</span>`;
                btn.dataset.id = item.id;
                btn.dataset.side = 'right';

                btn.addEventListener('click', () => handleMatchClick(btn, 'right'));
                if (matchColRight) matchColRight.appendChild(btn);
            });
        }
    }

    // Single Question Logic
    function checkAnswer(selectedIndex, actualCorrectIndex) {
        isAnswered = true;
        const isCorrect = (selectedIndex === actualCorrectIndex);

        if (optionsGrid) {
            const allBtns = optionsGrid.querySelectorAll('.btn-option');
            allBtns.forEach((btn, idx) => {
                btn.disabled = true;
                if (idx === actualCorrectIndex) {
                    btn.classList.add('correct');
                } else if (idx === selectedIndex && !isCorrect) {
                    btn.classList.add('incorrect');
                }
            });
        }

        if (gameFeedback) gameFeedback.style.display = 'block';
        if (isCorrect) {
            score++;
            if (scoreDisplay) scoreDisplay.textContent = `Puntos: ${score}`;
            if (feedbackText) {
                feedbackText.textContent = '¡Correcto!';
                feedbackText.className = 'correct-text';
            }
        } else {
            if (feedbackText) {
                feedbackText.textContent = 'Incorrecto';
                feedbackText.className = 'incorrect-text';
            }
        }

        if (btnNextQuestion) {
            if (currentQuestionIndex === currentActivity.questions.length - 1) {
                btnNextQuestion.textContent = 'Ver Resultados';
            } else {
                btnNextQuestion.textContent = 'Siguiente';
            }

            setTimeout(() => {
                if (btnNextQuestion) btnNextQuestion.style.display = 'inline-block';
            }, 600);
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
            // Correct match
            btnL.classList.remove('match-selected');
            btnR.classList.remove('match-selected');
            btnL.classList.add('match-matched');
            btnR.classList.add('match-matched');
            btnL.disabled = true;
            btnR.disabled = true;

            score++;
            matchedPairsCount++;

            if (questionCounter) questionCounter.textContent = `Par ${matchedPairsCount} de ${currentActivity.questions.length}`;
            if (scoreDisplay) scoreDisplay.textContent = `Puntos: ${score}`;

            if (matchedPairsCount === currentActivity.questions.length && btnNextQuestion) {
                btnNextQuestion.textContent = 'Ver Resultados';
                setTimeout(() => {
                    if (btnNextQuestion) btnNextQuestion.style.display = 'inline-block';
                }, 600);
            }

        } else {
            // Incorrect match
            btnL.classList.add('match-error');
            btnR.classList.add('match-error');

            setTimeout(() => {
                btnL.classList.remove('match-error', 'match-selected');
                btnR.classList.remove('match-error', 'match-selected');
            }, 500);
        }

        // Reset selections
        matchSelectedLeft = null;
        matchSelectedRight = null;
    }

    if (btnNextQuestion) {
        btnNextQuestion.addEventListener('click', () => {
            if (currentActivity.type === 'Emparejar' || currentQuestionIndex >= currentActivity.questions.length - 1) {
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
        if (gameContainer) gameContainer.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'flex';

        if (finalScoreText) finalScoreText.textContent = score;
        if (totalScoreText) totalScoreText.textContent = currentActivity.questions.length;
    }

    if (btnRestartGame) {
        btnRestartGame.addEventListener('click', () => {
            playActivity(currentActivity);
        });
    }

    // Image Search Logic
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            if (searchModal) searchModal.style.display = 'none';
        });
    }

    async function searchImages(query) {
        if (!query) return;

        if (searchLoader) searchLoader.style.display = 'block';
        if (searchResultsGrid) searchResultsGrid.innerHTML = '';

        try {
            // Usar Wikipedia PageImages para obtener imágenes altamente relevantes basadas en artículos
            const url = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=20&prop=pageimages&piprop=original&format=json&origin=*`;
            const response = await fetch(url);
            const data = await response.json();

            if (searchLoader) searchLoader.style.display = 'none';

            if (data.query && data.query.pages) {
                const pages = Object.values(data.query.pages);
                let addedCount = 0;

                pages.forEach(page => {
                    // Verificamos si el artículo tiene una imagen principal (pageimage original)
                    if (page.original && page.original.source) {
                        const imgUrl = page.original.source;

                        addedCount++;
                        const imgEl = document.createElement('img');
                        imgEl.src = imgUrl;
                        imgEl.className = 'image-result';
                        imgEl.style.animation = `slideUpFade 0.3s ease ${addedCount * 0.05}s backwards`;

                        imgEl.addEventListener('click', () => {
                            if (currentImageTarget) {
                                currentImageTarget.input.value = imgUrl;
                                currentImageTarget.preview.src = imgUrl;
                                currentImageTarget.container.style.display = 'block';
                            }
                            if (searchModal) searchModal.style.display = 'none';
                        });

                        if (searchResultsGrid) searchResultsGrid.appendChild(imgEl);
                    }
                });

                if (addedCount === 0) {
                    if (searchResultsGrid) searchResultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">No se encontraron fotografías para esta búsqueda.</p>';
                }
            } else {
                if (searchResultsGrid) searchResultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">No se encontraron resultados.</p>';
            }
        } catch (err) {
            console.error(err);
            if (searchLoader) searchLoader.style.display = 'none';
            if (searchResultsGrid) searchResultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px;">Error de red al buscar imágenes.</p>';
        }
    }

    if (btnSearchExecute && searchInput) {
        btnSearchExecute.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) searchImages(query);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) searchImages(query);
            }
        });
    }

    // Lógica para Compartir con Firestore
    async function getDirectLink() {
        if (!currentActivity) return '';

        const user = auth.currentUser;
        if (!user) {
            alert('Debes iniciar sesión para compartir actividades.');
            throw new Error('Not authenticated');
        }

        try {
            const docRef = await db.collection("activities").add({
                data: JSON.stringify(currentActivity),
                uid: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const id = docRef.id;
            return `${window.location.origin}${window.location.pathname}?id=${id}`;
        } catch (e) {
            console.error("Error guardando en Firestore:", e);
            throw e;
        }
    }

    if (btnCopyLink) {
        btnCopyLink.addEventListener('click', async () => {
            if (!currentActivity) return;

            const originalText = btnCopyLink.innerHTML;
            btnCopyLink.innerHTML = '⏳ Guardando...';
            btnCopyLink.disabled = true;

            try {
                const link = await getDirectLink();
                await navigator.clipboard.writeText(link);

                if (toastNotification) {
                    toastNotification.textContent = "Link copiado 🔗";
                    toastNotification.classList.add('show');
                    setTimeout(() => {
                        toastNotification.classList.remove('show');
                    }, 3000);
                }

            } catch (e) {
                console.error("Error copiando enlace:", e);
                if (toastNotification) {
                    toastNotification.textContent = "Error al guardar/copiar";
                    toastNotification.classList.add('show');
                    setTimeout(() => {
                        toastNotification.classList.remove('show');
                    }, 3000);
                }
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
            btnWhatsappShare.innerHTML = '⏳ Preparando...';
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

    // Inicialización y Carga desde URL con Firestore
    async function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedId = urlParams.get('id');

        if (sharedId) {
            try {
                const doc = await db.collection("activities").doc(sharedId).get();

                if (doc.exists) {
                    const sharedActivity = JSON.parse(doc.data().data);

                    window.history.replaceState({}, document.title, window.location.pathname);
                    renderActivities();
                    playActivity(sharedActivity);
                    navigateTo('preview-view');
                } else {
                    alert("La actividad no existe o ha sido eliminada.");
                    renderActivities();
                }
            } catch (e) {
                console.error("Error cargando actividad desde Firestore:", e);
                alert("Hubo un error al cargar la actividad. Cargando inicio normal.");
                renderActivities();
            }
        } else {
            renderActivities();
        }
    }

    // ── Auth: Google Login / Logout / State ─────────────────────────────────
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithRedirect(provider);
            } catch (e) {
                console.error('Error en login:', e);
                alert('No se pudo iniciar sesión. Inténtalo de nuevo.');
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

    // Reacts to login / logout automatically
    auth.onAuthStateChanged(user => {
        if (user) {
            // Show user info, hide login button
            if (btnLogin) btnLogin.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userName) userName.textContent = user.displayName || 'Usuario';
            if (userPhoto) {
                userPhoto.src = user.photoURL || '';
                userPhoto.style.display = user.photoURL ? 'block' : 'none';
            }
        } else {
            // Show login button, hide user info
            if (btnLogin) btnLogin.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
        }
        // Always run URL check so shared links work even without login
        checkUrlParams();
    });
});

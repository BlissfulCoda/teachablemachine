let mobileNetModel;
let classifier;
const happyImages = [];
const sadImages = [];
let isModelTrained = false;

// Theme Toggle
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update toggle button
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    if (newTheme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark';
    }
}

// Load saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;
    html.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    if (savedTheme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark';
    }
}

// Load theme on page load
loadTheme();

// Toast notification system
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✅' : '❌'}</div>
        <div>${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Load MobileNet and KNN Classifier
async function loadMobileNet() {
    try {
        console.log('Loading MobileNet...');
        mobileNetModel = await mobilenet.load();
        classifier = knnClassifier.create();
        console.log('Models loaded successfully');
        showToast('AI model loaded successfully!');
    } catch (error) {
        showToast('Failed to load AI model', 'error');
        console.error('Load error:', error);
    }
}

// File upload handlers
function setupFileHandlers(inputId, className, dropZoneId) {
    const input = document.getElementById(inputId);
    const dropZone = document.getElementById(dropZoneId);

    input.addEventListener('change', (e) => handleFiles(e.target.files, className));

    // Drag and drop for desktop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files, className);
    });

    // Improved touch and click handlers for better iPad/tablet support
    let touchStartTime;
    let touchStartX;
    let touchStartY;
    let hasMoved = false;

    // Touch start - record position and time
    dropZone.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        hasMoved = false;
        e.preventDefault(); // Prevent default to avoid scrolling issues
    }, { passive: false });

    // Touch move - check if user is scrolling
    dropZone.addEventListener('touchmove', (e) => {
        if (e.touches[0]) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
            }
        }
    });

    // Touch end - trigger file input if it was a tap
    dropZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touchDuration = Date.now() - touchStartTime;
        // Only trigger if it was a quick tap (not a long press or scroll)
        if (touchDuration < 500 && !hasMoved) {
            // Small delay to ensure touch events are fully processed
            setTimeout(() => {
                input.click();
            }, 50);
        }
    }, { passive: false });

    // Click handler for mouse/desktop (fallback)
    dropZone.addEventListener('click', (e) => {
        // Only trigger on click if it wasn't already triggered by touch
        if (e.type === 'click' && !e.touches) {
            input.click();
        }
    });
}

function handleFiles(files, className) {
    const gallery = document.getElementById(`${className}-gallery`);
    const count = document.getElementById(`${className}-count`);
    const imageArray = className === 'happy' ? happyImages : sadImages;

    // Remove empty state
    const emptyState = gallery.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload image files only', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                imageArray.push(img);

                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${e.target.result}" alt="${className}">
                    <button class="delete-btn" onclick="deleteImage('${className}', ${imageArray.length - 1})">✕</button>
                `;
                gallery.appendChild(item);

                count.textContent = imageArray.length;
                checkTrainButton();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function deleteImage(className, index) {
    const imageArray = className === 'happy' ? happyImages : sadImages;
    imageArray.splice(index, 1);
    
    const gallery = document.getElementById(`${className}-gallery`);
    gallery.innerHTML = '';
    
    if (imageArray.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <div>No images yet</div>
            </div>
        `;
    } else {
        imageArray.forEach((img, idx) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${img.src}" alt="${className}">
                <button class="delete-btn" onclick="deleteImage('${className}', ${idx})">✕</button>
            `;
            gallery.appendChild(item);
        });
    }
    
    document.getElementById(`${className}-count`).textContent = imageArray.length;
    checkTrainButton();
}

function checkTrainButton() {
    const trainBtn = document.getElementById('train-btn');
    if (happyImages.length >= 3 && sadImages.length >= 3) {
        trainBtn.disabled = false;
        updateStep(2);
    } else {
        trainBtn.disabled = true;
    }
}

function updateStep(stepNumber) {
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index < stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Train model using KNN
async function trainModel() {
    const trainBtn = document.getElementById('train-btn');
    trainBtn.disabled = true;
    trainBtn.innerHTML = '<div class="spinner"></div><span>Training...</span>';

    document.getElementById('progress-section').classList.remove('hidden');

    try {
        showToast('Processing images...');
        
        let totalImages = happyImages.length + sadImages.length;
        let processed = 0;

        for (let img of happyImages) {
            const features = mobileNetModel.infer(await imageToTensor(img), true);
            classifier.addExample(features, 'happy');
            features.dispose();
            processed++;
            updateProgress((processed / totalImages) * 100);
        }

        showToast('Learning patterns...');

        for (let img of sadImages) {
            const features = mobileNetModel.infer(await imageToTensor(img), true);
            classifier.addExample(features, 'sad');
            features.dispose();
            processed++;
            updateProgress((processed / totalImages) * 100);
        }

        isModelTrained = true;
        updateProgress(100);
        updateStep(3);

        setTimeout(() => {
            document.getElementById('test-section').classList.remove('hidden');
            document.getElementById('test-section').scrollIntoView({ behavior: 'smooth' });
            showToast('🎉 Model trained successfully!');
        }, 500);

        trainBtn.innerHTML = '<span>✅</span><span>Training Complete</span>';

    } catch (error) {
        console.error('Training error:', error);
        showToast('Training failed: ' + error.message, 'error');
        trainBtn.disabled = false;
        trainBtn.innerHTML = '<span>🚀</span><span>Train Model</span>';
    }
}

async function imageToTensor(img) {
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 224, 224);
    
    return tf.browser.fromPixels(canvas);
}

function updateProgress(percent) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-percent');
    bar.style.width = percent + '%';
    text.textContent = Math.round(percent);
}

// Test image
let currentTestImage = null;
let currentTestFeatures = null;

// Setup test input handler
const testInput = document.getElementById('test-input');
const testDropZone = document.getElementById('test-drop-zone');

// Setup touch handlers for test input
let testTouchStartTime;
let testTouchStartX;
let testTouchStartY;
let testHasMoved = false;

testDropZone.addEventListener('touchstart', (e) => {
    testTouchStartTime = Date.now();
    const touch = e.touches[0];
    testTouchStartX = touch.clientX;
    testTouchStartY = touch.clientY;
    testHasMoved = false;
    e.preventDefault();
}, { passive: false });

testDropZone.addEventListener('touchmove', (e) => {
    if (e.touches[0]) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - testTouchStartX);
        const deltaY = Math.abs(touch.clientY - testTouchStartY);
        if (deltaX > 10 || deltaY > 10) {
            testHasMoved = true;
        }
    }
});

testDropZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touchDuration = Date.now() - testTouchStartTime;
    if (touchDuration < 500 && !testHasMoved) {
        setTimeout(() => {
            testInput.click();
        }, 50);
    }
}, { passive: false });

testDropZone.addEventListener('click', (e) => {
    if (e.type === 'click' && !e.touches) {
        testInput.click();
    }
});

testInput.addEventListener('change', async (e) => {
    if (!isModelTrained) {
        showToast('Please train the model first!', 'error');
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
            currentTestImage = img;

            document.getElementById('test-image').src = event.target.result;
            document.getElementById('test-image-container').classList.remove('hidden');

            const resultCard = document.getElementById('result-card');
            const resultEmpty = document.getElementById('result-empty');
            resultEmpty.classList.add('hidden');
            resultCard.classList.remove('hidden');

            document.getElementById('feedback-section').classList.add('hidden');
            document.getElementById('correction-panel').classList.add('hidden');

            document.getElementById('result-emoji').textContent = '🤔';
            document.getElementById('result-label').textContent = 'Analyzing...';
            document.getElementById('confidence-fill').style.width = '0%';

            try {
                const imgTensor = await imageToTensor(img);
                const features = mobileNetModel.infer(imgTensor, true);
                
                if (currentTestFeatures) {
                    currentTestFeatures.dispose();
                }
                currentTestFeatures = features;
                
                const result = await classifier.predictClass(features, 3);
                
                const isHappy = result.label === 'happy';
                const confidence = result.confidences[result.label];

                setTimeout(() => {
                    document.getElementById('result-emoji').textContent = isHappy ? '😊' : '😢';
                    document.getElementById('result-label').textContent = isHappy ? 'HAPPY' : 'SAD';
                    
                    const confidencePercent = (confidence * 100).toFixed(1);
                    document.getElementById('confidence-fill').style.width = confidencePercent + '%';
                    document.getElementById('confidence-text').textContent = confidencePercent + '%';

                    document.getElementById('feedback-section').classList.remove('hidden');
                }, 500);

                imgTensor.dispose();

            } catch (error) {
                console.error('Prediction error:', error);
                showToast('Prediction failed: ' + error.message, 'error');
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function handleFeedback(isCorrect) {
    if (isCorrect) {
        showToast('Great! The model is learning well! 🎉', 'success');
        document.getElementById('feedback-section').classList.add('hidden');
    } else {
        document.getElementById('correction-panel').classList.remove('hidden');
    }
}

async function correctPrediction(correctLabel) {
    if (!currentTestFeatures) {
        showToast('No test image to correct', 'error');
        return;
    }

    try {
        for (let i = 0; i < 3; i++) {
            classifier.addExample(currentTestFeatures, correctLabel);
        }
        
        if (correctLabel === 'happy') {
            happyImages.push(currentTestImage);
            document.getElementById('happy-count').textContent = happyImages.length;
        } else {
            sadImages.push(currentTestImage);
            document.getElementById('sad-count').textContent = sadImages.length;
        }

        showToast(`✅ Model updated! This image will now be classified correctly`, 'success');
        
        document.getElementById('feedback-section').classList.add('hidden');
        document.getElementById('correction-panel').classList.add('hidden');

        const badge = document.createElement('div');
        badge.className = 'improvement-badge';
        badge.innerHTML = '🧠 Learned from feedback!<br><small>Try this image again to see</small>';
        document.getElementById('result-card').appendChild(badge);
        
        setTimeout(() => badge.remove(), 4000);

    } catch (error) {
        console.error('Correction error:', error);
        showToast('Failed to add correction', 'error');
    }
}

// Initialize
loadMobileNet();
setupFileHandlers('happy-input', 'happy', 'happy-drop-zone');
setupFileHandlers('sad-input', 'sad', 'sad-drop-zone');
document.getElementById('train-btn').addEventListener('click', trainModel);



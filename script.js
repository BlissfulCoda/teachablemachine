let mobileNetModel;
let classifier;
let classes = []; // Dynamic classes array: [{id, name, emoji, images: []}]
let isModelTrained = false;
let currentTemplate = null;

// Preset Templates
const templates = {
  emotions: {
    name: "Emotions",
    icon: "😊",
    classes: [
      { id: "happy", name: "Happy", emoji: "😊" },
      { id: "sad", name: "Sad", emoji: "😢" },
    ],
  },
  fruits: {
    name: "Fruits",
    icon: "🍎",
    classes: [
      { id: "apples", name: "Apples", emoji: "🍎" },
      { id: "oranges", name: "Oranges", emoji: "🍊" },
    ],
  },
  school: {
    name: "School Supplies",
    icon: "✏️",
    classes: [
      { id: "pencils", name: "Pencils", emoji: "✏️" },
      { id: "pens", name: "Pens", emoji: "✒️" },
    ],
  },
  animals: {
    name: "Animals",
    icon: "🐶",
    classes: [
      { id: "dogs", name: "Dogs", emoji: "🐶" },
      { id: "cats", name: "Cats", emoji: "🐱" },
    ],
  },
};

// Theme Toggle
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  // Update theme icon (swap Moon/Sun SVG)
  const themeIconImg = document.getElementById("theme-icon-img");
  if (themeIconImg) {
    if (newTheme === "dark") {
      themeIconImg.src = "Sun.svg";
      themeIconImg.alt = "Sun";
    } else {
      themeIconImg.src = "Moon.svg";
      themeIconImg.alt = "Moon";
    }
  }
}

// Load saved theme preference
function loadTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  const html = document.documentElement;
  html.setAttribute("data-theme", savedTheme);

  // Update theme icon based on saved theme
  const themeIconImg = document.getElementById("theme-icon-img");
  if (themeIconImg) {
    if (savedTheme === "dark") {
      themeIconImg.src = "Sun.svg";
      themeIconImg.alt = "Sun";
    } else {
      themeIconImg.src = "Moon.svg";
      themeIconImg.alt = "Moon";
    }
  }
}

// Load theme on page load
loadTheme();

// Toast notification system
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <div class="toast-icon">${type === "success" ? "✅" : "❌"}</div>
        <div>${message}</div>
    `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Load MobileNet and KNN Classifier
async function loadMobileNet() {
  try {
    console.log("Loading MobileNet...");
    mobileNetModel = await mobilenet.load();
    classifier = knnClassifier.create();
    console.log("Models loaded successfully");
    showToast("AI model loaded successfully!");
  } catch (error) {
    showToast("Failed to load AI model", "error");
    console.error("Load error:", error);
  }
}

// Initialize with default template (emotions)
function initializeTemplate(templateKey) {
  const template = templates[templateKey];
  if (!template) return;

  currentTemplate = templateKey;
  classes = template.classes.map((cls) => ({
    ...cls,
    images: [],
  }));

  renderClasses();
  updateProgressIndicators();
  checkTrainButton();
}

// Render class cards dynamically
function renderClasses() {
  const mainGrid = document.getElementById("main-grid");
  mainGrid.innerHTML = "";

  classes.forEach((cls) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <span class="card-icon">${cls.emoji}</span>
                    <span>${cls.name}</span>
                </div>
                <div class="card-count">
                    <span id="${cls.id}-count">0</span> images
                </div>
            </div>
            
            <div class="upload-zone" id="${cls.id}-drop-zone">
                <div class="upload-icon">📁</div>
                <div class="upload-text">Tap to upload images</div>
                <div class="upload-subtext">Select multiple images at once</div>
            </div>
            <input type="file" id="${cls.id}-input" accept="image/*" multiple>

            <div class="gallery" id="${cls.id}-gallery">
                <div class="empty-state">
                    <div class="empty-state-icon">🖼️</div>
                    <div>No images yet</div>
                </div>
            </div>
        `;
    mainGrid.appendChild(card);

    // Setup file handlers for this class
    setupFileHandlers(`${cls.id}-input`, cls.id, `${cls.id}-drop-zone`);
  });
}

// File upload handlers
function setupFileHandlers(inputId, classId, dropZoneId) {
  const input = document.getElementById(inputId);
  const dropZone = document.getElementById(dropZoneId);

  input.addEventListener("change", (e) => handleFiles(e.target.files, classId));

  // Drag and drop for desktop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files, classId);
  });

  // Improved touch and click handlers for better iPad/tablet support
  let touchStartTime;
  let touchStartX;
  let touchStartY;
  let hasMoved = false;

  // Touch start - record position and time
  dropZone.addEventListener(
    "touchstart",
    (e) => {
      touchStartTime = Date.now();
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      hasMoved = false;
      e.preventDefault();
    },
    { passive: false }
  );

  // Touch move - check if user is scrolling
  dropZone.addEventListener("touchmove", (e) => {
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
  dropZone.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      const touchDuration = Date.now() - touchStartTime;
      if (touchDuration < 500 && !hasMoved) {
        setTimeout(() => {
          input.click();
        }, 50);
      }
    },
    { passive: false }
  );

  // Click handler for mouse/desktop (fallback)
  dropZone.addEventListener("click", (e) => {
    if (e.type === "click" && !e.touches) {
      input.click();
    }
  });
}

function handleFiles(files, classId) {
  const classData = classes.find((c) => c.id === classId);
  if (!classData) return;

  const gallery = document.getElementById(`${classId}-gallery`);
  const count = document.getElementById(`${classId}-count`);

  // Remove empty state
  const emptyState = gallery.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  Array.from(files).forEach((file) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please upload image files only", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        classData.images.push(img);

        const item = document.createElement("div");
        item.className = "gallery-item";
        item.innerHTML = `
                    <img src="${e.target.result}" alt="${classData.name}">
                    <button class="delete-btn" onclick="deleteImage('${classId}', ${
          classData.images.length - 1
        })">✕</button>
                `;
        gallery.appendChild(item);

        count.textContent = classData.images.length;
        updateProgressIndicators();
        checkTrainButton();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function deleteImage(classId, index) {
  const classData = classes.find((c) => c.id === classId);
  if (!classData) return;

  classData.images.splice(index, 1);

  const gallery = document.getElementById(`${classId}-gallery`);
  gallery.innerHTML = "";

  if (classData.images.length === 0) {
    gallery.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <div>No images yet</div>
            </div>
        `;
  } else {
    classData.images.forEach((img, idx) => {
      const item = document.createElement("div");
      item.className = "gallery-item";
      item.innerHTML = `
                <img src="${img.src}" alt="${classData.name}">
                <button class="delete-btn" onclick="deleteImage('${classId}', ${idx})">✕</button>
            `;
      gallery.appendChild(item);
    });
  }

  document.getElementById(`${classId}-count`).textContent =
    classData.images.length;
  updateProgressIndicators();
  checkTrainButton();
}

// Update progress indicators
function updateProgressIndicators() {
  const progressContainer = document.getElementById("progress-indicators");
  if (!progressContainer) return;

  progressContainer.innerHTML = "";

  classes.forEach((cls) => {
    const indicator = document.createElement("div");
    indicator.className = "progress-indicator";
    const isReady = cls.images.length >= 3;
    indicator.innerHTML = `
            <div class="progress-indicator-header">
                <span class="progress-indicator-emoji">${cls.emoji}</span>
                <span class="progress-indicator-name">${cls.name}</span>
                <span class="progress-indicator-status ${
                  isReady ? "ready" : "not-ready"
                }">
                    ${isReady ? "✓ Ready" : "Need more"}
                </span>
            </div>
            <div class="progress-indicator-bar">
                <div class="progress-indicator-fill" style="width: ${Math.min(
                  (cls.images.length / 3) * 100,
                  100
                )}%"></div>
            </div>
            <div class="progress-indicator-text">${
              cls.images.length
            } / 3 images (minimum)</div>
        `;
    progressContainer.appendChild(indicator);
  });
}

function checkTrainButton() {
  const trainBtn = document.getElementById("train-btn");
  const allReady = classes.every((cls) => cls.images.length >= 3);

  if (allReady && classes.length >= 2) {
    trainBtn.disabled = false;
    updateStep(2);
  } else {
    trainBtn.disabled = true;
  }
}

function updateStep(stepNumber) {
  document.querySelectorAll(".step").forEach((step, index) => {
    if (index < stepNumber) {
      step.classList.add("active");
    } else {
      step.classList.remove("active");
    }
  });
}

// Train model using KNN
async function trainModel() {
  const trainBtn = document.getElementById("train-btn");
  trainBtn.disabled = true;
  trainBtn.innerHTML = '<div class="spinner"></div><span>Training...</span>';

  document.getElementById("progress-section").classList.remove("hidden");

  try {
    showToast("Processing images...");

    let totalImages = classes.reduce((sum, cls) => sum + cls.images.length, 0);
    let processed = 0;

    // Train each class
    for (let classData of classes) {
      showToast(`Learning ${classData.name}...`);

      for (let img of classData.images) {
        const features = mobileNetModel.infer(await imageToTensor(img), true);
        classifier.addExample(features, classData.id);
        features.dispose();
        processed++;
        updateProgress((processed / totalImages) * 100);
      }
    }

    isModelTrained = true;
    updateProgress(100);
    updateStep(3);

    setTimeout(() => {
      document.getElementById("test-section").classList.remove("hidden");
      document
        .getElementById("test-section")
        .scrollIntoView({ behavior: "smooth" });
      showToast("🎉 Model trained successfully!");
    }, 500);

    trainBtn.innerHTML = "<span>✅</span><span>Training Complete</span>";
  } catch (error) {
    console.error("Training error:", error);
    showToast("Training failed: " + error.message, "error");
    trainBtn.disabled = false;
    trainBtn.innerHTML = "<span>🚀</span><span>Train Model</span>";
  }
}

async function imageToTensor(img) {
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, 224, 224);

  return tf.browser.fromPixels(canvas);
}

function updateProgress(percent) {
  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-percent");
  bar.style.width = percent + "%";
  text.textContent = Math.round(percent);
}

// Test image
let currentTestImage = null;
let currentTestFeatures = null;

// Setup test input handler
const testInput = document.getElementById("test-input");
const testDropZone = document.getElementById("test-drop-zone");

// Setup touch handlers for test input
let testTouchStartTime;
let testTouchStartX;
let testTouchStartY;
let testHasMoved = false;

testDropZone.addEventListener(
  "touchstart",
  (e) => {
    testTouchStartTime = Date.now();
    const touch = e.touches[0];
    testTouchStartX = touch.clientX;
    testTouchStartY = touch.clientY;
    testHasMoved = false;
    e.preventDefault();
  },
  { passive: false }
);

testDropZone.addEventListener("touchmove", (e) => {
  if (e.touches[0]) {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - testTouchStartX);
    const deltaY = Math.abs(touch.clientY - testTouchStartY);
    if (deltaX > 10 || deltaY > 10) {
      testHasMoved = true;
    }
  }
});

testDropZone.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    const touchDuration = Date.now() - testTouchStartTime;
    if (touchDuration < 500 && !testHasMoved) {
      setTimeout(() => {
        testInput.click();
      }, 50);
    }
  },
  { passive: false }
);

testDropZone.addEventListener("click", (e) => {
  if (e.type === "click" && !e.touches) {
    testInput.click();
  }
});

testInput.addEventListener("change", async (e) => {
  if (!isModelTrained) {
    showToast("Please train the model first!", "error");
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const img = new Image();
    img.onload = async () => {
      currentTestImage = img;

      document.getElementById("test-image").src = event.target.result;
      document
        .getElementById("test-image-container")
        .classList.remove("hidden");

      const resultCard = document.getElementById("result-card");
      const resultEmpty = document.getElementById("result-empty");
      resultEmpty.classList.add("hidden");
      resultCard.classList.remove("hidden");

      document.getElementById("feedback-section").classList.add("hidden");
      document.getElementById("correction-panel").classList.add("hidden");

      document.getElementById("result-emoji").textContent = "🤔";
      document.getElementById("result-label").textContent = "Analyzing...";
      document.getElementById("confidence-fill").style.width = "0%";

      try {
        const imgTensor = await imageToTensor(img);
        const features = mobileNetModel.infer(imgTensor, true);

        if (currentTestFeatures) {
          currentTestFeatures.dispose();
        }
        currentTestFeatures = features;

        const result = await classifier.predictClass(features, 3);

        const predictedClass = classes.find((c) => c.id === result.label);
        const confidence = result.confidences[result.label];

        setTimeout(() => {
          if (predictedClass) {
            document.getElementById("result-emoji").textContent =
              predictedClass.emoji;
            document.getElementById("result-label").textContent =
              predictedClass.name.toUpperCase();
          } else {
            document.getElementById("result-emoji").textContent = "❓";
            document.getElementById("result-label").textContent = "UNKNOWN";
          }

          const confidencePercent = (confidence * 100).toFixed(1);
          document.getElementById("confidence-fill").style.width =
            confidencePercent + "%";
          document.getElementById("confidence-text").textContent =
            confidencePercent + "%";

          document
            .getElementById("feedback-section")
            .classList.remove("hidden");
        }, 500);

        imgTensor.dispose();
      } catch (error) {
        console.error("Prediction error:", error);
        showToast("Prediction failed: " + error.message, "error");
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function handleFeedback(isCorrect) {
  if (isCorrect) {
    showToast("Great! The model is learning well! 🎉", "success");
    document.getElementById("feedback-section").classList.add("hidden");
  } else {
    document.getElementById("correction-panel").classList.remove("hidden");
    renderCorrectionButtons();
  }
}

function renderCorrectionButtons() {
  const correctionButtons = document.getElementById("correction-buttons");
  correctionButtons.innerHTML = "";

  classes.forEach((cls) => {
    const button = document.createElement("button");
    button.className = `btn-correction btn-correction-${cls.id}`;
    button.onclick = () => correctPrediction(cls.id);
    button.innerHTML = `
            <span>${cls.emoji}</span>
            <span>${cls.name}</span>
        `;
    correctionButtons.appendChild(button);
  });
}

async function correctPrediction(correctLabel) {
  if (!currentTestFeatures) {
    showToast("No test image to correct", "error");
    return;
  }

  try {
    const classData = classes.find((c) => c.id === correctLabel);
    if (!classData) return;

    for (let i = 0; i < 3; i++) {
      classifier.addExample(currentTestFeatures, correctLabel);
    }

    classData.images.push(currentTestImage);
    document.getElementById(`${correctLabel}-count`).textContent =
      classData.images.length;
    updateProgressIndicators();

    showToast(
      `✅ Model updated! This image will now be classified correctly`,
      "success"
    );

    document.getElementById("feedback-section").classList.add("hidden");
    document.getElementById("correction-panel").classList.add("hidden");

    const badge = document.createElement("div");
    badge.className = "improvement-badge";
    badge.innerHTML =
      "🧠 Learned from feedback!<br><small>Try this image again to see</small>";
    document.getElementById("result-card").appendChild(badge);

    setTimeout(() => badge.remove(), 4000);
  } catch (error) {
    console.error("Correction error:", error);
    showToast("Failed to add correction", "error");
  }
}

// Template selection
function selectTemplate(templateKey) {
  initializeTemplate(templateKey);
  document.getElementById("template-selector").classList.add("hidden");
  document.getElementById("main-content").classList.remove("hidden");
  showToast(`Template "${templates[templateKey].name}" selected!`);
}

// Go back to template selection
function goBackToTemplates() {
  // Reset classes and images
  classes = [];
  isModelTrained = false;

  // Hide main content and show template selector
  document.getElementById("main-content").classList.add("hidden");
  document.getElementById("template-selector").classList.remove("hidden");

  // Reset steps
  updateStep(1);

  // Reset train button
  const trainBtn = document.getElementById("train-btn");
  trainBtn.disabled = true;
  trainBtn.innerHTML = "<span>🚀</span><span>Train Model</span>";

  // Hide progress and test sections
  document.getElementById("progress-section").classList.add("hidden");
  document.getElementById("test-section").classList.add("hidden");
}

// Initialize
loadMobileNet();
document.getElementById("train-btn").addEventListener("click", trainModel);

// Template selector will be shown on page load
// Users can choose a template or click "Start with Emotions (Default)"

function updateTime() {
    fetch('/api/time')
        .then(response => response.json())
        .then(data => {
            document.getElementById('time-display').textContent = data.current_time;
            document.getElementById('api-message').textContent = data.message;
        })
        .catch(error => console.error('Error:', error));
}

// Update time every second
setInterval(updateTime, 1000);
updateTime(); // Initial update 

// Theme handling
const themeToggle = document.querySelector('.theme-toggle');
let isDarkMode = localStorage.getItem('darkMode') === 'true';

function updateTheme() {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    updateTheme();
});

updateTheme();

// Tab handling
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Quality slider
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');

qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
});

// Drag and drop handling
const dropZone = document.querySelector('.drop-zone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        document.getElementById('imageFile').files = files;
        handleFileSelect(files[0]);
    }
});

// File handling and preview
function handleFileSelect(file) {
    const preview = document.getElementById('imagePreview');
    const previewPanel = document.getElementById('preview-panel');
    const originalSize = document.getElementById('originalSize');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            previewPanel.classList.remove('hidden');
            originalSize.textContent = formatFileSize(file.size);
        };
        reader.readAsDataURL(file);
    }
}

document.getElementById('imageFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Maintain aspect ratio
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const maintainRatio = document.getElementById('maintainAspectRatio');
let aspectRatio = 1;

function updateDimension(source, target, ratio) {
    if (maintainRatio.checked) {
        const value = parseInt(source.value) || 0;
        target.value = Math.round(source.id === 'width' ? value / ratio : value * ratio);
    }
}

document.getElementById('imageFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const img = new Image();
        img.onload = () => {
            aspectRatio = img.width / img.height;
            widthInput.value = img.width;
            heightInput.value = img.height;
        };
        img.src = URL.createObjectURL(e.target.files[0]);
    }
});

widthInput.addEventListener('input', () => updateDimension(widthInput, heightInput, aspectRatio));
heightInput.addEventListener('input', () => updateDimension(heightInput, widthInput, 1/aspectRatio));

// Form submission
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('imageFile');
    const format = document.getElementById('format').value;
    const quality = document.getElementById('quality').value;
    const width = document.getElementById('width').value;
    const height = document.getElementById('height').value;
    const status = document.getElementById('status');
    
    if (!fileInput.files[0]) {
        showStatus('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('format', format);
    formData.append('quality', quality);
    formData.append('width', width);
    formData.append('height', height);

    showStatus('Converting...', 'info');

    try {
        const response = await fetch('/convert', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            const newSize = document.getElementById('newSize');
            newSize.textContent = formatFileSize(blob.size);
            
            showStatus('Conversion successful!', 'success');
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
});

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
}

// Image editing functionality
let currentImage = null;
let currentEffect = null;
const canvas = document.getElementById('editCanvas');
const ctx = canvas.getContext('2d');

function loadImageToCanvas(file) {
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        currentImage = img;
    };
    img.src = URL.createObjectURL(file);
}

// Effect buttons
document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentEffect = btn.dataset.effect;
        
        const intensitySlider = document.querySelector('.intensity-slider');
        intensitySlider.classList.remove('hidden');
    });
});

// Intensity slider
const intensitySlider = document.getElementById('effectIntensity');
const intensityValue = document.getElementById('intensityValue');

intensitySlider.addEventListener('input', () => {
    intensityValue.textContent = `${intensitySlider.value}%`;
    applyEffect();
});

async function applyEffect() {
    if (!currentImage || !currentEffect) return;
    
    const formData = new FormData();
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    formData.append('file', blob);
    formData.append('effect', currentEffect);
    formData.append('intensity', intensitySlider.value / 100);
    
    try {
        const response = await fetch('/apply-effect', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
            img.src = URL.createObjectURL(blob);
        }
    } catch (error) {
        showStatus('Error applying effect: ' + error.message, 'error');
    }
}

// Cropping functionality
const cropOverlay = document.querySelector('.crop-overlay');
const cropArea = document.querySelector('.crop-area');
let isCropping = false;

document.getElementById('startCrop').addEventListener('click', () => {
    cropOverlay.classList.remove('hidden');
    document.getElementById('startCrop').classList.add('hidden');
    document.getElementById('applyCrop').classList.remove('hidden');
    isCropping = true;
    
    // Initialize crop area
    const canvasRect = canvas.getBoundingClientRect();
    cropArea.style.width = '50%';
    cropArea.style.height = '50%';
    cropArea.style.left = '25%';
    cropArea.style.top = '25%';
});

document.getElementById('applyCrop').addEventListener('click', async () => {
    if (!isCropping) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const cropRect = cropArea.getBoundingClientRect();
    
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    
    const x = (cropRect.left - canvasRect.left) * scaleX;
    const y = (cropRect.top - canvasRect.top) * scaleY;
    const width = cropRect.width * scaleX;
    const height = cropRect.height * scaleY;
    
    const formData = new FormData();
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    formData.append('file', blob);
    formData.append('x', x);
    formData.append('y', y);
    formData.append('width', width);
    formData.append('height', height);
    
    try {
        const response = await fetch('/crop', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                cropOverlay.classList.add('hidden');
                document.getElementById('startCrop').classList.remove('hidden');
                document.getElementById('applyCrop').classList.add('hidden');
                isCropping = false;
            };
            img.src = URL.createObjectURL(blob);
        }
    } catch (error) {
        showStatus('Error applying crop: ' + error.message, 'error');
    }
});

// Save edited image
document.getElementById('saveEdits').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'edited_image.png';
    link.href = canvas.toDataURL();
    link.click();
});

// Make crop area draggable
let isDragging = false;
let startX, startY;

cropArea.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - cropArea.offsetLeft;
    startY = e.clientY - cropArea.offsetTop;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - startX;
    const newY = e.clientY - startY;
    
    cropArea.style.left = `${newX}px`;
    cropArea.style.top = `${newY}px`;
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Add this to your existing script.js
let currentVideoUrl = null;

// Add/modify these functions for YouTube download
let selectedQuality = null;

document.querySelectorAll('.format-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.quality-panel').forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const format = tab.dataset.format;
        document.getElementById(`${format}QualityPanel`).classList.add('active');
    });
});

function createQualityOption(quality, isVideo) {
    const div = document.createElement('div');
    div.className = 'quality-option';
    div.dataset.itag = quality.itag;
    
    const filesize = formatFileSize(quality.filesize);
    const qualityLabel = isVideo ? 
        `${quality.resolution} ${quality.fps}fps` :
        `${quality.abr}`;
    
    div.innerHTML = `
        <div class="quality-info">
            <i class="fas fa-${isVideo ? 'video' : 'music'}"></i>
            <span>${qualityLabel}</span>
        </div>
        <span class="quality-size">${filesize}</span>
    `;
    
    div.addEventListener('click', () => {
        document.querySelectorAll('.quality-option').forEach(opt => 
            opt.classList.remove('selected'));
        div.classList.add('selected');
        selectedQuality = quality.itag;
        document.getElementById('downloadBtn').disabled = false;
    });
    
    return div;
}

document.getElementById('youtubeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('youtubeUrl').value;
    const videoInfo = document.getElementById('videoInfo');
    
    if (!url) {
        showToast('Please enter a YouTube URL', 'error');
        return;
    }

    showLoading(document.querySelector('.youtube-form'));
    showToast('Checking video...', 'info');

    try {
        const formData = new FormData();
        formData.append('url', url);

        const response = await fetch('/video-info', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            
            // Update video info
            document.getElementById('videoThumbnail').src = data.thumbnail;
            document.getElementById('videoTitle').textContent = data.title;
            document.getElementById('videoAuthor').textContent = `by ${data.author}`;
            document.getElementById('videoDuration').textContent = formatDuration(data.length);
            
            // Update quality options
            const videoQualities = document.getElementById('videoQualities');
            const audioQualities = document.getElementById('audioQualities');
            
            videoQualities.innerHTML = '';
            audioQualities.innerHTML = '';
            
            data.video_qualities.forEach(quality => {
                videoQualities.appendChild(createQualityOption(quality, true));
            });
            
            data.audio_qualities.forEach(quality => {
                audioQualities.appendChild(createQualityOption(quality, false));
            });
            
            videoInfo.classList.remove('hidden');
            showToast('Video found!', 'success');
        } else {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        hideLoading(document.querySelector('.youtube-form'));
    }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!selectedQuality) return;
    
    const progress = document.querySelector('.download-progress');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    
    progress.classList.remove('hidden');
    showToast('Starting download...', 'info');

    try {
        const formData = new FormData();
        formData.append('url', document.getElementById('youtubeUrl').value);
        formData.append('itag', selectedQuality);

        const response = await fetch('/download-video', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${document.getElementById('videoTitle').textContent}${
                document.querySelector('.format-tab.active').dataset.format === 'video' ? '.mp4' : '.mp3'
            }`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Download completed!', 'success');
        } else {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        progress.classList.add('hidden');
        progressBar.style.width = '0';
        progressText.textContent = 'Downloading: 0%';
    }
});

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Improved toast notifications
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                          type === 'error' ? 'exclamation-circle' : 
                          'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Feature card navigation
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => {
        const feature = card.querySelector('h3').textContent.toLowerCase();
        const tabId = feature.includes('image') ? 'convert' :
                     feature.includes('editor') ? 'edit' :
                     feature.includes('youtube') ? 'youtube' : 'batch';
        
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).click();
    });
});

// Improved file drag and drop
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dropZone = e.currentTarget;
    dropZone.style.transform = 'scale(1.02)';
    dropZone.style.borderColor = 'var(--primary-color)';
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dropZone = e.currentTarget;
    dropZone.style.transform = 'scale(1)';
    dropZone.style.borderColor = 'var(--border-color)';
}

// Add loading indicators
function showLoading(element) {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    element.appendChild(spinner);
}

function hideLoading(element) {
    const spinner = element.querySelector('.loading-spinner');
    if (spinner) spinner.remove();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                document.getElementById('saveEdits').click();
                break;
            case 'o':
                e.preventDefault();
                document.getElementById('imageFile').click();
                break;
        }
    }
}); 
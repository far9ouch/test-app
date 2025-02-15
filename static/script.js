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
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            document.getElementById('imageFile').files = files;
            handleFileSelect(files[0]);
        }
    });
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
    div.className = 'quality-option glass-card';
    div.dataset.itag = quality.itag;
    
    const icon = isVideo ? 'video' : 'music';
    const qualityLabel = isVideo ? 
        `${quality.resolution} ${quality.fps}fps` :
        `${quality.abr}`;
    const filesize = formatFileSize(quality.filesize);
    
    div.innerHTML = `
        <div class="quality-info">
            <i class="fas fa-${icon}"></i>
            <span class="quality-label">${qualityLabel}</span>
            <span class="quality-size">${filesize}</span>
        </div>
        <div class="quality-hover-effect"></div>
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

async function checkYouTubeUrl(url) {
    if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
        throw new Error('Please enter a valid YouTube URL');
    }
    
    const formData = new FormData();
    formData.append('url', url);
    
    try {
        const response = await fetchWithRetry('/video-info', {
            method: 'POST',
            body: formData
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        return response;
    } catch (error) {
        throw new Error('Could not fetch video information. Please try again.');
    }
}

document.getElementById('youtubeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('youtubeUrl').value;
    const videoInfo = document.getElementById('videoInfo');
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (!url) {
        showToast('Please enter a YouTube URL', 'error');
        return;
    }

    const loadingIndicator = showLoading(document.querySelector('.youtube-form'));
    showToast('Checking video...', 'info');

    try {
        const data = await checkYouTubeUrl(url);
        
        // Update video info
        document.getElementById('videoThumbnail').src = data.thumbnail;
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('videoAuthor').textContent = data.author;
        document.getElementById('videoDuration').textContent = formatDuration(data.length);
        
        // Update quality options
        updateQualityOptions(data.video_qualities, data.audio_qualities);
        
        videoInfo.classList.remove('hidden');
        showToast('Video found!', 'success');
    } catch (error) {
        handleYouTubeError(error);
    } finally {
        loadingIndicator.remove();
    }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!selectedQuality) return;
    
    const progress = document.querySelector('.download-progress');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const downloadBtn = document.getElementById('downloadBtn');
    
    progress.classList.remove('hidden');
    downloadBtn.disabled = true;
    showToast('Starting download...', 'info');

    try {
        const formData = new FormData();
        formData.append('url', document.getElementById('youtubeUrl').value);
        formData.append('itag', selectedQuality);
        formData.append('format', document.querySelector('.format-tab.active').dataset.format);

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
        downloadBtn.disabled = false;
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
function showLoading(element, text = 'Loading...') {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-wave';
    loadingEl.innerHTML = `
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <p>${text}</p>
    `;
    element.appendChild(loadingEl);
    return loadingEl;
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

// Add retry logic for video info
async function fetchVideoInfo(url, retryCount = 3) {
    for (let i = 0; i < retryCount; i++) {
        try {
            const formData = new FormData();
            formData.append('url', url);

            const response = await fetch('/video-info', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            if (i === retryCount - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Failed to fetch video info after multiple attempts');
}

function updateQualityOptions(videoQualities, audioQualities) {
    const videoList = document.getElementById('videoQualities');
    const audioList = document.getElementById('audioQualities');
    
    videoList.innerHTML = '';
    audioList.innerHTML = '';
    
    videoQualities.forEach(quality => {
        const option = createQualityOption(quality, true);
        videoList.appendChild(option);
    });
    
    audioQualities.forEach(quality => {
        const option = createQualityOption(quality, false);
        audioList.appendChild(option);
    });
}

// Add these functions for enhanced interactions

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Intersection Observer for animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .card').forEach(el => {
    observer.observe(el);
});

// Enhanced tooltips
document.querySelectorAll('[data-tooltip]').forEach(element => {
    element.addEventListener('mouseenter', e => {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = e.target.dataset.tooltip;
        document.body.appendChild(tooltip);
        
        const rect = e.target.getBoundingClientRect();
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
        tooltip.style.left = rect.left + (rect.width - tooltip.offsetWidth) / 2 + 'px';
    });
    
    element.addEventListener('mouseleave', () => {
        document.querySelector('.tooltip')?.remove();
    });
});

// Progress circle animation
function updateProgress(element, progress) {
    element.style.setProperty('--progress', `${progress}%`);
    element.setAttribute('data-progress', Math.round(progress));
}

// FAB interactions
document.querySelectorAll('.fab-button.mini').forEach(btn => {
    btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        document.querySelector(`.tab-btn[data-tab="${tool}"]`).click();
        
        // Smooth scroll to tool section
        document.querySelector('.converter-box').scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Enhanced form validation
document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', () => {
        input.parentElement.classList.remove('focused');
        if (input.value) {
            input.parentElement.classList.add('filled');
        } else {
            input.parentElement.classList.remove('filled');
        }
    });
});

// Loading skeleton
function showSkeleton(container) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    container.appendChild(skeleton);
    return skeleton;
}

function hideSkeleton(skeleton) {
    skeleton.remove();
}

// Improved error handling
function handleYouTubeError(error) {
    console.error('YouTube Error:', error);
    
    let errorMessage = 'An error occurred while processing your request.';
    
    if (error.message.includes('age restricted')) {
        errorMessage = 'This video is age restricted. Please try another video.';
    } else if (error.message.includes('not available')) {
        errorMessage = 'This video is not available in your region or has been removed.';
    } else if (error.message.includes('private')) {
        errorMessage = 'This is a private video. Please try another video.';
    }
    
    showToast(errorMessage, 'error', 5000);
}

// Add retry mechanism
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

// Spotify handling
let selectedSpotifyQuality = null;

document.getElementById('spotifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('spotifyUrl').value;
    const trackInfo = document.getElementById('trackInfo');
    const convertBtn = document.getElementById('convertBtn');
    
    if (!url) {
        showToast('Please enter a Spotify track URL', 'error');
        return;
    }

    const loadingIndicator = showLoading(document.querySelector('.spotify-form'));
    showToast('Checking track...', 'info');

    try {
        const formData = new FormData();
        formData.append('url', url);
        
        const response = await fetch('/spotify-info', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update track info
            document.getElementById('trackArtwork').src = data.artwork;
            document.getElementById('trackTitle').textContent = data.title;
            document.getElementById('trackArtist').textContent = data.artist;
            document.getElementById('trackAlbum').textContent = data.album;
            
            trackInfo.classList.remove('hidden');
            showToast('Track found!', 'success');
        } else {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        loadingIndicator.remove();
    }
});

// Quality selection
document.querySelectorAll('.quality-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.quality-option').forEach(opt => 
            opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedSpotifyQuality = option.dataset.quality;
        document.getElementById('convertBtn').disabled = false;
    });
});

// Convert button
document.getElementById('convertBtn').addEventListener('click', async () => {
    if (!selectedSpotifyQuality) return;
    
    const progress = document.querySelector('.conversion-progress');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const convertBtn = document.getElementById('convertBtn');
    
    progress.classList.remove('hidden');
    convertBtn.disabled = true;
    showToast('Starting conversion...', 'info');

    try {
        const formData = new FormData();
        formData.append('url', document.getElementById('spotifyUrl').value);
        formData.append('quality', selectedSpotifyQuality);

        const response = await fetch('/convert-spotify', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            
            // Download the converted file
            const a = document.createElement('a');
            a.href = data.url;
            a.download = `${data.title} - ${data.artist}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            showToast('Conversion completed!', 'success');
        } else {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        progress.classList.add('hidden');
        progressBar.style.width = '0';
        progressText.textContent = 'Converting: 0%';
        convertBtn.disabled = false;
    }
}); 
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
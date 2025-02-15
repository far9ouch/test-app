from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import os
from io import BytesIO
import cairosvg
import numpy as np
from pytube import YouTube
from pydub import AudioSegment
import re
import requests

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    target_format = request.form.get('format', 'png')
    quality = int(request.form.get('quality', 85))
    width = request.form.get('width')
    height = request.form.get('height')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file format'}), 400

    try:
        # Handle SVG files
        if file.filename.lower().endswith('.svg'):
            output = BytesIO()
            if target_format in ['png', 'jpg', 'jpeg']:
                cairosvg.svg2png(file_obj=file, write_to=output)
                if target_format in ['jpg', 'jpeg']:
                    png_image = Image.open(output)
                    output = BytesIO()
                    png_image.convert('RGB').save(output, 'JPEG', quality=quality)
        else:
            # Handle other image formats
            image = Image.open(file)
            
            # Resize if dimensions provided
            if width and height:
                try:
                    new_width = int(width)
                    new_height = int(height)
                    image = image.resize((new_width, new_height), Image.LANCZOS)
                except ValueError:
                    pass

            output = BytesIO()
            
            # Convert to RGB if saving as JPEG
            if target_format in ['jpg', 'jpeg']:
                image = image.convert('RGB')
                image.save(output, format='JPEG', quality=quality)
            elif target_format == 'png':
                image.save(output, format='PNG', optimize=True)
            elif target_format == 'webp':
                image.save(output, format='WEBP', quality=quality)
            else:
                image.save(output, format=target_format.upper())
        
        output.seek(0)
        return send_file(
            output,
            mimetype=f'image/{target_format}',
            as_attachment=True,
            download_name=f'converted.{target_format}'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/apply-effect', methods=['POST'])
def apply_effect():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    effect = request.form.get('effect', 'none')
    intensity = float(request.form.get('intensity', 1.0))
    
    try:
        image = Image.open(file)
        
        if effect == 'blur':
            image = image.filter(ImageFilter.GaussianBlur(radius=intensity))
        elif effect == 'sharpen':
            image = image.filter(ImageFilter.UnsharpMask(radius=intensity, percent=150))
        elif effect == 'brightness':
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(intensity)
        elif effect == 'contrast':
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(intensity)
        elif effect == 'grayscale':
            image = image.convert('L')
        elif effect == 'sepia':
            img_array = np.array(image)
            sepia_matrix = np.array([
                [0.393, 0.769, 0.189],
                [0.349, 0.686, 0.168],
                [0.272, 0.534, 0.131]
            ])
            sepia_img = img_array.dot(sepia_matrix.T)
            sepia_img /= sepia_img.max()
            sepia_img = (sepia_img * 255).astype(np.uint8)
            image = Image.fromarray(sepia_img)
        
        output = BytesIO()
        image.save(output, format='PNG')
        output.seek(0)
        
        return send_file(
            output,
            mimetype='image/png',
            as_attachment=True,
            download_name='edited.png'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/crop', methods=['POST'])
def crop_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    try:
        x = int(request.form.get('x', 0))
        y = int(request.form.get('y', 0))
        width = int(request.form.get('width', 0))
        height = int(request.form.get('height', 0))
        
        image = Image.open(file)
        cropped = image.crop((x, y, x + width, y + height))
        
        output = BytesIO()
        cropped.save(output, format='PNG')
        output.seek(0)
        
        return send_file(
            output,
            mimetype='image/png',
            as_attachment=True,
            download_name='cropped.png'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-mp3', methods=['POST'])
def download_mp3():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Validate YouTube URL
        if not re.match(r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$', url):
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        # Get video info
        yt = YouTube(url)
        
        # Get video details
        video_info = {
            'title': yt.title,
            'author': yt.author,
            'length': yt.length,
            'thumbnail': yt.thumbnail_url
        }

        # Get audio stream
        audio_stream = yt.streams.filter(only_audio=True).first()
        
        if not audio_stream:
            return jsonify({'error': 'No audio stream found'}), 404

        # Download to memory
        output = BytesIO()
        audio_stream.stream_to_buffer(output)
        output.seek(0)

        # Convert to MP3 if needed
        if audio_stream.subtype != 'mp3':
            audio = AudioSegment.from_file(output, format=audio_stream.subtype)
            output = BytesIO()
            audio.export(output, format='mp3', bitrate='192k')
            output.seek(0)

        # Clean filename
        safe_title = re.sub(r'[^\w\s-]', '', yt.title)
        filename = f"{safe_title}.mp3"

        return send_file(
            output,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/video-info', methods=['POST'])
def get_video_info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        yt = YouTube(url)
        return jsonify({
            'title': yt.title,
            'author': yt.author,
            'length': yt.length,
            'thumbnail': yt.thumbnail_url
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify({
        'conversions': 1234,
        'downloads': 567,
        'users': 890
    })

@app.route('/api/check-url', methods=['POST'])
def check_url():
    url = request.form.get('url')
    try:
        response = requests.head(url)
        return jsonify({
            'valid': response.status_code == 200,
            'type': response.headers.get('content-type', '')
        })
    except:
        return jsonify({'valid': False})

@app.errorhandler(404)
def not_found_error(error):
    return render_template('error.html', error=404), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('error.html', error=500), 500

if __name__ == '__main__':
    app.run(debug=True) 
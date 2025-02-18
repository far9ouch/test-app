from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import os
from io import BytesIO
import re
import requests
from spotipy import Spotify
from spotipy.oauth2 import SpotifyClientCredentials
from config import SPOTIFY_CONFIG
import logging
from functools import wraps
from time import time
from spotipy.exceptions import SpotifyException
from youtube_dl import YoutubeDL

app = Flask(__name__)
CORS(app)

# Set environment variables
os.environ['SPOTIFY_CLIENT_ID'] = 'e948f13a81c6473b9b63e5d2c0fa0811'
os.environ['SPOTIFY_CLIENT_SECRET'] = 'c7911881958046d399280e34dea2df03'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Performance and error tracking decorator
def track_performance(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        start_time = time()
        try:
            result = f(*args, **kwargs)
            execution_time = time() - start_time
            logger.info(f"{f.__name__} completed in {execution_time:.2f}s")
            return result
        except Exception as e:
            execution_time = time() - start_time
            logger.error(f"{f.__name__} failed after {execution_time:.2f}s: {str(e)}")
            raise
    return wrapper

# Fix for pytube user agent
def get_ytb_video(url):
    try:
        yt = YouTube(
            url,
            use_oauth=False,
            allow_oauth_cache=True
        )
        # Update headers with more complete user agent
        yt.bypass_age_gate()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
            'Keep-Alive': '300',
            'Connection': 'keep-alive',
        }
        yt.streams._monostate.headers = headers
        return yt
    except Exception as e:
        raise Exception(f"Error initializing YouTube: {str(e)}")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_image():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        format = request.form.get('format', 'png')
        quality = int(request.form.get('quality', 85))
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format'}), 400
        
        # Process image
        image = Image.open(file)
        output = BytesIO()
        
        if format in ['jpg', 'jpeg']:
            image = image.convert('RGB')
            image.save(output, format='JPEG', quality=quality)
        else:
            image.save(output, format=format.upper())
        
        output.seek(0)
        
        return send_file(
            output,
            mimetype=f'image/{format}',
            as_attachment=True,
            download_name=f'converted.{format}'
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

def get_highest_quality_stream(yt, is_video=True):
    if is_video:
        # Get progressive streams (with video and audio combined)
        streams = yt.streams.filter(progressive=True, file_extension='mp4')
        return streams.order_by('resolution').desc().first()
    else:
        # Get audio-only streams
        streams = yt.streams.filter(only_audio=True)
        return streams.order_by('abr').desc().first()

@app.route('/video-info', methods=['POST'])
def get_video_info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Use the new function to get YouTube video
        yt = get_ytb_video(url)
        
        # Get video streams
        video_streams = yt.streams.filter(progressive=True, file_extension='mp4')
        audio_streams = yt.streams.filter(only_audio=True)
        
        # Format stream information
        video_qualities = [{
            'itag': s.itag,
            'resolution': s.resolution,
            'fps': s.fps,
            'filesize': s.filesize,
            'mime_type': s.mime_type,
            'description': f"{s.resolution} ({formatFileSize(s.filesize)})"
        } for s in video_streams]
        
        audio_qualities = [{
            'itag': s.itag,
            'abr': s.abr,
            'filesize': s.filesize,
            'mime_type': s.mime_type,
            'description': f"{s.abr} ({formatFileSize(s.filesize)})"
        } for s in audio_streams]

        return jsonify({
            'title': yt.title,
            'author': yt.author,
            'length': yt.length,
            'thumbnail': yt.thumbnail_url,
            'video_qualities': video_qualities,
            'audio_qualities': audio_qualities
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-video', methods=['POST'])
def download_video():
    try:
        url = request.form.get('url')
        itag = request.form.get('itag')
        
        if not url or not itag:
            return jsonify({'error': 'Missing URL or quality selection'}), 400

        # Use the new function to get YouTube video
        yt = get_ytb_video(url)
        
        stream = yt.streams.get_by_itag(int(itag))
        
        if not stream:
            # Fallback to highest quality if selected stream is not available
            is_video = request.form.get('format') == 'video'
            stream = get_highest_quality_stream(yt, is_video)
            
            if not stream:
                return jsonify({'error': 'No suitable stream found'}), 404

        # Download to memory
        output = BytesIO()
        stream.stream_to_buffer(output)
        output.seek(0)

        # Clean filename
        safe_title = re.sub(r'[^\w\s-]', '', yt.title)
        extension = 'mp4' if stream.includes_video_track else 'mp3'
        filename = f"{safe_title}.{extension}"

        return send_file(
            output,
            mimetype=stream.mime_type,
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper function for file size formatting
def formatFileSize(bytes):
    if bytes is None:
        return "Unknown size"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} GB"

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

@app.route('/spotify-info', methods=['POST'])
@track_performance
def get_spotify_info():
    if not spotify_client:
        return jsonify({'error': 'Spotify service is not available'}), 503
        
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Extract track ID from URL with better validation
        if 'spotify.com/track/' in url:
            track_id = url.split('track/')[1].split('?')[0].split('/')[0]
        else:
            return jsonify({'error': 'Invalid Spotify URL format'}), 400
        
        try:
            # Retry mechanism for Spotify API calls
            max_retries = 3
            retry_count = 0
            
            while retry_count < max_retries:
                try:
                    track = spotify_client.track(track_id)
                    
                    # Validate track data
                    if not track or 'name' not in track:
                        raise ValueError('Invalid track data received')
                        
                    return jsonify({
                        'title': track['name'],
                        'artist': track['artists'][0]['name'] if track['artists'] else 'Unknown Artist',
                        'album': track['album']['name'] if track['album'] else 'Unknown Album',
                        'artwork': track['album']['images'][0]['url'] if track['album'].get('images') else '',
                        'duration': track['duration_ms'] // 1000,
                        'preview_url': track['preview_url'] or ''
                    })
                    
                except SpotifyException as se:
                    if se.http_status == 429:  # Rate limiting
                        retry_count += 1
                        time.sleep(2 ** retry_count)  # Exponential backoff
                    else:
                        raise
                except Exception as e:
                    retry_count += 1
                    if retry_count == max_retries:
                        raise
                    time.sleep(1)
                    
            raise Exception('Max retries exceeded')
            
        except SpotifyException as se:
            error_msg = {
                401: 'Spotify authentication failed',
                403: 'Spotify access forbidden',
                404: 'Track not found',
                429: 'Too many requests, please try again later'
            }.get(se.http_status, f'Spotify API error: {str(se)}')
            
            logger.error(f"Spotify API Error: {error_msg}")
            return jsonify({'error': error_msg}), se.http_status
            
    except Exception as e:
        logger.error(f"Spotify Track Info Error: {str(e)}")
        return jsonify({'error': 'Could not fetch track information'}), 500

@app.route('/convert-spotify', methods=['POST'])
def convert_spotify():
    try:
        url = request.form.get('url')
        quality = request.form.get('quality', '320')
        
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Extract track ID and get track info
        if 'spotify.com/track/' in url:
            track_id = url.split('track/')[1].split('?')[0].split('/')[0]
        else:
            return jsonify({'error': 'Invalid Spotify URL format'}), 400
        
        try:
            # Get track info from Spotify
            track = spotify_client.track(track_id)
            search_query = f"{track['name']} {track['artists'][0]['name']} official audio"
            
            # Configure youtube-dl
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': quality,
                }],
                'outtmpl': 'temp_%(title)s.%(ext)s',
                'quiet': True,
                'no_warnings': True,
                'default_search': 'ytsearch',
                'extract_flat': False
            }
            
            with YoutubeDL(ydl_opts) as ydl:
                try:
                    # Search and download
                    info = ydl.extract_info(f"ytsearch:{search_query}", download=True)
                    if not info or 'entries' not in info or not info['entries']:
                        return jsonify({'error': 'No matching audio found'}), 404
                    
                    video_info = info['entries'][0]
                    filename = f"temp_{video_info['title']}.mp3"
                    
                    # Create safe filename for the output
                    safe_title = re.sub(r'[^\w\s-]', '', track['name'])
                    safe_artist = re.sub(r'[^\w\s-]', '', track['artists'][0]['name'])
                    output_filename = f"{safe_title} - {safe_artist}.mp3"
                    
                    # Read the downloaded file
                    with open(filename, 'rb') as f:
                        audio_data = f.read()
                    
                    # Clean up the temporary file
                    os.remove(filename)
                    
                    # Send the file
                    return send_file(
                        BytesIO(audio_data),
                        mimetype='audio/mpeg',
                        as_attachment=True,
                        download_name=output_filename
                    )
                    
                except Exception as e:
                    logger.error(f"Download error: {str(e)}")
                    return jsonify({'error': 'Error downloading track'}), 500
                    
        except Exception as spotify_error:
            logger.error(f"Spotify API Error: {str(spotify_error)}")
            return jsonify({'error': 'Could not fetch track information'}), 403
            
    except Exception as e:
        logger.error(f"General Error: {str(e)}")
        return jsonify({'error': 'An error occurred processing your request'}), 500

@app.route('/api/docs')
def api_docs():
    return render_template('api.html')

@app.route('/api/convert', methods=['POST'])
def api_convert():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        format = request.form.get('format', 'png')
        quality = int(request.form.get('quality', 85))
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format'}), 400
            
        # Process the image
        image = Image.open(file)
        output = BytesIO()
        
        if format in ['jpg', 'jpeg']:
            image = image.convert('RGB')
            image.save(output, format='JPEG', quality=quality)
        else:
            image.save(output, format=format.upper())
            
        output.seek(0)
        
        return send_file(
            output,
            mimetype=f'image/{format}',
            as_attachment=True,
            download_name=f'converted.{format}'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/youtube/info', methods=['POST'])
def api_youtube_info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
            
        yt = get_ytb_video(url)
        return jsonify({
            'title': yt.title,
            'author': yt.author,
            'length': yt.length,
            'thumbnail': yt.thumbnail_url,
            'formats': [
                {
                    'itag': s.itag,
                    'quality': s.resolution or s.abr,
                    'type': 'video' if s.includes_video_track else 'audio',
                    'mime_type': s.mime_type
                } for s in yt.streams
            ]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/spotify/info', methods=['POST'])
def api_spotify_info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
            
        if 'track/' not in url:
            return jsonify({'error': 'Invalid Spotify URL'}), 400
            
        track_id = url.split('track/')[1].split('?')[0]
        track = spotify_client.track(track_id)
        
        return jsonify({
            'title': track['name'],
            'artist': track['artists'][0]['name'],
            'album': track['album']['name'],
            'duration': track['duration_ms'] // 1000,
            'preview_url': track['preview_url']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found_error(error):
    return render_template('error.html', error=404), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('error.html', error=500), 500

# Initialize Spotify client with better error handling
def init_spotify_client():
    try:
        return Spotify(client_credentials_manager=SpotifyClientCredentials(
            client_id=SPOTIFY_CONFIG['client_id'],
            client_secret=SPOTIFY_CONFIG['client_secret']
        ))
    except Exception as e:
        logger.error(f"Failed to initialize Spotify client: {str(e)}")
        return None

# Update the Spotify client initialization at the bottom of the file
spotify_client = init_spotify_client()
if not spotify_client:
    logger.warning("Spotify client initialization failed - service will be unavailable")

# Add these new utility functions
def validate_file_type(file, allowed_types):
    if '.' not in file.filename:
        raise ValueError("No file extension")
    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext not in allowed_types:
        raise ValueError(f"File type {ext} not allowed")
    return ext

def optimize_image(image, format, quality):
    """Optimize image based on format and quality settings"""
    if format in ['jpg', 'jpeg']:
        # Apply JPEG-specific optimizations
        image = image.convert('RGB')
        return image, {'quality': quality, 'optimize': True}
    elif format == 'png':
        # Apply PNG-specific optimizations
        return image, {'optimize': True, 'compress_level': 9}
    elif format == 'webp':
        # Apply WebP-specific optimizations
        return image, {'quality': quality, 'method': 6}
    return image, {}

if __name__ == '__main__':
    app.run(debug=True) 
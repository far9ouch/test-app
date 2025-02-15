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
from spotipy import Spotify
from spotipy.oauth2 import SpotifyClientCredentials
from config import SPOTIFY_CONFIG

app = Flask(__name__)
CORS(app)

# Set environment variables
os.environ['SPOTIFY_CLIENT_ID'] = 'e948f13a81c6473b9b63e5d2c0fa0811'
os.environ['SPOTIFY_CLIENT_SECRET'] = 'c7911881958046d399280e34dea2df03'

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
def get_spotify_info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Extract track ID from URL
        if 'track/' in url:
            track_id = url.split('track/')[1].split('?')[0]
        else:
            return jsonify({'error': 'Invalid Spotify URL'}), 400
        
        try:
            # Get track info
            track = spotify_client.track(track_id)
            
            return jsonify({
                'title': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'artwork': track['album']['images'][0]['url'] if track['album']['images'] else '',
                'duration': track['duration_ms'] // 1000,
                'preview_url': track['preview_url']
            })
        except Exception as spotify_error:
            print(f"Spotify API Error: {spotify_error}")
            return jsonify({'error': 'Could not fetch track information'}), 403
            
    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': 'An error occurred processing your request'}), 500

@app.route('/convert-spotify', methods=['POST'])
def convert_spotify():
    try:
        url = request.form.get('url')
        quality = request.form.get('quality', '320')
        
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Extract track ID
        if 'track/' in url:
            track_id = url.split('track/')[1].split('?')[0]
        else:
            return jsonify({'error': 'Invalid Spotify URL'}), 400
        
        try:
            # Get track info
            track = spotify_client.track(track_id)
            
            # Get track audio features
            audio_features = spotify_client.audio_features([track_id])[0]
            
            # Use youtube-dl to search and download the track
            from youtube_dl import YoutubeDL
            
            # Create search query
            search_query = f"{track['name']} {track['artists'][0]['name']} official audio"
            
            # Configure youtube-dl
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': quality,
                }],
                'outtmpl': '%(title)s.%(ext)s',
                'quiet': True,
                'no_warnings': True,
                'default_search': 'ytsearch',
            }
            
            with YoutubeDL(ydl_opts) as ydl:
                try:
                    # Search for the track
                    info = ydl.extract_info(f"ytsearch:{search_query}", download=False)
                    if 'entries' in info and len(info['entries']) > 0:
                        video = info['entries'][0]
                        
                        # Download to memory
                        output = BytesIO()
                        ydl.download([video['webpage_url']])
                        
                        # Get the downloaded file
                        filename = f"{track['name']} - {track['artists'][0]['name']}.mp3"
                        safe_filename = re.sub(r'[^\w\s-]', '', filename)
                        
                        # Read the file and send it
                        with open(f"{video['title']}.mp3", 'rb') as f:
                            output.write(f.read())
                        
                        # Clean up the temporary file
                        os.remove(f"{video['title']}.mp3")
                        
                        output.seek(0)
                        
                        # Add ID3 tags
                        from mutagen.easyid3 import EasyID3
                        from mutagen.mp3 import MP3
                        
                        # Create a temporary file for ID3 tags
                        temp_file = BytesIO(output.read())
                        audio = MP3(temp_file, ID3=EasyID3)
                        
                        # Add metadata
                        if audio.tags is None:
                            audio.add_tags()
                        
                        audio.tags['title'] = track['name']
                        audio.tags['artist'] = track['artists'][0]['name']
                        audio.tags['album'] = track['album']['name']
                        
                        # Save the file with tags
                        output = BytesIO()
                        audio.save(output)
                        output.seek(0)
                        
                        return send_file(
                            output,
                            mimetype='audio/mpeg',
                            as_attachment=True,
                            download_name=safe_filename
                        )
                    else:
                        return jsonify({'error': 'Could not find matching audio'}), 404
                        
                except Exception as e:
                    print(f"Download error: {str(e)}")
                    return jsonify({'error': 'Error downloading track'}), 500
                    
        except Exception as spotify_error:
            print(f"Spotify API Error: {spotify_error}")
            return jsonify({'error': 'Could not fetch track information'}), 403
            
    except Exception as e:
        print(f"General Error: {str(e)}")
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

# Initialize Spotify client
try:
    spotify_client = Spotify(client_credentials_manager=SpotifyClientCredentials(
        client_id=SPOTIFY_CONFIG['client_id'],
        client_secret=SPOTIFY_CONFIG['client_secret']
    ))
except Exception as e:
    print(f"Error initializing Spotify client: {str(e)}")
    spotify_client = None

if __name__ == '__main__':
    app.run(debug=True) 
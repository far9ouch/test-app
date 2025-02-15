from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image
import os
from io import BytesIO
import cairosvg

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

if __name__ == '__main__':
    app.run(debug=True) 
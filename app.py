from flask import Flask, render_template, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/time')
def get_time():
    return jsonify({
        'current_time': time.strftime('%H:%M:%S'),
        'message': 'Hello from the API!'
    })

if __name__ == '__main__':
    app.run(debug=True) 
"""
Flask + SocketIO Face Recognition Server
Processes video from Express backend and sends detections to React frontend
"""

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
from tensorflow import keras
import pickle
import threading
import time
import requests
from io import BytesIO

# ==================== CONFIGURATION ====================
# Update these paths for your laptop
YOLO_MODEL_PATH = "C:/Users/sudhe/Downloads/yolov9e-face-lindevs.pt"
FACE_CLASSIFIER_PATH = "D:/Downloads/face_model_final_v5.h5"
LABELS_PATH = "D:/Downloads/label_mapping_v5.pkl"

# Express backend URL
EXPRESS_API = "http://localhost:5000/api/video"

# Recognition settings
CONFIDENCE_THRESHOLD = 0.90  # 90% confidence minimum
PREDICTION_INTERVAL = 10  # Predict every 10 seconds
PADDING = 3

# ==================== FLASK APP SETUP ====================
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ==================== LOAD MODELS ====================
print("="*60)
print("LOADING MODELS")
print("="*60)

print("\n1. Loading YOLO face detection model...")
yolo_model = YOLO(YOLO_MODEL_PATH)
print("   ✓ YOLO loaded")

print("\n2. Loading face recognition model...")
face_model = keras.models.load_model(FACE_CLASSIFIER_PATH)
print("   ✓ Face classifier loaded")

print("\n3. Loading label mappings...")
with open(LABELS_PATH, 'rb') as f:
    idx_to_label = pickle.load(f)
print(f"   ✓ Can recognize {len(idx_to_label)} people")

# ==================== VIDEO PROCESSING STATE ====================
active_streams = {}  # Track active video processing threads

# ==================== PREDICTION FUNCTION ====================
def predict_face_from_crop(face_crop, model, idx_to_label):
    """Predict person from cropped face region"""
    try:
        # Convert to grayscale if needed
        if len(face_crop.shape) == 3:
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_crop

        # Normalize
        normalized = gray.astype('float32') / 255.0

        # Add channel and batch dimensions
        input_img = np.expand_dims(normalized, axis=-1)
        input_img = np.expand_dims(input_img, axis=0)

        # Predict
        predictions = model.predict(input_img, verbose=0)[0]

        # Get top prediction
        top_idx = np.argmax(predictions)
        label = idx_to_label[top_idx]
        confidence = predictions[top_idx] * 100

        return label, confidence

    except Exception as e:
        print(f"Error in prediction: {e}")
        return "unknown", 0.0

# ==================== PROCESS FRAME ====================
def process_frame(frame, yolo_model, face_model, idx_to_label, conf_threshold=0.90, padding=0):
    """
    Process a single frame: detect faces and recognize
    Returns: list of detections
    """
    h, w = frame.shape[:2]

    # Run YOLO detection
    results = yolo_model(frame, verbose=False)
    boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)

    detections = []

    for box in boxes:
        x1, y1, x2, y2 = box

        # Add padding
        x1_pad = max(0, x1 - padding)
        y1_pad = max(0, y1 - padding)
        x2_pad = min(w, x2 + padding)
        y2_pad = min(h, y2 + padding)

        # Crop and resize face
        face_crop = frame[y1_pad:y2_pad, x1_pad:x2_pad]
        if face_crop.size == 0:
            continue
        
        face_crop = cv2.resize(face_crop, (112, 112), interpolation=cv2.INTER_CUBIC)

        # Predict identity
        label, confidence = predict_face_from_crop(face_crop, face_model, idx_to_label)

        # Only include predictions above confidence threshold
        if confidence >= conf_threshold * 100:
            detections.append({
                'box': [int(x1), int(y1), int(x2), int(y2)],
                'label': label,
                'confidence': float(confidence)
            })

    return detections

# ==================== TRACK FACES CONTINUOUS ====================
def track_faces_continuous(frame, yolo_model, tracked_faces):
    """Use YOLO to continuously track face positions"""
    results = yolo_model(frame, verbose=False)
    detected_boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
    
    if len(detected_boxes) == 0:
        return []
    
    updated_faces = []
    
    # For each tracked face, find the closest detection
    for tracked in tracked_faces:
        old_box = tracked['box']
        best_iou = 0
        best_box = None
        
        # Find best matching detection using IoU
        for det_box in detected_boxes:
            x1_1, y1_1, x2_1, y2_1 = old_box
            x1_2, y1_2, x2_2, y2_2 = det_box
            
            x1_i = max(x1_1, x1_2)
            y1_i = max(y1_1, y1_2)
            x2_i = min(x2_1, x2_2)
            y2_i = min(y2_1, y2_2)
            
            if x2_i > x1_i and y2_i > y1_i:
                intersection = (x2_i - x1_i) * (y2_i - y1_i)
                area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
                area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
                union = area1 + area2 - intersection
                iou = intersection / union if union > 0 else 0
                
                if iou > best_iou:
                    best_iou = iou
                    best_box = det_box.tolist()
        
        # Update with best match
        if best_box is not None and best_iou > 0.3:
            updated_faces.append({
                'box': best_box,
                'label': tracked['label'],
                'confidence': tracked['confidence']
            })
        else:
            updated_faces.append(tracked)
    
    return updated_faces

# ==================== PROCESS VIDEO STREAM ====================
def process_video_stream(camera_id, video_url):
    """
    Process video stream and emit detections via WebSocket
    """
    print(f"Starting video processing for {camera_id}")
    
    # Open video stream
    cap = cv2.VideoCapture(video_url)
    
    if not cap.isOpened():
        print(f"Error: Could not open video stream {video_url}")
        socketio.emit('error', {'message': 'Could not open video stream'})
        return
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    current_tracked_faces = []
    last_prediction_time = time.time() - PREDICTION_INTERVAL
    frame_count = 0
    
    print(f"Video stream opened. FPS: {fps}")
    
    while camera_id in active_streams and active_streams[camera_id]:
        ret, frame = cap.read()
        if not ret:
            # Loop video
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        current_time = time.time()
        
        # Make new predictions every 10 seconds
        if current_time - last_prediction_time >= PREDICTION_INTERVAL:
            last_prediction_time = current_time
            
            # Detect and recognize faces
            detections = process_frame(
                frame, yolo_model, face_model, idx_to_label,
                CONFIDENCE_THRESHOLD, PADDING
            )
            
            current_tracked_faces = detections
            
            print(f"Frame {frame_count}: Detected {len(detections)} faces")
            
        else:
            # Track existing faces
            if current_tracked_faces:
                current_tracked_faces = track_faces_continuous(
                    frame, yolo_model, current_tracked_faces
                )
        
        # Emit detections to frontend
        socketio.emit('detections', {
            'camera_id': camera_id,
            'detections': current_tracked_faces,
            'total_detected': len(current_tracked_faces),
            'frame_count': frame_count
        })
        
        frame_count += 1
        
        # Control frame rate
        time.sleep(1.0 / fps)
    
    cap.release()
    print(f"Stopped video processing for {camera_id}")

# ==================== API ENDPOINTS ====================
@app.route('/api/status', methods=['GET'])
def status():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'models_loaded': True,
        'active_streams': list(active_streams.keys())
    })

@app.route('/api/start_stream/<camera_id>', methods=['POST'])
def start_stream(camera_id):
    """Start processing a camera stream"""
    if camera_id in active_streams and active_streams[camera_id]:
        return jsonify({'message': 'Stream already active'}), 200
    
    # Get video URL from Express backend
    video_url = f"{EXPRESS_API}/{camera_id}.mp4"
    
    # Start processing thread
    active_streams[camera_id] = True
    thread = threading.Thread(
        target=process_video_stream,
        args=(camera_id, video_url),
        daemon=True
    )
    thread.start()
    
    return jsonify({
        'message': f'Started processing {camera_id}',
        'video_url': video_url
    }), 200

@app.route('/api/stop_stream/<camera_id>', methods=['POST'])
def stop_stream(camera_id):
    """Stop processing a camera stream"""
    if camera_id in active_streams:
        active_streams[camera_id] = False
        return jsonify({'message': f'Stopped processing {camera_id}'}), 200
    
    return jsonify({'message': 'Stream not active'}), 404

# ==================== SOCKETIO EVENTS ====================
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'message': 'Connected to face recognition server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('request_stream')
def handle_stream_request(data):
    """Handle request to start streaming detections"""
    camera_id = data.get('camera_id')
    print(f"Stream requested for {camera_id}")
    
    # Start stream via HTTP endpoint
    if camera_id not in active_streams or not active_streams[camera_id]:
        video_url = f"{EXPRESS_API}/{camera_id}.mp4"
        active_streams[camera_id] = True
        thread = threading.Thread(
            target=process_video_stream,
            args=(camera_id, video_url),
            daemon=True
        )
        thread.start()

# ==================== RUN SERVER ====================
if __name__ == '__main__':
    print("\n" + "="*60)
    print("FACE RECOGNITION SERVER READY")
    print("="*60)
    print(f"\nServer running on: http://localhost:5001")
    print(f"WebSocket endpoint: ws://localhost:5001")
    print(f"\nWaiting for connections...\n")
    
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
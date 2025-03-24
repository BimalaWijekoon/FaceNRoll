import cv2
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
import pickle

# Configuration
MODEL_FOLDER = 'vgg_model'
FEATURE_MODEL_PATH = os.path.join(MODEL_FOLDER, 'vggface_features.h5')
FACES_DIR = 'faces'
OUTPUT_FILE = 'face_embeddings.pkl'

# Function to preprocess image for VGG model
def preprocess_image(img):
    # Resize to 224x224 (VGG input size)
    resized = cv2.resize(img, (224, 224))
    # Convert from BGR to RGB (OpenCV uses BGR, but model expects RGB)
    rgb_img = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    # Normalize pixel values
    normalized = rgb_img / 255.0
    # Add batch dimension
    preprocessed = np.expand_dims(normalized, axis=0)
    return preprocessed

# Function to extract face embeddings using VGG model
def extract_vgg_features(face_img):
    preprocessed = preprocess_image(face_img)
    features = vgg_feature_model.predict(preprocessed, verbose=0)
    return features[0]  # Return the feature vector

def main():
    # Load the VGG feature extraction model
    print("Loading VGG Face feature extraction model...")
    try:
        global vgg_feature_model
        vgg_feature_model = load_model(FEATURE_MODEL_PATH)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        return
    
    # Load face cascade for detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if face_cascade.empty():
        print("Error: Could not load face cascade classifier")
        return
    
    # Process each person's directory
    print("Processing faces...")
    embeddings_data = {}
    
    for person_name in os.listdir(FACES_DIR):
        person_path = os.path.join(FACES_DIR, person_name)
        if os.path.isdir(person_path):
            embeddings_data[person_name] = []
            print(f"Processing images for: {person_name}")
            
            # Process each image in the person's directory
            for img_name in os.listdir(person_path):
                if img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    img_path = os.path.join(person_path, img_name)
                    try:
                        # Load image
                        img = cv2.imread(img_path)
                        if img is None:
                            print(f"Could not read image: {img_path}")
                            continue
                        
                        # Detect face in the image
                        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                        
                        if len(faces) > 0:
                            # Use the first detected face
                            x, y, w, h = faces[0]
                            face_img = img[y:y+h, x:x+w]
                            
                            # Extract features
                            embedding = extract_vgg_features(face_img)
                            
                            # Store embedding
                            embeddings_data[person_name].append(embedding)
                            print(f"  Processed: {img_name}")
                        else:
                            print(f"  No face detected in: {img_name}")
                    
                    except Exception as e:
                        print(f"  Error processing {img_path}: {str(e)}")
    
    # Print summary
    total_embeddings = sum(len(emb) for emb in embeddings_data.values())
    print(f"\nProcessed {total_embeddings} face images for {len(embeddings_data)} persons")
    
    # Save embeddings to file
    print(f"Saving embeddings to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'wb') as f:
        pickle.dump(embeddings_data, f)
    print("Embeddings saved successfully!")

if __name__ == "__main__":
    main()
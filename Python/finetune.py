import os
import sys
import glob
import zipfile
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.layers import Input, Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications.vgg16 import preprocess_input
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import cv2
import time
import datetime
import h5py
import shutil
from tqdm import tqdm
import requests
import kagglehub

# Configuration
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
tf.random.set_seed(RANDOM_SEED)

# Directory structure
DATA_DIR = 'vggface2_data'
TRAIN_DIR = os.path.join(DATA_DIR, 'train')
VAL_DIR = os.path.join(DATA_DIR, 'val')
PROCESSED_TRAIN_DIR = os.path.join(DATA_DIR, 'processed_train')
PROCESSED_VAL_DIR = os.path.join(DATA_DIR, 'processed_val')

# VGG model paths
VGG_MODEL_FOLDER = 'vgg_model'
VGG_FEATURE_MODEL_PATH = os.path.join(VGG_MODEL_FOLDER, 'vggface_features.h5')

# Fine-tuned model paths
FINETUNED_MODEL_FOLDER = 'vgg_finetuned'
FINETUNED_FULL_MODEL_PATH = os.path.join(FINETUNED_MODEL_FOLDER, 'vggface_finetuned_full.h5')
FINETUNED_FEATURE_MODEL_PATH = os.path.join(FINETUNED_MODEL_FOLDER, 'vggface_finetuned_features.h5')

# Training parameters
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 1e-4
IMG_SIZE = (224, 224)
VALIDATION_SPLIT = 0.2

# Create directories if they don't exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(FINETUNED_MODEL_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_TRAIN_DIR, exist_ok=True)
os.makedirs(PROCESSED_VAL_DIR, exist_ok=True)

# Step 1: Download or extract the VGGFace2 dataset
def download_vggface2_dataset(manual_path=None):
    """
    Download the VGGFace2 dataset from Kaggle or use a manually downloaded version.
    
    Args:
        manual_path (str, optional): Path to manually downloaded dataset ZIP file.
    
    Returns:
        str: Path to the dataset files.
    """
    print("=" * 50)
    print("Setting up VGGFace2 dataset...")
    
    # Check if dataset directories already exist
    if os.path.exists(TRAIN_DIR) and os.path.exists(VAL_DIR):
        print("Dataset directories already exist. Skipping download/extraction.")
        return DATA_DIR
    
    # If manual path is provided, use that
    if manual_path and os.path.exists(manual_path):
        print(f"Using manually downloaded dataset at: {manual_path}")
        zip_path = manual_path
    else:
        # Download from Kaggle
        print("Downloading VGGFace2 dataset from Kaggle...")
        
        # Implement retry logic for downloading
        max_retries = 10
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                zip_path = kagglehub.dataset_download("hearfool/vggface2")
                print(f"Successfully downloaded dataset to: {zip_path}")
                break
            except Exception as e:
                retry_count += 1
                print(f"Download attempt {retry_count} failed: {e}")
                if retry_count >= max_retries:
                    print("Max retries reached. Please download the dataset manually.")
                    manual_path = input("Enter path to manually downloaded ZIP file: ")
                    if os.path.exists(manual_path):
                        zip_path = manual_path
                        break
                    else:
                        print("Invalid path. Exiting.")
                        sys.exit(1)
                print(f"Retrying in 5 seconds...")
                time.sleep(5)
    
    # Extract the dataset
    print("Extracting dataset...")
    
    # Find all zip files in the download directory
    if os.path.isdir(zip_path):
        zip_files = glob.glob(os.path.join(zip_path, "*.zip"))
    else:
        zip_files = [zip_path]
    
    for zip_file in zip_files:
        try:
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                zip_ref.extractall(DATA_DIR)
            print(f"Extracted: {zip_file}")
        except Exception as e:
            print(f"Error extracting {zip_file}: {e}")
    
    # Verify the folder structure
    expected_folders = [TRAIN_DIR, VAL_DIR]
    for folder in expected_folders:
        if not os.path.exists(folder):
            print(f"Warning: Expected folder {folder} not found after extraction.")
        else:
            print(f"Verified: {folder} exists.")
    
    return DATA_DIR

# Step 2: Preprocess the dataset
def preprocess_dataset():
    """
    Preprocess the VGGFace2 dataset by resizing images and organizing them for training.
    
    Returns:
        tuple: Lists of training and validation image paths.
    """
    print("=" * 50)
    print("Preprocessing dataset...")
    
    # Get all image files in train and val directories
    train_images = []
    val_images = []
    
    # Walk through the train directory
    for root, _, files in os.walk(TRAIN_DIR):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                train_images.append(os.path.join(root, file))
    
    # Walk through the val directory
    for root, _, files in os.walk(VAL_DIR):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                val_images.append(os.path.join(root, file))
    
    print(f"Found {len(train_images)} training images and {len(val_images)} validation images.")
    
    # If no validation images found, split training images
    if len(val_images) == 0:
        print("No validation images found. Splitting training data...")
        train_images, val_images = train_test_split(
            train_images, test_size=VALIDATION_SPLIT, random_state=RANDOM_SEED
        )
        print(f"Split into {len(train_images)} training and {len(val_images)} validation images.")
    
    # Process training images
    processed_train_images = []
    for idx, img_path in tqdm(enumerate(train_images), total=len(train_images), desc="Processing training images"):
        try:
            # Extract class from path
            class_name = os.path.basename(os.path.dirname(img_path))
            class_dir = os.path.join(PROCESSED_TRAIN_DIR, class_name)
            os.makedirs(class_dir, exist_ok=True)
            
            # Load image
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # Resize image
            img_resized = cv2.resize(img, IMG_SIZE)
            
            # Save processed image
            new_img_path = os.path.join(class_dir, f"{idx}.jpg")
            cv2.imwrite(new_img_path, img_resized)
            processed_train_images.append(new_img_path)
        except Exception as e:
            print(f"Error processing image {img_path}: {e}")
    
    # Process validation images
    processed_val_images = []
    for idx, img_path in tqdm(enumerate(val_images), total=len(val_images), desc="Processing validation images"):
        try:
            # Extract class from path
            class_name = os.path.basename(os.path.dirname(img_path))
            class_dir = os.path.join(PROCESSED_VAL_DIR, class_name)
            os.makedirs(class_dir, exist_ok=True)
            
            # Load image
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # Resize image
            img_resized = cv2.resize(img, IMG_SIZE)
            
            # Save processed image
            new_img_path = os.path.join(class_dir, f"{idx}.jpg")
            cv2.imwrite(new_img_path, img_resized)
            processed_val_images.append(new_img_path)
        except Exception as e:
            print(f"Error processing image {img_path}: {e}")
    
    print(f"Processed {len(processed_train_images)} training images and {len(processed_val_images)} validation images.")
    
    return processed_train_images, processed_val_images

# Step 3: Create data generators
def create_data_generators():
    """
    Create data generators for training and validation.
    
    Returns:
        tuple: Training and validation data generators.
    """
    print("=" * 50)
    print("Setting up data generators...")
    
    # Minimal processing for both training and validation
    train_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input
    )
    
    val_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input
    )
    
    # Create generators
    train_generator = train_datagen.flow_from_directory(
        PROCESSED_TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=True
    )
    
    val_generator = val_datagen.flow_from_directory(
        PROCESSED_VAL_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )
    
    print(f"Created data generators with {train_generator.num_classes} classes.")
    
    return train_generator, val_generator

# Step 4: Load pretrained VGGFace model
def load_vggface_model():
    """
    Load the pretrained VGGFace model.
    
    Returns:
        Model: Loaded VGGFace model.
    """
    print("=" * 50)
    print("Loading pretrained VGGFace model...")
    
    if not os.path.exists(VGG_FEATURE_MODEL_PATH):
        print(f"Error: VGGFace model not found at {VGG_FEATURE_MODEL_PATH}. Please run the ready.py script first.")
        sys.exit(1)
    
    try:
        # Load the feature extraction model
        vgg_model = load_model(VGG_FEATURE_MODEL_PATH)
        print("VGGFace model loaded successfully.")
        return vgg_model
    except Exception as e:
        print(f"Error loading VGGFace model: {e}")
        sys.exit(1)

# Step 5: Build and fine-tune the model
def build_and_finetune_model(vgg_model, train_generator, val_generator):
    """
    Build and fine-tune the model for face recognition.
    
    Args:
        vgg_model (Model): Loaded VGGFace model.
        train_generator: Training data generator.
        val_generator: Validation data generator.
    
    Returns:
        tuple: Fine-tuned model and training history.
    """
    print("=" * 50)
    print("Building and fine-tuning the model...")
    
    # Freeze early layers (first 3 blocks)
    for layer in vgg_model.layers[:10]:
        layer.trainable = False
    
    # Unfreeze later layers
    for layer in vgg_model.layers[10:]:
        layer.trainable = True
    
    # Add new layers for improved features
    x = vgg_model.output
    x = Dropout(0.5, name='dropout_ft1')(x)
    x = Dense(1024, activation='relu', name='fc8')(x)
    x = Dropout(0.5, name='dropout_ft2')(x)
    
    # Add classification layer
    predictions = Dense(train_generator.num_classes, activation='softmax', name='predictions')(x)
    
    # Create new model
    fine_tuned_model = Model(inputs=vgg_model.input, outputs=predictions)
    
    # Compile the model
    fine_tuned_model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Print model summary
    fine_tuned_model.summary()
    
    # Set up callbacks
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=5, min_lr=1e-6),
        ModelCheckpoint(
            os.path.join(FINETUNED_MODEL_FOLDER, 'checkpoint_{epoch:02d}_{val_accuracy:.4f}.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            save_weights_only=False
        ),
        TensorBoard(log_dir=os.path.join(FINETUNED_MODEL_FOLDER, 'logs'))
    ]
    
    # Train the model
    print("\nStarting fine-tuning...")
    history = fine_tuned_model.fit(
        train_generator,
        steps_per_epoch=len(train_generator),
        epochs=EPOCHS,
        validation_data=val_generator,
        validation_steps=len(val_generator),
        callbacks=callbacks,
        verbose=1
    )
    
    return fine_tuned_model, history

# Step 6: Evaluate the model
def evaluate_model(model, val_generator):
    """
    Evaluate the fine-tuned model.
    
    Args:
        model (Model): Fine-tuned model.
        val_generator: Validation data generator.
    
    Returns:
        list: Evaluation results.
    """
    print("=" * 50)
    print("Evaluating the fine-tuned model...")
    
    # Perform evaluation
    eval_results = model.evaluate(val_generator, steps=len(val_generator), verbose=1)
    
    print(f"Evaluation Results:")
    print(f"Loss: {eval_results[0]:.4f}")
    print(f"Accuracy: {eval_results[1]:.4f}")
    
    return eval_results

# Step 7: Save the model
def save_models(fine_tuned_model):
    """
    Save the fine-tuned model and feature extraction model.
    
    Args:
        fine_tuned_model (Model): Fine-tuned model.
    """
    print("=" * 50)
    print("Saving the fine-tuned models...")
    
    # Save the complete fine-tuned model
    fine_tuned_model.save(FINETUNED_FULL_MODEL_PATH)
    print(f"Saved complete fine-tuned model to: {FINETUNED_FULL_MODEL_PATH}")
    
    # Create and save the feature extraction model
    # (This is useful for extracting features for other tasks)
    feature_layer = fine_tuned_model.get_layer('fc8')
    feature_model = Model(inputs=fine_tuned_model.input, outputs=feature_layer.output)
    feature_model.save(FINETUNED_FEATURE_MODEL_PATH)
    print(f"Saved feature extraction model to: {FINETUNED_FEATURE_MODEL_PATH}")

# Step 8: Plot training history
def plot_training_history(history):
    """
    Plot the training history.
    
    Args:
        history: Training history object.
    """
    print("=" * 50)
    print("Plotting training history...")
    
    # Create figure and subplots
    plt.figure(figsize=(12, 5))
    
    # Plot accuracy
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Training Accuracy')
    plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
    plt.title('Model Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    
    # Plot loss
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    # Save the plot
    plt.tight_layout()
    plt.savefig(os.path.join(FINETUNED_MODEL_FOLDER, 'training_history.png'))
    print(f"Saved training history plot to: {os.path.join(FINETUNED_MODEL_FOLDER, 'training_history.png')}")

# Step 9: Calculate and log detailed metrics
def calculate_detailed_metrics(model, val_generator):
    """
    Calculate detailed metrics for the model performance.
    
    Args:
        model (Model): Fine-tuned model.
        val_generator: Validation data generator.
    """
    print("=" * 50)
    print("Calculating detailed metrics...")
    
    # Get predictions
    val_generator.reset()
    y_true = val_generator.classes
    y_pred_probs = model.predict(val_generator, steps=len(val_generator), verbose=1)
    y_pred = np.argmax(y_pred_probs, axis=1)
    
    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average='weighted')
    recall = recall_score(y_true, y_pred, average='weighted')
    f1 = f1_score(y_true, y_pred, average='weighted')
    
    # Log metrics
    print(f"Detailed Metrics:")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1 Score: {f1:.4f}")
    
    # Calculate confusion matrix
    conf_matrix = confusion_matrix(y_true, y_pred)
    
    # Save metrics to a file
    with open(os.path.join(FINETUNED_MODEL_FOLDER, 'metrics.txt'), 'w') as f:
        f.write(f"Accuracy: {accuracy:.4f}\n")
        f.write(f"Precision: {precision:.4f}\n")
        f.write(f"Recall: {recall:.4f}\n")
        f.write(f"F1 Score: {f1:.4f}\n")
    
    print(f"Saved metrics to: {os.path.join(FINETUNED_MODEL_FOLDER, 'metrics.txt')}")
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'confusion_matrix': conf_matrix
    }

# Step 10: Main function to run the full pipeline
def main():
    """
    Main function to run the full fine-tuning pipeline.
    """
    print("=" * 50)
    print("Starting VGGFace2 fine-tuning pipeline...")
    print("=" * 50)
    
    start_time = time.time()
    
    # Ask user if they want to use a manually downloaded dataset
    use_manual = input("Do you want to use a manually downloaded VGGFace2 dataset? (y/n): ").lower() == 'y'
    manual_path = None
    
    if use_manual:
        manual_path = input("Enter the path to the dataset ZIP file: ")
    
    # Step 1: Download or extract the dataset
    download_vggface2_dataset(manual_path)
    
    # Step 2: Preprocess the dataset
    preprocess_dataset()
    
    # Step 3: Create data generators
    train_generator, val_generator = create_data_generators()
    
    # Step 4: Load pretrained VGGFace model
    vgg_model = load_vggface_model()
    
    # Step 5: Build and fine-tune the model
    fine_tuned_model, history = build_and_finetune_model(vgg_model, train_generator, val_generator)
    
    # Step 6: Evaluate the model
    eval_results = evaluate_model(fine_tuned_model, val_generator)
    
    # Step 7: Save the model
    save_models(fine_tuned_model)
    
    # Step 8: Plot training history
    plot_training_history(history)
    
    # Step 9: Calculate detailed metrics
    metrics = calculate_detailed_metrics(fine_tuned_model, val_generator)
    
    # Calculate total time
    end_time = time.time()
    total_time = end_time - start_time
    
    # Log total time
    print("=" * 50)
    print(f"Fine-tuning completed in {total_time:.2f} seconds ({datetime.timedelta(seconds=total_time)})")
    print("=" * 50)
    
    # Summary of results
    print("Summary of results:")
    print(f"Model saved to: {FINETUNED_FULL_MODEL_PATH}")
    print(f"Feature extraction model saved to: {FINETUNED_FEATURE_MODEL_PATH}")
    print(f"Final validation accuracy: {metrics['accuracy']:.4f}")
    print(f"Final validation F1 score: {metrics['f1']:.4f}")
    print("=" * 50)

if __name__ == "__main__":
    main()
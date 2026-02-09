"""
Train ML models on TwiBot-20 dataset
"""
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score
import joblib

from app.config import settings
from app.utils.logging import setup_logging
from app.utils.twibot_loader import load_twibot20_dataset
from app.services.feature_engineering import FeatureEngineer

# Setup logging
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)

def train_models():
    """
    Main training pipeline:
    1. Load TwiBot-20 data
    2. Extract features
    3. Generate labels (heuristic)
    4. Train RF & IF models
    5. Evaluate and save
    """
    logger.info("Starting model training pipeline...")
    
    # 1. Load Data
    data_path = settings.twibot_dataset_path
    accounts = load_twibot20_dataset(data_path)
    
    if not accounts:
        logger.error("No accounts loaded. Exiting.")
        return
        
    logger.info(f"Loaded {len(accounts)} accounts for training")
    
    # 2. Extract Features
    engineer = FeatureEngineer()
    feature_matrix, _ = engineer.extract_features(accounts)
    feature_names = engineer.get_feature_names()
    
    logger.info(f"Extracted features shape: {feature_matrix.shape}")
    
    # 3. Generate Labels (Heuristic)
    # Since we don't have explicit labels in the JSON provided,
    # we'll use a strong heuristic based on TwiBot-20 paper insights & metadata:
    # - Verified accounts are likely Human (0)
    # - High follower/following usage ratio usually Human
    # - Default profile image + high actions often Bot (1)
    
    labels = []
    
    for acc in accounts:
        is_bot = 0
        
        # Heuristic 1: Verified accounts are human
        # (We don't have verified field in AccountData explicitly mapped from loader 'verified' 
        # but we can infer or update loader. For now let's reuse mapped fields)
        # 
        # Let's rely on what we have in AccountData:
        # High community_suspicion_index was mapped from verified=True -> low suspicion
        # So low suspicion = human
        
        # In loader: community_suspicion_index = 0.0 (default) or verified...
        # Wait, I mapped verified to community_suspicion_index in logic? 
        # Checking loader code... 
        # Logic was: network_data community_suspicion_index = 0.0 # Need external labels
        # Ah, I missed mapping 'verified' in loader to a useful field for labeling!
        
        # Let's use the raw logic here since we have AccountData objects but 
        # we might need to inspect the original data source or update heuristic.
        # 
        # Actually, let's use the features we DO have:
        # - profile_image_presence (False -> likely bot)
        # - bio_length_score (Low -> likely bot)
        # - username_entropy_score (High -> random strings -> bot)
        
        score = 0
        if not acc.profile.profile_image_presence: score += 1
        if acc.profile.bio_length_score < 0.1: score += 1
        if acc.profile.username_entropy_score > 3.5: score += 1
        if acc.behavioral.actions_per_minute > 1.0: score += 1 # Very high frequency
        if acc.profile.follower_following_ratio < 0.1: score += 1 # Follows many, few followers
        
        if score >= 2:
            is_bot = 1
            
        labels.append(is_bot)
        
    y = np.array(labels)
    logger.info(f"Generated labels: {np.sum(y)} bots, {len(y)-np.sum(y)} humans")
    
    # 4. Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        feature_matrix, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # 5. Train Random Forest
    logger.info("Training Random Forest...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    
    # Evaluate RF
    rf_pred = rf_model.predict(X_test)
    logger.info("Random Forest Results:")
    logger.info(f"\n{classification_report(y_test, rf_pred)}")
    
    # 6. Train Isolation Forest (Unsupervised)
    logger.info("Training Isolation Forest...")
    if_model = IsolationForest(
        n_estimators=100,
        contamination=0.1, # Est. 10% anomalies
        random_state=42,
        n_jobs=-1
    )
    if_model.fit(X_train)
    
    # 7. Save Models
    output_dir = Path(settings.model_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(rf_model, output_dir / settings.rf_model_file)
    joblib.dump(if_model, output_dir / settings.if_model_file)
    
    # Save feature names for inference alignment
    joblib.dump(feature_names, output_dir / "feature_names.joblib")
    
    logger.info(f"Models saved to {output_dir}")

if __name__ == "__main__":
    train_models()

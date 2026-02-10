#!/usr/bin/env python3
"""
Cresci-2017 Dataset Training Script

Trains the fraud detection model specifically on the Cresci-2017 dataset structure.
Handles the nested folder structure and maps available features.

Dataset Structure:
    data/datasets_full.csv/
    ├── genuine_accounts.csv/genuine_accounts.csv/users.csv  (label=0)
    ├── fake_followers.csv/fake_followers.csv/users.csv      (label=1)
    ├── social_spambots_1.csv/.../users.csv                  (label=1)
    ├── social_spambots_2.csv/.../users.csv                  (label=1)
    ├── social_spambots_3.csv/.../users.csv                  (label=1)
    ├── traditional_spambots_1.csv/.../users.csv             (label=1)
    ├── traditional_spambots_2.csv/.../users.csv             (label=1)
    ├── traditional_spambots_3.csv/.../users.csv             (label=1)
    └── traditional_spambots_4.csv/.../users.csv             (label=1)

Usage:
    python train_cresci.py
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('training_cresci.log')
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# PATHS
# =============================================================================

BASE_DATA_DIR = Path("data/datasets_full.csv")
OUTPUT_DIR = Path("models")

# Dataset folders with their labels (0=genuine, 1=bot/fake)
DATASETS = {
    "genuine_accounts": 0,
    "fake_followers": 1,
    "social_spambots_1": 1,
    "social_spambots_2": 1,
    "social_spambots_3": 1,
    "traditional_spambots_1": 1,
    "traditional_spambots_2": 1,
    "traditional_spambots_3": 1,
    "traditional_spambots_4": 1,
}

# =============================================================================
# FEATURE SCHEMA
# =============================================================================

FEATURE_COLUMNS = [
    'statuses_count',
    'followers_count', 
    'friends_count',
    'favourites_count',
    'listed_count',
    'account_age_days',
    'follower_following_ratio',
    'statuses_per_day',
    'followers_per_day',
    'friends_per_day',
    'has_description',
    'has_url',
    'has_location',
    'is_verified',
    'is_default_profile',
    'is_default_profile_image',
]

# =============================================================================
# DATA LOADING
# =============================================================================

def find_users_csv(dataset_dir: Path) -> Optional[Path]:
    """Find users.csv file in the nested folder structure."""
    # Pattern: dataset.csv/dataset.csv/users.csv or dataset.csv/__MACOSX/...
    for root, dirs, files in os.walk(dataset_dir):
        if 'users.csv' in files:
            return Path(root) / 'users.csv'
    return None


def load_dataset(name: str, label: int) -> pd.DataFrame:
    """Load a single dataset and assign label."""
    dataset_dir = BASE_DATA_DIR / f"{name}.csv"
    
    if not dataset_dir.exists():
        logger.warning(f"Dataset directory not found: {dataset_dir}")
        return pd.DataFrame()
    
    users_csv = find_users_csv(dataset_dir)
    if users_csv is None:
        logger.warning(f"users.csv not found in {dataset_dir}")
        return pd.DataFrame()
    
    try:
        df = pd.read_csv(users_csv, low_memory=False)
        df['label'] = label
        df['source_dataset'] = name
        logger.info(f"Loaded {name}: {len(df)} accounts (label={label})")
        return df
    except Exception as e:
        logger.error(f"Error loading {users_csv}: {e}")
        return pd.DataFrame()


def load_all_datasets() -> pd.DataFrame:
    """Load all Cresci-2017 datasets."""
    all_data = []
    
    for name, label in DATASETS.items():
        df = load_dataset(name, label)
        if not df.empty:
            all_data.append(df)
    
    if not all_data:
        logger.error("No datasets loaded!")
        return pd.DataFrame()
    
    combined = pd.concat(all_data, ignore_index=True)
    logger.info(f"Total samples: {len(combined)}")
    return combined


# =============================================================================
# FEATURE ENGINEERING
# =============================================================================

def compute_account_age(df: pd.DataFrame) -> pd.Series:
    """Compute account age in days from timestamp or updated column."""
    if 'created_at' in df.columns:
        created = pd.to_datetime(df['created_at'], errors='coerce', utc=True)
    elif 'timestamp' in df.columns:
        created = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
    elif 'updated' in df.columns:
        # Use updated as proxy (not ideal but better than nothing)
        created = pd.to_datetime(df['updated'], errors='coerce', utc=True)
    else:
        # Default to 365 days if no date column found
        return pd.Series([365] * len(df), index=df.index)
    
    # Use UTC now for comparison
    now = pd.Timestamp.now(tz='UTC')
    
    # Convert to UTC if not already
    if created.dt.tz is None:
        created = created.dt.tz_localize('UTC')
    
    age_days = (now - created).dt.days
    return age_days.fillna(365).clip(lower=1)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer features from raw Cresci-2017 data."""
    features = pd.DataFrame(index=df.index)
    
    # Raw counts (clip to reasonable ranges)
    features['statuses_count'] = df['statuses_count'].fillna(0).clip(0, 1e6)
    features['followers_count'] = df['followers_count'].fillna(0).clip(0, 1e7)
    features['friends_count'] = df['friends_count'].fillna(0).clip(0, 1e6)
    features['favourites_count'] = df['favourites_count'].fillna(0).clip(0, 1e6)
    features['listed_count'] = df['listed_count'].fillna(0).clip(0, 1e5)
    
    # Compute account age
    features['account_age_days'] = compute_account_age(df)
    
    # Ratios
    friends_safe = features['friends_count'].replace(0, 1)
    features['follower_following_ratio'] = (features['followers_count'] / friends_safe).clip(0, 1000)
    
    age_safe = features['account_age_days'].replace(0, 1)
    features['statuses_per_day'] = (features['statuses_count'] / age_safe).clip(0, 1000)
    features['followers_per_day'] = (features['followers_count'] / age_safe).clip(0, 1000)
    features['friends_per_day'] = (features['friends_count'] / age_safe).clip(0, 1000)
    
    # Profile completeness indicators
    features['has_description'] = 0
    if 'description' in df.columns:
        features['has_description'] = (df['description'].notna() & (df['description'] != '')).astype(int)
    
    features['has_url'] = 0
    if 'url' in df.columns:
        features['has_url'] = (df['url'].notna() & (df['url'] != '')).astype(int)
    
    features['has_location'] = 0
    if 'location' in df.columns:
        features['has_location'] = (df['location'].notna() & (df['location'] != '')).astype(int)
    
    features['is_verified'] = 0
    if 'verified' in df.columns:
        features['is_verified'] = df['verified'].fillna(False).astype(int)
    
    features['is_default_profile'] = 0
    if 'default_profile' in df.columns:
        features['is_default_profile'] = df['default_profile'].fillna(True).astype(int)
    
    features['is_default_profile_image'] = 0
    if 'default_profile_image' in df.columns:
        features['is_default_profile_image'] = df['default_profile_image'].fillna(True).astype(int)
    
    return features


# =============================================================================
# TRAINING
# =============================================================================

def train_model(X_train: np.ndarray, y_train: np.ndarray) -> RandomForestClassifier:
    """Train RandomForest with class weights for imbalance."""
    logger.info("Training RandomForest classifier...")
    
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    
    model.fit(X_train, y_train)
    logger.info("RandomForest training complete")
    return model


def train_isolation_forest(X_train: np.ndarray) -> IsolationForest:
    """Train Isolation Forest for anomaly detection."""
    logger.info("Training Isolation Forest...")
    
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train)
    logger.info("Isolation Forest training complete")
    return model


def evaluate_model(model, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
    """Evaluate model performance."""
    y_pred = model.predict(X_test)
    
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1_score': f1_score(y_test, y_pred, zero_division=0),
    }
    
    return metrics, y_pred


def get_feature_importance(model, feature_names: List[str]) -> Dict[str, float]:
    """Get sorted feature importances."""
    importances = model.feature_importances_
    return dict(sorted(
        zip(feature_names, importances),
        key=lambda x: x[1],
        reverse=True
    ))


# =============================================================================
# MAIN
# =============================================================================

def main():
    logger.info("="*60)
    logger.info("CRESCI-2017 FRAUD DETECTION MODEL TRAINING")
    logger.info("="*60)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load datasets
    logger.info("Loading datasets...")
    df = load_all_datasets()
    
    if df.empty:
        logger.error("No data loaded. Please check dataset paths.")
        sys.exit(1)
    
    # Class distribution
    class_counts = df['label'].value_counts()
    logger.info(f"Class distribution: {dict(class_counts)}")
    logger.info(f"  Genuine (0): {class_counts.get(0, 0)}")
    logger.info(f"  Bot/Fake (1): {class_counts.get(1, 0)}")
    
    # Engineer features
    logger.info("Engineering features...")
    X = engineer_features(df)
    y = df['label'].values
    
    # Remove rows with all zeros (bad data)
    valid_mask = X.sum(axis=1) > 0
    X = X[valid_mask]
    y = y[valid_mask]
    logger.info(f"Samples after filtering: {len(X)}")
    
    # Standardize features
    logger.info("Scaling features with StandardScaler...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train/test split
    logger.info("Splitting data (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )
    logger.info(f"Training samples: {len(X_train)}")
    logger.info(f"Test samples: {len(X_test)}")
    
    # Train models
    rf_model = train_model(X_train, y_train)
    if_model = train_isolation_forest(X_train)
    
    # Evaluate
    logger.info("Evaluating model...")
    metrics, y_pred = evaluate_model(rf_model, X_test, y_test)
    
    # Print results
    print("\n" + "="*60)
    print("MODEL EVALUATION RESULTS")
    print("="*60)
    print(f"Accuracy:  {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.2f}%)")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall:    {metrics['recall']:.4f}")
    print(f"F1 Score:  {metrics['f1_score']:.4f}")
    print("="*60)
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Genuine', 'Bot/Fake']))
    
    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"             Predicted")
    print(f"             Genuine  Bot")
    print(f"Actual Genuine  {cm[0][0]:5d}  {cm[0][1]:5d}")
    print(f"       Bot      {cm[1][0]:5d}  {cm[1][1]:5d}")
    
    # Feature importance
    importance = get_feature_importance(rf_model, FEATURE_COLUMNS)
    print("\nFeature Importances:")
    for i, (feat, imp) in enumerate(importance.items()):
        print(f"  {i+1:2d}. {feat:30s} {imp:.4f}")
    
    # Save models
    logger.info("Saving models...")
    
    joblib.dump(rf_model, OUTPUT_DIR / 'model.pkl')
    joblib.dump(rf_model, OUTPUT_DIR / 'random_forest.joblib')
    joblib.dump(if_model, OUTPUT_DIR / 'isolation_forest.joblib')
    joblib.dump(scaler, OUTPUT_DIR / 'scaler.joblib')
    joblib.dump(FEATURE_COLUMNS, OUTPUT_DIR / 'feature_names.joblib')
    
    # Save metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'dataset': 'Cresci-2017',
        'total_samples': len(X),
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'class_distribution': {str(k): int(v) for k, v in class_counts.items()},
        'metrics': {k: float(v) for k, v in metrics.items()},
        'feature_importance': {k: float(v) for k, v in importance.items()},
        'feature_columns': FEATURE_COLUMNS
    }
    
    with open(OUTPUT_DIR / 'training_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✅ Training complete!")
    print(f"   Models saved to: {OUTPUT_DIR.absolute()}")
    print(f"   - model.pkl")
    print(f"   - random_forest.joblib")
    print(f"   - isolation_forest.joblib")
    print(f"   - scaler.joblib")
    print(f"   - training_metadata.json")


if __name__ == '__main__':
    main()

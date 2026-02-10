"""
Training Pipeline Script
Standalone script for training models with datasets, synthetic data generation, and auto-saving
"""
import os
import sys
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from imblearn.over_sampling import SMOTE

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Feature columns for training
FEATURE_COLUMNS = [
    'actions_per_minute', 'inter_action_time_mean', 'inter_action_time_std',
    'message_similarity_index', 'follow_velocity', 'unfollow_velocity',
    'url_post_ratio', 'device_change_frequency', 'account_age_days',
    'follower_following_ratio', 'profile_completeness_index',
    'profile_image_presence', 'bio_length_score', 'mutual_connection_ratio',
    'clustering_coefficient', 'pagerank_score', 'edge_creation_velocity'
]


def load_dataset(file_path: str) -> pd.DataFrame:
    """Load dataset from CSV or JSON file"""
    logger.info(f"Loading dataset from {file_path}")
    
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.json'):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            if 'accounts' in data:
                df = pd.DataFrame(data['accounts'])
            elif 'data' in data:
                df = pd.DataFrame(data['data'])
            else:
                df = pd.DataFrame([data])
        else:
            raise ValueError("Unsupported JSON structure")
    else:
        raise ValueError("Unsupported file format. Use CSV or JSON.")
    
    logger.info(f"Loaded {len(df)} records")
    return df


def generate_synthetic_bots(n_samples: int = 500) -> pd.DataFrame:
    """
    Generate synthetic bot account data for training balance.
    Creates realistic bot-like behavior patterns.
    """
    logger.info(f"Generating {n_samples} synthetic bot accounts")
    
    np.random.seed(42)
    
    bots = {
        # High activity rate (automated)
        'actions_per_minute': np.random.exponential(50, n_samples) + 20,
        'inter_action_time_mean': np.random.uniform(0.1, 2.0, n_samples),
        'inter_action_time_std': np.random.uniform(0.01, 0.5, n_samples),
        
        # High similarity (templated messages)
        'message_similarity_index': np.random.beta(8, 2, n_samples),
        
        # Aggressive following
        'follow_velocity': np.random.exponential(100, n_samples) + 50,
        'unfollow_velocity': np.random.exponential(50, n_samples) + 20,
        
        # Spam-like URL posting
        'url_post_ratio': np.random.beta(5, 2, n_samples),
        
        # Device changes (VPN/bot farms)
        'device_change_frequency': np.random.exponential(5, n_samples),
        
        # New accounts
        'account_age_days': np.random.exponential(30, n_samples),
        
        # Unbalanced follower ratio
        'follower_following_ratio': np.random.exponential(0.1, n_samples),
        
        # Incomplete profiles
        'profile_completeness_index': np.random.beta(2, 5, n_samples),
        'profile_image_presence': np.random.choice([0, 1], n_samples, p=[0.4, 0.6]),
        'bio_length_score': np.random.beta(2, 5, n_samples),
        
        # Low network quality
        'mutual_connection_ratio': np.random.beta(1, 5, n_samples),
        'clustering_coefficient': np.random.beta(1, 5, n_samples),
        'pagerank_score': np.random.exponential(0.0001, n_samples),
        'edge_creation_velocity': np.random.exponential(50, n_samples) + 20,
        
        # Label: Fake
        'label': [1] * n_samples
    }
    
    return pd.DataFrame(bots)


def generate_synthetic_humans(n_samples: int = 500) -> pd.DataFrame:
    """
    Generate synthetic human account data for training balance.
    Creates realistic human behavior patterns.
    """
    logger.info(f"Generating {n_samples} synthetic human accounts")
    
    np.random.seed(43)
    
    humans = {
        # Moderate activity
        'actions_per_minute': np.random.lognormal(1, 0.5, n_samples),
        'inter_action_time_mean': np.random.uniform(5, 60, n_samples),
        'inter_action_time_std': np.random.uniform(2, 30, n_samples),
        
        # Low similarity (unique messages)
        'message_similarity_index': np.random.beta(2, 8, n_samples),
        
        # Moderate following
        'follow_velocity': np.random.lognormal(1.5, 0.8, n_samples),
        'unfollow_velocity': np.random.lognormal(0.5, 0.5, n_samples),
        
        # Low URL posting
        'url_post_ratio': np.random.beta(2, 8, n_samples),
        
        # Stable device
        'device_change_frequency': np.random.poisson(0.5, n_samples),
        
        # Established accounts
        'account_age_days': np.random.lognormal(6, 1, n_samples),
        
        # Balanced followers
        'follower_following_ratio': np.random.lognormal(0, 0.5, n_samples),
        
        # Complete profiles
        'profile_completeness_index': np.random.beta(8, 2, n_samples),
        'profile_image_presence': np.random.choice([0, 1], n_samples, p=[0.05, 0.95]),
        'bio_length_score': np.random.beta(5, 2, n_samples),
        
        # Good network quality
        'mutual_connection_ratio': np.random.beta(5, 2, n_samples),
        'clustering_coefficient': np.random.beta(5, 3, n_samples),
        'pagerank_score': np.random.exponential(0.001, n_samples),
        'edge_creation_velocity': np.random.lognormal(1, 0.5, n_samples),
        
        # Label: Real
        'label': [0] * n_samples
    }
    
    return pd.DataFrame(humans)


def preprocess_data(df: pd.DataFrame, label_column: str = 'label') -> tuple:
    """Preprocess training data with feature engineering"""
    
    # Ensure all feature columns exist
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
    
    X = df[FEATURE_COLUMNS].copy()
    
    # Handle labels
    if label_column in df.columns:
        y = df[label_column].copy()
        # Convert string labels
        if y.dtype == object:
            label_map = {'real': 0, 'fake': 1, 'suspicious': 1, 'bot': 1, 'human': 0}
            y = y.str.lower().map(label_map).fillna(1).astype(int)
    else:
        # Generate heuristic labels if not present
        logger.warning(f"Label column '{label_column}' not found, generating heuristic labels")
        y = generate_heuristic_labels(X)
    
    # Normalize features
    X['actions_per_minute'] = np.clip(X['actions_per_minute'] / 100.0, 0, 1)
    X['follow_velocity'] = np.clip(X['follow_velocity'] / 500.0, 0, 1)
    X['unfollow_velocity'] = np.clip(X['unfollow_velocity'] / 500.0, 0, 1)
    X['account_age_days'] = np.clip(X['account_age_days'] / 3650.0, 0, 1)
    X['edge_creation_velocity'] = np.clip(X['edge_creation_velocity'] / 100.0, 0, 1)
    X['pagerank_score'] = np.clip(X['pagerank_score'] * 1000, 0, 1)
    
    X = X.fillna(0)
    
    return X, y


def generate_heuristic_labels(X: pd.DataFrame) -> pd.Series:
    """Generate labels based on behavioral heuristics"""
    scores = np.zeros(len(X))
    
    # High action rate
    scores += (X['actions_per_minute'] > 0.3).astype(float) * 0.2
    
    # High message similarity
    scores += (X['message_similarity_index'] > 0.7).astype(float) * 0.25
    
    # Low profile completeness
    scores += (X['profile_completeness_index'] < 0.3).astype(float) * 0.15
    
    # Low mutual connections
    scores += (X['mutual_connection_ratio'] < 0.2).astype(float) * 0.15
    
    # High follow velocity
    scores += (X['follow_velocity'] > 0.3).astype(float) * 0.15
    
    # High URL ratio
    scores += (X['url_post_ratio'] > 0.5).astype(float) * 0.1
    
    return (scores >= 0.4).astype(int)


def train_models(X_train, y_train, use_smote: bool = True) -> dict:
    """Train ensemble of models"""
    models = {}
    
    # Apply SMOTE for class imbalance
    if use_smote:
        try:
            class_counts = np.bincount(y_train)
            if len(class_counts) > 1 and min(class_counts) / max(class_counts) < 0.5:
                logger.info("Applying SMOTE for class balance")
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
                logger.info(f"After SMOTE: {len(X_train)} samples")
        except Exception as e:
            logger.warning(f"SMOTE failed: {e}")
    
    # Feature scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    models['scaler'] = scaler
    
    # Random Forest with hyperparameter tuning
    logger.info("Training RandomForest...")
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_scaled, y_train)
    models['random_forest'] = rf
    
    # Gradient Boosting
    logger.info("Training GradientBoosting...")
    gb = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    gb.fit(X_train_scaled, y_train)
    models['gradient_boosting'] = gb
    
    # Isolation Forest for anomaly detection
    logger.info("Training IsolationForest...")
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
        n_jobs=-1
    )
    iso.fit(X_train_scaled)
    models['isolation_forest'] = iso
    
    return models


def evaluate_models(models: dict, X_test, y_test) -> dict:
    """Evaluate trained models"""
    scaler = models['scaler']
    X_test_scaled = scaler.transform(X_test)
    
    metrics = {}
    
    for name in ['random_forest', 'gradient_boosting']:
        if name in models:
            y_pred = models[name].predict(X_test_scaled)
            metrics[name] = {
                'accuracy': round(accuracy_score(y_test, y_pred), 4),
                'precision': round(precision_score(y_test, y_pred, zero_division=0), 4),
                'recall': round(recall_score(y_test, y_pred, zero_division=0), 4),
                'f1_score': round(f1_score(y_test, y_pred, zero_division=0), 4)
            }
            logger.info(f"{name}: {metrics[name]}")
    
    return metrics


def save_models(models: dict, output_dir: str, version: str):
    """Save trained models to disk"""
    os.makedirs(output_dir, exist_ok=True)
    
    for name, model in models.items():
        # Save versioned
        path = os.path.join(output_dir, f"{name}_{version}.joblib")
        joblib.dump(model, path)
        
        # Save as default (overwrite)
        default_path = os.path.join(output_dir, f"{name}.joblib")
        joblib.dump(model, default_path)
        
        logger.info(f"Saved {name} to {path}")
    
    # Save feature names
    joblib.dump(FEATURE_COLUMNS, os.path.join(output_dir, "feature_names.joblib"))
    
    logger.info(f"All models saved to {output_dir}")


def main():
    parser = argparse.ArgumentParser(description='Train fraud detection models')
    parser.add_argument('--data', type=str, help='Path to training data (CSV/JSON)')
    parser.add_argument('--output', type=str, default='models', help='Output directory for models')
    parser.add_argument('--synthetic', type=int, default=0, help='Number of synthetic samples per class')
    parser.add_argument('--test-size', type=float, default=0.2, help='Test set proportion')
    parser.add_argument('--no-smote', action='store_true', help='Disable SMOTE')
    parser.add_argument('--label', type=str, default='label', help='Label column name')
    args = parser.parse_args()
    
    version = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger.info(f"Training pipeline started - Version: {version}")
    
    # Load or generate data
    dfs = []
    
    if args.data:
        df = load_dataset(args.data)
        dfs.append(df)
    
    if args.synthetic > 0:
        # Generate synthetic balanced data
        dfs.append(generate_synthetic_bots(args.synthetic))
        dfs.append(generate_synthetic_humans(args.synthetic))
    
    if not dfs:
        logger.info("No data provided, generating synthetic dataset")
        dfs.append(generate_synthetic_bots(500))
        dfs.append(generate_synthetic_humans(500))
    
    # Combine datasets
    df = pd.concat(dfs, ignore_index=True)
    logger.info(f"Total training samples: {len(df)}")
    
    # Preprocess
    X, y = preprocess_data(df, args.label)
    
    # Class distribution
    class_dist = pd.Series(y).value_counts()
    logger.info(f"Class distribution: {class_dist.to_dict()}")
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=y
    )
    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")
    
    # Train
    models = train_models(X_train.values, y_train.values, use_smote=not args.no_smote)
    
    # Evaluate
    metrics = evaluate_models(models, X_test.values, y_test.values)
    
    # Find best model
    best_model = max(metrics.items(), key=lambda x: x[1]['f1_score'])
    logger.info(f"Best model: {best_model[0]} (F1: {best_model[1]['f1_score']})")
    
    # Save models
    save_models(models, args.output, version)
    
    logger.info("Training pipeline completed successfully!")
    
    return metrics


if __name__ == '__main__':
    main()

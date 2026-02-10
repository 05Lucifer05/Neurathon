#!/usr/bin/env python3
"""
Fraud Detection Model Training Pipeline

This script trains the RandomForest classifier using labeled datasets from the data/ directory.
Supports Cresci-2017, TwiBot-22, and non-automated user datasets.

Usage:
    python train_pipeline.py [--data-dir DATA_DIR] [--output OUTPUT_DIR]

Dataset Structure Expected:
    data/
    ├── cresci-2017/           # Cresci-2017 dataset folder
    │   ├── *.csv or *.json
    ├── twibot-22/             # TwiBot-22 dataset folder
    │   ├── *.csv or *.json
    ├── nonautomated/          # Non-automated accounts
    │   ├── *.csv or *.json
    └── *.csv or *.json        # Any additional labeled datasets
"""

import os
import sys
import json
import logging
import argparse
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
        logging.FileHandler('training.log')
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# FEATURE SCHEMA - Must match the system's expected features
# =============================================================================

FEATURE_COLUMNS = [
    # Behavioral features
    'actions_per_minute',
    'inter_action_time_mean',
    'inter_action_time_std',
    'message_similarity_index',
    'follow_velocity',
    'unfollow_velocity',
    'url_post_ratio',
    'device_change_frequency',
    'session_duration_mean',
    'click_sequence_entropy',
    
    # Profile features
    'account_age_days',
    'follower_following_ratio',
    'profile_completeness_index',
    'profile_image_presence',
    'bio_length_score',
    
    # Network features
    'mutual_connection_ratio',
    'clustering_coefficient',
    'pagerank_score',
    'edge_creation_velocity',
]

# =============================================================================
# DATASET LOADERS - Handle different dataset formats
# =============================================================================

def load_csv_file(filepath: Path) -> pd.DataFrame:
    """Load a CSV file with error handling."""
    try:
        df = pd.read_csv(filepath, low_memory=False)
        logger.info(f"Loaded CSV: {filepath.name} ({len(df)} rows)")
        return df
    except Exception as e:
        logger.warning(f"Failed to load {filepath}: {e}")
        return pd.DataFrame()


def load_json_file(filepath: Path) -> pd.DataFrame:
    """Load a JSON file (array or object with data key)."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # Try common keys
            for key in ['accounts', 'data', 'users', 'results']:
                if key in data and isinstance(data[key], list):
                    df = pd.DataFrame(data[key])
                    break
            else:
                df = pd.DataFrame([data])
        else:
            df = pd.DataFrame()
        
        logger.info(f"Loaded JSON: {filepath.name} ({len(df)} rows)")
        return df
    except Exception as e:
        logger.warning(f"Failed to load {filepath}: {e}")
        return pd.DataFrame()


def load_cresci_2017(data_dir: Path) -> pd.DataFrame:
    """
    Load Cresci-2017 dataset.
    Maps Cresci-2017 features to system schema.
    """
    cresci_dir = data_dir / 'cresci-2017'
    if not cresci_dir.exists():
        cresci_dir = data_dir / 'cresci2017'
    if not cresci_dir.exists():
        logger.warning("Cresci-2017 directory not found")
        return pd.DataFrame()
    
    all_data = []
    for file in cresci_dir.glob('*.csv'):
        df = load_csv_file(file)
        if not df.empty:
            all_data.append(df)
    
    for file in cresci_dir.glob('*.json'):
        df = load_json_file(file)
        if not df.empty:
            all_data.append(df)
    
    if not all_data:
        return pd.DataFrame()
    
    combined = pd.concat(all_data, ignore_index=True)
    logger.info(f"Cresci-2017: {len(combined)} total samples")
    return combined


def load_twibot_22(data_dir: Path) -> pd.DataFrame:
    """
    Load TwiBot-22 dataset.
    Maps TwiBot-22 features to system schema.
    """
    twibot_dir = data_dir / 'twibot-22'
    if not twibot_dir.exists():
        twibot_dir = data_dir / 'twibot22'
    if not twibot_dir.exists():
        logger.warning("TwiBot-22 directory not found")
        return pd.DataFrame()
    
    all_data = []
    for file in twibot_dir.glob('*.csv'):
        df = load_csv_file(file)
        if not df.empty:
            all_data.append(df)
    
    for file in twibot_dir.glob('*.json'):
        df = load_json_file(file)
        if not df.empty:
            all_data.append(df)
    
    if not all_data:
        return pd.DataFrame()
    
    combined = pd.concat(all_data, ignore_index=True)
    logger.info(f"TwiBot-22: {len(combined)} total samples")
    return combined


def load_nonautomated(data_dir: Path) -> pd.DataFrame:
    """
    Load non-automated (real user) accounts dataset.
    """
    nonaut_dir = data_dir / 'nonautomated'
    if not nonaut_dir.exists():
        nonaut_dir = data_dir / 'non-automated'
    if not nonaut_dir.exists():
        # Check for direct files
        patterns = ['*nonautomated*.json', '*nonautomated*.csv', 
                    '*real*.json', '*real*.csv', '*human*.json', '*human*.csv']
        all_data = []
        for pattern in patterns:
            for file in data_dir.glob(pattern):
                if file.suffix == '.csv':
                    df = load_csv_file(file)
                else:
                    df = load_json_file(file)
                if not df.empty:
                    all_data.append(df)
        if all_data:
            combined = pd.concat(all_data, ignore_index=True)
            logger.info(f"Non-automated: {len(combined)} total samples")
            return combined
        return pd.DataFrame()
    
    all_data = []
    for file in nonaut_dir.glob('*.csv'):
        df = load_csv_file(file)
        if not df.empty:
            all_data.append(df)
    
    for file in nonaut_dir.glob('*.json'):
        df = load_json_file(file)
        if not df.empty:
            all_data.append(df)
    
    if not all_data:
        return pd.DataFrame()
    
    combined = pd.concat(all_data, ignore_index=True)
    logger.info(f"Non-automated: {len(combined)} total samples")
    return combined


def load_additional_datasets(data_dir: Path) -> pd.DataFrame:
    """Load any additional CSV/JSON files in the root data directory."""
    all_data = []
    
    for file in data_dir.glob('*.csv'):
        df = load_csv_file(file)
        if not df.empty:
            all_data.append(df)
    
    for file in data_dir.glob('*.json'):
        df = load_json_file(file)
        if not df.empty:
            all_data.append(df)
    
    if not all_data:
        return pd.DataFrame()
    
    combined = pd.concat(all_data, ignore_index=True)
    logger.info(f"Additional datasets: {len(combined)} total samples")
    return combined


# =============================================================================
# FEATURE MAPPING - Map different dataset schemas to system features
# =============================================================================

FEATURE_MAPPINGS = {
    # Behavioral features
    'actions_per_minute': [
        'actions_per_minute', 'tweet_freq', 'statuses_per_day', 
        'tweets_per_day', 'activity_rate'
    ],
    'inter_action_time_mean': [
        'inter_action_time_mean', 'avg_time_between_tweets',
        'mean_tweet_interval', 'inter_tweet_time'
    ],
    'inter_action_time_std': [
        'inter_action_time_std', 'std_time_between_tweets',
        'tweet_interval_variance'
    ],
    'message_similarity_index': [
        'message_similarity_index', 'tweet_similarity', 
        'content_similarity', 'duplicate_ratio'
    ],
    'follow_velocity': [
        'follow_velocity', 'following_rate', 'follow_rate',
        'friends_growth_rate'
    ],
    'unfollow_velocity': [
        'unfollow_velocity', 'unfollow_rate'
    ],
    'url_post_ratio': [
        'url_post_ratio', 'url_ratio', 'links_ratio',
        'tweets_with_urls_ratio'
    ],
    'device_change_frequency': [
        'device_change_frequency', 'source_diversity',
        'client_diversity'
    ],
    'session_duration_mean': [
        'session_duration_mean', 'avg_session_length',
        'mean_session_duration'
    ],
    'click_sequence_entropy': [
        'click_sequence_entropy', 'action_entropy',
        'behavior_entropy'
    ],
    
    # Profile features
    'account_age_days': [
        'account_age_days', 'account_age', 'age_days',
        'days_since_creation', 'created_days_ago'
    ],
    'follower_following_ratio': [
        'follower_following_ratio', 'ff_ratio', 'followers_friends_ratio',
        'follower_friend_ratio'
    ],
    'profile_completeness_index': [
        'profile_completeness_index', 'profile_completeness',
        'profile_score'
    ],
    'profile_image_presence': [
        'profile_image_presence', 'has_profile_image',
        'default_profile_image', 'has_avatar'
    ],
    'bio_length_score': [
        'bio_length_score', 'description_length', 'bio_length',
        'description_score'
    ],
    
    # Network features
    'mutual_connection_ratio': [
        'mutual_connection_ratio', 'mutual_friends_ratio',
        'reciprocity_ratio'
    ],
    'clustering_coefficient': [
        'clustering_coefficient', 'local_clustering',
        'network_clustering'
    ],
    'pagerank_score': [
        'pagerank_score', 'pagerank', 'influence_score'
    ],
    'edge_creation_velocity': [
        'edge_creation_velocity', 'connection_rate',
        'network_growth_rate'
    ],
}

# Label column mappings
LABEL_MAPPINGS = ['label', 'is_bot', 'bot', 'class', 'target', 'is_fake', 'fake']


def find_column(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    """Find the first matching column from candidates."""
    for col in candidates:
        if col in df.columns:
            return col
        # Case-insensitive match
        for df_col in df.columns:
            if df_col.lower() == col.lower():
                return df_col
    return None


def map_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Map dataset columns to the system's feature schema.
    Handles nested JSON structures if present.
    """
    result = pd.DataFrame(index=df.index)
    
    # Flatten nested structures if present (e.g., behavioral.actions_per_minute)
    if 'behavioral' in df.columns and isinstance(df['behavioral'].iloc[0], dict):
        behavioral_df = pd.json_normalize(df['behavioral'])
        behavioral_df.columns = [f'behavioral_{c}' for c in behavioral_df.columns]
        df = pd.concat([df.drop('behavioral', axis=1), behavioral_df], axis=1)
    
    if 'profile' in df.columns and isinstance(df['profile'].iloc[0], dict):
        profile_df = pd.json_normalize(df['profile'])
        profile_df.columns = [f'profile_{c}' for c in profile_df.columns]
        df = pd.concat([df.drop('profile', axis=1), profile_df], axis=1)
    
    if 'network' in df.columns and isinstance(df['network'].iloc[0], dict):
        network_df = pd.json_normalize(df['network'])
        network_df.columns = [f'network_{c}' for c in network_df.columns]
        df = pd.concat([df.drop('network', axis=1), network_df], axis=1)
    
    # Map each feature
    for feature, candidates in FEATURE_MAPPINGS.items():
        # Also check prefixed versions
        all_candidates = candidates + [
            f'behavioral_{c}' for c in candidates
        ] + [
            f'profile_{c}' for c in candidates
        ] + [
            f'network_{c}' for c in candidates
        ]
        
        col = find_column(df, all_candidates)
        if col:
            result[feature] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        else:
            result[feature] = 0.0
    
    # Map label
    label_col = find_column(df, LABEL_MAPPINGS)
    if label_col:
        labels = df[label_col].copy()
        # Convert to binary: 1 = bot/fake, 0 = human/real
        if labels.dtype == object:
            label_map = {
                'bot': 1, 'fake': 1, 'suspicious': 1, 'automated': 1,
                'human': 0, 'real': 0, 'genuine': 0, 'legitimate': 0,
                'true': 1, 'false': 0, '1': 1, '0': 0
            }
            result['label'] = labels.str.lower().map(label_map).fillna(1).astype(int)
        else:
            result['label'] = labels.fillna(1).astype(int)
    else:
        logger.warning("No label column found - assuming all samples are unlabeled")
        result['label'] = -1  # Mark as unlabeled
    
    return result


def compute_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute derived features from raw data if columns are available."""
    # Compute follower_following_ratio if raw counts are available
    if 'followers_count' in df.columns and 'friends_count' in df.columns:
        friends = df['friends_count'].fillna(1).replace(0, 1)
        df['follower_following_ratio'] = df['followers_count'].fillna(0) / friends
    
    # Compute account age if created_at is available
    if 'created_at' in df.columns:
        try:
            created = pd.to_datetime(df['created_at'], errors='coerce')
            df['account_age_days'] = (datetime.now() - created).dt.days.fillna(0)
        except:
            pass
    
    # Compute url_post_ratio
    if 'statuses_count' in df.columns and 'url_count' in df.columns:
        statuses = df['statuses_count'].fillna(1).replace(0, 1)
        df['url_post_ratio'] = df['url_count'].fillna(0) / statuses
    
    # Profile completeness
    if 'profile_image_url' in df.columns:
        df['profile_image_presence'] = (~df['profile_image_url'].isna()).astype(int)
    if 'default_profile_image' in df.columns:
        df['profile_image_presence'] = (df['default_profile_image'] == False).astype(int)
    
    # Bio length score
    if 'description' in df.columns:
        df['bio_length_score'] = df['description'].fillna('').str.len().clip(0, 160) / 160
    
    return df


# =============================================================================
# PREPROCESSING
# =============================================================================

def preprocess_features(X: pd.DataFrame, scaler: StandardScaler = None) -> Tuple[np.ndarray, StandardScaler]:
    """
    Normalize features using StandardScaler.
    Returns scaled features and the fitted scaler.
    """
    # Fill NaN values
    X = X.fillna(0)
    
    # Clip extreme values
    X = X.clip(lower=-1e6, upper=1e6)
    
    # Handle infinite values
    X = X.replace([np.inf, -np.inf], 0)
    
    if scaler is None:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = scaler.transform(X)
    
    return X_scaled, scaler


# =============================================================================
# TRAINING
# =============================================================================

def train_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    class_weights: str = 'balanced'
) -> RandomForestClassifier:
    """
    Train RandomForest classifier with class weights for imbalance handling.
    """
    logger.info("Training RandomForest classifier...")
    
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight=class_weights,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    
    model.fit(X_train, y_train)
    logger.info("Training complete")
    
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


def evaluate_model(
    model: RandomForestClassifier,
    X_test: np.ndarray,
    y_test: np.ndarray
) -> Dict:
    """Evaluate model and return metrics."""
    y_pred = model.predict(X_test)
    
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, zero_division=0),
        'recall': recall_score(y_test, y_pred, zero_division=0),
        'f1_score': f1_score(y_test, y_pred, zero_division=0),
    }
    
    # Cross-validation score
    try:
        cv_scores = cross_val_score(model, X_test, y_test, cv=min(5, len(y_test) // 2))
        metrics['cv_mean'] = cv_scores.mean()
        metrics['cv_std'] = cv_scores.std()
    except:
        pass
    
    return metrics, y_pred


def get_feature_importance(model: RandomForestClassifier, feature_names: List[str]) -> Dict[str, float]:
    """Extract and sort feature importances."""
    importances = model.feature_importances_
    importance_dict = {
        name: float(imp) for name, imp in zip(feature_names, importances)
    }
    return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(data_dir: str, output_dir: str, test_size: float = 0.2):
    """
    Run the complete training pipeline.
    """
    data_path = Path(data_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Loading datasets from: {data_path}")
    
    # Load all datasets
    datasets = []
    
    cresci = load_cresci_2017(data_path)
    if not cresci.empty:
        cresci = compute_derived_features(cresci)
        datasets.append(cresci)
    
    twibot = load_twibot_22(data_path)
    if not twibot.empty:
        twibot = compute_derived_features(twibot)
        datasets.append(twibot)
    
    nonaut = load_nonautomated(data_path)
    if not nonaut.empty:
        nonaut = compute_derived_features(nonaut)
        # Mark non-automated as real (label=0)
        if 'label' not in nonaut.columns:
            nonaut['label'] = 0
        datasets.append(nonaut)
    
    additional = load_additional_datasets(data_path)
    if not additional.empty:
        additional = compute_derived_features(additional)
        datasets.append(additional)
    
    if not datasets:
        logger.error("No datasets found! Please place CSV/JSON files in the data/ directory.")
        sys.exit(1)
    
    # Combine all datasets
    logger.info("Combining datasets...")
    combined = pd.concat(datasets, ignore_index=True)
    logger.info(f"Total samples before mapping: {len(combined)}")
    
    # Map features to system schema
    logger.info("Mapping features to system schema...")
    mapped = map_features(combined)
    
    # Remove unlabeled samples
    labeled = mapped[mapped['label'] >= 0]
    if len(labeled) == 0:
        logger.error("No labeled samples found!")
        sys.exit(1)
    
    logger.info(f"Labeled samples: {len(labeled)}")
    
    # Prepare features and labels
    X = labeled[FEATURE_COLUMNS]
    y = labeled['label'].values
    
    # Check class distribution
    class_counts = pd.Series(y).value_counts()
    logger.info(f"Class distribution: {dict(class_counts)}")
    
    # Preprocess features
    logger.info("Preprocessing features...")
    X_scaled, scaler = preprocess_features(X)
    
    # Split data
    logger.info(f"Splitting data (test_size={test_size})...")
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=test_size, random_state=42, stratify=y
    )
    
    logger.info(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Train RandomForest
    rf_model = train_model(X_train, y_train)
    
    # Train Isolation Forest
    if_model = train_isolation_forest(X_train)
    
    # Evaluate
    logger.info("Evaluating model...")
    metrics, y_pred = evaluate_model(rf_model, X_test, y_test)
    
    # Print metrics
    print("\n" + "="*50)
    print("MODEL EVALUATION RESULTS")
    print("="*50)
    print(f"Accuracy:  {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall:    {metrics['recall']:.4f}")
    print(f"F1 Score:  {metrics['f1_score']:.4f}")
    if 'cv_mean' in metrics:
        print(f"CV Mean:   {metrics['cv_mean']:.4f} (+/- {metrics['cv_std']:.4f})")
    print("="*50)
    
    # Classification report
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Real', 'Fake']))
    
    # Confusion matrix
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Feature importance
    importance = get_feature_importance(rf_model, FEATURE_COLUMNS)
    print("\nTop 10 Feature Importances:")
    for i, (feat, imp) in enumerate(list(importance.items())[:10]):
        print(f"  {i+1}. {feat}: {imp:.4f}")
    
    # Save models
    logger.info("Saving models...")
    
    # Save RandomForest as model.pkl (main model)
    model_path = output_path / 'model.pkl'
    joblib.dump(rf_model, model_path)
    logger.info(f"Saved: {model_path}")
    
    # Also save with specific name
    rf_path = output_path / 'random_forest.joblib'
    joblib.dump(rf_model, rf_path)
    logger.info(f"Saved: {rf_path}")
    
    # Save Isolation Forest
    if_path = output_path / 'isolation_forest.joblib'
    joblib.dump(if_model, if_path)
    logger.info(f"Saved: {if_path}")
    
    # Save scaler
    scaler_path = output_path / 'scaler.joblib'
    joblib.dump(scaler, scaler_path)
    logger.info(f"Saved: {scaler_path}")
    
    # Save feature names
    features_path = output_path / 'feature_names.joblib'
    joblib.dump(FEATURE_COLUMNS, features_path)
    logger.info(f"Saved: {features_path}")
    
    # Save training metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'total_samples': len(labeled),
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'class_distribution': {str(k): int(v) for k, v in class_counts.items()},
        'metrics': metrics,
        'feature_importance': importance,
        'feature_columns': FEATURE_COLUMNS
    }
    
    metadata_path = output_path / 'training_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2, default=str)
    logger.info(f"Saved: {metadata_path}")
    
    print(f"\n✅ Training complete! Models saved to: {output_path}")
    print(f"   - model.pkl (main RandomForest model)")
    print(f"   - isolation_forest.joblib")
    print(f"   - scaler.joblib")
    print(f"   - training_metadata.json")
    
    return metrics


def main():
    parser = argparse.ArgumentParser(
        description='Train fraud detection model from labeled datasets'
    )
    parser.add_argument(
        '--data-dir', '-d',
        default='./data',
        help='Directory containing training datasets (default: ./data)'
    )
    parser.add_argument(
        '--output', '-o',
        default='./models',
        help='Output directory for trained models (default: ./models)'
    )
    parser.add_argument(
        '--test-size', '-t',
        type=float,
        default=0.2,
        help='Fraction of data for testing (default: 0.2)'
    )
    
    args = parser.parse_args()
    
    run_pipeline(args.data_dir, args.output, args.test_size)


if __name__ == '__main__':
    main()

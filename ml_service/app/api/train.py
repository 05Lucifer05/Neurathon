"""
Training API Routes
Model training with CSV/JSON datasets, class imbalance handling, and metrics evaluation
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
import logging
import time
import json
import os
from datetime import datetime
from io import StringIO
import joblib

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from imblearn.over_sampling import SMOTE

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Training"])


class TrainRequest(BaseModel):
    """Training request with inline data"""
    data: List[Dict[str, Any]]
    label_column: str = "label"
    test_size: float = Field(default=0.2, ge=0.1, le=0.4)
    use_smote: bool = True
    model_type: str = Field(default="ensemble", pattern="^(random_forest|gradient_boosting|ensemble)$")
    save_model: bool = True
    model_version: Optional[str] = None


class TrainResponse(BaseModel):
    """Training response with metrics"""
    success: bool
    model_type: str
    model_version: str
    samples_trained: int
    samples_tested: int
    class_distribution: Dict[str, int]
    metrics: Dict[str, float]
    feature_importance: Dict[str, float]
    training_time_seconds: float
    model_path: Optional[str] = None


class TrainingStatus(BaseModel):
    """Background training status"""
    job_id: str
    status: str  # pending, training, completed, failed
    progress: float = 0.0
    message: str = ""


# In-memory training job status
training_jobs: Dict[str, TrainingStatus] = {}


FEATURE_COLUMNS = [
    'actions_per_minute', 'inter_action_time_mean', 'inter_action_time_std',
    'message_similarity_index', 'follow_velocity', 'unfollow_velocity',
    'url_post_ratio', 'device_change_frequency', 'account_age_days',
    'follower_following_ratio', 'profile_completeness_index',
    'profile_image_presence', 'bio_length_score', 'mutual_connection_ratio',
    'clustering_coefficient', 'pagerank_score', 'edge_creation_velocity'
]


def preprocess_training_data(df: pd.DataFrame, label_column: str) -> tuple:
    """
    Preprocess training data with feature engineering and scaling.
    """
    # Ensure all feature columns exist
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
    
    # Extract features
    X = df[FEATURE_COLUMNS].copy()
    
    # Handle labels
    if label_column not in df.columns:
        raise ValueError(f"Label column '{label_column}' not found in data")
    
    y = df[label_column].copy()
    
    # Convert string labels to numeric if needed
    if y.dtype == object:
        label_map = {'real': 0, 'fake': 1, 'suspicious': 1, 'bot': 1, 'human': 0}
        y = y.str.lower().map(label_map).fillna(1).astype(int)
    
    # Fill missing values
    X = X.fillna(0)
    
    # Normalize features
    X['actions_per_minute'] = np.clip(X['actions_per_minute'] / 100.0, 0, 1)
    X['follow_velocity'] = np.clip(X['follow_velocity'] / 500.0, 0, 1)
    X['unfollow_velocity'] = np.clip(X['unfollow_velocity'] / 500.0, 0, 1)
    X['account_age_days'] = np.clip(X['account_age_days'] / 3650.0, 0, 1)
    X['edge_creation_velocity'] = np.clip(X['edge_creation_velocity'] / 100.0, 0, 1)
    X['pagerank_score'] = np.clip(X['pagerank_score'] * 1000, 0, 1)
    
    return X, y


def train_models(X_train, y_train, model_type: str, use_smote: bool) -> dict:
    """
    Train ML models with optional SMOTE for class imbalance.
    """
    models = {}
    
    # Apply SMOTE if enabled and classes are imbalanced
    if use_smote:
        try:
            class_counts = np.bincount(y_train)
            if len(class_counts) > 1 and min(class_counts) / max(class_counts) < 0.5:
                logger.info("Applying SMOTE for class imbalance")
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
        except Exception as e:
            logger.warning(f"SMOTE failed, continuing without: {e}")
    
    # Feature scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    
    if model_type in ['random_forest', 'ensemble']:
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
    
    if model_type in ['gradient_boosting', 'ensemble']:
        logger.info("Training GradientBoosting...")
        gb = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        gb.fit(X_train_scaled, y_train)
        models['gradient_boosting'] = gb
    
    # Always train IsolationForest for anomaly detection
    logger.info("Training IsolationForest...")
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
        n_jobs=-1
    )
    iso.fit(X_train_scaled)
    models['isolation_forest'] = iso
    
    models['scaler'] = scaler
    
    return models


def evaluate_models(models: dict, X_test, y_test) -> Dict[str, float]:
    """
    Evaluate trained models and return metrics.
    """
    scaler = models.get('scaler')
    X_test_scaled = scaler.transform(X_test) if scaler else X_test
    
    # Get predictions from primary classifier
    if 'random_forest' in models:
        y_pred = models['random_forest'].predict(X_test_scaled)
    elif 'gradient_boosting' in models:
        y_pred = models['gradient_boosting'].predict(X_test_scaled)
    else:
        y_pred = np.zeros(len(y_test))
    
    metrics = {
        'accuracy': round(accuracy_score(y_test, y_pred), 4),
        'precision': round(precision_score(y_test, y_pred, zero_division=0), 4),
        'recall': round(recall_score(y_test, y_pred, zero_division=0), 4),
        'f1_score': round(f1_score(y_test, y_pred, zero_division=0), 4)
    }
    
    # Cross-validation score if RF available
    if 'random_forest' in models:
        try:
            cv_scores = cross_val_score(models['random_forest'], X_test_scaled, y_test, cv=3)
            metrics['cv_score_mean'] = round(float(np.mean(cv_scores)), 4)
            metrics['cv_score_std'] = round(float(np.std(cv_scores)), 4)
        except Exception as e:
            logger.warning(f"Cross-validation failed: {e}")
    
    return metrics


def get_feature_importance(models: dict) -> Dict[str, float]:
    """Extract feature importance from trained models"""
    importance = {}
    
    if 'random_forest' in models:
        rf_importance = models['random_forest'].feature_importances_
        for i, col in enumerate(FEATURE_COLUMNS):
            importance[col] = round(float(rf_importance[i]), 4)
    elif 'gradient_boosting' in models:
        gb_importance = models['gradient_boosting'].feature_importances_
        for i, col in enumerate(FEATURE_COLUMNS):
            importance[col] = round(float(gb_importance[i]), 4)
    
    # Sort by importance
    importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
    
    return importance


def save_trained_models(models: dict, version: str) -> str:
    """Save trained models to disk"""
    model_dir = settings.model_path
    os.makedirs(model_dir, exist_ok=True)
    
    # Save with version suffix
    if 'random_forest' in models:
        path = os.path.join(model_dir, f"random_forest_{version}.joblib")
        joblib.dump(models['random_forest'], path)
        # Also save as default
        joblib.dump(models['random_forest'], os.path.join(model_dir, "random_forest.joblib"))
    
    if 'gradient_boosting' in models:
        path = os.path.join(model_dir, f"gradient_boosting_{version}.joblib")
        joblib.dump(models['gradient_boosting'], path)
    
    if 'isolation_forest' in models:
        path = os.path.join(model_dir, f"isolation_forest_{version}.joblib")
        joblib.dump(models['isolation_forest'], path)
        # Also save as default
        joblib.dump(models['isolation_forest'], os.path.join(model_dir, "isolation_forest.joblib"))
    
    if 'scaler' in models:
        path = os.path.join(model_dir, f"scaler_{version}.joblib")
        joblib.dump(models['scaler'], path)
    
    # Save feature names
    joblib.dump(FEATURE_COLUMNS, os.path.join(model_dir, "feature_names.joblib"))
    
    return model_dir


@router.post(
    "/train",
    response_model=TrainResponse,
    summary="Train ML Models",
    description="Train fraud detection models with provided dataset"
)
async def train_model(request: TrainRequest):
    """
    Train ML models with provided dataset.
    
    Supports:
    - Class imbalance handling (SMOTE)
    - Feature scaling
    - Metrics evaluation (accuracy, precision, recall, F1)
    - Model versioning and saving
    """
    start_time = time.time()
    
    if len(request.data) < 10:
        raise HTTPException(status_code=400, detail="At least 10 samples required for training")
    
    logger.info(f"Starting training with {len(request.data)} samples")
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(request.data)
        
        # Preprocess
        X, y = preprocess_training_data(df, request.label_column)
        
        # Check class distribution
        class_dist = y.value_counts().to_dict()
        logger.info(f"Class distribution: {class_dist}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=request.test_size, random_state=42, stratify=y
        )
        
        # Train models
        models = train_models(X_train.values, y_train.values, request.model_type, request.use_smote)
        
        # Evaluate
        metrics = evaluate_models(models, X_test.values, y_test.values)
        
        # Feature importance
        feature_importance = get_feature_importance(models)
        
        # Generate version
        version = request.model_version or datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save models
        model_path = None
        if request.save_model:
            model_path = save_trained_models(models, version)
            logger.info(f"Models saved to {model_path}")
        
        training_time = time.time() - start_time
        
        return TrainResponse(
            success=True,
            model_type=request.model_type,
            model_version=version,
            samples_trained=len(X_train),
            samples_tested=len(X_test),
            class_distribution={str(k): int(v) for k, v in class_dist.items()},
            metrics=metrics,
            feature_importance=feature_importance,
            training_time_seconds=round(training_time, 2),
            model_path=model_path
        )
        
    except Exception as e:
        logger.exception(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/train/upload",
    response_model=TrainResponse,
    summary="Train with File Upload",
    description="Upload CSV/JSON file for model training"
)
async def train_with_file(
    file: UploadFile = File(...),
    label_column: str = Form(default="label"),
    test_size: float = Form(default=0.2),
    use_smote: bool = Form(default=True),
    model_type: str = Form(default="ensemble"),
    save_model: bool = Form(default=True)
):
    """
    Train models with uploaded CSV or JSON file.
    """
    start_time = time.time()
    
    # Read file content
    content = await file.read()
    content_str = content.decode('utf-8')
    
    # Parse based on file type
    if file.filename.endswith('.csv'):
        df = pd.read_csv(StringIO(content_str))
    elif file.filename.endswith('.json'):
        data = json.loads(content_str)
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict) and 'data' in data:
            df = pd.DataFrame(data['data'])
        elif isinstance(data, dict) and 'accounts' in data:
            df = pd.DataFrame(data['accounts'])
        else:
            df = pd.DataFrame([data])
    elif file.filename.endswith('.zip'):
        import zipfile
        from io import BytesIO
        
        with zipfile.ZipFile(BytesIO(content)) as z:
            # Find first CSV or JSON file
            data_files = [f for f in z.namelist() if f.endswith('.csv') or f.endswith('.json')]
            if not data_files:
                raise HTTPException(status_code=400, detail="No CSV or JSON files found in ZIP archive")
            
            # Read first valid file
            # In a more advanced version, we could merge multiple files
            target_file = data_files[0]
            logger.info(f"Extracting {target_file} from ZIP")
            
            with z.open(target_file) as f:
                file_content = f.read().decode('utf-8')
                
                if target_file.endswith('.csv'):
                    df = pd.read_csv(StringIO(file_content))
                else:
                    data = json.loads(file_content)
                    if isinstance(data, list):
                        df = pd.DataFrame(data)
                    elif isinstance(data, dict) and 'data' in data:
                        df = pd.DataFrame(data['data'])
                    elif isinstance(data, dict) and 'accounts' in data:
                        df = pd.DataFrame(data['accounts'])
                    else:
                        df = pd.DataFrame([data])
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV, JSON, or ZIP.")
    
    if len(df) < 10:
        raise HTTPException(status_code=400, detail="At least 10 samples required")
    
    logger.info(f"Training with uploaded file: {file.filename} ({len(df)} samples)")
    
    try:
        # Preprocess
        X, y = preprocess_training_data(df, label_column)
        
        class_dist = y.value_counts().to_dict()
        
        # Split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        # Train
        models = train_models(X_train.values, y_train.values, model_type, use_smote)
        
        # Evaluate
        metrics = evaluate_models(models, X_test.values, y_test.values)
        
        # Feature importance
        feature_importance = get_feature_importance(models)
        
        # Version from filename
        version = file.filename.replace('.csv', '').replace('.json', '') + "_" + datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save
        model_path = None
        if save_model:
            model_path = save_trained_models(models, version)
        
        training_time = time.time() - start_time
        
        return TrainResponse(
            success=True,
            model_type=model_type,
            model_version=version,
            samples_trained=len(X_train),
            samples_tested=len(X_test),
            class_distribution={str(k): int(v) for k, v in class_dist.items()},
            metrics=metrics,
            feature_importance=feature_importance,
            training_time_seconds=round(training_time, 2),
            model_path=model_path
        )
        
    except Exception as e:
        logger.exception(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/train/status/{job_id}",
    response_model=TrainingStatus,
    summary="Get Training Status",
    description="Check status of background training job"
)
async def get_training_status(job_id: str):
    """Get status of a background training job"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Training job not found")
    return training_jobs[job_id]

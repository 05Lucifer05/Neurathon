"""
Optimized Prediction API Routes
High-performance batch prediction for 1000+ accounts using vectorized operations
"""
from fastapi import APIRouter, HTTPException, Request, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
import logging
import time
from enum import Enum

from app.models.ml_models import ModelManager
from app.services.feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Prediction"])


class Classification(str, Enum):
    REAL = "Real"
    SUSPICIOUS = "Suspicious"
    FAKE = "Fake"


class PredictRequest(BaseModel):
    """Single account prediction request"""
    account_id: str
    username: Optional[str] = None
    
    # Behavioral features
    actions_per_minute: float = 0.0
    inter_action_time_mean: float = 0.0
    inter_action_time_std: float = 0.0
    message_similarity_index: float = 0.0
    follow_velocity: float = 0.0
    unfollow_velocity: float = 0.0
    url_post_ratio: float = 0.0
    device_change_frequency: float = 0.0
    
    # Profile features
    account_age_days: int = 0
    follower_count: int = 0
    following_count: int = 0
    profile_completeness_index: float = 0.0
    profile_image_presence: bool = True
    bio_length: int = 0
    
    # Network features
    mutual_connection_ratio: float = 0.0
    clustering_coefficient: float = 0.0
    pagerank_score: float = 0.0
    edge_creation_velocity: float = 0.0


class PredictResponse(BaseModel):
    """Single account prediction response"""
    account_id: str
    username: Optional[str] = None
    trust_score: int = Field(..., ge=0, le=100, description="Trust score 0-100")
    probability_score: float = Field(..., ge=0.0, le=1.0, description="Fake probability 0-1")
    classification: Classification
    confidence: float = Field(..., ge=0.0, le=1.0)
    risk_factors: List[str] = []
    processing_time_ms: float = 0.0


class BatchPredictRequest(BaseModel):
    """Batch prediction request for 1000+ accounts"""
    accounts: List[PredictRequest]
    return_features: bool = False


class BatchPredictResponse(BaseModel):
    """Batch prediction response"""
    success: bool = True
    total_accounts: int
    processed: int
    results: List[PredictResponse]
    summary: Dict[str, Any] = {}
    processing_time_seconds: float


def get_model_manager(request: Request) -> ModelManager:
    """Dependency to get model manager from app state"""
    return request.app.state.model_manager


def extract_features_vectorized(accounts: List[PredictRequest]) -> np.ndarray:
    """
    Extract features using vectorized Pandas operations for maximum performance.
    Handles 1000+ accounts efficiently.
    DETERMINISTIC: Fixed normalization, log-scaling for ratios, sorted columns.
    """
    # Convert to DataFrame for vectorized operations
    data = []
    for acc in accounts:
        data.append({
            'actions_per_minute': acc.actions_per_minute,
            'inter_action_time_mean': acc.inter_action_time_mean,
            'inter_action_time_std': acc.inter_action_time_std,
            'message_similarity_index': acc.message_similarity_index,
            'follow_velocity': acc.follow_velocity,
            'unfollow_velocity': acc.unfollow_velocity,
            'url_post_ratio': acc.url_post_ratio,
            'device_change_frequency': acc.device_change_frequency,
            'account_age_days': acc.account_age_days,
            'follower_following_ratio': (acc.follower_count / max(acc.following_count, 1)),
            'profile_completeness_index': acc.profile_completeness_index,
            'profile_image_presence': 1.0 if acc.profile_image_presence else 0.0,
            'bio_length_score': min(acc.bio_length / 160.0, 1.0),
            'mutual_connection_ratio': acc.mutual_connection_ratio,
            'clustering_coefficient': acc.clustering_coefficient,
            'pagerank_score': acc.pagerank_score,
            'edge_creation_velocity': acc.edge_creation_velocity
        })
    
    df = pd.DataFrame(data)
    
    # DETERMINISM: Sort columns alphabetically for consistent ordering
    df = df[sorted(df.columns)]
    
    # Normalize features using vectorized operations (fixed bounds)
    df['actions_per_minute'] = np.clip(df['actions_per_minute'] / 100.0, 0, 1)
    df['inter_action_time_mean'] = np.clip(df['inter_action_time_mean'] / 3600.0, 0, 1)
    df['inter_action_time_std'] = np.clip(df['inter_action_time_std'] / 1800.0, 0, 1)
    df['follow_velocity'] = np.clip(df['follow_velocity'] / 500.0, 0, 1)
    df['unfollow_velocity'] = np.clip(df['unfollow_velocity'] / 500.0, 0, 1)
    df['account_age_days'] = np.clip(df['account_age_days'] / 3650.0, 0, 1)
    df['device_change_frequency'] = np.clip(df['device_change_frequency'] / 20.0, 0, 1)
    df['pagerank_score'] = np.clip(df['pagerank_score'], 0, 1)
    
    # Log-scaling for ratio features (prevents extreme values collapsing to 1.0)
    df['follower_following_ratio'] = np.log1p(np.clip(df['follower_following_ratio'], 0, None)) / np.log1p(100)
    df['follower_following_ratio'] = np.clip(df['follower_following_ratio'], 0, 1)
    
    df['edge_creation_velocity'] = np.log1p(np.clip(df['edge_creation_velocity'], 0, None)) / np.log1p(100)
    df['edge_creation_velocity'] = np.clip(df['edge_creation_velocity'], 0, 1)
    
    # Fill NaN with 0
    df = df.fillna(0)
    
    return df.values.astype(np.float32)



def classify_scores(probabilities: np.ndarray) -> List[Classification]:
    """Vectorized classification based on probability thresholds"""
    classifications = []
    for prob in probabilities:
        if prob >= 0.7:
            classifications.append(Classification.FAKE)
        elif prob >= 0.4:
            classifications.append(Classification.SUSPICIOUS)
        else:
            classifications.append(Classification.REAL)
    return classifications


def identify_risk_factors(account: PredictRequest, probability: float) -> List[str]:
    """Identify specific risk factors for an account"""
    factors = []
    
    if account.actions_per_minute > 50:
        factors.append("Unusually high activity rate")
    if account.message_similarity_index > 0.8:
        factors.append("High message similarity (potential automation)")
    if account.follow_velocity > 200:
        factors.append("Rapid follow activity")
    if account.mutual_connection_ratio < 0.1:
        factors.append("Very low mutual connections")
    if account.profile_completeness_index < 0.3:
        factors.append("Incomplete profile")
    if account.account_age_days < 30 and probability > 0.5:
        factors.append("New account with suspicious behavior")
    if account.url_post_ratio > 0.7:
        factors.append("High URL posting ratio")
    
    return factors


@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Single Account Prediction",
    description="Predict fraud probability for a single account"
)
async def predict_single(
    account: PredictRequest,
    model_manager: ModelManager = Depends(get_model_manager)
):
    """
    Predict fraud probability for a single account.
    Returns trust score (0-100), probability, and classification.
    """
    start_time = time.time()
    
    try:
        # Extract features
        features = extract_features_vectorized([account])
        
        # Get prediction from ensemble
        if model_manager.models_loaded and not model_manager.using_stubs:
            rf_proba = model_manager.rf_model.predict_proba(features)[0][1]
            if_score = model_manager.if_model.score_samples(features)[0]
            # Normalize isolation forest score
            if_proba = 1 / (1 + np.exp(if_score))
            # Ensemble
            probability = 0.6 * rf_proba + 0.4 * if_proba
        else:
            # Fallback: heuristic scoring
            probability = calculate_heuristic_probability(account)
        
        probability = float(np.clip(probability, 0, 1))
        trust_score = int((1 - probability) * 100)
        classification = classify_scores(np.array([probability]))[0]
        confidence = abs(probability - 0.5) * 2  # Higher confidence at extremes
        
        processing_time = (time.time() - start_time) * 1000
        
        return PredictResponse(
            account_id=account.account_id,
            username=account.username,
            trust_score=trust_score,
            probability_score=round(probability, 4),
            classification=classification,
            confidence=round(confidence, 4),
            risk_factors=identify_risk_factors(account, probability),
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        logger.exception(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/predict/batch",
    response_model=BatchPredictResponse,
    summary="Batch Prediction (1000+ accounts)",
    description="Efficiently predict fraud for large batches using vectorized operations"
)
async def predict_batch(
    request: BatchPredictRequest,
    model_manager: ModelManager = Depends(get_model_manager)
):
    """
    Batch prediction optimized for 1000+ accounts.
    Uses vectorized NumPy/Pandas operations for maximum throughput.
    DETERMINISTIC: Sorts accounts by account_id for consistent results.
    """
    start_time = time.time()
    accounts = request.accounts
    
    if len(accounts) == 0:
        raise HTTPException(status_code=400, detail="No accounts provided")
    
    # DETERMINISM: Sort accounts by account_id to ensure consistent ordering
    accounts_sorted = sorted(accounts, key=lambda x: x.account_id)
    
    logger.info(f"Processing batch of {len(accounts_sorted)} accounts (sorted by account_id)")
    
    try:
        # Vectorized feature extraction
        features = extract_features_vectorized(accounts_sorted)
        
        # Batch prediction
        if model_manager.models_loaded and not model_manager.using_stubs:
            # RandomForest predictions (vectorized)
            rf_probas = model_manager.rf_model.predict_proba(features)[:, 1]
            
            # IsolationForest scores (vectorized)
            if_scores = model_manager.if_model.score_samples(features)
            if_probas = 1 / (1 + np.exp(if_scores))
            
            # Ensemble combination (vectorized)
            probabilities = 0.6 * rf_probas + 0.4 * if_probas
        else:
            # Fallback: vectorized heuristic
            probabilities = np.array([
                calculate_heuristic_probability(acc) for acc in accounts_sorted
            ])
        
        # Clip probabilities
        probabilities = np.clip(probabilities, 0, 1)
        
        # Vectorized trust score calculation
        trust_scores = ((1 - probabilities) * 100).astype(int)
        
        # Classifications
        classifications = classify_scores(probabilities)
        
        # Confidence scores
        confidences = np.abs(probabilities - 0.5) * 2
        
        # Build results
        results = []
        for i, acc in enumerate(accounts_sorted):
            results.append(PredictResponse(
                account_id=acc.account_id,
                username=acc.username,
                trust_score=int(trust_scores[i]),
                probability_score=round(float(probabilities[i]), 4),
                classification=classifications[i],
                confidence=round(float(confidences[i]), 4),
                risk_factors=identify_risk_factors(acc, probabilities[i]),
                processing_time_ms=0  # Batch timing only
            ))
        
        processing_time = time.time() - start_time
        
        # Summary statistics
        fake_count = sum(1 for c in classifications if c == Classification.FAKE)
        suspicious_count = sum(1 for c in classifications if c == Classification.SUSPICIOUS)
        real_count = sum(1 for c in classifications if c == Classification.REAL)
        
        summary = {
            "fake_count": fake_count,
            "suspicious_count": suspicious_count,
            "real_count": real_count,
            "fake_percentage": round(fake_count / len(accounts_sorted) * 100, 2),
            "suspicious_percentage": round(suspicious_count / len(accounts_sorted) * 100, 2),
            "real_percentage": round(real_count / len(accounts_sorted) * 100, 2),
            "avg_trust_score": round(float(np.mean(trust_scores)), 2),
            "avg_probability": round(float(np.mean(probabilities)), 4),
            "accounts_per_second": round(len(accounts_sorted) / processing_time, 2) if processing_time > 0 else 0
        }
        
        logger.info(f"Batch processed in {processing_time:.2f}s ({summary['accounts_per_second']} acc/s)")
        
        return BatchPredictResponse(
            success=True,
            total_accounts=len(accounts_sorted),
            processed=len(results),
            results=results,
            summary=summary,
            processing_time_seconds=round(processing_time, 3)
        )
        
    except Exception as e:
        logger.exception(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def calculate_heuristic_probability(account: PredictRequest) -> float:
    """
    Fallback heuristic scoring when ML models unavailable.
    Uses rule-based logic to estimate fake probability.
    """
    score = 0.0
    weights = 0.0
    
    # Action rate (high = suspicious)
    if account.actions_per_minute > 30:
        score += 0.8
    elif account.actions_per_minute > 10:
        score += 0.3
    weights += 1.0
    
    # Message similarity (high = bot-like)
    score += account.message_similarity_index * 0.9
    weights += 1.0
    
    # Follow velocity (high = suspicious)
    if account.follow_velocity > 100:
        score += 0.7
    elif account.follow_velocity > 50:
        score += 0.3
    weights += 1.0
    
    # Profile completeness (low = suspicious)
    score += (1 - account.profile_completeness_index) * 0.5
    weights += 1.0
    
    # Mutual connections (low = suspicious)
    score += (1 - account.mutual_connection_ratio) * 0.4
    weights += 1.0
    
    # Account age (young = slightly suspicious)
    if account.account_age_days < 30:
        score += 0.3
    elif account.account_age_days < 90:
        score += 0.1
    weights += 1.0
    
    # URL ratio (high = spam-like)
    if account.url_post_ratio > 0.5:
        score += 0.6
    weights += 1.0
    
    return min(score / weights, 1.0)

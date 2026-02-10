"""
API Routes for Fraud Detection Service
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
import logging
import time
from typing import List

from app.models.schemas import (
    BatchRequest, BatchResponse, AccountData, 
    AccountResult, ErrorResponse
)
from app.services.fraud_detector import FraudDetector
from app.models.ml_models import ModelManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Fraud Detection"])


def get_model_manager(request: Request) -> ModelManager:
    """Dependency to get model manager from app state"""
    return request.app.state.model_manager


@router.post(
    "/detect",
    response_model=BatchResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Batch Fraud Detection",
    description="Analyze multiple social media accounts for fraud indicators"
)
async def detect_fraud(
    request: BatchRequest,
    model_manager: ModelManager = Depends(get_model_manager)
):
    """
    Perform batch fraud detection on multiple accounts.
    
    - **accounts**: List of account data objects to analyze
    
    Returns prediction results with trust scores and behavioral indicators.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Received detection request for {len(request.accounts)} accounts")
        
        # DETERMINISM: Sort accounts by account_id before processing
        sorted_accounts = sorted(request.accounts, key=lambda a: a.account_id)
        
        # Initialize fraud detector
        detector = FraudDetector(model_manager)
        
        # Process batch
        results, summary = detector.detect_batch(sorted_accounts)
        
        processing_time = time.time() - start_time
        logger.info(f"Batch processed in {processing_time:.2f}s")
        
        return BatchResponse(
            success=True,
            total_accounts=len(request.accounts),
            processed=len(results),
            results=results,
            summary={
                **summary,
                'processing_time_seconds': processing_time
            }
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.exception(f"Error processing detection request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/detect/single",
    response_model=AccountResult,
    summary="Single Account Detection",
    description="Analyze a single account for fraud indicators"
)
async def detect_single(
    account: AccountData,
    model_manager: ModelManager = Depends(get_model_manager)
):
    """
    Perform fraud detection on a single account.
    
    Convenience endpoint for analyzing individual accounts.
    """
    try:
        detector = FraudDetector(model_manager)
        results, _ = detector.detect_batch([account])
        return results[0]
        
    except Exception as e:
        logger.exception(f"Error processing single detection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/model/info",
    summary="Model Information",
    description="Get information about loaded ML models"
)
async def model_info(
    model_manager: ModelManager = Depends(get_model_manager)
):
    """Get information about the currently loaded models"""
    return {
        "models_loaded": model_manager.models_loaded,
        "using_stubs": model_manager.using_stubs,
        "rf_model": {
            "type": "RandomForestClassifier",
            "loaded": model_manager.rf_model is not None
        },
        "if_model": {
            "type": "IsolationForest", 
            "loaded": model_manager.if_model is not None
        }
    }


@router.get(
    "/features",
    summary="Feature Information",
    description="Get list of features used for fraud detection"
)
async def feature_info():
    """Get information about features used in the model"""
    return {
        "behavioral_features": [
            "actions_per_minute",
            "inter_action_time_mean",
            "inter_action_time_std",
            "circadian_activity_distribution",
            "message_similarity_index",
            "follow_velocity",
            "unfollow_velocity",
            "session_duration_mean",
            "session_duration_std",
            "click_sequence_entropy",
            "url_post_ratio",
            "device_change_frequency"
        ],
        "profile_features": [
            "account_age_days",
            "follower_following_ratio",
            "username_entropy_score",
            "profile_completeness_index",
            "profile_image_presence",
            "bio_length_score"
        ],
        "network_features": [
            "mutual_connection_ratio",
            "clustering_coefficient",
            "pagerank_score",
            "community_suspicion_index",
            "edge_creation_velocity"
        ],
        "output_scores": [
            "fake_probability",
            "anomaly_score",
            "trust_score",
            "authenticity_score",
            "network_risk_score",
            "behavioral_risk_score"
        ]
    }

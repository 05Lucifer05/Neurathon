
import logging
import joblib
import numpy as np
from app.models.ml_models import ModelManager
from app.models.schemas import AccountData, BehavioralTelemetry, ProfileAuthenticity, NetworkData
from app.services.feature_engineering import FeatureEngineer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_inference():
    try:
        logger.info("Initializing ModelManager...")
        manager = ModelManager()
        manager.load_models()
        
        if manager.using_stubs:
            logger.warning("Still using STUB models! Training didn't overwrite properly or loading failed.")
        else:
            logger.info("Successfully loaded TRAINED models.")
            
        # Create a dummy account for prediction
        dummy_account = AccountData(
            account_id="test_001",
            username="test_user",
            behavioral=BehavioralTelemetry(
                actions_per_minute=2.5,
                inter_action_time_mean=45.2,
                inter_action_time_std=22.1,
                circadian_activity_distribution=[0.04]*24,
                message_similarity_index=0.15,
                follow_velocity=5.2,
                unfollow_velocity=1.3,
                session_duration_mean=25.5,
                session_duration_std=12.3,
                click_sequence_entropy=3.8,
                url_post_ratio=0.12,
                device_change_frequency=0.5
            ),
            profile=ProfileAuthenticity(
                account_age_days=892,
                follower_following_ratio=1.45,
                username_entropy_score=2.1,
                profile_completeness_index=0.92,
                profile_image_presence=True,
                bio_length_score=0.85
            ),
            network=NetworkData(
                mutual_connection_ratio=0.68,
                clustering_coefficient=0.42,
                pagerank_score=0.0012,
                community_suspicion_index=0.08,
                edge_creation_velocity=2.1
            )
        )
        
        logger.info("Extracting features for test account...")
        engineer = FeatureEngineer()
        features, _ = engineer.extract_features([dummy_account])
        
        logger.info(f"Features shape: {features.shape}")
        
        logger.info("Running prediction...")
        fake_prob, anomaly_score = manager.predict_ensemble(features)
        
        logger.info(f"Prediction Result: Fake Prob={fake_prob[0]:.4f}, Anomaly Score={anomaly_score[0]:.4f}")
        print("Inference Test PASSED")
        
    except Exception as e:
        logger.error(f"Inference Test FAILED: {e}")
        raise

if __name__ == "__main__":
    test_inference()

"""
Fraud Detection Service

Core detection logic using ML models and behavioral analysis.
"""
import numpy as np
from typing import List, Dict, Any, Tuple
import logging

from app.models.schemas import (
    AccountData, AccountResult, BehavioralIndicator, 
    RiskClassification
)
from app.services.feature_engineering import FeatureEngineer
from app.models.ml_models import ModelManager
from app.config import settings

logger = logging.getLogger(__name__)


class FraudDetector:
    """
    Main fraud detection service that orchestrates feature engineering,
    model inference, and result compilation.
    """
    
    # Behavioral indicator thresholds (probability-based, not hard rules)
    INDICATOR_THRESHOLDS = {
        'high_action_rate': {
            'feature': 'actions_per_minute',
            'threshold': 0.8,
            'severity': 'high',
            'description': 'Unusually high activity rate suggesting automation'
        },
        'low_message_diversity': {
            'feature': 'message_similarity_index',
            'threshold': 0.85,
            'severity': 'medium',
            'description': 'High message similarity suggesting templated content'
        },
        'rapid_follow_unfollow': {
            'feature': 'follow_unfollow_ratio',
            'threshold': 0.9,
            'severity': 'high',
            'description': 'Aggressive follow/unfollow behavior pattern'
        },
        'unnatural_timing': {
            'feature': 'circadian_entropy',
            'threshold': 0.2,
            'severity': 'medium',
            'description': 'Unnatural activity timing distribution'
        },
        'low_profile_quality': {
            'feature': 'profile_quality_score',
            'threshold': 0.3,
            'severity': 'low',
            'description': 'Incomplete or low-quality profile'
        },
        'suspicious_network': {
            'feature': 'community_suspicion_index',
            'threshold': 0.7,
            'severity': 'high',
            'description': 'Connected to known suspicious account clusters'
        },
        'rapid_network_growth': {
            'feature': 'network_growth_rate',
            'threshold': 0.85,
            'severity': 'medium',
            'description': 'Unusually rapid network expansion'
        },
        'low_mutual_connections': {
            'feature': 'mutual_connection_ratio',
            'threshold': 0.15,
            'severity': 'medium',
            'description': 'Very few mutual/reciprocal connections'
        }
    }
    
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.feature_engineer = FeatureEngineer()
    
    def detect_batch(self, accounts: List[AccountData]) -> Tuple[List[AccountResult], Dict[str, Any]]:
        """
        Perform batch fraud detection on multiple accounts.
        
        Args:
            accounts: List of AccountData objects to analyze
            
        Returns:
            Tuple of (results list, summary statistics)
        """
        logger.info(f"Processing batch of {len(accounts)} accounts")
        
        # DETERMINISM: Sort accounts by account_id for consistent feature matrix ordering
        accounts = sorted(accounts, key=lambda a: a.account_id)
        
        # Extract and engineer features
        features, feature_snapshots = self.feature_engineer.extract_features(accounts)
        feature_names = self.feature_engineer.get_feature_names()
        
        # Get ensemble predictions
        fake_probabilities, anomaly_scores = self.model_manager.predict_ensemble(features)
        
        # Calculate component scores
        behavioral_scores = self._calculate_behavioral_scores(features, feature_names)
        network_scores = self._calculate_network_scores(features, feature_names)
        authenticity_scores = self._calculate_authenticity_scores(features, feature_names)
        
        # Build results
        results = []
        for i, account in enumerate(accounts):
            # Extract feature values for this account as dict
            feature_dict = dict(zip(feature_names, features[i]))
            
            # Calculate trust score
            trust_score = 1.0 - fake_probabilities[i]
            
            # Determine classification
            classification = self._classify_account(fake_probabilities[i])
            
            # Get triggered indicators
            indicators = self._get_triggered_indicators(feature_dict)
            
            result = AccountResult(
                account_id=account.account_id,
                username=account.username,
                fake_probability=float(fake_probabilities[i]),
                anomaly_score=float(anomaly_scores[i]),
                trust_score=float(trust_score),
                authenticity_score=float(authenticity_scores[i]),
                network_risk_score=float(network_scores[i]),
                behavioral_risk_score=float(behavioral_scores[i]),
                classification=classification,
                behavioral_indicators=indicators,
                feature_snapshot=feature_snapshots[i]
            )
            results.append(result)
        
        # Calculate summary statistics
        summary = self._calculate_summary(results)
        
        logger.info(f"Batch processing complete: {summary['fake_count']} fake, {summary['suspicious_count']} suspicious")
        
        return results, summary
    
    def _calculate_behavioral_scores(
        self, 
        features: np.ndarray, 
        feature_names: List[str]
    ) -> np.ndarray:
        """Calculate behavioral risk scores from features"""
        behavioral_features = [
            'actions_per_minute', 'message_similarity_index', 
            'follow_unfollow_ratio', 'circadian_entropy',
            'session_variance_coef', 'click_sequence_entropy'
        ]
        
        indices = [
            feature_names.index(f) for f in behavioral_features 
            if f in feature_names
        ]
        
        if not indices:
            return np.zeros(features.shape[0])
        
        # Weight and combine behavioral features
        behavioral_subset = features[:, indices]
        
        # Higher values = more suspicious for most behavioral features
        weights = np.array([0.2, 0.25, 0.15, -0.15, 0.1, -0.15])[:len(indices)]
        
        scores = np.dot(behavioral_subset, weights)
        
        # Use fixed sigmoid normalization for deterministic results
        scores = 1 / (1 + np.exp(-scores))
        
        return scores
    
    def _calculate_network_scores(
        self, 
        features: np.ndarray, 
        feature_names: List[str]
    ) -> np.ndarray:
        """Calculate network risk scores from features"""
        network_features = [
            'mutual_connection_ratio', 'clustering_coefficient',
            'community_suspicion_index', 'network_authenticity_score',
            'network_growth_rate'
        ]
        
        indices = [
            feature_names.index(f) for f in network_features 
            if f in feature_names
        ]
        
        if not indices:
            return np.zeros(features.shape[0])
        
        network_subset = features[:, indices]
        
        # Weights: negative for good signals, positive for bad signals
        weights = np.array([-0.2, -0.2, 0.3, -0.2, 0.1])[:len(indices)]
        
        scores = np.dot(network_subset, weights)
        # Use fixed sigmoid normalization for deterministic results
        scores = 1 / (1 + np.exp(-scores))
        
        return scores
    
    def _calculate_authenticity_scores(
        self, 
        features: np.ndarray, 
        feature_names: List[str]
    ) -> np.ndarray:
        """Calculate profile authenticity scores from features"""
        auth_features = [
            'profile_quality_score', 'account_maturity_score',
            'username_entropy_score', 'follower_following_ratio'
        ]
        
        indices = [
            feature_names.index(f) for f in auth_features 
            if f in feature_names
        ]
        
        if not indices:
            return np.ones(features.shape[0]) * 0.5
        
        auth_subset = features[:, indices]
        
        # Weights for authenticity (higher = more authentic)
        weights = np.array([0.35, 0.25, -0.2, 0.2])[:len(indices)]
        
        scores = np.dot(auth_subset, weights)
        # Use fixed sigmoid normalization for deterministic results
        scores = 1 / (1 + np.exp(-scores))
        
        return scores
    
    def _classify_account(self, fake_probability: float) -> RiskClassification:
        """Classify account based on fake probability"""
        if fake_probability >= 0.7:
            return RiskClassification.FAKE
        elif fake_probability >= 0.4:
            return RiskClassification.SUSPICIOUS
        else:
            return RiskClassification.REAL
    
    def _get_triggered_indicators(
        self, 
        feature_dict: Dict[str, float]
    ) -> List[BehavioralIndicator]:
        """Identify which behavioral indicators are triggered"""
        indicators = []
        
        for indicator_name, config in self.INDICATOR_THRESHOLDS.items():
            feature_name = config['feature']
            
            if feature_name not in feature_dict:
                continue
            
            value = feature_dict[feature_name]
            threshold = config['threshold']
            
            # Check if indicator is triggered
            # For some features, lower is suspicious (marked with negative threshold logic)
            is_triggered = False
            if indicator_name in ['unnatural_timing', 'low_profile_quality', 'low_mutual_connections']:
                is_triggered = value < threshold
            else:
                is_triggered = value > threshold
            
            if is_triggered:
                indicators.append(BehavioralIndicator(
                    indicator=indicator_name,
                    severity=config['severity'],
                    value=float(value),
                    threshold=threshold,
                    description=config['description']
                ))
        
        return indicators
    
    def _calculate_summary(self, results: List[AccountResult]) -> Dict[str, Any]:
        """Calculate summary statistics for batch results"""
        if not results:
            return {
                'total': 0,
                'fake_count': 0,
                'suspicious_count': 0,
                'real_count': 0,
                'avg_trust_score': 0.0,
                'avg_fake_probability': 0.0
            }
        
        fake_count = sum(1 for r in results if r.classification == RiskClassification.FAKE)
        suspicious_count = sum(1 for r in results if r.classification == RiskClassification.SUSPICIOUS)
        real_count = sum(1 for r in results if r.classification == RiskClassification.REAL)
        
        return {
            'total': len(results),
            'fake_count': fake_count,
            'suspicious_count': suspicious_count,
            'real_count': real_count,
            'fake_percentage': (fake_count / len(results)) * 100,
            'suspicious_percentage': (suspicious_count / len(results)) * 100,
            'real_percentage': (real_count / len(results)) * 100,
            'avg_trust_score': np.mean([r.trust_score for r in results]),
            'avg_fake_probability': np.mean([r.fake_probability for r in results]),
            'high_risk_accounts': [r.account_id for r in results if r.fake_probability > 0.8]
        }

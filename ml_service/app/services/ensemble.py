"""
Ensemble Scoring Module

Combines outputs from multiple ML models with configurable weights.
"""
import numpy as np
from typing import Dict, Any, Tuple
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class EnsembleScorer:
    """
    Combines predictions from multiple models using weighted averaging.
    Implements calibration and confidence adjustments.
    """
    
    def __init__(
        self, 
        rf_weight: float = None, 
        if_weight: float = None
    ):
        """
        Initialize ensemble scorer with model weights.
        
        Args:
            rf_weight: Weight for Random Forest predictions
            if_weight: Weight for Isolation Forest predictions
        """
        self.rf_weight = rf_weight or settings.rf_weight
        self.if_weight = if_weight or settings.if_weight
        
        # Ensure weights sum to 1
        total = self.rf_weight + self.if_weight
        self.rf_weight /= total
        self.if_weight /= total
        
        logger.info(f"Ensemble initialized: RF={self.rf_weight:.2f}, IF={self.if_weight:.2f}")
    
    def combine(
        self, 
        rf_predictions: np.ndarray, 
        if_predictions: np.ndarray,
        calibrate: bool = True
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Combine predictions from Random Forest and Isolation Forest.
        
        Args:
            rf_predictions: Probability predictions from Random Forest
            if_predictions: Anomaly scores from Isolation Forest
            calibrate: Whether to apply Platt scaling calibration
            
        Returns:
            Tuple of (combined_scores, metadata)
        """
        # Apply weighted combination
        combined = (
            self.rf_weight * rf_predictions + 
            self.if_weight * if_predictions
        )
        
        if calibrate:
            combined = self._calibrate_scores(combined)
        
        # Calculate confidence based on model agreement
        agreement = 1 - np.abs(rf_predictions - if_predictions)
        
        metadata = {
            'rf_weight': self.rf_weight,
            'if_weight': self.if_weight,
            'rf_predictions': rf_predictions.tolist(),
            'if_predictions': if_predictions.tolist(),
            'model_agreement': agreement.tolist(),
            'calibrated': calibrate
        }
        
        return combined, metadata
    
    def _calibrate_scores(self, scores: np.ndarray) -> np.ndarray:
        """
        Apply sigmoid calibration to ensure well-distributed probabilities.
        Uses a simplified Platt scaling approach.
        """
        # Simple sigmoid transformation centered at 0.5
        # This helps spread out scores that might be clustered
        centered = scores - 0.5
        calibrated = 1 / (1 + np.exp(-4 * centered))
        
        return calibrated
    
    def compute_trust_score(self, fake_probability: np.ndarray) -> np.ndarray:
        """
        Compute trust score as inverse of fake probability.
        
        Trust = 1 - P(Fake)
        """
        return 1 - fake_probability
    
    def compute_confidence_interval(
        self, 
        rf_predictions: np.ndarray, 
        if_predictions: np.ndarray,
        confidence_level: float = 0.95
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute confidence intervals for predictions.
        
        Returns:
            Tuple of (lower_bound, upper_bound)
        """
        # Stack predictions
        stacked = np.stack([rf_predictions, if_predictions], axis=1)
        
        # Compute mean and std
        mean = np.mean(stacked, axis=1)
        std = np.std(stacked, axis=1)
        
        # Z-score for confidence level
        z_scores = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
        z = z_scores.get(confidence_level, 1.96)
        
        lower = np.maximum(0, mean - z * std)
        upper = np.minimum(1, mean + z * std)
        
        return lower, upper


class DynamicWeightAdjuster:
    """
    Dynamically adjusts ensemble weights based on model performance.
    Can be used for online learning scenarios.
    """
    
    def __init__(self, initial_rf_weight: float = 0.6, learning_rate: float = 0.01):
        self.rf_weight = initial_rf_weight
        self.if_weight = 1 - initial_rf_weight
        self.learning_rate = learning_rate
        self.feedback_history = []
    
    def update_weights(self, rf_correct: bool, if_correct: bool):
        """
        Update weights based on which model was correct.
        
        Args:
            rf_correct: Whether RF prediction was correct
            if_correct: Whether IF prediction was correct
        """
        if rf_correct and not if_correct:
            self.rf_weight += self.learning_rate
        elif if_correct and not rf_correct:
            self.if_weight += self.learning_rate
        
        # Normalize
        total = self.rf_weight + self.if_weight
        self.rf_weight /= total
        self.if_weight /= total
        
        # Clamp weights to reasonable range
        self.rf_weight = max(0.2, min(0.8, self.rf_weight))
        self.if_weight = 1 - self.rf_weight
        
        self.feedback_history.append({
            'rf_correct': rf_correct,
            'if_correct': if_correct,
            'rf_weight': self.rf_weight,
            'if_weight': self.if_weight
        })
    
    def get_weights(self) -> Tuple[float, float]:
        """Get current weights"""
        return self.rf_weight, self.if_weight

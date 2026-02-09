"""
Feature Engineering Module

Handles transformation of raw account data into ML-ready features:
- Normalization and scaling
- Entropy calculations
- Temporal aggregation
- Network graph feature processing
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
import logging
from scipy import stats
import networkx as nx

from app.models.schemas import AccountData

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """
    Transforms raw account data into engineered features for ML models.
    Implements vectorized operations for efficient batch processing.
    """
    
    # Feature normalization ranges (based on typical social media patterns)
    NORMALIZATION_PARAMS = {
        'actions_per_minute': {'min': 0, 'max': 100},
        'inter_action_time_mean': {'min': 0, 'max': 3600},
        'inter_action_time_std': {'min': 0, 'max': 1800},
        'follow_velocity': {'min': 0, 'max': 500},
        'unfollow_velocity': {'min': 0, 'max': 500},
        'session_duration_mean': {'min': 0, 'max': 480},
        'session_duration_std': {'min': 0, 'max': 240},
        'click_sequence_entropy': {'min': 0, 'max': 10},
        'device_change_frequency': {'min': 0, 'max': 20},
        'account_age_days': {'min': 0, 'max': 3650},
        'follower_following_ratio': {'min': 0, 'max': 100},
        'username_entropy_score': {'min': 0, 'max': 5},
        'pagerank_score': {'min': 0, 'max': 1},
        'edge_creation_velocity': {'min': 0, 'max': 100},
    }
    
    def __init__(self):
        self.feature_names: List[str] = []
    
    def extract_features(self, accounts: List[AccountData]) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Extract and engineer features from a batch of accounts.
        
        Args:
            accounts: List of AccountData objects
            
        Returns:
            Tuple of (feature_matrix, feature_snapshots)
        """
        feature_dicts = []
        
        for account in accounts:
            features = self._extract_single_account(account)
            feature_dicts.append(features)
        
        # Convert to DataFrame for vectorized operations
        df = pd.DataFrame(feature_dicts)
        
        # Store feature names
        self.feature_names = list(df.columns)
        
        # Normalize features
        df_normalized = self._normalize_features(df)
        
        # Create feature snapshots for auditing
        feature_snapshots = [
            {**raw, 'normalized': norm}
            for raw, norm in zip(feature_dicts, df_normalized.to_dict('records'))
        ]
        
        return df_normalized.values, feature_snapshots
    
    def _extract_single_account(self, account: AccountData) -> Dict[str, float]:
        """Extract features from a single account"""
        features = {}
        
        # === Behavioral Features ===
        b = account.behavioral
        
        # Direct behavioral metrics
        features['actions_per_minute'] = b.actions_per_minute
        features['inter_action_time_mean'] = b.inter_action_time_mean
        features['inter_action_time_std'] = b.inter_action_time_std
        features['message_similarity_index'] = b.message_similarity_index
        features['follow_velocity'] = b.follow_velocity
        features['unfollow_velocity'] = b.unfollow_velocity
        features['session_duration_mean'] = b.session_duration_mean
        features['session_duration_std'] = b.session_duration_std
        features['click_sequence_entropy'] = b.click_sequence_entropy
        features['url_post_ratio'] = b.url_post_ratio
        features['device_change_frequency'] = b.device_change_frequency
        
        # Derived behavioral features
        features['follow_unfollow_ratio'] = self._safe_ratio(
            b.follow_velocity, 
            b.unfollow_velocity + 0.1
        )
        features['session_variance_coef'] = self._safe_ratio(
            b.session_duration_std,
            b.session_duration_mean + 0.1
        )
        
        # Circadian activity features
        circadian = np.array(b.circadian_activity_distribution)
        features['circadian_entropy'] = self._calculate_entropy(circadian)
        features['circadian_peak_hour'] = np.argmax(circadian)
        features['circadian_night_activity'] = np.sum(circadian[0:6]) + np.sum(circadian[22:24])
        features['circadian_burst_score'] = np.max(circadian) / (np.mean(circadian) + 0.001)
        
        # === Profile Authenticity Features ===
        p = account.profile
        
        features['account_age_days'] = p.account_age_days
        features['follower_following_ratio'] = p.follower_following_ratio
        features['username_entropy_score'] = p.username_entropy_score
        features['profile_completeness_index'] = p.profile_completeness_index
        features['profile_image_presence'] = 1.0 if p.profile_image_presence else 0.0
        features['bio_length_score'] = p.bio_length_score
        
        # Derived profile features
        features['account_maturity_score'] = min(p.account_age_days / 365, 1.0)
        features['profile_quality_score'] = (
            p.profile_completeness_index * 0.4 +
            features['profile_image_presence'] * 0.3 +
            p.bio_length_score * 0.3
        )
        
        # === Network Features ===
        n = account.network
        
        features['mutual_connection_ratio'] = n.mutual_connection_ratio
        features['clustering_coefficient'] = n.clustering_coefficient
        features['pagerank_score'] = n.pagerank_score
        features['community_suspicion_index'] = n.community_suspicion_index
        features['edge_creation_velocity'] = n.edge_creation_velocity
        
        # Derived network features
        features['network_authenticity_score'] = (
            n.mutual_connection_ratio * 0.3 +
            n.clustering_coefficient * 0.3 +
            (1 - n.community_suspicion_index) * 0.4
        )
        features['network_growth_rate'] = n.edge_creation_velocity / (account.profile.account_age_days + 1)
        
        return features
    
    def _normalize_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply min-max normalization to features"""
        df_norm = df.copy()
        
        for col in df.columns:
            if col in self.NORMALIZATION_PARAMS:
                params = self.NORMALIZATION_PARAMS[col]
                min_val, max_val = params['min'], params['max']
                df_norm[col] = (df[col] - min_val) / (max_val - min_val)
                df_norm[col] = df_norm[col].clip(0, 1)
            elif df[col].max() > 1 or df[col].min() < 0:
                # Auto-normalize if not in params and out of 0-1 range
                col_min, col_max = df[col].min(), df[col].max()
                if col_max - col_min > 0:
                    df_norm[col] = (df[col] - col_min) / (col_max - col_min)
                else:
                    df_norm[col] = 0.5
        
        return df_norm
    
    @staticmethod
    def _calculate_entropy(distribution: np.ndarray) -> float:
        """Calculate Shannon entropy of a distribution"""
        # Normalize to sum to 1
        total = np.sum(distribution)
        if total == 0:
            return 0.0
        
        probs = distribution / total
        # Filter out zeros to avoid log(0)
        probs = probs[probs > 0]
        
        return -np.sum(probs * np.log2(probs))
    
    @staticmethod
    def _safe_ratio(numerator: float, denominator: float) -> float:
        """Calculate ratio with safety for division by zero"""
        if denominator == 0:
            return 0.0
        return numerator / denominator
    
    def get_feature_names(self) -> List[str]:
        """Get list of feature names in order"""
        return self.feature_names


class NetworkGraphProcessor:
    """
    Process network graph features using NetworkX.
    Computes advanced graph metrics when full graph data is available.
    """
    
    @staticmethod
    def compute_graph_features(edges: List[Tuple[str, str]], target_node: str) -> Dict[str, float]:
        """
        Compute graph features for a target node given edge list.
        
        Args:
            edges: List of (source, target) tuples representing connections
            target_node: The node to compute features for
            
        Returns:
            Dictionary of graph metrics
        """
        if not edges:
            return {
                'computed_pagerank': 0.0,
                'computed_clustering': 0.0,
                'computed_degree_centrality': 0.0,
                'computed_betweenness': 0.0
            }
        
        # Build graph
        G = nx.DiGraph()
        G.add_edges_from(edges)
        
        features = {}
        
        # PageRank
        try:
            pagerank = nx.pagerank(G, alpha=0.85)
            features['computed_pagerank'] = pagerank.get(target_node, 0.0)
        except:
            features['computed_pagerank'] = 0.0
        
        # Clustering coefficient (for undirected version)
        try:
            G_undirected = G.to_undirected()
            features['computed_clustering'] = nx.clustering(G_undirected, target_node)
        except:
            features['computed_clustering'] = 0.0
        
        # Degree centrality
        try:
            degree_cent = nx.degree_centrality(G)
            features['computed_degree_centrality'] = degree_cent.get(target_node, 0.0)
        except:
            features['computed_degree_centrality'] = 0.0
        
        # Betweenness centrality (can be expensive for large graphs)
        try:
            if G.number_of_nodes() < 1000:
                betweenness = nx.betweenness_centrality(G)
                features['computed_betweenness'] = betweenness.get(target_node, 0.0)
            else:
                features['computed_betweenness'] = 0.0
        except:
            features['computed_betweenness'] = 0.0
        
        return features

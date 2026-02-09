"""
TwiBot-20 Dataset Loader

Handles loading and transformation of TwiBot-20 dataset into
the application's AccountData schema for training and inference.
"""
import json
import math
import logging
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import Counter
import re

from app.models.schemas import (
    AccountData, 
    BehavioralTelemetry, 
    ProfileAuthenticity, 
    NetworkData
)

logger = logging.getLogger(__name__)

def load_twibot20_dataset(file_path: str, limit: Optional[int] = None) -> List[AccountData]:
    """
    Load TwiBot-20 dataset from JSON file and transform to AccountData objects.
    
    Args:
        file_path: Path to twibot20.json
        limit: Optional limit on number of accounts to load
        
    Returns:
        List of AccountData objects
    """
    try:
        logger.info(f"Loading TwiBot-20 dataset from {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if limit:
            data = data[:limit]
            
        transformed_accounts = []
        for entry in data:
            try:
                account = transform_to_account_data(entry)
                transformed_accounts.append(account)
            except Exception as e:
                logger.warning(f"Failed to transform account {entry.get('ID', 'unknown')}: {e}")
                continue
                
        logger.info(f"Successfully loaded {len(transformed_accounts)} accounts")
        return transformed_accounts
        
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return []
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON format in {file_path}")
        return []

def transform_to_account_data(entry: Dict[str, Any]) -> AccountData:
    """
    Transform a single TwiBot-20 entry into AccountData schema.
    """
    profile = entry.get('profile', {})
    tweets = entry.get('tweet', [])
    neighbor = entry.get('neighbor', {})
    
    # 1. Profile Features
    # -------------------
    
    # Parse dates (e.g., "Tue Nov 18 10:27:25 +0000 2008 ")
    created_at_str = profile.get('created_at', '').strip()
    try:
        created_at = datetime.strptime(created_at_str, '%a %b %d %H:%M:%S %z %Y')
        account_age_days = (datetime.now(created_at.tzinfo) - created_at).days
        if account_age_days < 0: account_age_days = 0
    except ValueError:
        account_age_days = 1000 # Default if parse fails
        
    # Numeric conversions
    followers = int(profile.get('followers_count', '0').strip() or 0)
    following = int(profile.get('friends_count', '0').strip() or 0)
    statuses = int(profile.get('statuses_count', '0').strip() or 0)
    
    # Text scoring
    username = profile.get('screen_name', '').strip()
    description = profile.get('description', '').strip()
    
    # Profile Authenticity Object
    profile_data = ProfileAuthenticity(
        account_age_days=account_age_days,
        follower_following_ratio=_safe_ratio(followers, following),
        username_entropy_score=_calculate_entropy(username),
        profile_completeness_index=_calculate_completeness(profile),
        profile_image_presence=not (profile.get('default_profile_image', 'False').strip() == 'True'),
        bio_length_score=min(len(description) / 160.0, 1.0)
    )
    
    # 2. Behavioral Features
    # ----------------------
    
    # Since TwiBot-20 tweets in this JSON don't have timestamps, we estimate
    # based on global patterns or use defaults.
    
    # Message analysis
    urls_count = sum(1 for t in tweets if 'http' in t) if tweets else 0
    
    behavioral_data = BehavioralTelemetry(
        actions_per_minute=statuses / (account_age_days * 24 * 60 + 1), # Lifetime avg
        inter_action_time_mean=0.0, # Cannot calculate without timestamps
        inter_action_time_std=0.0,
        circadian_activity_distribution=[1.0/24] * 24, # Uniform default
        message_similarity_index=_calculate_text_similarity(tweets) if tweets else 0.0,
        follow_velocity=following / (account_age_days + 1),
        unfollow_velocity=0.0, # Not available
        session_duration_mean=0.0, # Not available
        session_duration_std=0.0,
        click_sequence_entropy=0.0, # Not web logs
        url_post_ratio=_safe_ratio(urls_count, len(tweets)) if tweets else 0.0,
        device_change_frequency=0.0
    )
    
    # 3. Network Features
    # -------------------
    neighbor_following = neighbor.get('following', []) if neighbor else []
    neighbor_follower = neighbor.get('follower', []) if neighbor else []
    
    # Convert to sets for intersection (IDs are strings in JSON)
    following_set = set(neighbor_following)
    follower_set = set(neighbor_follower)
    
    mutual = len(following_set.intersection(follower_set))
    total_distinct = len(following_set.union(follower_set))
    
    network_data = NetworkData(
        mutual_connection_ratio=_safe_ratio(mutual, total_distinct),
        clustering_coefficient=0.0, # Need full graph
        pagerank_score=0.0, # Need full graph
        community_suspicion_index=0.0, # Need external labels
        edge_creation_velocity=(len(following_set) + len(follower_set)) / (account_age_days + 1)
    )
    
    return AccountData(
        account_id=entry.get('ID', 'unknown'),
        username=username,
        behavioral=behavioral_data,
        profile=profile_data,
        network=network_data
    )

def _safe_ratio(num: float, den: float) -> float:
    if den == 0:
        return 0.0
    return num / den

def _calculate_entropy(text: str) -> float:
    """Shannon entropy of character distribution"""
    if not text:
        return 0.0
    prob = [float(text.count(c)) / len(text) for c in set(text)]
    return -sum(p * math.log(p) / math.log(2.0) for p in prob)

def _calculate_completeness(profile: Dict) -> float:
    fields = ['location', 'description', 'url']
    present = sum(1 for f in fields if profile.get(f) and profile.get(f).strip() not in ['None', ''])
    return present / len(fields)

def _calculate_text_similarity(texts: List[str]) -> float:
    """
    Estimate message similarity.
    For efficiency in loading loop, we use a simple distinct words ratio 
    instead of full TF-IDF/Cosine for now.
    
    Similarity = 1 - (Unique Words / Total Words)
    High similarity (1.0) means same words repeated.
    Low similarity (0.0) means diverse vocabulary.
    """
    if not texts or len(texts) < 2:
        return 0.0
        
    all_words = []
    for t in texts:
        # Simple tokenization
        words = re.findall(r'\w+', t.lower())
        all_words.extend(words)
        
    if not all_words:
        return 0.0
        
    unique_count = len(set(all_words))
    total_count = len(all_words)
    
    # Diversity ratio: higher is more diverse
    diversity = unique_count / total_count
    
    # Similarity is inverse of diversity
    return 1.0 - diversity

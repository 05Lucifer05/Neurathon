"""
Determinism Validation Tests

Tests to ensure the prediction pipeline produces identical results 
for identical inputs, regardless of batch composition or ordering.
"""
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.api.predict import PredictRequest, extract_features_vectorized, predict_batch, BatchPredictRequest
import numpy as np


def create_test_account(account_id: str) -> PredictRequest:
    """Create a test account with deterministic values"""
    return PredictRequest(
        account_id=account_id,
        username=f"user_{account_id}",
        actions_per_minute=15.0,
        inter_action_time_mean=120.0,
        inter_action_time_std=30.0,
        message_similarity_index=0.65,
        follow_velocity=100.0,
        unfollow_velocity=50.0,
        url_post_ratio=0.3,
        device_change_frequency=2.0,
        account_age_days=180,
        follower_count=500,
        following_count=600,
        profile_completeness_index=0.7,
        profile_image_presence=True,
        bio_length=80,
        mutual_connection_ratio=0.4,
        clustering_coefficient=0.25,
        pagerank_score=0.001,
        edge_creation_velocity=20.0
    )


def test_single_account_determinism():
    """Test that same account produces identical results across 100 runs"""
    print("Test 1: Single Account Determinism (100 iterations)")
    print("=" * 60)
    
    account = create_test_account("test_001")
    
    # Extract features 100 times
    results = []
    for i in range(100):
        features = extract_features_vectorized([account])
        results.append(features[0])
    
    # Check all results are identical
    first_result = results[0]
    all_identical = all(np.allclose(r, first_result, atol=1e-10) for r in results)
    
    if all_identical:
        print("[PASS] All 100 iterations produced identical features")
        print(f"   Sample features (first 5): {first_result[:5]}")
    else:
        print("[FAIL] Features vary across iterations")
        # Find first difference
        for i, r in enumerate(results[1:], 1):
            if not np.allclose(r, first_result, atol=1e-10):
                print(f"   Iteration {i} differs from iteration 0")
                diff = np.abs(r - first_result)
                max_diff_idx = np.argmax(diff)
                print(f"   Max difference: {diff[max_diff_idx]} at index {max_diff_idx}")
                break
    
    print()
    return all_identical


def test_batch_order_invariance():
    """Test that different ordering produces same results"""
    print("Test 2: Batch Order Invariance")
    print("=" * 60)
    
    # Create 5 accounts
    accounts = [create_test_account(f"test_{i:03d}") for i in range(5)]
    
    # Process in original order
    features_123 = extract_features_vectorized(accounts)
    
    # Process in reverse order
    accounts_reversed = list(reversed(accounts))
    features_321 = extract_features_vectorized(accounts_reversed)
    
    # After sorting by account_id in predict.py, results should match
    # (features_123[i] should match features_321[4-i])
    matches = []
    for i in range(len(accounts)):
        reverse_idx = len(accounts) - 1 - i
        match = np.allclose(features_123[i], features_321[reverse_idx], atol=1e-10)
        matches.append(match)
        if not match:
            print(f"❌ Account {i} doesn't match reverse position {reverse_idx}")
    
    all_match = all(matches)
    
    if all_match:
        print("[PASS] Features match regardless of input order")
    else:
        print("[FAIL] Features depend on input order")
    
    print()
    return all_match


def test_batch_composition_independence():
    """Test that batch composition doesn't affect individual scores"""
    print("Test 3: Batch Composition Independence")
    print("=" * 60)
    
    # Create accounts
    acc1 = create_test_account("test_001")
    acc2 = create_test_account("test_002")
    acc3 = create_test_account("test_003")
    
    # Process solo
    features_solo = extract_features_vectorized([acc1])
    
    # Process in small batch
    features_small = extract_features_vectorized([acc1, acc2])
    
    # Process in larger batch
    features_large = extract_features_vectorized([acc1, acc2, acc3])
    
    # acc1's features should be identical in all cases
    solo_match_small = np.allclose(features_solo[0], features_small[0], atol=1e-10)
    solo_match_large = np.allclose(features_solo[0], features_large[0], atol=1e-10)
    
    if solo_match_small and solo_match_large:
        print("[PASS] Account features independent of batch composition")
        print(f"   Solo features (first 5): {features_solo[0][:5]}")
        print(f"   Small batch (first 5):   {features_small[0][:5]}")
        print(f"   Large batch (first 5):   {features_large[0][:5]}")
    else:
        print("[FAIL] Batch composition affects individual features")
        if not solo_match_small:
            print("   Solo vs Small batch differ")
            diff = np.abs(features_solo[0] - features_small[0])
            print(f"   Max diff: {np.max(diff)}")
        if not solo_match_large:
            print("   Solo vs Large batch differ")
            diff = np.abs(features_solo[0] - features_large[0])
            print(f"   Max diff: {np.max(diff)}")
    
    print()
    return solo_match_small and solo_match_large


def test_feature_value_ranges():
    """Test that all features are normalized to 0-1 range"""
    print("Test 4: Feature Normalization Range")
    print("=" * 60)
    
    # Create account with extreme values
    extreme_account = PredictRequest(
        account_id="extreme_001",
        username="extreme_user",
        actions_per_minute=9999.0,  # Extreme
        inter_action_time_mean=10000.0,  # Extreme
        inter_action_time_std=5000.0,
        message_similarity_index=1.0,
        follow_velocity=10000.0,
        unfollow_velocity=10000.0,
        url_post_ratio=1.0,
        device_change_frequency=100.0,
        account_age_days=10000,
        follower_count=1000000,
        following_count=1,
        profile_completeness_index=1.0,
        profile_image_presence=True,
        bio_length=500,
        mutual_connection_ratio=1.0,
        clustering_coefficient=1.0,
        pagerank_score=1.0,
        edge_creation_velocity=1000.0
    )
    
    features = extract_features_vectorized([extreme_account])
    
    # Check all features are in [0, 1]
    in_range = np.all((features >= 0) & (features <= 1))
    
    if in_range:
        print("[PASS] All features normalized to [0, 1] range")
        print(f"   Min feature value: {np.min(features):.6f}")
        print(f"   Max feature value: {np.max(features):.6f}")
    else:
        print("[FAIL] Some features outside [0, 1] range")
        out_of_range = (features < 0) | (features > 1)
        print(f"   Out of range indices: {np.where(out_of_range)}")
        print(f"   Out of range values: {features[out_of_range]}")
    
    print()
    return in_range


def run_all_tests():
    """Run all determinism tests"""
    print("\n" + "=" * 60)
    print("DETERMINISM VALIDATION TEST SUITE")
    print("=" * 60 + "\n")
    
    results = {
        "single_account_determinism": test_single_account_determinism(),
        "batch_order_invariance": test_batch_order_invariance(),
        "batch_composition_independence": test_batch_composition_independence(),
        "feature_normalization": test_feature_value_ranges()
    }
    
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status}: {test_name}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n*** ALL TESTS PASSED - Pipeline is deterministic! ***")
    else:
        print("\n*** SOME TESTS FAILED - Pipeline has non-deterministic behavior ***")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

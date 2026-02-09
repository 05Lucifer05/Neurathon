"""
Environment-based configuration for ML Service
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Logging
    log_level: str = "INFO"
    
    # Model paths
    model_path: str = "./models"
    rf_model_file: str = "random_forest.joblib"
    if_model_file: str = "isolation_forest.joblib"
    
    # Dataset
    twibot_dataset_path: str = "data/twibot20.json"
    
    # Ensemble weights
    rf_weight: float = 0.6
    if_weight: float = 0.4
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    
    # API
    api_version: str = "v1"
    api_prefix: str = "/api/v1"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()

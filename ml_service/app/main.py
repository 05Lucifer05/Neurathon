"""
FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.api.routes import router
from app.utils.logging import setup_logging
from app.models.ml_models import ModelManager


# Setup logging
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events"""
    # Startup
    logger.info("Starting ML Service...")
    
    # Load ML models
    model_manager = ModelManager()
    model_manager.load_models()
    app.state.model_manager = model_manager
    
    logger.info("ML Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service...")


# Create FastAPI application
app = FastAPI(
    title="Fraud Detection ML Service",
    description="AI-powered social media fraud detection using behavioral analysis and network signals",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix=settings.api_prefix)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Fraud Detection ML Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

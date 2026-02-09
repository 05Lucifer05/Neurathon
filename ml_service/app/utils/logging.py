"""
Logging Configuration

Sets up structured JSON logging for production environments.
"""
import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        return json.dumps(log_entry)


class StandardFormatter(logging.Formatter):
    """Standard formatter for development"""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


def setup_logging(log_level: str = "INFO", json_format: bool = False):
    """
    Configure application logging.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON format for production
    """
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    
    # Set formatter
    if json_format:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(StandardFormatter())
    
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    
    logging.info(f"Logging configured: level={log_level}, json={json_format}")


class LoggerAdapter(logging.LoggerAdapter):
    """Custom logger adapter for adding context to log messages"""
    
    def process(self, msg: str, kwargs: Dict) -> tuple:
        extra = kwargs.get('extra', {})
        extra['extra_fields'] = self.extra
        kwargs['extra'] = extra
        return msg, kwargs


def get_logger(name: str, **context) -> LoggerAdapter:
    """
    Get a logger with additional context.
    
    Args:
        name: Logger name
        **context: Additional context to include in all log messages
        
    Returns:
        LoggerAdapter with context
    """
    logger = logging.getLogger(name)
    return LoggerAdapter(logger, context)

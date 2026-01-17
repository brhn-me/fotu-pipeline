import logging
import json
import os
import sys
from datetime import datetime

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "service": record.name,
            "file_id": getattr(record, "file_id", None)
        }
        # Merge extra fields
        if hasattr(record, "extra_kvs"):
            log_record.update(record.extra_kvs)
            
        return json.dumps(log_record)

def get_logger(service_name):
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    
    # Check if handler exists
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        
    return LoggerAdapter(logger, {})

class LoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        # Extract file_id if present
        extra = kwargs.get("extra", {})
        if "file_id" in kwargs:
             extra["file_id"] = kwargs.pop("file_id")
        
        # Add other kwargs as extra fields
        # Identify non-reserved keys that should be moved to extra
        reserved = {'extra', 'exc_info', 'stack_info', 'stacklevel'}
        custom_keys = [k for k in kwargs.keys() if k not in reserved]
        
        extra_kvs = {}
        # Move custom fields to extra_kvs and REMOVE from kwargs to avoid TypeError in logger
        for k in custom_keys:
            extra_kvs[k] = kwargs.pop(k)
            
        # Also include existing extra fields
        extra_kvs.update(extra)
        
        extra["extra_kvs"] = extra_kvs
        
        # Ensure extra is updated in kwargs
        kwargs["extra"] = extra
        
        return msg, kwargs

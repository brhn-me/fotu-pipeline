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
        extra["extra_kvs"] = kwargs
        
        return msg, {"extra": extra}

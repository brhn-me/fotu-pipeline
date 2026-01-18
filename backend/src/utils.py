import os
import uuid
from typing import Union

def get_trie_path(uuid_input: Union[str, uuid.UUID]) -> str:
    """
    Returns a 2-layer trie path based on the UUID/ID.
    Format: ab/cd/{uuid_hex}
    
    Validates that the input is a valid UUID to ensure length safety.
    """
    if isinstance(uuid_input, str):
        # Validate/clean
        u = uuid.UUID(uuid_input)
    else:
        u = uuid_input
        
    # Use hex to normalize (no dashes) and ensure consistency
    s = u.hex 
    l1 = s[:2]
    l2 = s[2:4]
    return os.path.join(l1, l2, s)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple test for Qdrant and OpenAI connections
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

QDRANT_URL = os.getenv('QDRANT_URL')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

def test_qdrant():
    """Test Qdrant connection"""
    try:
        from qdrant_client import QdrantClient
        print("Qdrant client library imported successfully")
        
        client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY
        )
        
        print("Connecting to Qdrant...")
        collections = client.get_collections()
        
        print(f"SUCCESS: Connected to Qdrant")
        print(f"Collections found: {len(collections.collections)}")
        
        if collections.collections:
            print("Existing collections:")
            for collection in collections.collections:
                print(f"  - {collection.name}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: Qdrant connection failed: {e}")
        return False

def test_openai():
    """Test OpenAI connection"""
    try:
        import openai
        print("OpenAI library imported successfully")
        
        if not OPENAI_API_KEY:
            print("ERROR: No OpenAI API key found")
            return False
        
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        print("Testing OpenAI API...")
        response = client.embeddings.create(
            input="test message",
            model="text-embedding-3-small"
        )
        
        print(f"SUCCESS: OpenAI API working")
        print(f"Embedding dimensions: {len(response.data[0].embedding)}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: OpenAI API failed: {e}")
        return False

def main():
    """Main test function"""
    print("=" * 50)
    print("TESTING CONNECTIONS")
    print("=" * 50)
    
    # Test Qdrant
    print("\n1. Testing Qdrant...")
    qdrant_ok = test_qdrant()
    
    # Test OpenAI
    print("\n2. Testing OpenAI...")
    openai_ok = test_openai()
    
    # Results
    print("\n" + "=" * 50)
    print("TEST RESULTS:")
    print(f"Qdrant:  {'SUCCESS' if qdrant_ok else 'FAILED'}")
    print(f"OpenAI:  {'SUCCESS' if openai_ok else 'FAILED'}")
    
    if qdrant_ok and openai_ok:
        print("\nAll systems ready for bulk upload!")
        return True
    else:
        print("\nPlease fix connection issues before proceeding")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
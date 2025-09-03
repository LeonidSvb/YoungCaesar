#!/usr/bin/env python3
"""
Bulk upload VAPI calls to Qdrant with OpenAI embeddings
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Any
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from .env
QDRANT_URL = os.getenv('QDRANT_URL')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_EMBEDDING_MODEL = os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')
COLLECTION_NAME = os.getenv('DB_COLLECTION_TRANSCRIPTS', 'vapi_transcripts')
MIN_CALL_DURATION = int(os.getenv('MIN_CALL_DURATION', 30))
MIN_CALL_COST = float(os.getenv('MIN_CALL_COST', 0.02))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VapiBulkUploader:
    def __init__(self):
        """Initialize with OpenAI and Qdrant"""
        logger.info("Initializing bulk uploader...")
        
        # OpenAI client
        try:
            import openai
            self.openai_client = openai
            self.openai_client.api_key = OPENAI_API_KEY
            logger.info("OpenAI API connected")
        except Exception as e:
            logger.error(f"OpenAI connection error: {e}")
            raise
        
        # Qdrant client
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import PointStruct, Distance, VectorParams
            
            self.qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
            self.PointStruct = PointStruct
            self.Distance = Distance  
            self.VectorParams = VectorParams
            
            logger.info("Qdrant connected")
        except Exception as e:
            logger.error(f"Qdrant connection error: {e}")
            raise

    def create_embedding(self, text: str) -> List[float]:
        """Create embedding via OpenAI API"""
        try:
            response = self.openai_client.embeddings.create(
                input=text,
                model=OPENAI_EMBEDDING_MODEL
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding creation error: {e}")
            raise

    def create_collection_if_not_exists(self):
        """Create collection (idempotent operation)"""
        try:
            # Check if collection exists
            try:
                collection_info = self.qdrant_client.get_collection(COLLECTION_NAME)
                logger.info(f"Collection '{COLLECTION_NAME}' already exists")
                return True
            except:
                # Collection doesn't exist - create it
                logger.info(f"Creating collection '{COLLECTION_NAME}'...")
                
                # Determine vector size by model
                vector_sizes = {
                    "text-embedding-3-small": 1536,
                    "text-embedding-3-large": 3072, 
                    "text-embedding-ada-002": 1536
                }
                vector_size = vector_sizes.get(OPENAI_EMBEDDING_MODEL, 1536)
                
                self.qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=self.VectorParams(
                        size=vector_size,
                        distance=self.Distance.COSINE
                    )
                )
                
                logger.info(f"Collection created. Vector size: {vector_size}")
                return True
                
        except Exception as e:
            logger.error(f"Collection error: {e}")
            return False

    def load_calls_data(self) -> List[Dict[str, Any]]:
        """Load calls data"""
        data_file = "data/raw/vapi_raw_calls_2025-09-03.json"
        
        if not os.path.exists(data_file):
            logger.error(f"File {data_file} not found")
            return []
        
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            # Extract all calls
            all_calls = []
            for date_entry in raw_data:
                if 'calls' in date_entry and date_entry['calls']:
                    all_calls.extend(date_entry['calls'])
            
            # Filter by quality criteria
            quality_calls = []
            for call in all_calls:
                transcript = call.get('transcript', '').strip()
                cost = call.get('cost', 0) or 0
                
                # Calculate duration from time difference if duration not provided
                duration = call.get('duration', 0)
                if not duration and call.get('startedAt') and call.get('endedAt'):
                    try:
                        from datetime import datetime
                        started = datetime.fromisoformat(call['startedAt'].replace('Z', '+00:00'))
                        ended = datetime.fromisoformat(call['endedAt'].replace('Z', '+00:00'))
                        duration = (ended - started).total_seconds()
                    except:
                        duration = 0
                
                # Only calls with transcript - relaxed criteria for first upload
                if (transcript and 
                    len(transcript) >= 20 and  # minimum 20 characters (relaxed)
                    cost >= 0.01):  # minimum cost 0.01 (relaxed)
                    quality_calls.append(call)
            
            logger.info(f"Loaded {len(all_calls)} calls, filtered {len(quality_calls)} quality calls")
            return quality_calls
            
        except Exception as e:
            logger.error(f"Data loading error: {e}")
            return []

    def check_existing_calls(self, calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Check existing calls in Qdrant (avoid duplicates)"""
        try:
            # Get all existing IDs
            existing_points = self.qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                limit=10000,  # maximum for check
                with_payload=False,
                with_vectors=False
            )
            
            existing_ids = {point.id for point in existing_points[0]}
            logger.info(f"Found {len(existing_ids)} existing records")
            
            # Filter new calls
            new_calls = [call for call in calls if call.get('id') not in existing_ids]
            
            logger.info(f"To upload: {len(new_calls)} new calls (skipped {len(calls) - len(new_calls)} duplicates)")
            return new_calls
            
        except Exception as e:
            logger.warning(f"Could not check duplicates: {e}")
            return calls  # Upload all if check failed

    def process_calls_to_points(self, calls: List[Dict[str, Any]]) -> List:
        """Process calls to points for Qdrant"""
        points = []
        processed = 0
        failed = 0
        
        total = len(calls)
        logger.info(f"Processing {total} calls with OpenAI embeddings...")
        
        for i, call in enumerate(calls):
            try:
                # Prepare text for embedding
                transcript = call.get('transcript', '').strip()
                summary = call.get('summary', '').strip()
                
                # Combine transcript and summary for better context
                embedding_text = transcript
                if summary and summary not in transcript:
                    embedding_text += f"\n\nSummary: {summary}"
                
                # Create embedding via OpenAI
                logger.info(f"Creating embedding {i+1}/{total} (ID: {call.get('id', 'unknown')[:8]}...)")
                vector = self.create_embedding(embedding_text)
                
                # Prepare metadata (compatible with N8N structure)
                payload = {
                    # Main fields
                    "call_id": call.get('id', ''),
                    "transcript": transcript,
                    "summary": summary,
                    "duration": call.get('duration', 0) or 0,
                    "cost": call.get('cost', 0) or 0,
                    
                    # Status and results
                    "status": call.get('status', 'unknown'),
                    "ended_reason": call.get('endedReason', 'unknown'),
                    "recording_url": call.get('recordingUrl', ''),
                    
                    # Timestamps
                    "created_at": call.get('createdAt', ''),
                    "started_at": call.get('startedAt', ''),
                    "ended_at": call.get('endedAt', ''),
                    
                    # Identifiers
                    "assistant_id": call.get('assistantId', ''),
                    "customer_id": call.get('customerId', ''),
                    "phone_number_id": call.get('phoneNumberId', ''),
                    "org_id": call.get('orgId', ''),
                    
                    # Metadata for analysis
                    "type": call.get('type', 'unknown'),
                    "transcript_length": len(transcript),
                    "has_summary": bool(summary),
                    
                    # Technical information
                    "embedding_model": OPENAI_EMBEDDING_MODEL,
                    "upload_type": "bulk",
                    "upload_timestamp": datetime.utcnow().isoformat(),
                    "vector_dimensions": len(vector)
                }
                
                # Create point
                point = self.PointStruct(
                    id=call.get('id', f"bulk_call_{i}"),
                    vector=vector,
                    payload=payload
                )
                
                points.append(point)
                processed += 1
                
                # Progress every 10 calls
                if processed % 10 == 0:
                    logger.info(f"Processed {processed}/{total} calls...")
                    
            except Exception as e:
                failed += 1
                logger.error(f"Error processing call {i}: {e}")
                continue
        
        logger.info(f"Total: {processed} successful, {failed} errors")
        return points

    def upload_points_to_qdrant(self, points: List) -> bool:
        """Upload points to Qdrant in batches"""
        if not points:
            logger.warning("No points to upload")
            return False
        
        try:
            batch_size = 25  # Small batches for stability with OpenAI
            total_batches = (len(points) + batch_size - 1) // batch_size
            
            logger.info(f"Uploading {len(points)} points in {total_batches} batches...")
            
            uploaded = 0
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]
                batch_num = i // batch_size + 1
                
                try:
                    logger.info(f"Uploading batch {batch_num}/{total_batches} ({len(batch)} points)...")
                    
                    operation_info = self.qdrant_client.upsert(
                        collection_name=COLLECTION_NAME,
                        wait=True,
                        points=batch
                    )
                    
                    uploaded += len(batch)
                    logger.info(f"Batch {batch_num} uploaded successfully")
                    
                except Exception as e:
                    logger.error(f"Error uploading batch {batch_num}: {e}")
                    continue
            
            logger.info(f"Uploaded {uploaded}/{len(points)} points to collection '{COLLECTION_NAME}'")
            return uploaded > 0
            
        except Exception as e:
            logger.error(f"Critical upload error: {e}")
            return False

    def get_collection_stats(self):
        """Get collection statistics"""
        try:
            collection_info = self.qdrant_client.get_collection(COLLECTION_NAME)
            
            # Statistics by upload type
            bulk_count = self.qdrant_client.count(
                collection_name=COLLECTION_NAME,
                count_filter={"must": [{"key": "upload_type", "match": {"value": "bulk"}}]}
            )
            
            auto_count = self.qdrant_client.count(
                collection_name=COLLECTION_NAME,
                count_filter={"must": [{"key": "upload_type", "match": {"value": "auto"}}]}
            )
            
            logger.info("COLLECTION STATISTICS:")
            logger.info(f"   Total vectors: {collection_info.points_count}")
            logger.info(f"   Bulk upload: {bulk_count.count}")
            logger.info(f"   Auto upload N8N: {auto_count.count}")
            logger.info(f"   Status: {collection_info.status}")
            
            return collection_info
            
        except Exception as e:
            logger.error(f"Statistics error: {e}")
            return None

def main():
    """Main bulk upload function"""
    print("BULK UPLOAD VAPI CALLS TO QDRANT")
    print("=" * 60)
    print("Uses OpenAI embeddings")
    print("Compatible with N8N automation")
    print("Prevents duplicates")
    print("=" * 60)
    
    uploader = VapiBulkUploader()
    
    # 1. Create collection
    if not uploader.create_collection_if_not_exists():
        logger.error("Could not create collection")
        return
    
    # 2. Load calls
    calls = uploader.load_calls_data()
    if not calls:
        logger.error("No data to upload")
        return
    
    # 3. Check duplicates
    new_calls = uploader.check_existing_calls(calls)
    if not new_calls:
        logger.info("All calls already uploaded, no duplicates")
        uploader.get_collection_stats()
        return
    
    # 4. Confirmation (considering OpenAI cost)
    estimated_tokens = sum(len(call.get('transcript', '')) for call in new_calls) // 4
    estimated_cost = (estimated_tokens / 1000) * 0.00002  # for text-embedding-3-small
    
    print(f"\nTo upload:")
    print(f"   Calls: {len(new_calls)}")
    print(f"   Estimated OpenAI cost: ${estimated_cost:.4f}")
    
    confirm = input("\nContinue? (y/N): ").strip().lower()
    if confirm != 'y':
        print("Upload cancelled")
        return
    
    # 5. Create embeddings and upload
    points = uploader.process_calls_to_points(new_calls)
    if not points:
        logger.error("Could not create points")
        return
    
    # 6. Upload to Qdrant
    if uploader.upload_points_to_qdrant(points):
        print("\nBULK UPLOAD COMPLETED SUCCESSFULLY!")
        uploader.get_collection_stats()
        
        print("\nNEXT STEPS:")
        print("1. Setup N8N webhook for automatic updates")
        print("2. Use collection to search similar calls")
        print("3. Analyze successful conversation patterns")
        
    else:
        logger.error("Bulk upload failed")

if __name__ == "__main__":
    main()
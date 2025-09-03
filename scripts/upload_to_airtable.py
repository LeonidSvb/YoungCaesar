#!/usr/bin/env python3
"""
Upload VAPI calls from Qdrant to Airtable for client access
"""
import os
import requests
import json
from typing import List, Dict
from dotenv import load_dotenv
from datetime import datetime

# Load environment
load_dotenv()

# Configuration - UPDATE THESE VALUES
AIRTABLE_TOKEN = "YOUR_AIRTABLE_PERSONAL_ACCESS_TOKEN"
BASE_ID = "YOUR_BASE_ID"  # From the base URL: https://airtable.com/appXXXXXXXXXX/
TABLE_NAME = "VAPI_Calls"

# Qdrant config
QDRANT_URL = os.getenv('QDRANT_URL')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')
QDRANT_COLLECTION = "vapi_transcripts"

class AirtableUploader:
    def __init__(self):
        """Initialize Airtable uploader"""
        if AIRTABLE_TOKEN == "YOUR_AIRTABLE_PERSONAL_ACCESS_TOKEN":
            raise ValueError("Please set your Airtable Personal Access Token")
        if BASE_ID == "YOUR_BASE_ID":
            raise ValueError("Please set your Airtable Base ID")
            
        self.headers = {
            "Authorization": f"Bearer {AIRTABLE_TOKEN}",
            "Content-Type": "application/json"
        }
        self.base_url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"
        
        # Initialize Qdrant
        try:
            from qdrant_client import QdrantClient
            self.qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
            print("✅ Connected to Qdrant")
        except Exception as e:
            raise Exception(f"Failed to connect to Qdrant: {e}")
    
    def get_calls_from_qdrant(self) -> List[Dict]:
        """Retrieve all calls from Qdrant"""
        try:
            print("🔄 Fetching calls from Qdrant...")
            
            # Get all points from collection
            points, _ = self.qdrant.scroll(
                collection_name=QDRANT_COLLECTION,
                limit=1000,  # Should be enough for 781 calls
                with_payload=True,
                with_vectors=False
            )
            
            print(f"✅ Retrieved {len(points)} calls from Qdrant")
            return points
            
        except Exception as e:
            raise Exception(f"Failed to retrieve calls from Qdrant: {e}")
    
    def transform_for_airtable(self, points: List) -> List[Dict]:
        """Transform Qdrant data for Airtable format"""
        airtable_records = []
        
        print("🔄 Transforming data for Airtable...")
        
        for point in points:
            payload = point.payload
            
            # Parse created_at date
            created_date = None
            if payload.get("created_at"):
                try:
                    dt = datetime.fromisoformat(payload["created_at"].replace('Z', '+00:00'))
                    created_date = dt.strftime('%Y-%m-%d')
                except:
                    pass
            
            # Truncate long fields for Airtable limits
            transcript = payload.get("transcript", "")
            if len(transcript) > 100000:
                transcript = transcript[:99950] + "... (truncated)"
            
            summary = payload.get("summary", "")
            if len(summary) > 50000:
                summary = summary[:49950] + "... (truncated)"
            
            # Calculate success score based on duration and cost
            duration = payload.get("duration", 0) or 0
            cost = payload.get("cost", 0) or 0
            success_score = min(100, max(0, int(duration * 2 + cost * 100)))  # Simple scoring
            
            airtable_record = {
                "fields": {
                    "call_id": payload.get("call_id", "")[:50],  # Truncate if too long
                    "transcript": transcript,
                    "summary": summary,
                    "duration": int(duration),
                    "cost": float(cost),
                    "status": payload.get("status", "unknown"),
                    "ended_reason": payload.get("ended_reason", "unknown"),
                    "created_at": created_date,
                    "assistant_id": payload.get("assistant_id", "")[:50],
                    "customer_id": payload.get("customer_id", "")[:50],
                    "success_score": success_score,
                    "transcript_length": payload.get("transcript_length", len(transcript)),
                    "recording_url": payload.get("recording_url", ""),
                    "upload_source": payload.get("upload_type", "bulk")
                }
            }
            
            # Remove empty fields to avoid Airtable issues
            airtable_record["fields"] = {
                k: v for k, v in airtable_record["fields"].items() 
                if v not in [None, "", 0] or k in ["duration", "cost", "success_score"]
            }
            
            airtable_records.append(airtable_record)
        
        print(f"✅ Transformed {len(airtable_records)} records")
        return airtable_records
    
    def upload_to_airtable(self, records: List[Dict]) -> bool:
        """Upload records to Airtable in batches"""
        batch_size = 10  # Airtable limit
        total_batches = (len(records) + batch_size - 1) // batch_size
        
        print(f"🚀 Uploading {len(records)} records to Airtable in {total_batches} batches...")
        
        uploaded_count = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            batch_num = i // batch_size + 1
            
            try:
                response = requests.post(
                    self.base_url,
                    headers=self.headers,
                    json={"records": batch}
                )
                
                if response.status_code == 200:
                    uploaded_count += len(batch)
                    print(f"✅ Batch {batch_num}/{total_batches} uploaded ({len(batch)} records)")
                else:
                    print(f"❌ Batch {batch_num} failed: {response.status_code}")
                    print(f"   Error: {response.text[:200]}")
                    
                    # Try to continue with next batch
                    continue
                    
            except Exception as e:
                print(f"❌ Exception in batch {batch_num}: {e}")
                continue
        
        print(f"🎉 Upload complete! {uploaded_count}/{len(records)} records uploaded")
        return uploaded_count == len(records)
    
    def test_connection(self) -> bool:
        """Test Airtable connection"""
        try:
            response = requests.get(
                f"{self.base_url}?maxRecords=1",
                headers=self.headers
            )
            
            if response.status_code == 200:
                print("✅ Airtable connection successful")
                return True
            else:
                print(f"❌ Airtable connection failed: {response.status_code}")
                print(f"   Error: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Airtable connection error: {e}")
            return False

def main():
    """Main upload process"""
    print("=" * 60)
    print("VAPI CALLS → AIRTABLE MIGRATION")
    print("=" * 60)
    
    try:
        uploader = AirtableUploader()
        
        # 1. Test Airtable connection
        print("\n1. Testing Airtable connection...")
        if not uploader.test_connection():
            print("❌ Cannot proceed without Airtable connection")
            return
        
        # 2. Get data from Qdrant
        print("\n2. Retrieving data from Qdrant...")
        points = uploader.get_calls_from_qdrant()
        
        if not points:
            print("❌ No data retrieved from Qdrant")
            return
        
        # 3. Transform data
        print("\n3. Transforming data...")
        airtable_records = uploader.transform_for_airtable(points)
        
        # 4. Confirm upload
        print(f"\n4. Ready to upload {len(airtable_records)} records to Airtable")
        print("   This will add them to your VAPI_Calls table")
        
        confirm = input("\n   Continue? (y/N): ").strip().lower()
        if confirm != 'y':
            print("❌ Upload cancelled")
            return
        
        # 5. Upload to Airtable
        print("\n5. Uploading to Airtable...")
        success = uploader.upload_to_airtable(airtable_records)
        
        if success:
            print("\n🎉 MIGRATION SUCCESSFUL!")
            print("   Your client can now access the data in Airtable")
            print(f"   Base URL: https://airtable.com/{BASE_ID}")
        else:
            print("\n⚠️ Migration partially completed")
            print("   Check the logs above for any failed batches")
    
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("   Please check your configuration and try again")

if __name__ == "__main__":
    main()
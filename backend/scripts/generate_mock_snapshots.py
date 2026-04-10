import sys
import os
import random
import datetime

# Setup path to import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.firestore_service import get_db
from firebase_admin import firestore

db = get_db()

def generate_mock_snapshots(user_type="local", user_id="admin"):
    col_path = f"{user_type}_users"
    print(f"Generating for {col_path} -> {user_id}")
    
    docs = db.collection(col_path).document(user_id).collection('dailySnapshots')\
             .order_by("date", direction=firestore.Query.DESCENDING).limit(1).stream()
             
    latest = None
    for d in docs:
        latest = d.to_dict()
    
    if not latest:
        print("No snapshots found for", user_id)
        return
        
    date_format = "%Y-%m-%d"
    today = datetime.datetime.now()
    
    batch = db.batch()
    
    current_val = float(latest.get("portfolioValue", 100000000))
    current_net = float(latest.get("netWorth", 100000000))
    current_cost = float(latest.get("portfolioCost", 80000000))
    
    count = 0
    for i in range(1, 365):
        target_date = today - datetime.timedelta(days=i)
        dt_str = target_date.strftime(date_format)
        
        # Simulate back in time: today's price = prev_price * (1 + ret) => prev_price = today_price / (1 + ret)
        # We will make random returns slightly positive meaning going back in time it decreases.
        daily_ret = random.uniform(-0.015, 0.018)
        current_val = current_val / (1 + daily_ret)
        current_net = current_net / (1 + daily_ret)
        current_cost = current_cost * random.uniform(0.998, 1.0) # Cost decreases slightly backwards
        
        snap = latest.copy()
        snap['date'] = dt_str
        snap['portfolioValue'] = max(current_val, 0)
        snap['netWorth'] = max(current_net, 0)
        snap['portfolioCost'] = max(current_cost, 0)
        snap['portfolioPnL'] = snap['portfolioValue'] - snap['portfolioCost']
            
        doc_ref = db.collection(col_path).document(user_id).collection('dailySnapshots').document(dt_str)
        batch.set(doc_ref, snap)
        count += 1
        
        if count % 100 == 0:
            batch.commit()
            print(f"Committed {count} records...")
            
    batch.commit()
    print("✅ Done generating 365 days of mock data for user:", user_id)

if __name__ == "__main__":
    generate_mock_snapshots("local", "admin")
    generate_mock_snapshots("firebase", "admin")

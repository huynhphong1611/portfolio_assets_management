import sys
import os
import random
import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.firestore_service import get_db

db = get_db()
today = datetime.datetime.now()

def seed_admin_snapshots():
    # 1. Get admin user id
    users_query = list(db.collection('users').where('username', '==', 'admin').limit(1).stream())
    if not users_query:
        print("No admin user found in 'users' collection")
        return
    user_id = users_query[0].id
    col_path = "guest_users"
    
    print(f"Generating for {col_path}/{user_id}/dailySnapshots")
    
    batch = db.batch()
    
    current_val = 250000000.0
    current_net = 230000000.0
    current_cost = 200000000.0
    
    count = 0
    date_format = "%Y-%m-%d"
    
    # Forward simulation: from 365 days ago up to today
    for i in range(365, -1, -1):
        target_date = today - datetime.timedelta(days=i)
        dt_str = target_date.strftime(date_format)
        
        # Simulate slight daily growth logic
        daily_ret = random.uniform(-0.015, 0.018)
        current_val = current_val * (1 + daily_ret)
        current_net = current_net * (1 + daily_ret)
        current_cost = current_cost * random.uniform(1.0, 1.002) # Cost increases slightly
        
        snap = {
            "date": dt_str,
            "portfolioValue": max(current_val, 0),
            "netWorth": max(current_net, 0),
            "portfolioCost": max(current_cost, 0),
            "portfolioPnL": current_val - current_cost
        }
            
        doc_ref = db.collection(col_path).document(user_id).collection('dailySnapshots').document(dt_str)
        batch.set(doc_ref, snap)
        count += 1
        
        if count % 100 == 0:
            batch.commit()
            print(f"Committed {count} records...")
            
    batch.commit()
    print("✅ Done generating 366 days of mock data for admin UUID:", user_id)

if __name__ == "__main__":
    seed_admin_snapshots()

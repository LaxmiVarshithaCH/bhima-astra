from app.db.session import SessionLocal
from app.db.models.worker import Worker

db = SessionLocal()

workers = db.query(Worker).limit(5).all()

for w in workers:
    print(w.worker_name)

db.close()

try:
    from app.config import settings
    print("Config loaded successfully")
    print(f"Dataset path: {settings.twibot_dataset_path}")
except Exception as e:
    print(f"Config error: {e}")

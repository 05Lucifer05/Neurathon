
import logging
from app.utils.twibot_loader import load_twibot20_dataset
from app.config import settings

logging.basicConfig(level=logging.INFO)


try:
    with open("debug.log", "w") as f:
        f.write(f"Loading from {settings.twibot_dataset_path}\n")
        accounts = load_twibot20_dataset(settings.twibot_dataset_path, limit=5)
        f.write(f"Loaded {len(accounts)} accounts\n")
        if accounts:
            f.write(accounts[0].model_dump_json(indent=2))
except Exception as e:
    with open("debug.log", "w") as f:
        f.write(f"Error: {e}\n")


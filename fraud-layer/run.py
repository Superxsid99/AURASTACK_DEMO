import uvicorn
import os


if __name__ == "__main__":
    reload_enabled = os.getenv("FRAUD_LAYER_RELOAD", "false").strip().lower() == "true"
    uvicorn.run("app.main:app", host="0.0.0.0", port=8090, reload=reload_enabled)

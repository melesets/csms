"""Run the |Adare CrewAI service."""
import uvicorn
from app.config import HOST, PORT
from app.main import app

if __name__ == '__main__':
    uvicorn.run(app, host=HOST, port=PORT)

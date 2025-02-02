from fastapi import FastAPI
from routes import game

app = FastAPI(title="My FastAPI App", version="1.0.0")

# Include the routers
app.include_router(game.router, prefix="/game", tags=["Game"])


@app.get("/")
def home():
    return {"message": "Welcome to My FastAPI App"}

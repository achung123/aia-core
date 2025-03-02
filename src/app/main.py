from fastapi import FastAPI

from .routes import game

app = FastAPI(title="All In Analytics Core Backend", version="1.0.0")

# Include the routers
app.include_router(game.router)


@app.get("/")
def home():
    return {"message": "Welcome to the All In Analytics Core Backend!"}

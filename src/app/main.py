from fastapi import FastAPI
from routes.routes import router

app = FastAPI(title="FastAPI Boilerplate")

app.include_router(router.routes.game)

@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI!"}
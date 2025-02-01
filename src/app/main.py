from fastapi import FastAPI
from routes import routes

app = FastAPI(title="FastAPI Boilerplate")

app.include_router(routes.game)


@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI!"}

from fastapi import FastAPI

from .routes import game, games, hands, images, players, upload, stats, search

app = FastAPI(title='All In Analytics Core Backend', version='1.0.0')

# Include the routers
app.include_router(game.router)
app.include_router(games.router)
app.include_router(hands.router)
app.include_router(images.router)
app.include_router(images.corrections_router)
app.include_router(players.router)
app.include_router(upload.router)
app.include_router(stats.router)
app.include_router(search.router)


@app.get('/')
def home():
    return {'message': 'Welcome to the All In Analytics Core Backend!'}

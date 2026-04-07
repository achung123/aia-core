import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import game, games, hands, images, players, upload, stats, search

app = FastAPI(title='All In Analytics Core Backend', version='1.0.0')

_raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')
_allowed_origins = [origin.strip() for origin in _raw_origins.split(',')]

if '*' in _allowed_origins:
    raise ValueError(
        "ALLOWED_ORIGINS must not contain '*' when allow_credentials=True. "
        'Specify explicit origins instead.'
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

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

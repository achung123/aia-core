"""Images router - handles image upload endpoints."""

import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.models import GameSession, ImageUpload
from app.database.session import get_db

router = APIRouter(prefix='/games', tags=['images'])

ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post('/{game_id}/hands/image', status_code=201)
async def upload_image(
    game_id: int,
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
):
    """Accept a JPEG/PNG image upload, store it, and create an ImageUpload record."""
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f'Unsupported file type: {file.content_type}. Only JPEG and PNG are accepted.',
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail='File too large. Maximum allowed size is 10 MB.',
        )

    upload_dir = os.path.join('uploads', str(game_id))
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename)

    tmp_path = os.path.join(upload_dir, f'tmp_{uuid.uuid4().hex}')
    with open(tmp_path, 'wb') as f:
        f.write(content)

    record = ImageUpload(game_id=game_id, file_path=tmp_path, status='processing')
    db.add(record)
    db.flush()  # assigns upload_id without committing

    final_name = f'{record.upload_id}_{safe_name}'
    final_path = os.path.join(upload_dir, final_name)

    try:
        os.rename(tmp_path, final_path)
    except OSError:
        os.remove(tmp_path)
        raise HTTPException(status_code=500, detail='Failed to store uploaded file')

    record.file_path = final_path
    try:
        db.commit()
    except Exception:
        os.remove(final_path)
        db.rollback()
        raise HTTPException(status_code=500, detail='Failed to save upload record')

    db.refresh(record)

    return {
        'upload_id': record.upload_id,
        'game_id': record.game_id,
        'file_path': record.file_path,
        'status': record.status,
    }

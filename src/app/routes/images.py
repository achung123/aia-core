"""Images router - handles image upload and card detection endpoints."""

import os
import uuid
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import (
    CardDetection,
    DetectionCorrection,
    GameSession,
    Hand,
    ImageUpload,
    Player,
    PlayerHand,
)
from app.database.session import get_db
from app.services.card_detector import CardDetector, MockCardDetector, YOLOCardDetector
from app.services.position_assigner import PositionAssigner
from pydantic_models.app_models import (
    ConfirmDetectionRequest,
    HandResponse,
    PlayerHandResponse,
)
from pydantic_models.card_validator import validate_no_duplicate_cards

router = APIRouter(prefix='/games', tags=['images'])

corrections_router = APIRouter(prefix='/images', tags=['images'])

ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

JPEG_MAGIC = b'\xff\xd8\xff'
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


@lru_cache(maxsize=1)
def get_card_detector() -> CardDetector:
    backend = os.environ.get('CARD_DETECTOR_BACKEND', 'mock')
    model_path = os.environ.get(
        'CARD_DETECTOR_MODEL_PATH', 'models/card_detector_v1.pt'
    )
    confidence = float(os.environ.get('CARD_DETECTOR_CONFIDENCE', '0.5'))

    if backend == 'mock':
        return MockCardDetector()
    elif backend == 'yolo':
        if not os.path.isfile(model_path):
            raise FileNotFoundError(
                f'YOLO model file not found: {model_path}. '
                f'Set CARD_DETECTOR_MODEL_PATH to a valid model file.'
            )
        return YOLOCardDetector(model_path=model_path, confidence_threshold=confidence)
    else:
        raise ValueError(
            f'Unknown CARD_DETECTOR_BACKEND: {backend!r}. Use "mock" or "yolo".'
        )


def _has_valid_image_magic(data: bytes) -> bool:
    return data[:3] == JPEG_MAGIC or data[:8] == PNG_MAGIC


def _get_image_dimensions(file_path: str) -> tuple[int, int]:
    """Read image dimensions from file. Returns (width, height) or (0, 0) on failure."""
    try:
        with Image.open(file_path) as img:
            return img.size
    except Exception:
        return (0, 0)


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

    if not _has_valid_image_magic(content):
        raise HTTPException(
            status_code=415,
            detail='File content does not match a valid JPEG or PNG image.',
        )

    upload_dir = os.path.join('uploads', str(game_id))
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename)

    tmp_path = os.path.join(upload_dir, f'tmp_{uuid.uuid4().hex}')
    with open(tmp_path, 'wb') as f:
        f.write(content)

    record = ImageUpload(game_id=game_id, file_path=tmp_path, status='processing')
    db.add(record)
    try:
        db.flush()  # assigns upload_id without committing
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        db.rollback()
        raise HTTPException(
            status_code=500, detail='Failed to flush upload record'
        ) from None

    final_name = f'{record.upload_id}_{safe_name}'
    final_path = os.path.join(upload_dir, final_name)

    try:
        os.rename(tmp_path, final_path)
    except OSError:
        os.remove(tmp_path)
        raise HTTPException(
            status_code=500, detail='Failed to store uploaded file'
        ) from None

    record.file_path = final_path
    try:
        db.commit()
    except Exception:
        try:
            os.remove(final_path)
        except OSError:
            pass
        db.rollback()
        raise HTTPException(
            status_code=500, detail='Failed to save upload record'
        ) from None

    db.refresh(record)

    return {
        'upload_id': record.upload_id,
        'game_id': record.game_id,
        'file_path': record.file_path,
        'status': record.status,
    }


@router.get('/{game_id}/hands/image/{upload_id}')
def get_detection_results(
    game_id: int,
    upload_id: int,
    db: Annotated[Session, Depends(get_db)],
    detector: Annotated[CardDetector, Depends(get_card_detector)],
):
    """Return card detection results for an uploaded image."""
    upload = (
        db.query(ImageUpload)
        .filter(ImageUpload.upload_id == upload_id, ImageUpload.game_id == game_id)
        .first()
    )
    if upload is None:
        raise HTTPException(status_code=404, detail='Upload not found')

    # Run detection if not already done
    if upload.status != 'detected':
        if upload.status == 'failed':
            return {
                'upload_id': upload.upload_id,
                'game_id': upload.game_id,
                'status': upload.status,
                'card_count': 0,
                'image_width': upload.image_width or 0,
                'image_height': upload.image_height or 0,
                'detections': [],
            }
        try:
            results = detector.detect(upload.file_path)

            # Get image dimensions and run position assignment
            img_w, img_h = _get_image_dimensions(upload.file_path)
            assigner = PositionAssigner()
            assigned = assigner.assign(results, img_w, img_h)

            for r in assigned:
                detection = CardDetection(
                    upload_id=upload_id,
                    card_position=r.card_position,
                    detected_value=r.detected_value,
                    confidence=r.confidence,
                    bbox_x=r.bbox_x,
                    bbox_y=r.bbox_y,
                    bbox_width=r.bbox_width,
                    bbox_height=r.bbox_height,
                    position_confidence=r.position_confidence,
                )
                db.add(detection)
            upload.status = 'detected'
            upload.image_width = img_w
            upload.image_height = img_h
            db.commit()
            db.refresh(upload)
        except IntegrityError:
            db.rollback()
            db.refresh(upload)
        except Exception:
            db.rollback()
            upload.status = 'failed'
            db.commit()
            raise HTTPException(
                status_code=500, detail='Card detection failed'
            ) from None

    detections = (
        db.query(CardDetection).filter(CardDetection.upload_id == upload_id).all()
    )

    return {
        'upload_id': upload.upload_id,
        'game_id': upload.game_id,
        'status': upload.status,
        'card_count': len(detections),
        'image_width': upload.image_width or 0,
        'image_height': upload.image_height or 0,
        'detections': [
            {
                'detection_id': d.detection_id,
                'card_position': d.card_position,
                'detected_value': d.detected_value,
                'confidence': d.confidence,
                'bbox_x': d.bbox_x,
                'bbox_y': d.bbox_y,
                'bbox_width': d.bbox_width,
                'bbox_height': d.bbox_height,
                'position_confidence': d.position_confidence,
            }
            for d in detections
        ],
    }


@router.post(
    '/{game_id}/hands/image/{upload_id}/confirm',
    status_code=201,
    response_model=HandResponse,
)
def confirm_detection(
    game_id: int,
    upload_id: int,
    payload: ConfirmDetectionRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Confirm detected cards and create a Hand + PlayerHand records."""
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    upload = (
        db.query(ImageUpload)
        .filter(ImageUpload.upload_id == upload_id, ImageUpload.game_id == game_id)
        .first()
    )
    if upload is None:
        raise HTTPException(status_code=404, detail='Upload not found')

    if upload.status != 'detected':
        raise HTTPException(
            status_code=409,
            detail=f'Upload status is {upload.status!r}, expected "detected"',
        )

    # Collect all cards for duplicate validation
    cc = payload.community_cards
    all_cards = [str(cc.flop_1), str(cc.flop_2), str(cc.flop_3)]
    if cc.turn is not None:
        all_cards.append(str(cc.turn))
    if cc.river is not None:
        all_cards.append(str(cc.river))
    for entry in payload.player_hands:
        all_cards.append(str(entry.card_1))
        all_cards.append(str(entry.card_2))
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Reject duplicate player names
    player_names = [e.player_name.lower() for e in payload.player_hands]
    if len(player_names) != len(set(player_names)):
        raise HTTPException(
            status_code=400,
            detail='Duplicate player_name in player_hands',
        )

    # Auto-increment hand_number
    max_hand_number = (
        db.query(func.max(Hand.hand_number)).filter(Hand.game_id == game_id).scalar()
    )
    hand_number = (max_hand_number or 0) + 1

    game_player_ids = {p.player_id for p in game.players}

    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        flop_1=str(cc.flop_1),
        flop_2=str(cc.flop_2),
        flop_3=str(cc.flop_3),
        turn=str(cc.turn) if cc.turn is not None else None,
        river=str(cc.river) if cc.river is not None else None,
        source_upload_id=upload_id,
    )
    db.add(hand)
    db.flush()

    player_hand_responses: list[PlayerHandResponse] = []
    for entry in payload.player_hands:
        player = (
            db.query(Player)
            .filter(func.lower(Player.name) == entry.player_name.lower())
            .first()
        )
        if player is None:
            raise HTTPException(
                status_code=404,
                detail=f'Player {entry.player_name!r} not found',
            )
        if player.player_id not in game_player_ids:
            raise HTTPException(
                status_code=400,
                detail=f'Player {entry.player_name!r} is not a participant in this game',
            )

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1=str(entry.card_1),
            card_2=str(entry.card_2),
        )
        db.add(ph)
        db.flush()

        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=player.name,
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
            )
        )

    # Compare confirmed values against detections and store corrections
    detections = (
        db.query(CardDetection).filter(CardDetection.upload_id == upload_id).all()
    )
    detection_map = {d.card_position: d.detected_value for d in detections}

    # Build confirmed values map using position keys that match detection positions
    confirmed_map = {
        'flop_1': str(cc.flop_1),
        'flop_2': str(cc.flop_2),
        'flop_3': str(cc.flop_3),
    }
    if cc.turn is not None:
        confirmed_map['turn'] = str(cc.turn)
    if cc.river is not None:
        confirmed_map['river'] = str(cc.river)

    # Map player hole cards — hole_1/hole_2 for first player,
    # hole_3/hole_4 for second, etc.
    for i, entry in enumerate(payload.player_hands):
        confirmed_map[f'hole_{i * 2 + 1}'] = str(entry.card_1)
        confirmed_map[f'hole_{i * 2 + 2}'] = str(entry.card_2)

    for position, confirmed_value in confirmed_map.items():
        detected_value = detection_map.get(position)
        if detected_value is not None and detected_value != confirmed_value:
            db.add(
                DetectionCorrection(
                    upload_id=upload_id,
                    card_position=position,
                    detected_value=detected_value,
                    corrected_value=confirmed_value,
                )
            )

    upload.status = 'confirmed'
    db.commit()
    db.refresh(hand)

    return HandResponse(
        hand_id=hand.hand_id,
        game_id=hand.game_id,
        hand_number=hand.hand_number,
        flop_1=hand.flop_1,
        flop_2=hand.flop_2,
        flop_3=hand.flop_3,
        turn=hand.turn,
        river=hand.river,
        source_upload_id=hand.source_upload_id,
        created_at=hand.created_at,
        player_hands=player_hand_responses,
    )


@corrections_router.get('/corrections')
def get_corrections(
    db: Annotated[Session, Depends(get_db)],
):
    """Return all detection corrections for model retraining data."""
    corrections = db.query(DetectionCorrection).all()
    return [
        {
            'correction_id': c.correction_id,
            'upload_id': c.upload_id,
            'card_position': c.card_position,
            'detected_value': c.detected_value,
            'corrected_value': c.corrected_value,
            'created_at': c.created_at.isoformat() if c.created_at else None,
        }
        for c in corrections
    ]

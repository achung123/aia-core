from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Player(Base):
    __tablename__ = 'players'

    player_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    games = relationship(
        'GameSession', secondary='game_players', back_populates='players'
    )
    hands_played = relationship('PlayerHand', back_populates='player')


class GameSession(Base):
    __tablename__ = 'game_sessions'

    game_id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default='active')
    winners = Column(String, nullable=True)
    small_blind = Column(Float, nullable=False, default=0.10)
    big_blind = Column(Float, nullable=False, default=0.20)
    blind_timer_minutes = Column(Integer, nullable=False, default=15)
    blind_timer_paused = Column(Boolean, nullable=False, default=False)
    blind_timer_started_at = Column(DateTime, nullable=True)
    blind_timer_remaining_seconds = Column(Integer, nullable=True)
    default_buy_in = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    players = relationship('Player', secondary='game_players', back_populates='games')

    hands = relationship('Hand', back_populates='game_session')


class GamePlayer(Base):
    __tablename__ = 'game_players'

    game_id = Column(Integer, ForeignKey('game_sessions.game_id'), primary_key=True)
    player_id = Column(Integer, ForeignKey('players.player_id'), primary_key=True)
    is_active = Column(Boolean, default=True, nullable=False)
    seat_number = Column(Integer, nullable=True)
    buy_in = Column(Float, nullable=True)


class Hand(Base):
    __tablename__ = 'hands'
    __table_args__ = (
        UniqueConstraint('game_id', 'hand_number', name='uq_hand_game_number'),
    )

    hand_id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey('game_sessions.game_id'), nullable=False)
    hand_number = Column(Integer, nullable=False)
    flop_1 = Column(String, nullable=True)
    flop_2 = Column(String, nullable=True)
    flop_3 = Column(String, nullable=True)
    turn = Column(String, nullable=True)
    river = Column(String, nullable=True)
    sb_player_id = Column(Integer, ForeignKey('players.player_id'), nullable=True)
    bb_player_id = Column(Integer, ForeignKey('players.player_id'), nullable=True)
    source_upload_id = Column(
        Integer, ForeignKey('image_uploads.upload_id'), nullable=True
    )
    pot = Column(Float, nullable=False, default=0)
    side_pots = Column(String, nullable=False, default='[]')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    game_session = relationship('GameSession', back_populates='hands')
    player_hands = relationship('PlayerHand', back_populates='hand')
    state = relationship('HandState', back_populates='hand', uselist=False)


class PlayerHand(Base):
    __tablename__ = 'player_hands'
    __table_args__ = (UniqueConstraint('hand_id', 'player_id', name='uq_player_hand'),)

    player_hand_id = Column(Integer, primary_key=True, autoincrement=True)
    hand_id = Column(Integer, ForeignKey('hands.hand_id'), nullable=False)
    player_id = Column(Integer, ForeignKey('players.player_id'), nullable=False)
    card_1 = Column(String, nullable=True)
    card_2 = Column(String, nullable=True)
    result = Column(String, nullable=True)
    profit_loss = Column(Float, nullable=True)
    outcome_street = Column(String, nullable=True)
    is_all_in = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    hand = relationship('Hand', back_populates='player_hands')
    player = relationship('Player', back_populates='hands_played')
    actions = relationship('PlayerHandAction', back_populates='player_hand')


class PlayerHandAction(Base):
    __tablename__ = 'player_hand_actions'

    action_id = Column(Integer, primary_key=True, autoincrement=True)
    player_hand_id = Column(
        Integer, ForeignKey('player_hands.player_hand_id'), nullable=False
    )
    street = Column(String, nullable=False)
    action = Column(String, nullable=False)
    amount = Column(Float, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%f', 'now'))"),
    )

    player_hand = relationship('PlayerHand', back_populates='actions')


class ImageUpload(Base):
    __tablename__ = 'image_uploads'

    upload_id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey('game_sessions.game_id'), nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default='processing')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    detections = relationship('CardDetection', back_populates='image_upload')


class CardDetection(Base):
    __tablename__ = 'card_detections'
    __table_args__ = (
        UniqueConstraint(
            'upload_id', 'card_position', name='uq_detection_upload_position'
        ),
    )

    detection_id = Column(Integer, primary_key=True, autoincrement=True)
    upload_id = Column(Integer, ForeignKey('image_uploads.upload_id'), nullable=False)
    card_position = Column(String, nullable=False)
    detected_value = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=True)
    bbox_y = Column(Float, nullable=True)
    bbox_width = Column(Float, nullable=True)
    bbox_height = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    image_upload = relationship('ImageUpload', back_populates='detections')


class DetectionCorrection(Base):
    __tablename__ = 'detection_corrections'

    correction_id = Column(Integer, primary_key=True, autoincrement=True)
    upload_id = Column(Integer, ForeignKey('image_uploads.upload_id'), nullable=False)
    card_position = Column(String, nullable=False)
    detected_value = Column(String, nullable=False)
    corrected_value = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    image_upload = relationship('ImageUpload')


class HandState(Base):
    __tablename__ = 'hand_states'

    hand_state_id = Column(Integer, primary_key=True, autoincrement=True)
    hand_id = Column(Integer, ForeignKey('hands.hand_id'), unique=True, nullable=False)
    phase = Column(String, nullable=False, default='preflop')
    current_seat = Column(Integer, nullable=True)
    action_index = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    hand = relationship('Hand', back_populates='state')


class Rebuy(Base):
    __tablename__ = 'rebuys'

    rebuy_id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey('game_sessions.game_id'), nullable=False)
    player_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

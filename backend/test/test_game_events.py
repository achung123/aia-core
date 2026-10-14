"""Change notifications: the hub, the stream, and the automatic publish on writes."""

import asyncio
import sqlite3

import pytest

from app.database.session import configure_sqlite
from app.routes.events import change_stream
from app.services.events import GameEventHub, game_events


class TestHub:
    def test_token_changes_on_publish_and_only_for_that_game(self):
        hub = GameEventHub()
        before_one, before_two = hub.token(1), hub.token(2)
        hub.publish(1)
        assert hub.token(1) != before_one
        assert hub.token(2) == before_two

    def test_a_restarted_server_never_reuses_a_token(self):
        assert GameEventHub().token(1) != GameEventHub().token(1)

    def test_subscriber_receives_the_latest_token_only(self):
        async def scenario():
            hub = GameEventHub()
            queue = hub.subscribe(7)
            hub.publish(7)
            hub.publish(7)
            latest = hub.publish(7)
            await asyncio.sleep(0)
            assert queue.qsize() == 1
            assert await queue.get() == latest
            hub.unsubscribe(7, queue)
            assert hub.subscriber_count(7) == 0

        asyncio.run(scenario())

    def test_publish_from_another_thread_wakes_the_subscriber(self):
        async def scenario():
            hub = GameEventHub()
            queue = hub.subscribe(3)
            token = await asyncio.to_thread(hub.publish, 3)
            assert await asyncio.wait_for(queue.get(), timeout=1) == token

        asyncio.run(scenario())


class TestChangeStream:
    def test_sends_current_state_then_each_change_then_cleans_up(self):
        async def scenario():
            stream = change_stream(990001, heartbeat_seconds=5)
            assert (await anext(stream)).startswith('retry:')
            first = await anext(stream)
            assert first == f'event: change\ndata: {game_events.token(990001)}\n\n'
            assert game_events.subscriber_count(990001) == 1

            token = game_events.publish(990001)
            assert await anext(stream) == f'event: change\ndata: {token}\n\n'

            await stream.aclose()
            assert game_events.subscriber_count(990001) == 0

        asyncio.run(scenario())

    def test_sends_a_keep_alive_when_nothing_changes(self):
        async def scenario():
            stream = change_stream(990002, heartbeat_seconds=0.01)
            await anext(stream)
            await anext(stream)
            assert await anext(stream) == ': keep-alive\n\n'
            await stream.aclose()

        asyncio.run(scenario())


class TestWritesNotifyAutomatically:
    def make_game(self, client) -> int:
        response = client.post(
            '/games',
            json={
                'game_date': '2026-10-13',
                'player_names': ['Ann', 'Ben'],
                'default_buy_in': 20,
            },
        )
        return response.json()['game_id']

    def version(self, client, game_id: int) -> str:
        return client.get(f'/games/{game_id}/version').json()['token']

    def test_a_successful_write_changes_the_game_token(self, client):
        game_id = self.make_game(client)
        before = self.version(client, game_id)
        assert client.post(f'/games/{game_id}/hands/start').status_code == 201
        assert self.version(client, game_id) != before

    def test_reads_do_not_change_the_token(self, client):
        game_id = self.make_game(client)
        client.post(f'/games/{game_id}/hands/start')
        before = self.version(client, game_id)
        client.get(f'/games/{game_id}')
        client.get(f'/games/{game_id}/hands')
        client.get(f'/games/{game_id}/hands/1/status')
        assert self.version(client, game_id) == before

    def test_a_rejected_write_does_not_change_the_token(self, client):
        game_id = self.make_game(client)
        client.post(f'/games/{game_id}/hands/start')
        before = self.version(client, game_id)
        response = client.post(
            f'/games/{game_id}/hands/1/players/Ann/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.1},
        )
        assert response.status_code == 403  # still awaiting cards
        assert self.version(client, game_id) == before

    def test_a_write_to_one_game_leaves_other_games_alone(self, client):
        first = self.make_game(client)
        second = self.make_game(client)
        before = self.version(client, second)
        client.post(f'/games/{first}/hands/start')
        assert self.version(client, second) == before

    def test_a_read_that_advances_the_hand_notifies(self, client):
        game_id = self.make_game(client)
        client.post(f'/games/{game_id}/hands/start')
        for name, hole in (('Ann', ('Ah', 'Ad')), ('Ben', ('Kh', 'Kd'))):
            client.patch(
                f'/games/{game_id}/hands/1/players/{name}',
                json={'card_1': hole[0], 'card_2': hole[1]},
            )
        for name, action, amount in (('Ann', 'call', 0.1), ('Ben', 'check', None)):
            client.post(
                f'/games/{game_id}/hands/1/players/{name}/actions',
                json={'street': 'preflop', 'action': action, 'amount': amount},
            )
        # Deal the flop straight into the database, so only the status read
        # can move the hand on to the next street.
        from conftest import SessionLocal

        from app.database.models import Hand

        with SessionLocal() as db:
            hand = db.query(Hand).filter(Hand.game_id == game_id).one()
            hand.flop_1, hand.flop_2, hand.flop_3 = '3C', '8D', '9S'
            db.commit()
        before = self.version(client, game_id)
        assert client.get(f'/games/{game_id}/hands/1/status').json()['phase'] == 'flop'
        assert self.version(client, game_id) != before


class TestSqliteSettings:
    def test_write_ahead_log_and_busy_timeout_are_applied(self, tmp_path):
        connection = sqlite3.connect(tmp_path / 'settings.db')
        try:
            configure_sqlite(connection)
            assert connection.execute('PRAGMA journal_mode').fetchone()[0] == 'wal'
            assert connection.execute('PRAGMA busy_timeout').fetchone()[0] == 5000
            assert connection.execute('PRAGMA synchronous').fetchone()[0] == 1
        finally:
            connection.close()


@pytest.mark.parametrize('path', ['/games/12/events', '/games/12/version'])
def test_event_routes_are_registered(path):
    from app.main import app

    assert path.replace('12', '{game_id}') in {route.path for route in app.routes}

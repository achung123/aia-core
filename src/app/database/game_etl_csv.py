import datetime
import uuid

import pandas as pd
from database_models import Player, engine
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

Session = sessionmaker(bind=engine)


class GameConstructionTool:
    """Tool used to extract, transform, and load the game data stored in CSV format."""

    def __init__(
        self,
        player_csv_file_paths: list[str],
        dealer_csv_file_path: str,
        player_ids: list[str],
    ):
        self.player_csv_file_paths = player_csv_file_paths
        self.dealer_csv_file_path = dealer_csv_file_path
        self.database_path = "sqlite:///game.db"
        self.date = datetime.datetime.now(tz=datetime.timezone.utc)
        self.player_ids = player_ids
        self.game_uuid = str(uuid.uuid4())

    def _get_or_create_game_uuid(self):
        """Check if a game exists for the given date and reuse its UUID if found, otherwise create a new UUID."""
        engine = create_engine(self.database_path)
        query = text("SELECT game_uuid FROM game WHERE game_date = :game_date LIMIT 1")
        with engine.connect() as conn:
            result = conn.execute(query, {"game_date": str(self.date)}).fetchone()
        return result[0] if result else str(uuid.uuid4())

    def spin_etl(self):
        """Execute the ETL process."""
        df_extracted = self._extract()
        df_transformed = self._transform(df_extracted)
        self._load(df_transformed)

    def _extract(self):
        """Extract the data from the CSV files."""
        return {file: pd.read_csv(file) for file in self.player_csv_file_paths}

    def _transform(self, df_extracted):
        """Transform the extracted data by adding necessary metadata."""
        transformed_rows = []
        for file, df_current in df_extracted.items():
            df_current_cleaned = df_current.dropna()
            df_current_cleaned["game_date"] = str(self.date)
            df_current_cleaned["game_uuid"] = self.game_uuid
            df_current_cleaned["hand_number"] = range(1, len(df_current_cleaned) + 1)
            df_current_cleaned["player_id"] = self.player_ids[
                self.player_csv_file_paths.index(file)
            ]
            if (
                "hole_card_1" not in df_current_cleaned.columns
                or "hole_card_2" not in df_current_cleaned.columns
            ):
                df_current_cleaned["hole_card_1"] = None
                df_current_cleaned["hole_card_2"] = None
            transformed_rows.append(df_current_cleaned)

        return pd.concat(transformed_rows, ignore_index=True)

    def _load(self, df_transformed):
        """Load the transformed data into the database."""
        for _, row in df_transformed.iterrows():
            player = Player(
                game_uuid=row["game_uuid"],
                game_date=row["game_date"],
                player_id=row["player_id"],
                hand_number=row["hand_number"],
                hole_card_1=row["hole_card_1"],
                hole_card_2=row["hole_card_2"],
            )
            with Session() as session:
                session.add(player)
                session.commit()


# Example usage
if __name__ == "__main__":
    game_tool = GameConstructionTool(
        ["adam.csv", "gil.csv"], "dealer.csv", ["adam", "gil"]
    )
    game_tool.spin_etl()

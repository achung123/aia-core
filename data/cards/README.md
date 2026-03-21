# Playing Cards Dataset

## Source

- **Dataset:** Playing Cards by Augmented Startups
- **URL:** https://universe.roboflow.com/augmented-startups/playing-cards-ow27d
- **Format:** YOLOv8 (bounding box annotations)
- **Version:** 4

## License

This dataset is hosted on Roboflow Universe under the **CC BY 4.0** license.
See the dataset page for full license terms.

## Statistics

- **Images:** ~24,000 (train ~20,000 / val ~2,400 / test ~1,200)
- **Annotations:** ~24,000 bounding boxes (approximately one card per image)
- **Classes:** 52 (one per card in a standard playing card deck)

## Class Distribution

The dataset contains 52 classes representing every card in a standard deck:

| Rank  | Clubs | Diamonds | Hearts | Spades |
|-------|-------|----------|--------|--------|
| Ace   | ace of clubs | ace of diamonds | ace of hearts | ace of spades |
| 2     | 2 of clubs | 2 of diamonds | 2 of hearts | 2 of spades |
| 3     | 3 of clubs | 3 of diamonds | 3 of hearts | 3 of spades |
| 4     | 4 of clubs | 4 of diamonds | 4 of hearts | 4 of spades |
| 5     | 5 of clubs | 5 of diamonds | 5 of hearts | 5 of spades |
| 6     | 6 of clubs | 6 of diamonds | 6 of hearts | 6 of spades |
| 7     | 7 of clubs | 7 of diamonds | 7 of hearts | 7 of spades |
| 8     | 8 of clubs | 8 of diamonds | 8 of hearts | 8 of spades |
| 9     | 9 of clubs | 9 of diamonds | 9 of hearts | 9 of spades |
| 10    | 10 of clubs | 10 of diamonds | 10 of hearts | 10 of spades |
| Jack  | jack of clubs | jack of diamonds | jack of hearts | jack of spades |
| Queen | queen of clubs | queen of diamonds | queen of hearts | queen of spades |
| King  | king of clubs | king of diamonds | king of hearts | king of spades |

## Directory Structure

After download, the dataset is organized as:

```
data/cards/
├── data.yaml
├── README.md
├── train/
│   ├── images/
│   └── labels/
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

## Download

Run the download script:

```bash
pip install roboflow
python3 scripts/download_dataset.py
```

The script uses the Roboflow Python SDK. Authenticate first via `roboflow login`
or set the `ROBOFLOW_API_KEY` environment variable.

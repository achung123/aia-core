"""Upload router - handles file upload endpoints."""

from fastapi import APIRouter

from pydantic_models.csv_schema import CSV_COLUMNS, CSV_COLUMN_FORMATS

router = APIRouter(prefix='/upload', tags=['upload'])


@router.get('/csv/schema')
def get_csv_schema():
    return {
        'columns': CSV_COLUMNS,
        'formats': CSV_COLUMN_FORMATS,
    }

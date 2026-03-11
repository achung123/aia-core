"""Upload router - handles file upload endpoints."""

from fastapi import APIRouter, HTTPException, UploadFile

from pydantic_models.csv_schema import (
    CSV_COLUMNS,
    CSV_COLUMN_FORMATS,
    parse_csv,
    validate_csv_rows,
)

router = APIRouter(prefix='/upload', tags=['upload'])


@router.get('/csv/schema')
def get_csv_schema():
    return {
        'columns': CSV_COLUMNS,
        'formats': CSV_COLUMN_FORMATS,
    }


@router.post('/csv')
async def upload_csv(file: UploadFile):
    """Accept a CSV file upload, validate it, and return a validation report."""
    content = await file.read()
    csv_text = content.decode('utf-8')

    try:
        grouped = parse_csv(csv_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    total_rows = sum(len(rows) for rows in grouped.values())
    errors = validate_csv_rows(grouped)

    return {
        'valid': len(errors) == 0,
        'total_rows': total_rows,
        'error_count': len(errors),
        'errors': errors,
    }

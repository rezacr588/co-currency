# ML Service for CoAI

Machine learning microservice providing predictive cash flow forecasting and anomaly detection.

## Features

- **Time-Series Forecasting**: Prophet-based predictions for income and expenses
- **Anomaly Detection**: Statistical methods (Z-score, IQR) for unusual spending
- **Production-Ready**: Gunicorn WSGI server, health checks, logging

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run service
python -m app.main

# Service available at http://localhost:5001
```

### Docker

```bash
# Build image
docker build -t coai-ml-service .

# Run container
docker run -p 5001:5001 coai-ml-service
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Forecast
```bash
POST /forecast
Content-Type: application/json

{
  "transactions": [
    {"date": "2024-01-01", "amount": 100.0, "type": "credit"},
    {"date": "2024-01-02", "amount": 50.0, "type": "debit"}
  ],
  "days": 30,
  "currency": "USD"
}
```

### Detect Anomalies
```bash
POST /detect-anomalies
Content-Type: application/json

{
  "transactions": [
    {"id": "tx1", "date": "2024-01-01", "amount": 100.0, "category": "food", "type": "debit"}
  ],
  "threshold": 2.5
}
```

## Testing

```bash
pytest tests/
```

## Configuration

- `PORT`: Service port (default: 5001)
- Workers: 2 (configured in Dockerfile)
- Timeout: 60 seconds

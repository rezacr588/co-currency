"""
ML Service Main Application
Provides forecasting and anomaly detection for CoAI
"""
from flask import Flask, jsonify, request
from datetime import datetime
import logging
import os

from app.forecaster import Forecaster
from app.anomaly_detector import AnomalyDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize services
forecaster = Forecaster()
anomaly_detector = AnomalyDetector()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-service',
        'version': '0.1.0',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.route('/forecast', methods=['POST'])
def forecast():
    """
    Generate time-series forecast from transaction history
    
    Request body:
    {
        "transactions": [
            {"date": "2024-01-01", "amount": 100.0, "type": "credit"},
            ...
        ],
        "days": 30,
        "currency": "USD"
    }
    
    Response:
    {
        "predictions": [
            {"date": "2024-02-01", "predicted": 150.0, "lower": 100.0, "upper": 200.0},
            ...
        ],
        "confidence": 0.85
    }
    """
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Missing transactions data'}), 400
        
        transactions = data['transactions']
        days = data.get('days', 30)
        currency = data.get('currency', 'USD')
        
        if days <= 0 or days > 90:
            return jsonify({'error': 'Days must be between 1 and 90'}), 400
        
        if len(transactions) < 14:
            return jsonify({'error': 'Insufficient data: need at least 14 days of history'}), 400
        
        # Generate forecast
        logger.info(f"Generating {days}-day forecast for {len(transactions)} transactions")
        result = forecaster.predict(transactions, days, currency)
        
        return jsonify(result), 200
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Forecast error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/detect-anomalies', methods=['POST'])
def detect_anomalies():
    """
    Detect spending anomalies in transaction history
    
    Request body:
    {
        "transactions": [
            {"id": "uuid", "date": "2024-01-01", "amount": 100.0, "category": "food", "type": "debit"},
            ...
        ],
        "threshold": 2.5
    }
    
    Response:
    {
        "anomalies": [
            {
                "transaction_id": "uuid",
                "category": "food",
                "amount": 500.0,
                "expected_range": [50.0, 150.0],
                "severity": "high",
                "z_score": 3.2,
                "message": "Spending in 'food' category is 3.3x higher than normal"
            },
            ...
        ],
        "total_checked": 100,
        "anomalies_found": 3
    }
    """
    try:
        data = request.get_json()
        
        # Validate input
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Missing transactions data'}), 400
        
        transactions = data['transactions']
        threshold = data.get('threshold', 2.5)
        
        if threshold < 1.0 or threshold > 5.0:
            return jsonify({'error': 'Threshold must be between 1.0 and 5.0'}), 400
        
        if len(transactions) < 30:
            return jsonify({'error': 'Insufficient data: need at least 30 transactions'}), 400
        
        # Detect anomalies
        logger.info(f"Detecting anomalies in {len(transactions)} transactions with threshold {threshold}")
        result = anomaly_detector.detect(transactions, threshold)
        
        return jsonify(result), 200
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Anomaly detection error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)

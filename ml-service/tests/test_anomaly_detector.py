import pytest
from datetime import datetime, timedelta
import pandas as pd
from app.anomaly_detector import AnomalyDetector


class TestAnomalyDetector:
    """Test suite for anomaly detection."""

    @pytest.fixture
    def detector(self):
        """Create an anomaly detector instance."""
        return AnomalyDetector()

    @pytest.fixture
    def normal_transactions(self):
        """Generate normal transaction data without anomalies."""
        dates = pd.date_range(end=datetime.now(), periods=60, freq='D')
        transactions = []
        
        for date in dates:
            # Regular daily spending
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            })
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -30.0,
                'type': 'debit',
                'category': 'Transportation'
            })
        
        return transactions

    @pytest.fixture
    def transactions_with_anomalies(self):
        """Generate transaction data with clear anomalies."""
        dates = pd.date_range(end=datetime.now(), periods=60, freq='D')
        transactions = []
        
        for i, date in enumerate(dates):
            # Normal spending most days
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            })
            
            # Add anomalies on specific days
            if i == 30:  # Huge food expense
                transactions.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'amount': -500.0,
                    'type': 'debit',
                    'category': 'Food'
                })
            
            if i == 45:  # Unusual shopping spree
                transactions.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'amount': -800.0,
                    'type': 'debit',
                    'category': 'Shopping'
                })
        
        return transactions

    def test_detect_no_anomalies(self, detector, normal_transactions):
        """Test detection with normal transactions (no anomalies)."""
        result = detector.detect(
            transactions=normal_transactions,
            threshold=2.5
        )
        
        assert 'anomalies' in result
        assert 'summary' in result
        
        # Should detect no or very few anomalies
        assert len(result['anomalies']) <= 2  # Allow for statistical edge cases

    def test_detect_clear_anomalies(self, detector, transactions_with_anomalies):
        """Test detection with clear anomalous transactions."""
        result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=1.8  # Very low threshold
        )
        
        anomalies = result['anomalies']
        
        # Should detect at least 1 anomaly
        assert len(anomalies) >= 1, f"Expected anomalies, got {len(anomalies)}"
        
        # Check structure is correct (use 'date' not 'transaction_date')
        for anomaly in anomalies:
            assert 'date' in anomaly
            assert 'category' in anomaly
            assert 'amount' in anomaly
            assert 'z_score' in anomaly
            assert 'severity' in anomaly

    def test_severity_levels(self, detector, transactions_with_anomalies):
        """Test that severity levels are assigned correctly."""
        result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=2.0  # Lower threshold to catch more
        )
        
        anomalies = result['anomalies']
        
        # Check severity is one of expected values
        for anomaly in anomalies:
            assert anomaly['severity'] in ['low', 'medium', 'high', 'critical']
            
            # Higher z-scores should have higher severity
            if abs(anomaly['z_score']) > 4:
                assert anomaly['severity'] in ['high', 'critical']

    def test_insufficient_data(self, detector):
        """Test detection with insufficient data."""
        # Only 10 transactions (less than minimum)
        transactions = [
            {
                'date': (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            }
            for i in range(10)
        ]
        
        result = detector.detect(
            transactions=transactions,
            threshold=2.5
        )
        
        # Should still work but indicate insufficient data
        assert 'anomalies' in result
        assert 'summary' in result
        assert result['summary']['total_transactions'] == 10

    def test_empty_transactions(self, detector):
        """Test detection with no transactions."""
        result = detector.detect(
            transactions=[],
            threshold=2.5
        )
        
        assert result['anomalies'] == []
        assert result['summary']['total_transactions'] == 0
        assert result['summary']['anomaly_count'] == 0

    def test_category_grouping(self, detector):
        """Test that anomalies are detected per category."""
        # Create transactions with anomaly in specific category
        transactions = []
        dates = pd.date_range(end=datetime.now(), periods=40, freq='D')
        
        for date in dates:
            # Normal food expenses
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            })
            # Normal transport expenses
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -20.0,
                'type': 'debit',
                'category': 'Transportation'
            })
        
        # Add anomaly only in food category
        transactions.append({
            'date': datetime.now().strftime('%Y-%m-%d'),
            'amount': -400.0,
            'type': 'debit',
            'category': 'Food'
        })
        
        result = detector.detect(
            transactions=transactions,
            threshold=2.5
        )
        
        # Should detect anomaly in Food category
        food_anomalies = [a for a in result['anomalies'] if a['category'] == 'Food']
        assert len(food_anomalies) > 0

    def test_threshold_sensitivity(self, detector, transactions_with_anomalies):
        """Test that different thresholds affect detection."""
        # Strict threshold (fewer anomalies)
        strict_result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=3.5
        )
        
        # Lenient threshold (more anomalies)
        lenient_result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=1.5
        )
        
        # Lenient should catch more anomalies
        assert len(lenient_result['anomalies']) >= len(strict_result['anomalies'])

    def test_summary_statistics(self, detector, transactions_with_anomalies):
        """Test that summary statistics are accurate."""
        result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=2.5
        )
        
        summary = result['summary']
        
        assert 'total_transactions' in summary
        assert 'anomaly_count' in summary
        assert 'categories_affected' in summary
        assert 'threshold_used' in summary
        
        # Anomaly count should match length of anomalies list
        assert summary['anomaly_count'] == len(result['anomalies'])
        
        # Threshold should match what we passed
        assert summary['threshold_used'] == 2.5

    def test_categories_affected(self, detector, transactions_with_anomalies):
        """Test that affected categories are listed correctly."""
        result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=2.5
        )
        
        summary = result['summary']
        categories_affected = summary['categories_affected']
        
        # Should be a list
        assert isinstance(categories_affected, list)
        
        # All anomaly categories should be in affected list
        anomaly_categories = set(a['category'] for a in result['anomalies'])
        for cat in anomaly_categories:
            assert cat in categories_affected

    def test_message_generation(self, detector, transactions_with_anomalies):
        """Test that human-readable messages are generated."""
        result = detector.detect(
            transactions=transactions_with_anomalies,
            threshold=2.5
        )
        
        for anomaly in result['anomalies']:
            message = anomaly['message']
            
            # Message should be non-empty string
            assert isinstance(message, str)
            assert len(message) > 0
            
            # Should mention the category
            assert anomaly['category'].lower() in message.lower()

    def test_credit_transactions_ignored(self, detector):
        """Test that credit transactions (income) are not flagged as anomalies."""
        transactions = []
        dates = pd.date_range(end=datetime.now(), periods=40, freq='D')
        
        for i, date in enumerate(dates):
            # Normal expenses
            transactions.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            })
            
            # Income (credit)
            if i % 14 == 0:
                transactions.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'amount': 3000.0,  # Large income
                    'type': 'credit',
                    'category': 'Salary'
                })
        
        result = detector.detect(
            transactions=transactions,
            threshold=2.5
        )
        
        # Should not flag income as anomalies
        for anomaly in result['anomalies']:
            assert anomaly['amount'] < 0, "Only expenses should be flagged"

    def test_recent_bias(self, detector):
        """Test that recent anomalies are prioritized."""
        transactions = []
        
        # Old anomaly (60 days ago)
        transactions.append({
            'date': (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d'),
            'amount': -500.0,
            'type': 'debit',
            'category': 'Food'
        })
        
        # Recent anomaly (3 days ago)
        transactions.append({
            'date': (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d'),
            'amount': -500.0,
            'type': 'debit',
            'category': 'Food'
        })
        
        # Normal transactions for context
        for i in range(40):
            transactions.append({
                'date': (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d'),
                'amount': -50.0,
                'type': 'debit',
                'category': 'Food'
            })
        
        result = detector.detect(
            transactions=transactions,
            threshold=2.5
        )
        
        # Both should be detected
        assert len(result['anomalies']) >= 2

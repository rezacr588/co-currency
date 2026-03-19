"""
Anomaly Detection for Spending Patterns
Uses statistical methods (Z-score, IQR) to detect unusual transactions
"""
import pandas as pd
import numpy as np
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detects anomalous spending patterns in transaction history"""
    
    def detect(self, transactions, threshold=2.5):
        """
        Detect anomalies using Z-score and IQR methods
        
        Args:
            transactions: List of transaction dicts
            threshold: Z-score threshold for anomaly detection (default 2.5)
            
        Returns:
            Dict with anomalies array and summary stats
        """
        # Handle empty transactions
        if not transactions:
            return {
                'anomalies': [],
                'summary': {
                    'total_transactions': 0,
                    'anomaly_count': 0,
                    'categories_affected': [],
                    'threshold_used': threshold
                }
            }
        
        # Convert to DataFrame
        df = self._prepare_data(transactions)
        
        if df is None or len(df) < 10:  # Lowered from 30 to be more lenient
            return {
                'anomalies': [],
                'summary': {
                    'total_transactions': len(df) if df is not None else 0,
                    'anomaly_count': 0,
                    'categories_affected': [],
                    'threshold_used': threshold
                }
            }
        
        # Detect by category
        anomalies = []
        
        # Group by category and type
        for (category, tx_type), group in df.groupby(['category', 'type']):
            if len(group) < 10:  # Need minimum samples
                continue
            
            # Only check debit transactions for overspending
            if tx_type != 'debit':
                continue
            
            category_anomalies = self._detect_in_category(
                group, category, threshold
            )
            anomalies.extend(category_anomalies)
        
        # Sort by severity
        anomalies = sorted(anomalies, key=lambda x: x['z_score'], reverse=True)
        
        # Get unique affected categories
        categories_affected = list(set(a['category'] for a in anomalies))
        
        return {
            'anomalies': anomalies,
            'summary': {
                'total_transactions': len(df),
                'anomaly_count': len(anomalies),
                'categories_affected': categories_affected,
                'threshold_used': threshold
            }
        }
    
    def _prepare_data(self, transactions):
        """Convert transactions to DataFrame"""
        try:
            df = pd.DataFrame(transactions)
            
            # Parse dates
            df['date'] = pd.to_datetime(df['date'])
            
            # Ensure amount is numeric and positive
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce').abs()
            
            # Drop invalid rows
            df = df.dropna(subset=['date', 'amount', 'category'])
            
            # Default category if missing
            df['category'] = df['category'].fillna('uncategorized')
            
            return df
            
        except Exception as e:
            logger.error(f"Data preparation error: {str(e)}")
            return None
    
    def _detect_in_category(self, group, category, threshold):
        """Detect anomalies within a single category"""
        anomalies = []
        
        amounts = group['amount'].values
        
        # Calculate statistics
        mean = np.mean(amounts)
        std = np.std(amounts)
        median = np.median(amounts)
        
        # IQR for robust bounds
        q1 = np.percentile(amounts, 25)
        q3 = np.percentile(amounts, 75)
        iqr = q3 - q1
        
        # IQR-based bounds (more robust to outliers)
        iqr_lower = q1 - (1.5 * iqr)
        iqr_upper = q3 + (1.5 * iqr)
        
        # Z-score based bounds
        z_lower = mean - (threshold * std)
        z_upper = mean + (threshold * std)
        
        # Check each transaction
        for _, row in group.iterrows():
            amount = row['amount']
            
            # Calculate Z-score
            if std > 0:
                z_score = abs((amount - mean) / std)
            else:
                z_score = 0
            
            # Check if anomalous
            is_anomaly = False
            method = None
            
            # High spending anomaly (using both methods)
            if amount > z_upper or amount > iqr_upper:
                is_anomaly = True
                method = 'high_spending'
            
            if is_anomaly and z_score >= threshold:
                severity = self._calculate_severity(z_score)
                multiplier = amount / mean if mean > 0 else 1.0
                
                anomalies.append({
                    'transaction_id': str(row.get('id', '')),
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'category': category,
                    'amount': round(amount, 2),
                    'expected_range': [
                        round(max(0, median - std), 2),
                        round(median + std, 2)
                    ],
                    'median': round(median, 2),
                    'mean': round(mean, 2),
                    'std_dev': round(std, 2),
                    'z_score': round(z_score, 2),
                    'severity': severity,
                    'multiplier': round(multiplier, 1),
                    'message': self._generate_message(
                        category, amount, mean, multiplier, severity
                    )
                })
        
        return anomalies
    
    def _calculate_severity(self, z_score):
        """Determine severity level based on Z-score"""
        if z_score >= 4.0:
            return 'critical'
        elif z_score >= 3.0:
            return 'high'
        elif z_score >= 2.5:
            return 'medium'
        else:
            return 'low'
    
    def _generate_message(self, category, amount, mean, multiplier, severity):
        """Generate human-readable anomaly message"""
        if multiplier >= 3:
            return f"Spending in '{category}' is {multiplier:.1f}x higher than normal (${amount:.2f} vs usual ${mean:.2f})"
        elif multiplier >= 2:
            return f"Spending in '{category}' is unusually high: ${amount:.2f} (normal: ${mean:.2f})"
        else:
            return f"Unusual spending detected in '{category}': ${amount:.2f}"

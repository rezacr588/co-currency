"""
Time-Series Forecasting using ARIMA
"""
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from datetime import datetime, timedelta
import logging
import warnings

logger = logging.getLogger(__name__)
warnings.filterwarnings('ignore')  # Suppress ARIMA convergence warnings


class Forecaster:
    """Handles time-series forecasting for financial transactions"""
    
    def __init__(self):
        self.model = None
    
    def forecast(self, transactions, days, currency):
        """Alias for predict method (public API name)"""
        return self.predict(transactions, days, currency)
    
    def predict(self, transactions, days, currency):
        """
        Generate forecast using ARIMA
        
        Args:
            transactions: List of transaction dicts with date, amount, type
            days: Number of days to forecast
            currency: Currency code for reference
            
        Returns:
            Dict with predictions array and confidence score
        """
        # Convert to DataFrame
        df = self._prepare_data(transactions)
        
        if df is None or len(df) < 14:
            # Return zero predictions for insufficient data
            return self._zero_forecast(days, currency, 0)
        
        # Separate income and expenses for better predictions
        income_df = df[df['type'] == 'credit'].copy()
        expense_df = df[df['type'] == 'debit'].copy()
        
        # Forecast income and expenses separately
        income_forecast = self._forecast_series(income_df, days, 'income')
        expense_forecast = self._forecast_series(expense_df, days, 'expenses')
        
        # Combine predictions
        predictions = self._combine_forecasts(income_forecast, expense_forecast, days)
        
        # Calculate confidence based on data quality
        confidence = self._calculate_confidence(df, days)
        
        # Calculate metadata
        metadata = self._calculate_metadata(df, income_df, expense_df)
        
        return {
            'predictions': predictions,
            'confidence_score': round(confidence, 2),
            'currency': currency,
            'metadata': metadata
        }
    
    def _zero_forecast(self, days, currency, historical_days):
        """Return zero predictions when insufficient data"""
        predictions = []
        start_date = datetime.now()
        
        for i in range(days):
            date = start_date + timedelta(days=i+1)
            predictions.append({
                'date': date.strftime('%Y-%m-%d'),
                'income': 0.0,
                'expenses': 0.0,
                'net_cash_flow': 0.0,
                'balance': 0.0,
                'confidence': {'income': 0.0, 'expenses': 0.0}
            })
        
        return {
            'predictions': predictions,
            'confidence_score': 0.0,
            'currency': currency,
            'metadata': {
                'total_historical_days': historical_days,
                'avg_daily_income': 0.0,
                'avg_daily_expenses': 0.0,
                'income_volatility': 0.0,
                'expense_volatility': 0.0,
                'model_type': 'zero_forecast'
            }
        }
    
    def _prepare_data(self, transactions):
        """Convert transactions to time-series DataFrame"""
        try:
            # Create DataFrame
            df = pd.DataFrame(transactions)
            
            if len(df) == 0:
                return None
            
            # Parse dates
            df['date'] = pd.to_datetime(df['date'])
            
            # Ensure amount is numeric
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            
            # Drop invalid rows
            df = df.dropna(subset=['date', 'amount'])
            
            # Sort by date
            df = df.sort_values('date')
            
            return df
            
        except Exception as e:
            logger.error(f"Data preparation error: {str(e)}")
            return None
            
            return df
            
        except Exception as e:
            logger.error(f"Data preparation error: {str(e)}")
            return None
    
    def _forecast_series(self, df, days, series_name):
        """Forecast a single series (income or expenses) using ARIMA"""
        if len(df) < 7:
            # Not enough data, return zeros
            dates = pd.date_range(start=datetime.now(), periods=days)
            return pd.DataFrame({
                'date': dates,
                'prediction': [0] * days,
                'lower': [0] * days,
                'upper': [0] * days
            })
        
        try:
            # Aggregate by day (sum transactions per day)
            daily = df.groupby(df['date'].dt.date)['amount'].sum().reset_index()
            daily.columns = ['date', 'value']
            daily['date'] = pd.to_datetime(daily['date'])
            
            # Fill missing dates with zero
            date_range = pd.date_range(start=daily['date'].min(), end=daily['date'].max())
            daily = daily.set_index('date').reindex(date_range, fill_value=0).reset_index()
            daily.columns = ['date', 'value']
            
            # Convert to absolute values (debits are already positive in prepare_data)
            daily['value'] = daily['value'].abs()
            
            # Use ARIMA(1,1,1) - simple and robust
            model = ARIMA(daily['value'], order=(1, 1, 1))
            fitted = model.fit()
            
            # Forecast
            forecast_result = fitted.forecast(steps=days)
            
            # Get confidence intervals (approximate with ±15% of prediction)
            predictions = np.maximum(0, forecast_result)  # No negative predictions
            lower_bounds = np.maximum(0, predictions * 0.85)
            upper_bounds = predictions * 1.15
            
            # Create date range for predictions
            last_date = daily['date'].max()
            future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=days)
            
            return pd.DataFrame({
                'date': future_dates,
                'prediction': predictions,
                'lower': lower_bounds,
                'upper': upper_bounds
            })
            
        except Exception as e:
            logger.warning(f"ARIMA forecast failed for {series_name}: {str(e)}, using average")
            # Fallback: use historical average
            avg = df['amount'].abs().mean()
            dates = pd.date_range(start=datetime.now(), periods=days)
            return pd.DataFrame({
                'date': dates,
                'prediction': [avg] * days,
                'lower': [avg * 0.85] * days,
                'upper': [avg * 1.15] * days
            })
    
    def _combine_forecasts(self, income_forecast, expense_forecast, days):
        """Combine income and expense forecasts into net predictions"""
        predictions = []
        cumulative_balance = 0
        
        for i in range(days):
            income = income_forecast.iloc[i]['prediction']
            expense = expense_forecast.iloc[i]['prediction']
            date = income_forecast.iloc[i]['date']
            
            net = income - expense
            cumulative_balance += net
            
            # Confidence: narrower interval = higher confidence
            income_range = income_forecast.iloc[i]['upper'] - income_forecast.iloc[i]['lower']
            expense_range = expense_forecast.iloc[i]['upper'] - expense_forecast.iloc[i]['lower']
            
            # Normalize to 0-1 scale (smaller range = higher confidence)
            income_conf = max(0.5, 1.0 - (income_range / (income + 1)))
            expense_conf = max(0.5, 1.0 - (expense_range / (expense + 1)))
            
            predictions.append({
                'date': date.strftime('%Y-%m-%d'),
                'income': round(income, 2),
                'expenses': round(expense, 2),
                'net_cash_flow': round(net, 2),
                'balance': round(cumulative_balance, 2),
                'confidence': {
                    'income': round(income_conf, 2),
                    'expenses': round(expense_conf, 2)
                }
            })
        
        return predictions
    
    def _calculate_confidence(self, df, forecast_days):
        """
        Calculate confidence score based on data quality
        
        Factors:
        - Data volume (more is better)
        - Data recency (recent is better)
        - Forecast horizon (shorter is more accurate)
        """
        # Volume score: 60 days = 1.0, 14 days = 0.5
        days_of_data = (df['date'].max() - df['date'].min()).days + 1
        volume_score = min(1.0, max(0.3, days_of_data / 60.0))
        
        # Recency score: how recent is the latest data?
        days_since_last = (datetime.now().date() - df['date'].max().date()).days
        recency_score = max(0.4, 1.0 - (days_since_last / 30.0))
        
        # Horizon score: 7 days = 1.0, 90 days = 0.5
        horizon_score = max(0.5, 1.0 - (forecast_days / 180.0))
        
        # Weighted average
        confidence = (
            volume_score * 0.4 +
            recency_score * 0.3 +
            horizon_score * 0.3
        )
        
        return max(0.5, min(1.0, confidence))

    def _calculate_metadata(self, df, income_df, expense_df):
        """Calculate metadata about the forecast"""
        total_days = (df['date'].max() - df['date'].min()).days + 1
        
        # Calculate daily averages
        avg_daily_income = income_df['amount'].abs().sum() / total_days if len(income_df) > 0 else 0
        avg_daily_expenses = expense_df['amount'].abs().sum() / total_days if len(expense_df) > 0 else 0
        
        # Calculate volatility (standard deviation)
        income_volatility = income_df.groupby(income_df['date'].dt.date)['amount'].sum().std() if len(income_df) > 0 else 0
        expense_volatility = expense_df.groupby(expense_df['date'].dt.date)['amount'].sum().std() if len(expense_df) > 0 else 0
        
        return {
            'total_historical_days': total_days,
            'avg_daily_income': round(avg_daily_income, 2),
            'avg_daily_expenses': round(avg_daily_expenses, 2),
            'income_volatility': round(income_volatility if not np.isnan(income_volatility) else 0, 2),
            'expense_volatility': round(expense_volatility if not np.isnan(expense_volatility) else 0, 2),
            'model_type': 'arima'
        }

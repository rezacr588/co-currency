"""
Behavioral Analytics Module

ML-powered analysis of transaction patterns to determine:
1. Financial personality archetype (clustering)
2. Behavioral patterns (time-based, category-based)
3. Peer comparison metrics (anonymized)
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict
import numpy as np
from scipy import stats


@dataclass
class Transaction:
    """Transaction data structure for analysis."""
    id: str
    amount: float
    currency: str
    category: str
    type: str  # credit/debit
    created_at: datetime
    description: Optional[str] = None


@dataclass
class BehavioralFeatures:
    """Extracted behavioral features from transaction history."""
    # Spending patterns
    avg_transaction_amount: float
    transaction_frequency: float  # per day
    spending_variance: float
    weekend_vs_weekday_ratio: float
    
    # Category affinity
    top_categories: List[str]
    category_diversity: float  # entropy-based
    
    # Time patterns
    peak_spending_hour: int
    payday_effect_score: float
    month_end_stress_score: float
    
    # Consistency metrics
    income_regularity: float
    expense_predictability: float
    saving_rate: float
    
    # Behavioral scores (0-100)
    impulse_score: float
    planning_score: float
    frugality_score: float
    risk_tolerance: float
    stress_indicator: float


@dataclass
class ArchetypeResult:
    """Financial personality archetype result."""
    archetype: str
    confidence: float
    description: str
    strengths: List[str]
    growth_areas: List[str]
    dimensions: Dict[str, float]


# Financial archetypes with their characteristics
ARCHETYPES = {
    "conscious_spender": {
        "description": "You carefully consider each purchase and make mindful spending decisions.",
        "strengths": ["Thoughtful decisions", "Low impulse spending", "Good self-awareness"],
        "growth_areas": ["Occasional flexibility", "Enjoyment without guilt"],
        "center": [70, 80, 75, 40, 20]  # impulse, planning, frugality, risk, stress
    },
    "steady_saver": {
        "description": "Your priority is building financial security through consistent saving.",
        "strengths": ["Strong discipline", "Future-oriented", "Consistent habits"],
        "growth_areas": ["Balance with present enjoyment", "Investment diversification"],
        "center": [20, 90, 90, 30, 15]
    },
    "impulsive_buyer": {
        "description": "You tend to make spontaneous purchases based on emotion or opportunity.",
        "strengths": ["Spontaneity", "Enjoyment of life", "Quick decisions"],
        "growth_areas": ["Impulse control", "Long-term planning", "Budgeting"],
        "center": [90, 30, 20, 60, 60]
    },
    "planful_investor": {
        "description": "You think long-term and make strategic financial decisions.",
        "strengths": ["Strategic thinking", "Goal-oriented", "Research-driven"],
        "growth_areas": ["Flexibility for short-term needs", "Analysis paralysis"],
        "center": [30, 95, 60, 70, 30]
    },
    "balanced_manager": {
        "description": "You maintain a healthy equilibrium between spending and saving.",
        "strengths": ["Balance", "Adaptability", "Sustainable habits"],
        "growth_areas": ["Optimization opportunities", "Risk/reward fine-tuning"],
        "center": [50, 65, 55, 50, 35]
    },
    "cautious_conserver": {
        "description": "You prioritize financial security and tend to avoid financial risk.",
        "strengths": ["Risk awareness", "Emergency preparedness", "Stability"],
        "growth_areas": ["Growth opportunities", "Managing fear of loss"],
        "center": [25, 75, 85, 15, 50]
    }
}


def extract_features(transactions: List[Transaction]) -> BehavioralFeatures:
    """
    Extract behavioral features from transaction history.
    
    Args:
        transactions: List of transactions to analyze
        
    Returns:
        BehavioralFeatures with computed metrics
    """
    if not transactions:
        return _default_features()
    
    # Separate credits and debits
    debits = [t for t in transactions if t.type == 'debit']
    credits = [t for t in transactions if t.type == 'credit']
    
    # Basic spending metrics
    amounts = [t.amount for t in debits] if debits else [0]
    avg_amount = np.mean(amounts)
    spending_variance = np.var(amounts) if len(amounts) > 1 else 0
    
    # Transaction frequency
    if len(transactions) > 1:
        date_range = (max(t.created_at for t in transactions) - 
                     min(t.created_at for t in transactions)).days or 1
        frequency = len(transactions) / date_range
    else:
        frequency = 0.5
    
    # Weekend vs weekday spending
    weekend_spending = sum(t.amount for t in debits if t.created_at.weekday() >= 5)
    weekday_spending = sum(t.amount for t in debits if t.created_at.weekday() < 5)
    weekend_ratio = (weekend_spending / (weekday_spending + weekend_spending + 0.01))
    
    # Category analysis
    category_counts = defaultdict(float)
    for t in debits:
        category_counts[t.category] += t.amount
    
    top_categories = sorted(category_counts.keys(), 
                           key=lambda x: category_counts[x], 
                           reverse=True)[:5]
    
    # Category diversity (entropy)
    total_spending = sum(category_counts.values()) or 1
    probs = [v/total_spending for v in category_counts.values()]
    category_diversity = -sum(p * np.log(p + 1e-10) for p in probs) if probs else 0
    category_diversity = min(category_diversity / 3, 1.0)  # Normalize
    
    # Time patterns
    hour_spending = defaultdict(float)
    for t in debits:
        hour_spending[t.created_at.hour] += t.amount
    peak_hour = max(hour_spending.keys(), key=lambda x: hour_spending[x]) if hour_spending else 12
    
    # Payday effect (spending spike around common paydays: 1st, 15th)
    day_spending = defaultdict(float)
    for t in debits:
        day_spending[t.created_at.day] += t.amount
    
    payday_days = sum(day_spending.get(d, 0) for d in [1, 2, 14, 15, 16])
    other_days = sum(v for k, v in day_spending.items() if k not in [1, 2, 14, 15, 16])
    payday_effect = payday_days / (other_days + 1) if other_days else 0
    payday_effect = min(payday_effect, 3.0) / 3.0  # Normalize 0-1
    
    # Month-end stress (spending drop last week)
    month_end_spending = sum(day_spending.get(d, 0) for d in range(25, 32))
    month_start_spending = sum(day_spending.get(d, 0) for d in range(1, 8))
    stress_score = 1 - (month_end_spending / (month_start_spending + 1))
    stress_score = max(0, min(1, stress_score))
    
    # Income regularity (variance in credit amounts/timing)
    if credits:
        credit_amounts = [t.amount for t in credits]
        income_regularity = 1 - min(np.std(credit_amounts) / (np.mean(credit_amounts) + 1), 1)
    else:
        income_regularity = 0.5
    
    # Expense predictability (how consistent is daily spending)
    daily_totals = defaultdict(float)
    for t in debits:
        date_key = t.created_at.date()
        daily_totals[date_key] += t.amount
    
    if len(daily_totals) > 5:
        daily_values = list(daily_totals.values())
        expense_predictability = 1 - min(np.std(daily_values) / (np.mean(daily_values) + 1), 1)
    else:
        expense_predictability = 0.5
    
    # Saving rate
    total_income = sum(t.amount for t in credits)
    total_expense = sum(t.amount for t in debits)
    if total_income > 0:
        saving_rate = max(0, (total_income - total_expense) / total_income)
    else:
        saving_rate = 0
    
    # Compute behavioral scores
    impulse_score = _calculate_impulse_score(debits, avg_amount, spending_variance)
    planning_score = _calculate_planning_score(transactions, saving_rate, income_regularity)
    frugality_score = _calculate_frugality_score(saving_rate, category_diversity)
    risk_tolerance = _calculate_risk_tolerance(transactions, spending_variance)
    stress_indicator = _calculate_stress_indicator(stress_score, payday_effect)
    
    return BehavioralFeatures(
        avg_transaction_amount=avg_amount,
        transaction_frequency=frequency,
        spending_variance=spending_variance,
        weekend_vs_weekday_ratio=weekend_ratio,
        top_categories=top_categories,
        category_diversity=category_diversity,
        peak_spending_hour=peak_hour,
        payday_effect_score=payday_effect,
        month_end_stress_score=stress_score,
        income_regularity=income_regularity,
        expense_predictability=expense_predictability,
        saving_rate=saving_rate,
        impulse_score=impulse_score,
        planning_score=planning_score,
        frugality_score=frugality_score,
        risk_tolerance=risk_tolerance,
        stress_indicator=stress_indicator
    )


def _default_features() -> BehavioralFeatures:
    """Return default features for new users."""
    return BehavioralFeatures(
        avg_transaction_amount=0,
        transaction_frequency=0,
        spending_variance=0,
        weekend_vs_weekday_ratio=0.5,
        top_categories=[],
        category_diversity=0.5,
        peak_spending_hour=12,
        payday_effect_score=0.5,
        month_end_stress_score=0.5,
        income_regularity=0.5,
        expense_predictability=0.5,
        saving_rate=0.5,
        impulse_score=50,
        planning_score=50,
        frugality_score=50,
        risk_tolerance=50,
        stress_indicator=50
    )


def _calculate_impulse_score(debits: List[Transaction], 
                             avg_amount: float,
                             variance: float) -> float:
    """Calculate impulse buying score (0-100)."""
    if not debits:
        return 50
    
    # High variance suggests impulse
    variance_factor = min(variance / (avg_amount + 1) * 10, 50)
    
    # Multiple small transactions in short time
    sorted_debits = sorted(debits, key=lambda x: x.created_at)
    rapid_transactions = 0
    for i in range(1, len(sorted_debits)):
        diff = (sorted_debits[i].created_at - sorted_debits[i-1].created_at).total_seconds()
        if diff < 3600:  # Within 1 hour
            rapid_transactions += 1
    
    rapid_factor = min(rapid_transactions / len(debits) * 100, 50)
    
    return min(100, variance_factor + rapid_factor)


def _calculate_planning_score(transactions: List[Transaction],
                              saving_rate: float,
                              income_regularity: float) -> float:
    """Calculate planning/forward-thinking score (0-100)."""
    # Higher saving rate = more planning
    saving_factor = saving_rate * 50
    
    # Regular income = more stable planning
    regularity_factor = income_regularity * 30
    
    # Consistent transaction patterns
    consistency_factor = 20 if len(transactions) > 50 else len(transactions) / 50 * 20
    
    return min(100, saving_factor + regularity_factor + consistency_factor)


def _calculate_frugality_score(saving_rate: float, 
                               category_diversity: float) -> float:
    """Calculate frugality score (0-100)."""
    # High saving = frugal
    saving_factor = saving_rate * 60
    
    # Low diversity (focused spending) = more frugal
    diversity_factor = (1 - category_diversity) * 40
    
    return min(100, saving_factor + diversity_factor)


def _calculate_risk_tolerance(transactions: List[Transaction],
                              spending_variance: float) -> float:
    """Calculate risk tolerance score (0-100)."""
    # High variance in spending suggests higher risk tolerance
    variance_factor = min(spending_variance / 1000, 50)
    
    # Look for investment-like categories
    investment_keywords = ['invest', 'stock', 'crypto', 'trading', 'fund']
    investment_txns = sum(1 for t in transactions 
                         if any(kw in t.category.lower() for kw in investment_keywords))
    investment_factor = min(investment_txns * 5, 50)
    
    return min(100, variance_factor + investment_factor)


def _calculate_stress_indicator(month_end_stress: float,
                                payday_effect: float) -> float:
    """Calculate financial stress indicator (0-100)."""
    # High month-end stress
    stress_factor = month_end_stress * 50
    
    # Strong payday effect suggests living paycheck to paycheck
    payday_factor = payday_effect * 50
    
    return min(100, stress_factor + payday_factor)


def determine_archetype(features: BehavioralFeatures) -> ArchetypeResult:
    """
    Determine financial personality archetype using clustering.
    
    Uses distance-based matching to find closest archetype center.
    
    Args:
        features: Extracted behavioral features
        
    Returns:
        ArchetypeResult with archetype assignment and confidence
    """
    # Feature vector for comparison
    user_vector = np.array([
        features.impulse_score,
        features.planning_score,
        features.frugality_score,
        features.risk_tolerance,
        features.stress_indicator
    ])
    
    # Find closest archetype
    min_distance = float('inf')
    best_archetype = "balanced_manager"
    
    distances = {}
    for archetype, info in ARCHETYPES.items():
        center = np.array(info["center"])
        distance = np.linalg.norm(user_vector - center)
        distances[archetype] = distance
        
        if distance < min_distance:
            min_distance = distance
            best_archetype = archetype
    
    # Calculate confidence based on separation
    all_distances = list(distances.values())
    second_best = sorted(all_distances)[1] if len(all_distances) > 1 else min_distance
    confidence = min(0.95, 0.5 + (second_best - min_distance) / 100)
    
    archetype_info = ARCHETYPES[best_archetype]
    
    return ArchetypeResult(
        archetype=best_archetype,
        confidence=confidence,
        description=archetype_info["description"],
        strengths=archetype_info["strengths"],
        growth_areas=archetype_info["growth_areas"],
        dimensions={
            "impulse_control": 100 - features.impulse_score,
            "planning_horizon": features.planning_score,
            "frugality": features.frugality_score,
            "risk_tolerance": features.risk_tolerance,
            "financial_stress": 100 - features.stress_indicator
        }
    )


def generate_insights(features: BehavioralFeatures,
                     archetype: ArchetypeResult) -> List[Dict[str, Any]]:
    """
    Generate personalized behavioral insights.
    
    Args:
        features: Extracted behavioral features
        archetype: Determined archetype
        
    Returns:
        List of insight dictionaries
    """
    insights = []
    
    # Impulse spending insight
    if features.impulse_score > 60:
        insights.append({
            "type": "pattern",
            "title": "Impulse Spending Pattern Detected",
            "description": f"You've made multiple quick purchases, often within an hour of each other. Consider a 24-hour rule for non-essential purchases.",
            "category": "spending_behavior",
            "importance": min(features.impulse_score / 100, 0.9)
        })
    
    # Weekend spending insight
    if features.weekend_vs_weekday_ratio > 0.4:
        insights.append({
            "type": "pattern",
            "title": "Weekend Spending Spike",
            "description": f"About {int(features.weekend_vs_weekday_ratio * 100)}% of your spending happens on weekends. Consider setting a separate weekend budget.",
            "category": "timing",
            "importance": 0.6
        })
    
    # Payday effect insight
    if features.payday_effect_score > 0.5:
        insights.append({
            "type": "alert",
            "title": "Payday Effect Noticed",
            "description": "You tend to spend more right after payday. Try automating savings immediately when you receive income.",
            "category": "timing",
            "importance": 0.7
        })
    
    # Month-end stress insight
    if features.month_end_stress_score > 0.6:
        insights.append({
            "type": "alert",
            "title": "Month-End Budget Pressure",
            "description": "Your spending drops significantly at month's end, suggesting budget constraints. Consider spreading expenses more evenly.",
            "category": "budgeting",
            "importance": 0.8
        })
    
    # Saving rate insight
    if features.saving_rate < 0.1:
        insights.append({
            "type": "recommendation",
            "title": "Boost Your Savings",
            "description": f"Your current saving rate is {int(features.saving_rate * 100)}%. Even a small increase can make a big difference over time.",
            "category": "saving",
            "importance": 0.9
        })
    elif features.saving_rate > 0.3:
        insights.append({
            "type": "celebration",
            "title": "Great Saving Habits!",
            "description": f"You're saving {int(features.saving_rate * 100)}% of your income. Keep it up!",
            "category": "saving",
            "importance": 0.5
        })
    
    # Category concentration insight
    if features.category_diversity < 0.3 and features.top_categories:
        top_cat = features.top_categories[0] if features.top_categories else "one category"
        insights.append({
            "type": "pattern",
            "title": "Concentrated Spending",
            "description": f"Most of your spending is in {top_cat}. Review if this aligns with your priorities.",
            "category": "spending_behavior",
            "importance": 0.5
        })
    
    # Peak spending time insight
    peak = features.peak_spending_hour
    if 22 <= peak or peak <= 4:
        insights.append({
            "type": "pattern",
            "title": "Late Night Spending",
            "description": "You tend to spend most during late hours. Late-night purchases are often more impulsive.",
            "category": "timing",
            "importance": 0.6
        })
    
    # Archetype-specific insight
    insights.append({
        "type": "personality",
        "title": f"Your Financial Personality: {archetype.archetype.replace('_', ' ').title()}",
        "description": archetype.description,
        "category": "personality",
        "importance": 0.7
    })
    
    # Sort by importance
    insights.sort(key=lambda x: x["importance"], reverse=True)
    
    return insights[:8]  # Return top 8 insights


def analyze_transactions(transaction_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main entry point for behavioral analysis.
    
    Args:
        transaction_data: List of transaction dictionaries from API
        
    Returns:
        Complete analysis result with archetype, features, and insights
    """
    # Parse transactions
    transactions = []
    for t in transaction_data:
        try:
            created_at = datetime.fromisoformat(t.get("created_at", "").replace("Z", "+00:00"))
        except:
            created_at = datetime.now()
        
        transactions.append(Transaction(
            id=t.get("id", ""),
            amount=float(t.get("amount", 0)),
            currency=t.get("currency", "USD"),
            category=t.get("category", "uncategorized"),
            type=t.get("type", "debit"),
            created_at=created_at,
            description=t.get("description")
        ))
    
    # Extract features
    features = extract_features(transactions)
    
    # Determine archetype
    archetype = determine_archetype(features)
    
    # Generate insights
    insights = generate_insights(features, archetype)
    
    return {
        "archetype": {
            "name": archetype.archetype,
            "confidence": archetype.confidence,
            "description": archetype.description,
            "strengths": archetype.strengths,
            "growth_areas": archetype.growth_areas
        },
        "dimensions": archetype.dimensions,
        "features": {
            "avg_transaction_amount": features.avg_transaction_amount,
            "transaction_frequency": features.transaction_frequency,
            "saving_rate": features.saving_rate,
            "category_diversity": features.category_diversity,
            "top_categories": features.top_categories,
            "peak_spending_hour": features.peak_spending_hour,
            "weekend_vs_weekday_ratio": features.weekend_vs_weekday_ratio
        },
        "scores": {
            "impulse_score": features.impulse_score,
            "planning_score": features.planning_score,
            "frugality_score": features.frugality_score,
            "risk_tolerance": features.risk_tolerance,
            "stress_indicator": features.stress_indicator
        },
        "insights": insights,
        "transaction_count": len(transactions),
        "analysis_date": datetime.now().isoformat()
    }

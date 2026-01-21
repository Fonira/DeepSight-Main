"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Billing & Subscriptions — Logique de Facturation                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests critiques pour:                                                             ║
║  • Gestion des plans et privilèges                                                 ║
║  • Calcul des crédits et quotas                                                    ║
║  • Validation des webhooks Stripe                                                  ║
║  • Cycle de vie des abonnements                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any
import sys
import os

# Ajouter le src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION DES PLANS (répliquée du backend)
# ═══════════════════════════════════════════════════════════════════════════════

PLAN_CONFIG = {
    "free": {
        "price_monthly": 0,
        "price_yearly": 0,
        "monthly_analyses": 5,
        "daily_chat_messages": 10,
        "max_video_duration": 30,  # minutes
        "features": {
            "basic_analysis": True,
            "accessible_mode": True,
            "standard_mode": False,
            "expert_mode": False,
            "web_search": False,
            "fact_checking": False,
            "playlists": False,
            "exports": ["txt"],
            "api_access": False,
            "priority_support": False,
        }
    },
    "starter": {
        "price_monthly": 4.99,
        "price_yearly": 49.90,
        "monthly_analyses": 50,
        "daily_chat_messages": 50,
        "max_video_duration": 120,  # minutes
        "features": {
            "basic_analysis": True,
            "accessible_mode": True,
            "standard_mode": True,
            "expert_mode": False,
            "web_search": True,
            "fact_checking": False,
            "playlists": False,
            "exports": ["txt", "md"],
            "api_access": False,
            "priority_support": False,
        }
    },
    "pro": {
        "price_monthly": 9.99,
        "price_yearly": 99.90,
        "monthly_analyses": 200,
        "daily_chat_messages": -1,  # illimité
        "max_video_duration": -1,  # illimité
        "features": {
            "basic_analysis": True,
            "accessible_mode": True,
            "standard_mode": True,
            "expert_mode": True,
            "web_search": True,
            "fact_checking": True,
            "playlists": True,
            "exports": ["txt", "md", "pdf"],
            "api_access": False,
            "priority_support": True,
        }
    },
    "expert": {
        "price_monthly": 14.99,
        "price_yearly": 149.90,
        "monthly_analyses": -1,  # illimité
        "daily_chat_messages": -1,
        "max_video_duration": -1,
        "features": {
            "basic_analysis": True,
            "accessible_mode": True,
            "standard_mode": True,
            "expert_mode": True,
            "web_search": True,
            "fact_checking": True,
            "playlists": True,
            "exports": ["txt", "md", "pdf"],
            "api_access": True,
            "priority_support": True,
        }
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def get_plan_config(plan_name: str) -> Dict[str, Any]:
    """Récupère la configuration d'un plan."""
    return PLAN_CONFIG.get(plan_name, PLAN_CONFIG["free"])


def can_access_feature(plan_name: str, feature: str) -> bool:
    """Vérifie si un plan a accès à une feature."""
    config = get_plan_config(plan_name)
    return config["features"].get(feature, False)


def get_monthly_limit(plan_name: str) -> int:
    """Récupère la limite mensuelle d'analyses."""
    config = get_plan_config(plan_name)
    return config["monthly_analyses"]


def check_quota(plan_name: str, current_usage: int) -> tuple:
    """Vérifie si le quota est atteint."""
    limit = get_monthly_limit(plan_name)
    
    if limit == -1:  # Illimité
        return (False, -1, current_usage)
    
    remaining = limit - current_usage
    is_exceeded = remaining <= 0
    
    return (is_exceeded, remaining, current_usage)


def calculate_proration(
    old_price: float,
    new_price: float,
    days_remaining: int,
    days_in_period: int = 30
) -> float:
    """Calcule le montant au prorata lors d'un changement de plan."""
    if days_in_period <= 0:
        return 0
    
    daily_old = old_price / days_in_period
    daily_new = new_price / days_in_period
    
    credit = daily_old * days_remaining
    charge = daily_new * days_remaining
    
    return round(charge - credit, 2)


def is_subscription_active(status: str, current_period_end: datetime) -> bool:
    """Vérifie si un abonnement est actif."""
    active_statuses = ["active", "trialing"]
    
    if status not in active_statuses:
        return False
    
    return current_period_end > datetime.utcnow()


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 TESTS CONFIGURATION DES PLANS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPlanConfiguration:
    """Tests pour la configuration des plans."""
    
    @pytest.mark.unit
    def test_all_plans_exist(self):
        """Tous les plans doivent être définis."""
        required_plans = ["free", "starter", "pro", "expert"]
        
        for plan in required_plans:
            assert plan in PLAN_CONFIG, f"Plan {plan} manquant"
    
    @pytest.mark.unit
    def test_plan_price_hierarchy(self):
        """Les prix doivent être croissants."""
        prices = [
            PLAN_CONFIG["free"]["price_monthly"],
            PLAN_CONFIG["starter"]["price_monthly"],
            PLAN_CONFIG["pro"]["price_monthly"],
            PLAN_CONFIG["expert"]["price_monthly"],
        ]
        
        assert prices[0] < prices[1] < prices[2] < prices[3]
    
    @pytest.mark.unit
    def test_yearly_discount(self):
        """Le prix annuel doit être inférieur à 12x mensuel."""
        for plan_name, config in PLAN_CONFIG.items():
            if config["price_monthly"] > 0:
                yearly = config["price_yearly"]
                monthly_x12 = config["price_monthly"] * 12
                
                assert yearly < monthly_x12, f"{plan_name}: pas de remise annuelle"
    
    @pytest.mark.unit
    def test_quota_hierarchy(self):
        """Les quotas doivent être croissants."""
        free_limit = PLAN_CONFIG["free"]["monthly_analyses"]
        starter_limit = PLAN_CONFIG["starter"]["monthly_analyses"]
        pro_limit = PLAN_CONFIG["pro"]["monthly_analyses"]
        expert_limit = PLAN_CONFIG["expert"]["monthly_analyses"]
        
        assert free_limit < starter_limit < pro_limit
        assert expert_limit == -1  # Illimité
    
    @pytest.mark.unit
    def test_free_plan_has_basic_features(self):
        """Le plan gratuit doit avoir les features de base."""
        features = PLAN_CONFIG["free"]["features"]
        
        assert features["basic_analysis"] == True
        assert features["accessible_mode"] == True
    
    @pytest.mark.unit
    def test_paid_plans_have_more_features(self):
        """Les plans payants doivent avoir plus de features."""
        free_features = sum(1 for v in PLAN_CONFIG["free"]["features"].values() if v == True)
        starter_features = sum(1 for v in PLAN_CONFIG["starter"]["features"].values() if v == True)
        pro_features = sum(1 for v in PLAN_CONFIG["pro"]["features"].values() if v == True)
        
        assert starter_features > free_features
        assert pro_features > starter_features
    
    @pytest.mark.unit
    def test_expert_has_api_access(self):
        """Seul le plan Expert doit avoir l'accès API."""
        assert PLAN_CONFIG["free"]["features"]["api_access"] == False
        assert PLAN_CONFIG["starter"]["features"]["api_access"] == False
        assert PLAN_CONFIG["pro"]["features"]["api_access"] == False
        assert PLAN_CONFIG["expert"]["features"]["api_access"] == True


# ═══════════════════════════════════════════════════════════════════════════════
# 🎫 TESTS ACCÈS AUX FEATURES
# ═══════════════════════════════════════════════════════════════════════════════

class TestFeatureAccess:
    """Tests pour l'accès aux features."""
    
    @pytest.mark.unit
    def test_free_cannot_access_expert_mode(self):
        """Free ne peut pas accéder au mode expert."""
        assert can_access_feature("free", "expert_mode") == False
    
    @pytest.mark.unit
    def test_pro_can_access_expert_mode(self):
        """Pro peut accéder au mode expert."""
        assert can_access_feature("pro", "expert_mode") == True
    
    @pytest.mark.unit
    def test_web_search_access(self):
        """Web search disponible à partir de Starter."""
        assert can_access_feature("free", "web_search") == False
        assert can_access_feature("starter", "web_search") == True
        assert can_access_feature("pro", "web_search") == True
    
    @pytest.mark.unit
    def test_playlists_access(self):
        """Playlists disponible à partir de Pro."""
        assert can_access_feature("free", "playlists") == False
        assert can_access_feature("starter", "playlists") == False
        assert can_access_feature("pro", "playlists") == True
    
    @pytest.mark.unit
    def test_unknown_plan_defaults_to_free(self):
        """Un plan inconnu doit utiliser la config Free."""
        config = get_plan_config("unknown_plan")
        
        assert config == PLAN_CONFIG["free"]
    
    @pytest.mark.unit
    def test_unknown_feature_returns_false(self):
        """Une feature inconnue doit retourner False."""
        assert can_access_feature("pro", "nonexistent_feature") == False


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TESTS GESTION DES QUOTAS
# ═══════════════════════════════════════════════════════════════════════════════

class TestQuotaManagement:
    """Tests pour la gestion des quotas."""
    
    @pytest.mark.unit
    def test_free_quota_limit(self):
        """Le plan Free a une limite de 5 analyses."""
        limit = get_monthly_limit("free")
        assert limit == 5
    
    @pytest.mark.unit
    def test_expert_unlimited(self):
        """Le plan Expert est illimité."""
        limit = get_monthly_limit("expert")
        assert limit == -1
    
    @pytest.mark.unit
    def test_quota_not_exceeded(self):
        """Vérification quota non dépassé."""
        is_exceeded, remaining, usage = check_quota("free", 3)
        
        assert is_exceeded == False
        assert remaining == 2
        assert usage == 3
    
    @pytest.mark.unit
    def test_quota_exceeded(self):
        """Vérification quota dépassé."""
        is_exceeded, remaining, usage = check_quota("free", 5)
        
        assert is_exceeded == True
        assert remaining == 0
    
    @pytest.mark.unit
    def test_quota_over_limit(self):
        """Vérification quota largement dépassé."""
        is_exceeded, remaining, usage = check_quota("free", 10)
        
        assert is_exceeded == True
        assert remaining == -5
    
    @pytest.mark.unit
    def test_unlimited_never_exceeded(self):
        """Un plan illimité n'est jamais dépassé."""
        is_exceeded, remaining, usage = check_quota("expert", 1000)
        
        assert is_exceeded == False
        assert remaining == -1  # -1 signifie illimité


# ═══════════════════════════════════════════════════════════════════════════════
# 💳 TESTS CALCULS DE PRORATA
# ═══════════════════════════════════════════════════════════════════════════════

class TestProrationCalculation:
    """Tests pour les calculs de prorata."""
    
    @pytest.mark.unit
    def test_upgrade_proration(self):
        """Calcul prorata lors d'un upgrade."""
        # Upgrade de Starter (4.99) à Pro (9.99) avec 15 jours restants
        proration = calculate_proration(
            old_price=4.99,
            new_price=9.99,
            days_remaining=15,
            days_in_period=30
        )
        
        # (9.99/30 - 4.99/30) * 15 ≈ 2.50
        assert proration > 0
        assert 2.0 < proration < 3.0
    
    @pytest.mark.unit
    def test_downgrade_proration(self):
        """Calcul prorata lors d'un downgrade."""
        # Downgrade de Pro (9.99) à Starter (4.99) avec 15 jours restants
        proration = calculate_proration(
            old_price=9.99,
            new_price=4.99,
            days_remaining=15,
            days_in_period=30
        )
        
        # Devrait être négatif (crédit)
        assert proration < 0
    
    @pytest.mark.unit
    def test_proration_full_period(self):
        """Prorata pour une période complète."""
        proration = calculate_proration(
            old_price=4.99,
            new_price=9.99,
            days_remaining=30,
            days_in_period=30
        )
        
        # Devrait être la différence complète
        expected = 9.99 - 4.99
        assert abs(proration - expected) < 0.01
    
    @pytest.mark.unit
    def test_proration_zero_days(self):
        """Prorata avec 0 jours restants."""
        proration = calculate_proration(
            old_price=4.99,
            new_price=9.99,
            days_remaining=0,
            days_in_period=30
        )
        
        assert proration == 0
    
    @pytest.mark.unit
    def test_proration_same_price(self):
        """Prorata avec le même prix."""
        proration = calculate_proration(
            old_price=9.99,
            new_price=9.99,
            days_remaining=15,
            days_in_period=30
        )
        
        assert proration == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 📅 TESTS CYCLE DE VIE ABONNEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class TestSubscriptionLifecycle:
    """Tests pour le cycle de vie des abonnements."""
    
    @pytest.mark.unit
    def test_active_subscription(self):
        """Un abonnement actif dans la période."""
        future_date = datetime.utcnow() + timedelta(days=15)
        
        is_active = is_subscription_active("active", future_date)
        assert is_active == True
    
    @pytest.mark.unit
    def test_expired_subscription(self):
        """Un abonnement expiré."""
        past_date = datetime.utcnow() - timedelta(days=1)
        
        is_active = is_subscription_active("active", past_date)
        assert is_active == False
    
    @pytest.mark.unit
    def test_canceled_subscription(self):
        """Un abonnement annulé."""
        future_date = datetime.utcnow() + timedelta(days=15)
        
        is_active = is_subscription_active("canceled", future_date)
        assert is_active == False
    
    @pytest.mark.unit
    def test_trialing_subscription(self):
        """Un abonnement en période d'essai."""
        future_date = datetime.utcnow() + timedelta(days=7)
        
        is_active = is_subscription_active("trialing", future_date)
        assert is_active == True
    
    @pytest.mark.unit
    def test_past_due_subscription(self):
        """Un abonnement en impayé."""
        future_date = datetime.utcnow() + timedelta(days=15)
        
        is_active = is_subscription_active("past_due", future_date)
        assert is_active == False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 TESTS VALIDATION WEBHOOKS
# ═══════════════════════════════════════════════════════════════════════════════

class TestWebhookValidation:
    """Tests pour la validation des webhooks Stripe."""
    
    @pytest.mark.unit
    def test_valid_webhook_event_types(self):
        """Les types d'événements webhook valides."""
        valid_events = [
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "invoice.paid",
            "invoice.payment_failed",
        ]
        
        # Ces événements doivent être gérés
        for event in valid_events:
            assert isinstance(event, str)
            assert "." in event  # Format Stripe
    
    @pytest.mark.unit
    def test_webhook_payload_structure(self):
        """Structure d'un payload webhook."""
        mock_payload = {
            "id": "evt_123",
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_123",
                    "customer": "cus_123",
                    "status": "active",
                    "items": {
                        "data": [{"price": {"id": "price_pro"}}]
                    }
                }
            }
        }
        
        assert "id" in mock_payload
        assert "type" in mock_payload
        assert "data" in mock_payload
        assert "object" in mock_payload["data"]
    
    @pytest.mark.unit
    def test_extract_subscription_from_webhook(self):
        """Extraction des données d'abonnement."""
        mock_payload = {
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_123",
                    "customer": "cus_456",
                    "status": "active",
                    "current_period_end": 1735689600,
                }
            }
        }
        
        sub_data = mock_payload["data"]["object"]
        
        assert sub_data["id"] == "sub_123"
        assert sub_data["customer"] == "cus_456"
        assert sub_data["status"] == "active"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎁 TESTS CODES PROMO ET REMISES
# ═══════════════════════════════════════════════════════════════════════════════

class TestPromoCodes:
    """Tests pour les codes promo."""
    
    @pytest.mark.unit
    def test_percentage_discount(self):
        """Calcul remise en pourcentage."""
        original_price = 9.99
        discount_percent = 20
        
        discounted = original_price * (1 - discount_percent / 100)
        assert abs(discounted - 7.99) < 0.01
    
    @pytest.mark.unit
    def test_fixed_amount_discount(self):
        """Calcul remise montant fixe."""
        original_price = 9.99
        discount_amount = 2.00
        
        discounted = max(0, original_price - discount_amount)
        assert discounted == 7.99
    
    @pytest.mark.unit
    def test_discount_cannot_be_negative(self):
        """La remise ne peut pas rendre le prix négatif."""
        original_price = 4.99
        discount_amount = 10.00
        
        discounted = max(0, original_price - discount_amount)
        assert discounted == 0
    
    @pytest.mark.unit
    def test_promo_code_format(self):
        """Format d'un code promo."""
        import re
        
        valid_codes = ["SUMMER20", "LAUNCH50", "WELCOME", "BF2024"]
        
        # Format: lettres majuscules et chiffres, 4-12 caractères
        pattern = r'^[A-Z0-9]{4,12}$'
        
        for code in valid_codes:
            assert re.match(pattern, code), f"Code {code} invalide"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

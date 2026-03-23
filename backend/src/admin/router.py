"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👑 ADMIN ROUTER — Panel d'administration                                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta

from db.database import (
    get_session, User, Summary, CreditTransaction,
    PlaylistAnalysis, AdminLog, VoiceSession, VoiceQuota
)
from auth.dependencies import get_current_admin
from core.config import PLAN_LIMITS

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: str
    plan: str
    credits: int
    is_admin: bool
    email_verified: bool
    total_videos: int
    total_words: int
    created_at: datetime
    last_login: Optional[datetime]


class UpdateUserRequest(BaseModel):
    plan: Optional[str] = None
    credits: Optional[int] = None
    is_admin: Optional[bool] = None

    def validate_plan(self) -> Optional[str]:
        """Valide que le plan est une valeur autorisée"""
        if self.plan is None:
            return None
        valid_plans = ["free", "starter", "pro", "expert", "unlimited"]
        if self.plan not in valid_plans:
            raise ValueError(f"Invalid plan. Must be one of: {', '.join(valid_plans)}")
        return self.plan


class AddCreditsRequest(BaseModel):
    amount: int
    reason: str = "Admin bonus"


class StatsResponse(BaseModel):
    total_users: int
    total_videos: int
    total_words: int
    active_subscriptions: int
    new_users_today: int
    new_users_week: int
    revenue_estimate: float


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=StatsResponse)
async def get_admin_stats(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Statistiques globales pour le dashboard admin"""
    # Total users
    total_users_result = await session.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0
    
    # Total videos
    total_videos_result = await session.execute(
        select(func.sum(User.total_videos))
    )
    total_videos = total_videos_result.scalar() or 0
    
    # Total words
    total_words_result = await session.execute(
        select(func.sum(User.total_words))
    )
    total_words = total_words_result.scalar() or 0
    
    # Active subscriptions (non-free)
    active_subs_result = await session.execute(
        select(func.count(User.id)).where(User.plan != "free")
    )
    active_subscriptions = active_subs_result.scalar() or 0
    
    # New users today
    today = date.today()
    new_today_result = await session.execute(
        select(func.count(User.id)).where(
            func.date(User.created_at) == today
        )
    )
    new_users_today = new_today_result.scalar() or 0
    
    # New users this week
    week_ago = today - timedelta(days=7)
    new_week_result = await session.execute(
        select(func.count(User.id)).where(
            func.date(User.created_at) >= week_ago
        )
    )
    new_users_week = new_week_result.scalar() or 0
    
    # Revenue estimate (based on plans)
    revenue = 0.0
    for plan, limits in PLAN_LIMITS.items():
        if plan == "free" or plan == "unlimited":
            continue
        plan_count_result = await session.execute(
            select(func.count(User.id)).where(User.plan == plan)
        )
        plan_count = plan_count_result.scalar() or 0
        revenue += plan_count * (limits.get("price", 0) / 100)  # centimes -> euros
    
    return StatsResponse(
        total_users=total_users,
        total_videos=total_videos,
        total_words=total_words,
        active_subscriptions=active_subscriptions,
        new_users_today=new_users_today,
        new_users_week=new_users_week,
        revenue_estimate=revenue
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 👥 GESTION UTILISATEURS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Liste tous les utilisateurs avec pagination"""
    query = select(User)
    count_query = select(func.count(User.id))
    
    # Filtres - SÉCURITÉ: Échapper les caractères spéciaux pour éviter l'injection
    if search:
        # Échapper les caractères spéciaux SQL LIKE (%, _, \)
        safe_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_pattern = f"%{safe_search}%"
        search_filter = User.email.ilike(search_pattern) | User.username.ilike(search_pattern)
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    if plan:
        query = query.where(User.plan == plan)
        count_query = count_query.where(User.plan == plan)
    
    # Total
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * per_page
    query = query.order_by(desc(User.created_at)).offset(offset).limit(per_page)
    
    result = await session.execute(query)
    users = result.scalars().all()
    
    return {
        "users": [
            UserAdminResponse(
                id=u.id,
                username=u.username,
                email=u.email,
                plan=u.plan or "free",
                credits=u.credits or 0,
                is_admin=u.is_admin or False,
                email_verified=u.email_verified or False,
                total_videos=u.total_videos or 0,
                total_words=u.total_words or 0,
                created_at=u.created_at,
                last_login=u.last_login
            )
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Détails complets d'un utilisateur"""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Stats
    summaries_result = await session.execute(
        select(func.count(Summary.id)).where(Summary.user_id == user_id)
    )
    summaries_count = summaries_result.scalar() or 0
    
    playlists_result = await session.execute(
        select(func.count(PlaylistAnalysis.id)).where(PlaylistAnalysis.user_id == user_id)
    )
    playlists_count = playlists_result.scalar() or 0
    
    # Dernières transactions
    transactions_result = await session.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user_id)
        .order_by(desc(CreditTransaction.created_at))
        .limit(10)
    )
    transactions = transactions_result.scalars().all()
    
    return {
        "user": UserAdminResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            plan=user.plan or "free",
            credits=user.credits or 0,
            is_admin=user.is_admin or False,
            email_verified=user.email_verified or False,
            total_videos=user.total_videos or 0,
            total_words=user.total_words or 0,
            created_at=user.created_at,
            last_login=user.last_login
        ),
        "stats": {
            "summaries": summaries_count,
            "playlists": playlists_count
        },
        "recent_transactions": [
            {
                "amount": t.amount,
                "type": t.transaction_type or t.type,
                "description": t.description,
                "created_at": t.created_at
            }
            for t in transactions
        ],
        "stripe": {
            "customer_id": user.stripe_customer_id,
            "subscription_id": user.stripe_subscription_id
        }
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    request: UpdateUserRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Met à jour un utilisateur"""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 🔐 SÉCURITÉ: Valider le plan avant mise à jour
    if request.plan is not None:
        try:
            validated_plan = request.validate_plan()
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 🔐 SÉCURITÉ: Empêcher de modifier son propre statut admin
    if user_id == admin.id and request.is_admin is False:
        raise HTTPException(status_code=403, detail="Cannot remove your own admin privileges")

    # Mettre à jour les champs
    if request.plan is not None:
        user.plan = request.plan
    if request.credits is not None:
        user.credits = request.credits
    if request.is_admin is not None:
        user.is_admin = request.is_admin
    
    # Logger l'action
    log = AdminLog(
        admin_id=admin.id,
        action="update_user",
        target_user_id=user_id,
        details=f"Updated: plan={request.plan}, credits={request.credits}, is_admin={request.is_admin}"
    )
    session.add(log)
    
    await session.commit()
    
    return {"success": True, "message": "User updated"}


@router.post("/users/{user_id}/credits")
async def add_credits_to_user(
    user_id: int,
    request: AddCreditsRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Ajoute des crédits à un utilisateur"""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.credits = (user.credits or 0) + request.amount
    
    # Transaction
    transaction = CreditTransaction(
        user_id=user_id,
        amount=request.amount,
        balance_after=user.credits,
        transaction_type="admin_bonus",
        type="admin_bonus",
        description=f"Admin bonus: {request.reason}"
    )
    session.add(transaction)
    
    # Log
    log = AdminLog(
        admin_id=admin.id,
        action="add_credits",
        target_user_id=user_id,
        details=f"Added {request.amount} credits: {request.reason}"
    )
    session.add(log)
    
    await session.commit()
    
    return {"success": True, "new_balance": user.credits}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Supprime un utilisateur et toutes ses données"""
    # 🔐 SÉCURITÉ: Empêcher l'admin de se supprimer lui-même
    if user_id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete your own account from admin panel")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_admin:
        raise HTTPException(status_code=403, detail="Cannot delete admin user")
    
    # Log avant suppression
    log = AdminLog(
        admin_id=admin.id,
        action="delete_user",
        target_user_id=user_id,
        details=f"Deleted user: {user.email}"
    )
    session.add(log)
    
    # Supprimer l'utilisateur (cascade delete les données liées)
    await session.delete(user)
    await session.commit()
    
    return {"success": True, "message": "User deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# 📜 LOGS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/logs")
async def get_admin_logs(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Récupère les logs d'administration"""
    offset = (page - 1) * per_page
    
    result = await session.execute(
        select(AdminLog)
        .order_by(desc(AdminLog.created_at))
        .offset(offset)
        .limit(per_page)
    )
    logs = result.scalars().all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "admin_id": log.admin_id,
                "action": log.action,
                "target_user_id": log.target_user_id,
                "details": log.details,
                "created_at": log.created_at
            }
            for log in logs
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 BACKUP
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/backup/trigger")
async def trigger_backup(
    admin: User = Depends(get_current_admin),
):
    """Trigger a manual database backup."""
    try:
        from scripts.backup_db import run_backup
    except ImportError:
        raise HTTPException(status_code=500, detail="Backup module not available")

    result = await run_backup(upload=True)
    return result


@router.get("/backup/list")
async def list_backups(
    admin: User = Depends(get_current_admin),
):
    """List all available backups (local + S3)."""
    try:
        from scripts.restore_db import list_all_backups
    except ImportError:
        raise HTTPException(status_code=500, detail="Restore module not available")

    backups = await list_all_backups()
    return {"backups": backups, "total": len(backups)}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 OUTILS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reset-monthly-credits")
async def reset_monthly_credits(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """
    Réinitialise les crédits mensuels de tous les utilisateurs selon leur plan.
    À utiliser avec précaution (normalement géré par Stripe).
    """
    result = await session.execute(select(User))
    users = result.scalars().all()
    
    count = 0
    for user in users:
        plan_limits = PLAN_LIMITS.get(user.plan or "free", PLAN_LIMITS["free"])
        new_credits = plan_limits.get("monthly_credits", 10)
        user.credits = new_credits
        count += 1
    
    log = AdminLog(
        admin_id=admin.id,
        action="reset_monthly_credits",
        details=f"Reset credits for {count} users"
    )
    session.add(log)
    
    await session.commit()
    
    return {"success": True, "users_updated": count}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ VOICE CHAT STATS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/voice-stats")
async def get_voice_stats(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """Statistiques d'utilisation du voice chat."""
    now = datetime.now()
    current_year = now.year
    current_month_num = now.month
    current_month = now.strftime("%Y-%m")

    # Total minutes ce mois (depuis VoiceSession)
    total_seconds_result = await session.execute(
        select(func.coalesce(func.sum(VoiceSession.duration_seconds), 0)).where(
            func.extract("year", VoiceSession.started_at) == current_year,
            func.extract("month", VoiceSession.started_at) == current_month_num,
        )
    )
    total_seconds = total_seconds_result.scalar() or 0
    total_minutes = round(total_seconds / 60, 2)

    # Nombre d'utilisateurs actifs voice ce mois
    active_users_result = await session.execute(
        select(func.count(func.distinct(VoiceSession.user_id))).where(
            func.extract("year", VoiceSession.started_at) == current_year,
            func.extract("month", VoiceSession.started_at) == current_month_num,
        )
    )
    active_users = active_users_result.scalar() or 0

    # Nombre de sessions ce mois
    total_sessions_result = await session.execute(
        select(func.count(VoiceSession.id)).where(
            func.extract("year", VoiceSession.started_at) == current_year,
            func.extract("month", VoiceSession.started_at) == current_month_num,
        )
    )
    total_sessions = total_sessions_result.scalar() or 0

    # Moyenne minutes/user
    avg_minutes = round(total_minutes / active_users, 2) if active_users > 0 else 0.0

    # Nombre de quotas atteints (seconds_used >= seconds_limit)
    quota_reached_result = await session.execute(
        select(func.count(VoiceQuota.id)).where(
            VoiceQuota.year == current_year,
            VoiceQuota.month == current_month_num,
            VoiceQuota.seconds_used >= VoiceQuota.seconds_limit,
        )
    )
    quota_reached = quota_reached_result.scalar() or 0

    # Stats par plan
    plan_stats_result = await session.execute(
        select(
            User.plan,
            func.count(func.distinct(VoiceSession.user_id)).label("users"),
            func.coalesce(func.sum(VoiceSession.duration_seconds), 0).label("seconds"),
        )
        .join(User, VoiceSession.user_id == User.id)
        .where(
            func.extract("year", VoiceSession.started_at) == current_year,
            func.extract("month", VoiceSession.started_at) == current_month_num,
        )
        .group_by(User.plan)
    )
    plan_rows = plan_stats_result.all()

    by_plan = {}
    for row in plan_rows:
        plan_name = row.plan or "free"
        plan_users = row.users
        plan_seconds = row.seconds
        plan_minutes = round(plan_seconds / 60, 2)
        by_plan[plan_name] = {
            "users": plan_users,
            "minutes": plan_minutes,
            "avg_minutes_per_user": round(plan_minutes / plan_users, 2) if plan_users > 0 else 0.0,
        }

    return {
        "month": current_month,
        "total_voice_minutes": total_minutes,
        "total_voice_cost_estimated": round(total_minutes * 0.12, 2),
        "active_voice_users": active_users,
        "total_sessions": total_sessions,
        "avg_minutes_per_user": avg_minutes,
        "quota_reached_count": quota_reached,
        "by_plan": by_plan,
    }

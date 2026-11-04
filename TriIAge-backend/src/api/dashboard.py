from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import Date, cast, func, select

from src.api.deps import Db
from src.db.models import Classification, Encounter, Triage, User
from src.schemas import DashboardOut, ModelStats

router = APIRouter(prefix="/dashboard", tags=["painel"])

# o banco guarda em UTC; para "hoje" fazer sentido tem que converter para o horário de Brasília
TZ = "America/Sao_Paulo"


def local_day(column):
    return cast(func.timezone(TZ, column), Date)


TODAY = local_day(func.now())


@router.get("", response_model=DashboardOut)
def dashboard(db: Db, user_id: int | None = None):
    """Números dos cards da tela inicial. Cada perfil usa os que fazem sentido para ele."""
    def count(*where):
        return db.scalar(select(func.count()).select_from(Encounter).where(*where))

    open_ = Encounter.status != "completed"

    # retriagem = qualquer triagem que não seja a primeira do atendimento
    numbered = select(
        Triage.created_at,
        func.row_number().over(partition_by=Triage.encounter_id, order_by=Triage.id).label("n"),
    ).subquery()
    triages_today = db.scalar(select(func.count()).select_from(Triage).where(local_day(Triage.created_at) == TODAY))
    retriages_today = db.scalar(
        select(func.count()).select_from(numbered).where(numbered.c.n > 1, local_day(numbered.c.created_at) == TODAY)
    )

    mine_today = 0
    user = db.get(User, user_id) if user_id else None
    if user and user.role == "ENFERMEIRO":
        mine_today = db.scalar(select(func.count()).select_from(Triage).where(
            Triage.nurse_id == user.id, local_day(Triage.created_at) == TODAY))
    elif user and user.role == "MEDICO":
        mine_today = count(Encounter.doctor_id == user.id, local_day(Encounter.completed_at) == TODAY)

    since = datetime.now(UTC) - timedelta(days=30)
    by_level = {
        level or "none": total
        for level, total in db.execute(
            select(Encounter.urgency_level, func.count()).where(Encounter.created_at >= since)
            .group_by(Encounter.urgency_level)
        ).all()
    }

    stats = db.execute(select(
        func.count(),
        func.count().filter(Classification.matched.is_(False)),
        func.count().filter(Classification.escalated.is_(True)),
        func.count().filter(Classification.needs_human_review.is_(True)),
        func.avg(Classification.confidence),
    )).one()
    overrides = db.scalar(select(func.count()).select_from(Triage).where(Triage.override_reason.is_not(None)))

    return DashboardOut(
        waiting_nurse=count(Encounter.status == "waiting_nurse"),
        waiting_doctor=count(Encounter.status == "waiting_doctor"),
        critical_waiting=count(open_, Encounter.priority <= 2),
        review_waiting=count(open_, Encounter.needs_human_review.is_(True)),
        oldest_waiting_since=db.scalar(
            select(func.min(Encounter.created_at)).where(Encounter.status == "waiting_nurse")
        ),
        created_today=count(local_day(Encounter.created_at) == TODAY),
        completed_today=count(local_day(Encounter.completed_at) == TODAY),
        triages_today=triages_today,
        retriages_today=retriages_today,
        mine_today=mine_today,
        by_level=by_level,
        model=ModelStats(
            classifications=stats[0], unmatched=stats[1], escalated=stats[2], needs_review=stats[3],
            avg_confidence=round(float(stats[4]), 3) if stats[4] is not None else None, overrides=overrides,
        ),
    )

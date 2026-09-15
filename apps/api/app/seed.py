"""Idempotent seed for single-shop / single-haircut invariant."""
import datetime

from app.database import SessionLocal
from app.models.user import User
from app.models.service import Service
from app.models.availability import Availability
from app.models.shop_settings import ShopSettings
from app.core.security import hash_password
from app.config import settings


def seed_all() -> None:
    db = SessionLocal()
    try:
        # 1. ShopSettings singleton
        shop = db.query(ShopSettings).first()
        if not shop:
            shop = ShopSettings(is_open=True, shop_name="Kabarbers")
            db.add(shop)
            db.commit()
            print("[seed] Created ShopSettings singleton")
        else:
            # ensure defaults
            changed = False
            if not shop.shop_name:
                shop.shop_name = "Kabarbers"
                changed = True
            if not getattr(shop, "gcash_number", None):
                shop.gcash_number = "09550996494"
                changed = True
            if not getattr(shop, "gcash_account_name", None):
                shop.gcash_account_name = "MA**N D."
                changed = True
            if changed:
                db.commit()

        # 2. Owner user (single) — always ensure the documented default owner exists
        # 1) Ensure settings.owner_email exists (what we tell users to use)
        default_owner = db.query(User).filter(User.email == settings.owner_email).first()
        if not default_owner:
            default_owner = User(
                email=settings.owner_email,
                password_hash=hash_password(settings.owner_password),
                name=settings.owner_name,
                role="owner",
            )
            db.add(default_owner)
            db.commit()
            db.refresh(default_owner)
            print(f"[seed] Created default owner {default_owner.email}")
        # 2) Also ensure at least one owner role exists for legacy DBs
        owner = db.query(User).filter(User.role == "owner").first()
        if not owner:
            owner = default_owner
        # keep the default owner's role as owner and password in sync with settings
        # (so restart with changed .env updates password)
        if default_owner.role != "owner":
            default_owner.role = "owner"
            db.commit()
        # Pick canonical owner for service creation
        owner = default_owner

        # 3. Singleton haircut service
        service = db.query(Service).filter(Service.is_active == True).first()
        if not service:
            # fallback any service
            service = db.query(Service).first()
        if not service:
            service = Service(
                name="Haircut",
                duration_minutes=30,
                description="Classic haircut - strictly by appointment",
                owner_id=owner.id,
                is_active=True,
            )
            db.add(service)
            db.commit()
            db.refresh(service)
            print(f"[seed] Created singleton Haircut service {service.id}")
        else:
            # normalize singleton
            updated = False
            if service.name != "Haircut":
                service.name = "Haircut"
                updated = True
            if not service.is_active:
                service.is_active = True
                updated = True
            if service.duration_minutes not in (15, 30, 45, 60):
                # keep existing if valid, else default 30
                if service.duration_minutes <= 0:
                    service.duration_minutes = 30
                    updated = True
            if updated:
                db.commit()
            # deactivate any extra services beyond singleton
            extras = db.query(Service).filter(Service.id != service.id).all()
            for e in extras:
                if e.is_active:
                    e.is_active = False
            if extras:
                db.commit()
                print(f"[seed] Deactivated {len(extras)} extra services")

        # refresh service after commit
        service = db.query(Service).filter(Service.is_active == True).first()

        # 4. Availability for singleton — image schedule (lunch 12:30-13:30 excluded):
        # Mon 10-7, Tue CLOSED, Wed 10-7, Thu 10-5, Fri 10-7, Sat 10-5, Sun 10-7
        IMAGE_SCHEDULE = {
            0: [("10:00", "12:30"), ("13:30", "19:00")],  # Mon
            1: [],                                         # Tue OFF
            2: [("10:00", "12:30"), ("13:30", "19:00")],  # Wed
            3: [("10:00", "12:30"), ("13:30", "17:00")],  # Thu
            4: [("10:00", "12:30"), ("13:30", "19:00")],  # Fri
            5: [("10:00", "12:30"), ("13:30", "17:00")],  # Sat
            6: [("10:00", "12:30"), ("13:30", "19:00")],  # Sun
        }

        def _parse(t: str) -> datetime.time:
            return datetime.datetime.strptime(t, "%H:%M").time()

        existing_avail = db.query(Availability).filter(Availability.service_id == service.id).all()
        # Build expected set for comparison
        expected_set = set()
        for d, windows in IMAGE_SCHEDULE.items():
            for s, e in windows:
                expected_set.add((d, s, e))

        current_set = set(
            (a.day_of_week, a.start_time.strftime("%H:%M"), a.end_time.strftime("%H:%M"))
            for a in existing_avail
        )

        if not existing_avail:
            for day, windows in IMAGE_SCHEDULE.items():
                for s, e in windows:
                    db.add(Availability(
                        service_id=service.id,
                        day_of_week=day,
                        start_time=_parse(s),
                        end_time=_parse(e),
                    ))
            db.commit()
            print("[seed] Created image availability Mon 10-19, Tue OFF, Wed 10-19, Thu 10-17, Fri 10-19, Sat 10-17, Sun 10-19 (lunch excluded)")
        elif current_set != expected_set:
            # Migrate existing DB to new schedule
            db.query(Availability).filter(Availability.service_id == service.id).delete()
            db.commit()
            for day, windows in IMAGE_SCHEDULE.items():
                for s, e in windows:
                    db.add(Availability(
                        service_id=service.id,
                        day_of_week=day,
                        start_time=_parse(s),
                        end_time=_parse(e),
                    ))
            db.commit()
            print(f"[seed] Migrated availability {len(current_set)} -> {len(expected_set)} rows to image schedule")
    except Exception as e:
        db.rollback()
        print(f"[seed] Error: {e}")
        raise
    finally:
        db.close()

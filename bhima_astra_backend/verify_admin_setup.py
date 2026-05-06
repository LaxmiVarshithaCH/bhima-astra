#!/usr/bin/env python3
"""
Verification script for admin backend setup.
Checks database state, services, schemas, and router imports.
"""

import json
import os
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from sqlalchemy import inspect, text


def check_admins():
    """Check if admin users exist and return count."""
    db = SessionLocal()
    try:
        # Check if admins table exists
        inspector = inspect(engine)
        if "admins" not in inspector.get_table_names():
            return False, 0, None

        # Count admins
        result = db.execute(text("SELECT COUNT(*) FROM admins")).scalar()
        admin_count = result if result else 0

        # Get test admin email if exists
        test_admin = db.execute(
            text("SELECT email FROM admins WHERE email = 'admin@demo.com' LIMIT 1")
        ).scalar()

        return admin_count > 0, admin_count, test_admin
    except Exception as e:
        print(f"Error checking admins: {e}")
        return False, 0, None
    finally:
        db.close()


def insert_test_admin():
    """Insert a test admin user if none exist."""
    db = SessionLocal()
    try:
        # Check if table exists
        inspector = inspect(engine)
        if "admins" not in inspector.get_table_names():
            print("❌ Admins table does not exist")
            return False

        # Try to insert test admin
        db.execute(
            text("""
            INSERT INTO admins (admin_name, email, password_hash, role)
            VALUES ('Demo Admin', 'admin@demo.com', 'hashed_password_demo', 'admin')
            ON CONFLICT (email) DO NOTHING
        """)
        )
        db.commit()
        print("✅ Test admin inserted or already exists")
        return True
    except Exception as e:
        print(f"Error inserting test admin: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def get_table_counts():
    """Get counts for critical tables."""
    db = SessionLocal()
    tables = {
        "policy_claims": 0,
        "zone_live_cache": 0,
        "agent_state": 0,
        "manager_disruption_flags": 0,
    }

    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        for table_name in tables.keys():
            if table_name in existing_tables:
                count = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
                tables[table_name] = count if count else 0
            else:
                tables[table_name] = 0
    except Exception as e:
        print(f"Error getting table counts: {e}")
    finally:
        db.close()

    return tables


def check_services():
    """Check if all service files exist."""
    backend_path = Path(__file__).parent
    services = [
        "app/services/admin_dashboard_service.py",
        "app/services/admin_claims_service.py",
        "app/services/admin_live_service.py",
        "app/services/analytics_service.py",
        "app/services/admin_service.py",
    ]

    for service in services:
        full_path = backend_path / service
        if not full_path.exists():
            print(f"❌ Missing service: {service}")
            return False
    return True


def check_schemas():
    """Check if all schema files exist."""
    backend_path = Path(__file__).parent
    schemas = [
        "app/schemas/admin_dashboard.py",
        "app/schemas/admin_claims.py",
        "app/schemas/admin_live.py",
        "app/schemas/auth.py",
        "app/schemas/admin.py",
    ]

    for schema in schemas:
        full_path = backend_path / schema
        if not full_path.exists():
            print(f"❌ Missing schema: {schema}")
            return False
    return True


def check_router_imports():
    """Check if main.py has all required router imports."""
    backend_path = Path(__file__).parent
    main_file = backend_path / "app" / "main.py"

    required_imports = [
        "from app.api.v1 import auth",
        "app.include_router(auth.router)",
        "from app.api.v1 import admin",
        "app.include_router(admin.router)",
        "from app.api.v1 import admin_dashboard",
        "app.include_router(admin_dashboard.router)",
        "from app.api.v1 import admin_live",
        "app.include_router(admin_live.router)",
        "from app.api.v1 import admin_claims",
        "app.include_router(admin_claims.router)",
        "from app.api.v1 import analytics",
        "app.include_router(analytics.router)",
    ]

    try:
        with open(main_file, "r") as f:
            content = f.read()

        for import_str in required_imports:
            if import_str not in content:
                print(f"❌ Missing import in main.py: {import_str}")
                return False
        return True
    except Exception as e:
        print(f"Error checking main.py: {e}")
        return False


def main():
    """Run all verification checks."""
    print("🔍 Starting admin setup verification...\n")

    # Check admins
    print("1️⃣ Checking admin users...")
    admins_exist, admin_count, test_admin_email = check_admins()
    print(f"   Admin count: {admin_count}")

    if not admins_exist:
        print("   No admins found. Inserting test admin...")
        insert_test_admin()
        admins_exist, admin_count, test_admin_email = check_admins()

    # Get table counts
    print("\n2️⃣ Checking database tables...")
    table_counts = get_table_counts()
    for table, count in table_counts.items():
        print(f"   {table}: {count} records")

    # Check services
    print("\n3️⃣ Checking service files...")
    services_ok = check_services()
    print(f"   Services: {'✅ OK' if services_ok else '❌ MISSING'}")

    # Check schemas
    print("\n4️⃣ Checking schema files...")
    schemas_ok = check_schemas()
    print(f"   Schemas: {'✅ OK' if schemas_ok else '❌ MISSING'}")

    # Check router imports
    print("\n5️⃣ Checking router imports in main.py...")
    routers_imported = check_router_imports()
    print(f"   Routers: {'✅ OK' if routers_imported else '❌ MISSING'}")

    # Determine status
    has_data = table_counts["policy_claims"] > 0 and table_counts["zone_live_cache"] > 0
    all_services_ready = (
        services_ok and schemas_ok and routers_imported and admins_exist
    )

    if all_services_ready and has_data:
        status = "READY"
    elif all_services_ready:
        status = "NEEDS_DATA"
    else:
        status = "HAS_ISSUES"

    # Build JSON response
    response = {
        "admins_exist": admins_exist,
        "admin_count": admin_count,
        "test_admin_email": test_admin_email,
        "database_tables": table_counts,
        "services_ok": services_ok,
        "schemas_ok": schemas_ok,
        "routers_imported": routers_imported,
        "status": status,
    }

    print("\n" + "=" * 60)
    print("📋 VERIFICATION SUMMARY")
    print("=" * 60)
    print(json.dumps(response, indent=2))

    return response


if __name__ == "__main__":
    main()

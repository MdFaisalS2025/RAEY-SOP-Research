"""
DISCLAIMER: SYNTHETIC / FICTIONAL DEMO ACCOUNTS
================================================================
These are entirely SYNTHETIC demo accounts created solely for RESEARCH and
DEMONSTRATION purposes as part of the Meridian prototype. Passwords are
intentionally simple and published in this repo's docs - this is a
publicly-known demo credential set, not a security boundary. It exists so
the platform can be evaluated without a real hospital directory to
authenticate against; do not reuse these credentials or this pattern for
any account that protects real data.
================================================================

staff_id values ("u1".."u4") deliberately match the ids DEMO_USERS has
always used on the frontend (mock-data.ts) - proposal `initiated_by`,
committee-roster cross-references, and other mock data already reference
these ids, and this keeps them valid without a broader data migration.
"""

DEMO_STAFF_USERS = [
    {
        "staff_id": "u1", "name": "Dr. Sarah Mitchell", "role": "clinical_staff",
        "department": "ICU", "title": "Intensivist / Physician Reviewer",
        "password": "demo1234",
    },
    {
        "staff_id": "u2", "name": "Nurse Educator Marcus Chen", "role": "educator",
        "department": "Education & Training", "title": "Lead Nurse Educator",
        "password": "demo1234",
    },
    {
        "staff_id": "u3", "name": "Dr. Linda Yeo", "role": "governance_compliance",
        "department": "Compliance & Quality", "title": "Chief Compliance Officer",
        "password": "demo1234",
    },
    {
        "staff_id": "u4", "name": "Tariq Farooq", "role": "system_admin",
        "department": "IT & Health Informatics", "title": "Meridian System Administrator",
        "password": "demo1234",
    },
]

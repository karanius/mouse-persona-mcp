"""Seed admin@test.com as an approved consultant so the user can experience Chris's flow."""
import asyncio
import asyncpg
import json

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')

    uid_row = await conn.fetchrow("SELECT id FROM users WHERE email = 'admin@test.com'")
    if not uid_row:
        print('admin@test.com not found')
        return
    uid = str(uid_row['id'])

    # Clean
    await conn.execute(f"DELETE FROM partner_profiles WHERE user_id = '{uid}'::uuid")
    await conn.execute(f"DELETE FROM service_providers WHERE user_id = '{uid}'::uuid")

    from backend.infra.crypto import encrypt_field

    enc_name = encrypt_field('Admin Consultant')
    enc_creds = encrypt_field(json.dumps({'college_id': 'R999999'}))
    meta = json.dumps({
        'insurance': {'doc_type': 'liability_insurance', 'uploaded_at': '2026-05-24T00:00:00+00:00'},
        'cicc_verified': True,
        'cicc_name': 'Admin Consultant',
        'cicc_college_id': 'R999999',
        'cicc_license_class': 'RCIC-L2',
        'cicc_entitled_to_practice': True,
        'cicc_verified_at': '2026-05-24T00:00:00+00:00',
        'cicc_verification_method': 'manual',
        'cicc_evidence': {
            'name': 'Admin Consultant',
            'company': 'CanaDREAMERS',
            'license_class': 'RCIC-L2',
            'entitled_to_practice': 'Yes',
        },
    })
    await conn.execute(
        "INSERT INTO partner_profiles (user_id, taxonomy_path, display_name, credentials, status, onboarding_step, metadata, created_at, verified_at)"
        " VALUES ($1::uuid, 'consultant.rcic', $2, $3, 'approved', 'complete', $4::jsonb, NOW(), NOW())",
        uid, enc_name, enc_creds, meta
    )

    enc_bio = encrypt_field('Platform admin testing the consultant experience.')
    enc_city = encrypt_field('Toronto')
    enc_specs = encrypt_field(json.dumps(['Express Entry', 'Family Sponsorship']))
    enc_langs = encrypt_field(json.dumps(['English']))
    enc_license = encrypt_field('R999999')
    await conn.execute(
        "INSERT INTO service_providers (user_id, name, bio, license_no, location_city, specializations, languages, verified, provider_type)"
        " VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, true, 'consultant')",
        uid, enc_name, enc_bio, enc_license, enc_city, enc_specs, enc_langs
    )

    print(f'Admin consultant profile created: {uid}')
    await conn.close()

asyncio.run(main())

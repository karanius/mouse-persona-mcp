"""Seed Chris Daw as a pending consultant with CICC verified + E&O on file."""
import asyncio
import asyncpg
import json
import uuid

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')

    # Clean
    await conn.execute("DELETE FROM partner_profiles WHERE user_id IN (SELECT id FROM users WHERE email = 'chris@dawimmigration.com')")
    await conn.execute("DELETE FROM service_providers WHERE user_id IN (SELECT id FROM users WHERE email = 'chris@dawimmigration.com')")
    await conn.execute("DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email = 'chris@dawimmigration.com')")
    await conn.execute("DELETE FROM cicc_registry WHERE college_id = 'R409583'")

    row = await conn.fetchrow("SELECT id FROM users WHERE email = 'chris@dawimmigration.com'")
    if not row:
        print('Chris user not found!')
        return
    uid = str(row['id'])
    await conn.execute(f"UPDATE users SET role = 'partner:consultant' WHERE id = '{uid}'::uuid")

    # Encrypt fields
    from backend.infra.crypto import encrypt_field
    enc_name = encrypt_field('Chris Daw')
    enc_creds = encrypt_field(json.dumps({'college_id': 'R409583'}))

    meta = json.dumps({
        'cicc_verified': True,
        'cicc_verified_at': '2026-05-23T04:00:00Z',
        'cicc_verified_by': 'automated_iframe_lookup',
        'cicc_name': 'Christopher Robert Daw',
        'cicc_license_class': 'RCIC-IRB - L3',
        'cicc_entitled_to_practice': True,
        'cicc_college_id': 'R409583',
        'cicc_evidence': {
            'name': 'Christopher Robert Daw',
            'company': 'Daw Immigration Solutions Inc',
            'license_class': 'RCIC-IRB - L3',
            'entitled_to_practice': True
        }
    })

    await conn.execute(
        "INSERT INTO partner_profiles (user_id, taxonomy_path, display_name, credentials, status, onboarding_step, metadata) VALUES ($1::uuid, 'consultant.rcic', $2, $3, 'pending', 'pending_review', $4::jsonb)",
        uid, enc_name, enc_creds, meta
    )

    # Service provider
    enc_bio = encrypt_field('Chris Daw is a Regulated Canadian Immigration Consultant (RCIC) with over 20 years of experience.')
    enc_specs = encrypt_field(json.dumps(['Express Entry', 'Work Permits', 'LMIA', 'IRB Hearings']))
    enc_langs = encrypt_field(json.dumps(['English', 'French']))
    enc_city = encrypt_field('Vancouver')
    enc_license = encrypt_field('R409583')

    await conn.execute(
        "INSERT INTO service_providers (user_id, provider_type, name, bio, license_no, verified, location_city, specializations, languages) VALUES ($1::uuid, 'consultant', $2, $3, $4, true, $5, $6, $7)",
        uid, enc_name, enc_bio, enc_license, enc_city, enc_specs, enc_langs
    )

    # E&O document
    await conn.execute(
        "INSERT INTO documents (user_id, doc_type, s3_key, status) VALUES ($1::uuid, 'liability_insurance', $2, 'pending')",
        uid, str(uuid.uuid4())
    )

    # CICC registry
    await conn.execute(
        "INSERT INTO cicc_registry (college_id, name, company, license_class, entitled_to_practice, scraped_at) VALUES ('R409583', 'Christopher Robert Daw', 'Daw Immigration Solutions Inc', 'RCIC-IRB - L3', true, NOW()) ON CONFLICT (college_id) DO NOTHING"
    )

    count = await conn.fetchval("SELECT COUNT(*) FROM partner_profiles WHERE user_id = $1::uuid", uid)
    print(f'Chris Daw seeded: {count} profile(s), pending + CICC verified + E&O on file')
    await conn.close()

asyncio.run(main())

"""Seed Chris Daw as an approved consultant with CICC verified + E&O on file."""
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
        import bcrypt
        uid = str(uuid.uuid4())
        from backend.infra.crypto import hash_field
        pw_hash = bcrypt.hashpw(b'Chris1234!', bcrypt.gensalt()).decode()
        email_hash = hash_field('chris@dawimmigration.com')
        await conn.execute(
            "INSERT INTO users (id, email, email_hash, role, created_at) VALUES ($1::uuid, $2, $3, 'partner:consultant', NOW())",
            uid, 'chris@dawimmigration.com', email_hash
        )
        await conn.execute(
            "INSERT INTO auth_credentials (user_id, password_hash) VALUES ($1, $2)",
            uid, pw_hash
        )
    else:
        uid = str(row['id'])
    await conn.execute(f"UPDATE users SET role = 'partner:consultant' WHERE id = '{uid}'::uuid")
    await conn.execute(f"UPDATE users SET role = 'partner:consultant' WHERE id = '{uid}'::uuid")

    # Encrypt fields
    from backend.infra.crypto import encrypt_field
    enc_name = encrypt_field('Chris Daw')
    enc_creds = encrypt_field(json.dumps({'college_id': 'R409583'}))

    meta = json.dumps({
        'insurance': {
            'doc_type': 'liability_insurance',
            'uploaded_at': '2026-05-24T00:00:00+00:00',
        },
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
        "INSERT INTO partner_profiles (user_id, taxonomy_path, display_name, credentials, status, onboarding_step, metadata, verified_at) VALUES ($1::uuid, 'consultant.rcic', $2, $3, 'approved', 'complete', $4::jsonb, NOW())",
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

    # E&O document — link to an existing file_registry entry if one exists from a prior upload
    existing_file = await conn.fetchval(
        "SELECT id FROM file_registry WHERE storage_path LIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 1",
        uid
    )
    doc_s3_key = str(existing_file) if existing_file else str(uuid.uuid4())
    await conn.execute(
        "INSERT INTO documents (user_id, doc_type, s3_key, status) VALUES ($1::uuid, 'liability_insurance', $2, 'pending')",
        uid, doc_s3_key
    )

    # CICC registry
    await conn.execute(
        "INSERT INTO cicc_registry (college_id, name, company, license_class, entitled_to_practice, scraped_at) VALUES ('R409583', 'Christopher Robert Daw', 'Daw Immigration Solutions Inc', 'RCIC-IRB - L3', true, NOW()) ON CONFLICT (college_id) DO NOTHING"
    )

    count = await conn.fetchval("SELECT COUNT(*) FROM partner_profiles WHERE user_id = $1::uuid", uid)
    print(f'Chris Daw seeded: {count} profile(s), approved + CICC verified + E&O on file')
    await conn.close()

asyncio.run(main())

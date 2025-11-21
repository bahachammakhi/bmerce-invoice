-- This file will run when the PostgreSQL container starts for the first time
-- Create the database if it doesn't exist
SELECT 'CREATE DATABASE invoice_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'invoice_db')\gexec

-- Grant all privileges to postgres user
GRANT ALL PRIVILEGES ON DATABASE invoice_db TO postgres;
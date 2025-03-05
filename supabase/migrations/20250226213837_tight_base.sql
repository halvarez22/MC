/*
  # Create affiliates schema

  1. New Tables
    - `affiliates`
      - `id` (uuid, primary key)
      - `first_name` (text, not null)
      - `last_name` (text, not null)
      - `email` (text, unique)
      - `phone` (text)
      - `address` (text)
      - `city` (text)
      - `state` (text)
      - `postal_code` (text)
      - `membership_date` (date, default: current date)
      - `status` (text, default: 'active')
      - `created_at` (timestamptz, default: now())
      - `updated_at` (timestamptz, default: now())
  
  2. Security
    - Enable RLS on `affiliates` table
    - Add policy for authenticated users to read all affiliates
    - Add policy for authenticated users to insert affiliates
    - Add policy for authenticated users to update affiliates
    - Add policy for authenticated users to delete affiliates
*/

-- Create affiliates table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  membership_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all affiliates"
  ON affiliates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert affiliates"
  ON affiliates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update affiliates"
  ON affiliates FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete affiliates"
  ON affiliates FOR DELETE
  TO authenticated
  USING (true);
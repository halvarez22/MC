/*
  # Initial Schema for Movimiento Ciudadano

  1. New Tables
    - `profiles`
      - Basic user profile information
      - Linked to Supabase auth.users
    - `affiliates`
      - Main affiliate information
      - Stores personal and contact details
    - `documents`
      - Document metadata and URLs
      - Linked to affiliates
    - `elected_representatives`
      - Information about elected officials
      - Linked to affiliates
    - `positions`
      - Party positions/roles
      - Historical tracking of leadership positions

  2. Security
    - RLS enabled on all tables
    - Policies for different access levels
*/

-- Profiles table for basic user information
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Affiliates table for member information
CREATE TABLE affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
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

-- Documents table for storing document metadata
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliates(id),
  document_type text NOT NULL,
  document_url text NOT NULL,
  upload_date timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Elected representatives table
CREATE TABLE elected_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliates(id),
  position text NOT NULL,
  jurisdiction text NOT NULL,
  term_start date NOT NULL,
  term_end date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Party positions/roles table
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliates(id),
  title text NOT NULL,
  department text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE elected_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policies for affiliates
CREATE POLICY "Staff can view affiliates"
  ON affiliates FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  ));

CREATE POLICY "Staff can insert affiliates"
  ON affiliates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  ));

-- Policies for documents
CREATE POLICY "Staff can manage documents"
  ON documents FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  ));

-- Policies for elected representatives
CREATE POLICY "Public can view elected representatives"
  ON elected_representatives FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Staff can manage elected representatives"
  ON elected_representatives FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  ));

-- Policies for positions
CREATE POLICY "Staff can view positions"
  ON positions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  ));

CREATE POLICY "Admins can manage positions"
  ON positions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ));
-- Run this SQL in Supabase Dashboard > SQL Editor.
create table if not exists public.bookings (
  booking_id text primary key,
  name text not null,
  phone text not null,
  email text default '',
  project text not null,
  budget text default '',
  deadline text default '',
  details text not null,
  address text default '',
  status text not null default 'quote_pending',
  created_at timestamptz not null default now(),
  razorpay_order_id text,
  quoted_amount_paise integer,
  razorpay_payment_id text,
  paid_at timestamptz
);

-- Keep Row Level Security enabled. The backend uses the service-role key
-- from its private environment variables; never expose that key in browser code.
alter table public.bookings enable row level security;

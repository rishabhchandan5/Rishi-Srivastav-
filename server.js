require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })
  : null;

const DATA_DIR = path.join(__dirname, "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, "[]");

function makeId() {
  return "RH-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}
async function getBooking(id) {
  if (supabase) {
    const { data, error } = await supabase.from("bookings").select("*").eq("booking_id", id).maybeSingle();
    if (error) throw error;
    return data;
  }
  const rows = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
  return rows.find(b => b.booking_id === id) || null;
}
async function updateBooking(id, patch) {
  if (supabase) {
    const { error } = await supabase.from("bookings").update(patch).eq("booking_id", id);
    if (error) throw error;
    return;
  }
  const rows = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
  const i = rows.findIndex(b => b.booking_id === id);
  if (i < 0) throw new Error("Booking not found");
  rows[i] = { ...rows[i], ...patch };
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(rows, null, 2));
}

app.post("/api/bookings", async (req, res) => {
  try {
    const { name, phone, email="", project, budget="", deadline="", details, address="" } = req.body || {};
    if (!name || !phone || !project || !details) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }
    if (String(name).length > 100 || String(phone).length > 30 || String(details).length > 3000) {
      return res.status(400).json({ error: "One or more fields are too long." });
    }
    const booking = {
      booking_id: makeId(), name: String(name).trim(), phone: String(phone).trim(),
      email: String(email).trim(), project: String(project), budget: String(budget),
      deadline: String(deadline), details: String(details).trim(),
      address: String(address).trim(), status: "quote_pending",
      created_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from("bookings").insert(booking);
      if (error) throw error;
    } else {
      const rows = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
      rows.push(booking);
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(rows, null, 2));
    }
    return res.status(201).json({ bookingId: booking.booking_id, status: booking.status });
  } catch (err) {
    console.error("Booking save failed:", err.message);
    return res.status(500).json({ error: "Unable to save booking right now. Please try again." });
  }
});

// Owner-side workflow should call this only after confirming the quote with the customer.
// The amount is supplied by the trusted owner/admin interface, never by the public booking form.
app.post("/api/create-order", async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Online payments are not configured yet." });
    }
    const { bookingId, amountInPaise } = req.body || {};
    const amount = Number(amountInPaise);
    if (!bookingId || !Number.isInteger(amount) || amount < 100 || amount > 50000000) {
      return res.status(400).json({ error: "Invalid booking or payment amount." });
    }
    const booking = await getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const order = await razorpay.orders.create({
      amount, currency: "INR", receipt: bookingId,
      notes: { bookingId, project: booking.project }
    });
    await updateBooking(bookingId, {
      razorpay_order_id: order.id,
      quoted_amount_paise: amount,
      status: "payment_pending"
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Create order failed:", err.message);
    res.status(500).json({ error: "Unable to start payment. Please try again." });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: "Payments are not configured." });
    const booking = await getBooking(bookingId);
    if (!booking || booking.razorpay_order_id !== razorpay_order_id) {
      return res.status(404).json({ error: "Booking/order not found." });
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(String(razorpay_signature || ""));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: "Payment signature verification failed." });
    }
    await updateBooking(bookingId, {
      razorpay_payment_id, status: "payment_signature_verified",
      paid_at: new Date().toISOString()
    });
    res.json({ verified: true, bookingId });
  } catch (err) {
    console.error("Payment verification failed:", err.message);
    res.status(500).json({ error: "Could not verify payment." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "RoboHouse" }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`RoboHouse running at http://localhost:${port}`));

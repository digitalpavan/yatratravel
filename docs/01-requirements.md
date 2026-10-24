# Yatra Travels — Phase 1: Planning and Requirements

Status: Draft. Items marked **[CONFIRM]** need sign-off from the business before launch.

---

## 1.1 Business objectives

### Customer-facing goals

| ID | Customers must be able to… | Notes |
|----|-----------------------------|-------|
| C1 | Explore Tirupati and Tirumala pilgrimage packages | Listing page with filters for duration, price and vehicle type |
| C2 | View destinations, vehicle options and tour itineraries | Day-by-day itinerary on each package page |
| C3 | Submit online booking requests | A *request*, not a paid booking. Staff confirm availability by hand |
| C4 | Enquire by WhatsApp and phone | Floating WhatsApp button and click-to-call on every page |
| C5 | View package prices and inclusions | Prices shown as "from ₹X" per vehicle type, with inclusions and exclusions listed |
| C6 | Request a customised travel plan | Free-form form: dates, group size, places, budget |
| C7 | Receive a booking reference and confirmation updates | Reference shown on screen and sent by email/WhatsApp |

### Administrator goals

The administrator must be able to manage all of the following **without editing source code**:

| ID | Manage | Operations |
|----|--------|------------|
| A1 | Packages / services | Create, edit, publish/unpublish, reorder |
| A2 | Enquiries | View, assign status, add notes |
| A3 | Bookings | View, confirm, cancel, mark complete |
| A4 | Prices | Per package × vehicle type, with a seasonal override |
| A5 | Images | Upload, choose cover image, set alt text |
| A6 | Vehicles | Type, seating capacity, AC/non-AC, availability |
| A7 | Website content | Home page banners, contact details, FAQs, policies |

---

## 1.2 Target customers

| Segment | Main need | What the site needs for them |
|---------|-----------|------------------------------|
| Families visiting Tirumala | Safe, comfortable transport and clear timings | Vehicle seating and child-friendly details |
| Pilgrims from other Indian cities | Pickup on arrival, with darshan handled for them | Airport/railway transfer and package bundles |
| Groups visiting several temples | Multi-temple routes, larger vehicles | Tempo Traveller / mini-bus options, group enquiry |
| Local sightseeing customers | Short half-day or full-day trips | Local tour packages with hourly/km pricing |
| Airport / railway pickup customers | Fixed, reliable transfers | Fixed-fare transfer booking |
| Tourists exploring Andhra Pradesh & South India | Multi-day outstation trips | Outstation pricing and custom itineraries |

---

## 1.3 Core business services

All services are **content stored in the database**, not hard-coded pages. Seed data is in
[`content/seed/services.json`](../content/seed/services.json).

| # | Service | Category | Pricing model |
|---|---------|----------|---------------|
| 1 | Tirupati local temple tour | Local tour | Per vehicle, fixed |
| 2 | Tirupati to Tirumala transportation | Transfer | Per vehicle, one-way / return |
| 3 | Tirupati pilgrimage packages | Package | Per package × vehicle |
| 4 | Tirupati–Kanipakam–Srikalahasti tour | Day tour | Per vehicle, fixed |
| 5 | Tirupati–Vellore Golden Temple tour | Day tour | Per vehicle, fixed |
| 6 | Local cab booking | Cab | Hourly / per km |
| 7 | Outstation travel | Cab | Per km with minimum km per day |
| 8 | Customised pilgrimage itineraries | Custom | Quote on request |
| 9 | Airport and railway station transfers | Transfer | Fixed fare per route × vehicle |

> **[CONFIRM]** These services are suggestions. The business must confirm the actual packages, prices,
> schedules, vehicle availability and inclusions. The seed file deliberately leaves every price
> empty (`null`).

---

## Data model (draft)

```
Service ──< ServicePrice >── Vehicle
   │
   ├──< ItineraryStop
   ├──< Image
   └──< Booking ── BookingStatusHistory
Enquiry (standalone: general, WhatsApp click, custom plan)
SiteContent (key/value: banners, phone, WhatsApp number, FAQs, policies)
AdminUser
```

### Booking reference format

`YT-YYMMDD-XXXX`, for example `YT-261024-7K3Q`, where `XXXX` is 4 random characters from an
unambiguous alphabet (no 0/O, 1/I/L). The reference is short enough to read out over the phone
and contains no personal data.

### Booking status lifecycle

```
requested → confirmed → completed
     │           │
     └→ cancelled ←┘
```

Every status change is logged with a timestamp, and the customer gets a notification.

---

## Open questions for the business  **[CONFIRM]**

1. Final list of packages, with prices for each vehicle type.
2. Vehicle fleet: types, seating, AC/non-AC, number of each.
3. Does the business arrange darshan tickets (e.g. ₹300 special entry), or only transport?
4. Is advance payment collected online, or only after confirmation?
5. Which channel carries confirmation updates: email, SMS, WhatsApp, or all three?
6. Business phone number, WhatsApp number and office address.
7. Cancellation and refund policy wording.
8. Languages required (English only, or also Telugu, Tamil, Hindi?).

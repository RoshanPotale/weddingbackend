# 🎯 VENDOR BOOKING MANAGEMENT - QUICK REFERENCE CARD

## 📋 8 API ENDPOINTS AT A GLANCE

### BOOKING OPERATIONS (5 endpoints)

#### 1️⃣ CREATE BOOKING
```
POST /vendor/bookings
Headers: Authorization: Bearer <token>
Body: {
  "bookingDate": "2026-06-15",
  "customerName": "John Doe",
  "contactNumber": "9876543210",
  "bookingFrom": "direct_customer",  // or "platform"
  "bookingAmount": 50000,
  "eventDate": "2026-07-20",
  "eventLocation": "Delhi",
  "notes": "VIP service"
}
Response: 201 Created with booking object + bookingId
```

#### 2️⃣ GET ALL BOOKINGS
```
GET /vendor/bookings
Headers: Authorization: Bearer <token>
Response: 200 OK with array of all bookings (sorted latest first)
```

#### 3️⃣ GET BOOKING BY ID
```
GET /vendor/bookings/{bookingId}
Headers: Authorization: Bearer <token>
Response: 200 OK with booking details
```

#### 4️⃣ UPDATE BOOKING
```
PUT /vendor/bookings/{bookingId}
Headers: Authorization: Bearer <token>
Body: {
  "customerName": "Updated Name",
  "bookingAmount": 55000,
  "eventDate": "2026-07-25",
  "bookingStatus": "completed"
}
Response: 200 OK with updated booking
Note: remainingAmount auto-recalculates if bookingAmount changes
```

#### 5️⃣ DELETE BOOKING
```
DELETE /vendor/bookings/{bookingId}
Headers: Authorization: Bearer <token>
Response: 200 OK - Booking deleted
```

---

### PAYMENT OPERATIONS (2 endpoints)

#### 6️⃣ ADD PAYMENT
```
POST /vendor/bookings/{bookingId}/payment
Headers: Authorization: Bearer <token>
Body: {
  "amountPaid": 15000,
  "paymentMethod": "bank_transfer",  // cash|card|upi|bank_transfer|cheque
  "transactionId": "TXN123456",
  "notes": "Advance payment"
}
Response: 200 OK with updated booking + payment details
Note: paymentStatus auto-updates (pending→partial→completed)
```

#### 7️⃣ GET PAYMENT HISTORY
```
GET /vendor/bookings/{bookingId}/payment-history
Headers: Authorization: Bearer <token>
Response: 200 OK with:
{
  "booking": { ...booking details... },
  "paymentHistory": [ ...all payments... ],
  "summary": {
    "totalBookingAmount": 50000,
    "totalPaid": 30000,
    "remainingAmount": 20000,
    "paymentStatus": "partial",
    "totalPayments": 2
  }
}
```

---

### STATISTICS (1 endpoint)

#### 8️⃣ GET BOOKING STATISTICS
```
GET /vendor/bookings/stats/summary
Headers: Authorization: Bearer <token>
Response: 200 OK with:
{
  "totalBookings": 8,
  "upcomingBookings": 5,
  "completedBookings": 2,
  "cancelledBookings": 1,
  "totalBookingAmount": 350000,
  "totalPaidAmount": 225000,
  "totalPendingAmount": 125000,
  "paymentBreakdown": {
    "completed": 3,
    "partial": 4,
    "pending": 1
  }
}
```

---

## 💡 QUICK FORMULAS

### Remaining Amount Calculation
```
remainingAmount = bookingAmount - paidAmount
```

### Payment Status Rules
```
IF remainingAmount = 0       → status = "completed"
ELSE IF paidAmount > 0       → status = "partial"
ELSE (paidAmount = 0)        → status = "pending"
```

### Validation Rules
```
✓ amountPaid must be > 0
✓ amountPaid cannot exceed remainingAmount
✓ bookingAmount, bookingDate, customerName, contactNumber are required
✓ bookingFrom must be "direct_customer" or "platform"
✓ paymentMethod must be "cash", "card", "upi", or "bank_transfer"
```

---

## 🧪 QUICK POSTMAN TEST WORKFLOW

### Step 1: Create Booking
```
POST /vendor/bookings
Save the returned _id to {{bookingId}} variable
```

### Step 2: View All Bookings
```
GET /vendor/bookings
Verify your booking appears
```

### Step 3: Get Booking Details
```
GET /vendor/bookings/{{bookingId}}
Check remaining amount is correct
```

### Step 4: Add First Payment
```
POST /vendor/bookings/{{bookingId}}/payment
Send: { "amountPaid": 15000, "paymentMethod": "bank_transfer" }
Status should change to "partial"
```

### Step 5: View Payment History
```
GET /vendor/bookings/{{bookingId}}/payment-history
Verify payment was recorded
```

### Step 6: Add Second Payment
```
POST /vendor/bookings/{{bookingId}}/payment
Send: { "amountPaid": 20000, "paymentMethod": "upi" }
Remaining should be recalculated
```

### Step 7: View Statistics
```
GET /vendor/bookings/stats/summary
See aggregated data
```

### Step 8: Update Booking
```
PUT /vendor/bookings/{{bookingId}}
Update any field and verify success
```

### Step 9: Delete Booking
```
DELETE /vendor/bookings/{{bookingId}}
Verify deletion successful
```

---

## 📊 EXAMPLE WORKFLOW: COMPLETE BOOKING CYCLE

### Initial State
```
Create booking with amount: 100,000
- Paid: 0
- Remaining: 100,000
- Status: pending
```

### After Payment 1 (30,000)
```
- Paid: 30,000
- Remaining: 70,000
- Status: partial
- History: 1 payment
```

### After Payment 2 (40,000)
```
- Paid: 70,000
- Remaining: 30,000
- Status: partial
- History: 2 payments
```

### After Payment 3 (30,000)
```
- Paid: 100,000
- Remaining: 0
- Status: completed ✓
- History: 3 payments
```

### Statistics After Complete Booking
```
totalBookings: 1
completedBookings: 1
totalBookingAmount: 100,000
totalPaidAmount: 100,000
totalPendingAmount: 0
paymentBreakdown.completed: 1
```

---

## ⚡ COMMON ERRORS & SOLUTIONS

### Error: "Payment exceeds booking amount"
**Cause**: Trying to pay more than remaining
**Solution**: Check remaining amount and pay less

### Error: "Missing required fields"
**Cause**: Not sending all required fields
**Solution**: Check required fields list above

### Error: "Booking not found"
**Cause**: Wrong bookingId
**Solution**: Copy bookingId from create response

### Error: "Amount paid must be greater than 0"
**Cause**: Sending amountPaid = 0
**Solution**: Send amountPaid > 0

### Error: "Unauthorized"
**Cause**: Invalid or missing token
**Solution**: Login and get fresh token

---

## 🔑 VARIABLE SETUP FOR POSTMAN

In Postman, set these variables in your environment:

```
baseUrl = http://localhost:5000
vendorToken = <your_jwt_token_from_login>
bookingId = <booking_id_from_create_response>
```

---

## ✅ FIELD REFERENCE

### Booking Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| bookingDate | Date | ✓ | When booking was made |
| customerName | String | ✓ | Customer's name |
| contactNumber | String | ✓ | Customer's phone |
| bookingFrom | Enum | ✓ | direct_customer \| platform |
| bookingAmount | Number | - | Total amount (optional) |
| paidAmount | Number | - | Amount paid (auto: 0) |
| remainingAmount | Number | - | Auto-calculated |
| paymentStatus | Enum | - | pending \| partial \| completed |
| bookingStatus | Enum | - | upcoming \| completed \| cancelled |
| eventDate | Date | - | When event happens |
| eventLocation | String | - | Where event is |
| notes | String | - | Additional info |

### Payment Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| amountPaid | Number | ✓ | Must be > 0 |
| paymentMethod | Enum | ✓ | cash \| card \| upi \| bank_transfer |
| transactionId | String | - | Reference number |
| notes | String | - | Payment notes |
| paymentDate | Date | - | Auto-timestamp |

---

## 🎯 ENDPOINT SUMMARY TABLE

| # | Method | Endpoint | Purpose | Auth | Returns |
|---|--------|----------|---------|------|---------|
| 1 | POST | /vendor/bookings | Create | ✓ | Booking |
| 2 | GET | /vendor/bookings | Get all | ✓ | [Booking] |
| 3 | GET | /vendor/bookings/:id | Get one | ✓ | Booking |
| 4 | PUT | /vendor/bookings/:id | Update | ✓ | Booking |
| 5 | DELETE | /vendor/bookings/:id | Delete | ✓ | Success |
| 6 | POST | /vendor/bookings/:id/payment | Pay | ✓ | Payment |
| 7 | GET | /vendor/bookings/:id/payment-history | History | ✓ | Payments |
| 8 | GET | /vendor/bookings/stats/summary | Stats | ✓ | Stats |

---

## 📚 DOCUMENTATION REFERENCES

- **API Details**: See `BOOKING_MANAGEMENT_API.md`
- **Setup Guide**: See `BOOKING_SYSTEM_SETUP.md`
- **Implementation**: See `BOOKING_IMPLEMENTATION_COMPLETE.md`
- **Postman Collection**: Import `Booking_Management_Postman.json`

---

## 🚀 YOU'RE ALL SET!

You now have:
- ✅ 8 working endpoints
- ✅ Complete documentation
- ✅ Postman collection ready
- ✅ Example workflows
- ✅ Quick reference guide

**Start testing!** Import the Postman collection and follow the test workflow above.

---

*Version 1.0.0 | Production Ready* 🎉

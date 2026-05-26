# Booking Management API Documentation

## Overview
This documentation covers all the booking management endpoints added to the Vendor Controller. These endpoints allow vendors to manage bookings, track payments, and generate booking statistics.

## Authentication
All endpoints require vendor authentication. Include the vendor token in the Authorization header:
```
Authorization: Bearer {{vendorToken}}
```

## Base URL
```
{{baseUrl}}/vendor
```

---

## 📋 Booking CRUD Operations

### 1. Create a New Booking
**Endpoint:** `POST /vendor/bookings`

**Description:** Create a new booking for a vendor with customer and event details.

**Request Body:**
```json
{
  "bookingDate": "2026-06-15",
  "customerName": "Rohit Kumar",
  "contactNumber": "9876543210",
  "bookingFrom": "direct_customer",
  "bookingAmount": 50000,
  "eventDate": "2026-07-20",
  "eventLocation": "Delhi Convention Center",
  "notes": "Premium catering service required"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| bookingDate | Date | Yes | Date when booking was made |
| customerName | String | Yes | Name of the customer |
| contactNumber | String | Yes | Customer contact number |
| bookingFrom | String | Yes | Source of booking: `direct_customer` or `platform` |
| bookingAmount | Number | No | Total booking amount |
| eventDate | Date | No | Date of the event/service |
| eventLocation | String | No | Location of the event |
| notes | String | No | Additional notes about the booking |

**Response:**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "bookingDate": "2026-06-15T00:00:00.000Z",
    "customerName": "Rohit Kumar",
    "contactNumber": "9876543210",
    "bookingFrom": "direct_customer",
    "bookingAmount": 50000,
    "paidAmount": 0,
    "remainingAmount": 50000,
    "paymentStatus": "pending",
    "paymentHistory": [],
    "bookingStatus": "upcoming",
    "eventDate": "2026-07-20T00:00:00.000Z",
    "eventLocation": "Delhi Convention Center",
    "notes": "Premium catering service required",
    "createdAt": "2026-05-26T10:30:00.000Z",
    "updatedAt": "2026-05-26T10:30:00.000Z"
  }
}
```

---

### 2. Get All Bookings
**Endpoint:** `GET /vendor/bookings`

**Description:** Retrieve all bookings for the vendor (sorted by date, latest first).

**Query Parameters:** None

**Response:**
```json
{
  "totalBookings": 5,
  "bookings": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "customerName": "Rohit Kumar",
      "bookingDate": "2026-06-15T00:00:00.000Z",
      "bookingAmount": 50000,
      "paidAmount": 15000,
      "remainingAmount": 35000,
      "paymentStatus": "partial",
      "bookingStatus": "upcoming",
      "eventDate": "2026-07-20T00:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Booking by ID
**Endpoint:** `GET /vendor/bookings/:bookingId`

**Description:** Retrieve detailed information about a specific booking.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | String | The ID of the booking |

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "bookingDate": "2026-06-15T00:00:00.000Z",
  "customerName": "Rohit Kumar",
  "contactNumber": "9876543210",
  "bookingFrom": "direct_customer",
  "bookingAmount": 50000,
  "paidAmount": 15000,
  "remainingAmount": 35000,
  "paymentStatus": "partial",
  "paymentHistory": [
    {
      "paymentDate": "2026-06-16T10:30:00.000Z",
      "amountPaid": 15000,
      "paymentMethod": "bank_transfer",
      "transactionId": "TXN123456",
      "notes": "Advance payment"
    }
  ],
  "bookingStatus": "upcoming",
  "eventDate": "2026-07-20T00:00:00.000Z",
  "eventLocation": "Delhi Convention Center",
  "notes": "Premium catering service required",
  "createdAt": "2026-05-26T10:30:00.000Z",
  "updatedAt": "2026-05-26T10:30:00.000Z"
}
```

---

### 4. Update Booking
**Endpoint:** `PUT /vendor/bookings/:bookingId`

**Description:** Update booking details (customer name, contact, amount, dates, status, etc.).

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | String | The ID of the booking |

**Request Body:**
```json
{
  "customerName": "Rohit Kumar",
  "contactNumber": "9876543210",
  "bookingAmount": 55000,
  "eventDate": "2026-07-25",
  "eventLocation": "Mumbai Convention Center",
  "notes": "Updated to premium service",
  "bookingStatus": "upcoming"
}
```

**Response:**
```json
{
  "message": "Booking updated successfully",
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "customerName": "Rohit Kumar",
    "bookingAmount": 55000,
    "remainingAmount": 40000,
    "updatedAt": "2026-05-26T11:00:00.000Z"
  }
}
```

---

### 5. Delete Booking
**Endpoint:** `DELETE /vendor/bookings/:bookingId`

**Description:** Delete a booking from the system.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | String | The ID of the booking |

**Response:**
```json
{
  "message": "Booking deleted successfully"
}
```

---

## 💳 Payment Management

### 6. Add Payment to Booking
**Endpoint:** `POST /vendor/bookings/:bookingId/payment`

**Description:** Record a payment against a booking. Automatically calculates remaining amount and updates payment status.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | String | The ID of the booking |

**Request Body:**
```json
{
  "amountPaid": 15000,
  "paymentMethod": "bank_transfer",
  "transactionId": "TXN123456",
  "notes": "Advance payment received"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amountPaid | Number | Yes | Amount being paid (must be > 0) |
| paymentMethod | String | No | Payment method: `cash`, `card`, `upi`, `bank_transfer`, `cheque` |
| transactionId | String | No | Transaction/Reference ID for the payment |
| notes | String | No | Additional notes about the payment |

**Validation:**
- Amount paid cannot exceed remaining booking amount
- System will validate: `totalPaid + amountPaid ≤ bookingAmount`
- Error if payment exceeds available remaining amount

**Payment Status Auto-Updates:**
- **pending**: No payment received yet (paidAmount = 0)
- **partial**: Some payment received but not complete (0 < paidAmount < bookingAmount)
- **completed**: Full payment received (paidAmount = bookingAmount)

**Response:**
```json
{
  "message": "Payment recorded successfully",
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "customerName": "Rohit Kumar",
    "paidAmount": 15000,
    "remainingAmount": 35000,
    "paymentStatus": "partial",
    "paymentHistory": [
      {
        "paymentDate": "2026-06-16T10:30:00.000Z",
        "amountPaid": 15000,
        "paymentMethod": "bank_transfer",
        "transactionId": "TXN123456",
        "notes": "Advance payment received"
      }
    ]
  },
  "paymentDetails": {
    "amountPaid": 15000,
    "totalPaid": 15000,
    "totalBookingAmount": 50000,
    "remainingAmount": 35000,
    "paymentStatus": "partial"
  }
}
```

---

### 7. Get Payment History
**Endpoint:** `GET /vendor/bookings/:bookingId/payment-history`

**Description:** Retrieve complete payment history for a specific booking.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | String | The ID of the booking |

**Response:**
```json
{
  "booking": {
    "_id": "507f1f77bcf86cd799439011",
    "customerName": "Rohit Kumar",
    "bookingAmount": 50000,
    "paidAmount": 25000,
    "remainingAmount": 25000,
    "paymentStatus": "partial"
  },
  "paymentHistory": [
    {
      "paymentDate": "2026-06-16T10:30:00.000Z",
      "amountPaid": 15000,
      "paymentMethod": "bank_transfer",
      "transactionId": "TXN123456",
      "notes": "Advance payment"
    },
    {
      "paymentDate": "2026-06-20T14:15:00.000Z",
      "amountPaid": 10000,
      "paymentMethod": "upi",
      "transactionId": "UPI789012",
      "notes": "Second installment"
    }
  ],
  "summary": {
    "totalPayments": 2,
    "totalAmountPaid": 25000,
    "totalAmountPending": 25000
  }
}
```

---

## 📊 Statistics & Analytics

### 8. Get Booking Statistics
**Endpoint:** `GET /vendor/bookings/stats/summary`

**Description:** Get comprehensive booking and payment statistics for the vendor.

**Response:**
```json
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

## Payment Calculation Examples

### Example 1: Booking with Partial Payment
```
Initial State:
- Booking Amount: ₹50,000
- Paid Amount: ₹0
- Remaining Amount: ₹50,000
- Payment Status: pending

After Payment 1 (₹15,000):
- Paid Amount: ₹15,000
- Remaining Amount: ₹35,000
- Payment Status: partial

After Payment 2 (₹20,000):
- Paid Amount: ₹35,000
- Remaining Amount: ₹15,000
- Payment Status: partial

After Payment 3 (₹15,000):
- Paid Amount: ₹50,000
- Remaining Amount: ₹0
- Payment Status: completed
```

### Example 2: Booking without Amount (Flexible Booking)
```
Initial State:
- Booking Amount: null
- Paid Amount: ₹0
- Remaining Amount: null
- Payment Status: pending

After Payment 1 (₹10,000):
- Paid Amount: ₹10,000
- Remaining Amount: null (no limit set)
- Payment Status: partial

This allows flexible bookings where amount is determined later.
```

---

## Error Responses

### Missing Required Fields
```json
{
  "message": "Missing required fields: bookingDate, customerName, contactNumber, bookingFrom"
}
```

### Booking Not Found
```json
{
  "message": "Booking not found"
}
```

### Payment Exceeds Booking Amount
```json
{
  "message": "Payment exceeds booking amount. Remaining: ₹35,000"
}
```

### Invalid Payment Amount
```json
{
  "message": "Amount paid must be greater than 0"
}
```

### Vendor Not Found
```json
{
  "message": "Vendor not found"
}
```

---

## Notes
1. **Automatic Calculations**: Remaining amount is automatically calculated whenever booking amount or paid amount changes
2. **Payment History**: All payments are tracked with dates, methods, and transaction IDs
3. **Flexible Bookings**: Bookings can be created without a booking amount for flexible pricing
4. **Date Sorting**: All bookings are returned sorted by date (latest first)
5. **Payment Status**: Automatically updates based on payment amounts
6. **Authorization**: All endpoints require valid vendor token and vendor can only access their own bookings

---

## Implementation Notes

### Remaining Amount Calculation
```
remainingAmount = bookingAmount - paidAmount
```
- Only calculated if `bookingAmount` is set
- Returns `null` if no booking amount is specified

### Payment Status Logic
```
if bookingAmount exists:
  if remainingAmount === 0 → "completed"
  else if paidAmount > 0 → "partial"
  else → "pending"
else:
  if paidAmount > 0 → "partial"
  else → "pending"
```

### Date Handling
- All dates use ISO 8601 format
- Automatically converted to UTC
- `createdAt` and `updatedAt` are auto-managed by MongoDB

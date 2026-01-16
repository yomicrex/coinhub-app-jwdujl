# CoinHub Trade System API Documentation

## Overview
The Trade System enables users to initiate peer-to-peer trades for coins, manage trade offers, communicate through private messages, track shipping status, and report trade violations.

## Database Schema

### Trades Table
- **id**: UUID (Primary Key)
- **initiatorId**: User ID (Foreign Key) - User initiating the trade
- **coinOwnerId**: User ID (Foreign Key) - Owner of the coin being traded
- **coinId**: Coin ID (Foreign Key) - Coin being traded
- **status**: Enum ['pending', 'accepted', 'rejected', 'countered', 'completed', 'cancelled', 'disputed']
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

### Trade Offers Table
- **id**: UUID (Primary Key)
- **tradeId**: UUID (Foreign Key) - Associated trade
- **offererId**: User ID (Foreign Key) - User making the offer
- **offeredCoinId**: UUID (Foreign Key, nullable) - Coin offered in exchange
- **isCounterOffer**: Boolean - Whether this is a counter-offer
- **message**: Text (nullable) - Optional message with the offer
- **status**: Enum ['pending', 'accepted', 'rejected', 'countered']
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

### Trade Messages Table
- **id**: UUID (Primary Key)
- **tradeId**: UUID (Foreign Key) - Associated trade
- **senderId**: User ID (Foreign Key) - User sending the message
- **content**: Text - Message content
- **createdAt**: Timestamp

### Trade Shipping Table
- **id**: UUID (Primary Key)
- **tradeId**: UUID (Foreign Key, unique) - Associated trade
- **initiatorShipped**: Boolean - Whether initiator shipped their coin
- **initiatorTrackingNumber**: Text (nullable) - Tracking number for initiator's shipment
- **initiatorShippedAt**: Timestamp (nullable)
- **initiatorReceived**: Boolean - Whether initiator received the coin owner's coin
- **initiatorReceivedAt**: Timestamp (nullable)
- **ownerShipped**: Boolean - Whether owner shipped their coin
- **ownerTrackingNumber**: Text (nullable) - Tracking number for owner's shipment
- **ownerShippedAt**: Timestamp (nullable)
- **ownerReceived**: Boolean - Whether owner received the initiator's coin
- **ownerReceivedAt**: Timestamp (nullable)
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

### Trade Reports Table
- **id**: UUID (Primary Key)
- **tradeId**: UUID (Foreign Key) - Associated trade
- **reporterId**: User ID (Foreign Key) - User filing the report
- **reportedUserId**: User ID (Foreign Key) - User being reported
- **reason**: Text - Reason for the report
- **description**: Text (nullable) - Detailed description
- **status**: Enum ['pending', 'in_review', 'resolved', 'dismissed']
- **reviewedBy**: User ID (Foreign Key, nullable) - Admin/moderator who reviewed
- **reviewNotes**: Text (nullable) - Notes from review
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

## API Endpoints

### Trade Initiation

#### POST /api/trades/initiate
Initiate a new trade for a coin marked as available for trade

**Authentication Required**: Yes
**Request Body**:
```json
{
  "coinId": "uuid-of-coin"
}
```

**Response (Success - 200)**:
```json
{
  "trade": {
    "id": "uuid",
    "initiatorId": "user-id",
    "coinOwnerId": "user-id",
    "coinId": "uuid",
    "status": "pending",
    "createdAt": "ISO-8601 timestamp",
    "updatedAt": "ISO-8601 timestamp"
  },
  "message": "Trade initiated. You can now send offers to the coin owner."
}
```

**Possible Errors**:
- 404: Coin not found
- 400: Coin not available for trade, Cannot trade own coin, Trade already exists

---

### Trade Management

#### GET /api/trades
Get all trades for the current user

**Authentication Required**: Yes
**Query Parameters**:
- `status`: Optional - Filter by trade status
- `role`: Optional - 'initiator' or 'owner' (if not provided, returns both)

**Response (Success - 200)**:
```json
{
  "trades": [
    {
      "id": "uuid",
      "initiatorId": "user-id",
      "coinOwnerId": "user-id",
      "coinId": "uuid",
      "status": "pending",
      "initiator": {
        "id": "user-id",
        "username": "john",
        "displayName": "John Doe",
        "avatarUrl": "signed-url"
      },
      "coinOwner": {
        "id": "user-id",
        "username": "jane",
        "displayName": "Jane Smith",
        "avatarUrl": "signed-url"
      },
      "coin": {
        "id": "uuid",
        "title": "1944 Penny",
        "country": "USA",
        "year": 1944
      },
      "offers": [
        {
          "id": "uuid",
          "status": "pending",
          "createdAt": "ISO-8601 timestamp"
        }
      ],
      "messages": [
        {
          "id": "uuid",
          "createdAt": "ISO-8601 timestamp"
        }
      ],
      "createdAt": "ISO-8601 timestamp",
      "updatedAt": "ISO-8601 timestamp"
    }
  ]
}
```

---

#### GET /api/trades/:tradeId
Get detailed information about a specific trade

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Response (Success - 200)**:
```json
{
  "id": "uuid",
  "initiatorId": "user-id",
  "coinOwnerId": "user-id",
  "coinId": "uuid",
  "status": "pending",
  "initiator": {
    "id": "user-id",
    "username": "john",
    "displayName": "John Doe",
    "avatarUrl": "signed-url"
  },
  "coinOwner": {
    "id": "user-id",
    "username": "jane",
    "displayName": "Jane Smith",
    "avatarUrl": "signed-url"
  },
  "coin": {
    "id": "uuid",
    "title": "1944 Penny",
    "country": "USA",
    "year": 1944,
    "condition": "Mint",
    "visibility": "public",
    "tradeStatus": "open_to_trade"
  },
  "offers": [
    {
      "id": "uuid",
      "offerer": {
        "id": "user-id",
        "username": "john",
        "displayName": "John Doe",
        "avatarUrl": "signed-url"
      },
      "offeredCoin": {
        "id": "uuid",
        "title": "1950 Nickel",
        "country": "USA",
        "year": 1950
      },
      "message": "I'd like to trade this nickel for your penny",
      "status": "pending",
      "createdAt": "ISO-8601 timestamp"
    }
  ],
  "messages": [
    {
      "id": "uuid",
      "sender": {
        "id": "user-id",
        "username": "john",
        "displayName": "John Doe",
        "avatarUrl": "signed-url"
      },
      "content": "Hi, I'm interested in your penny!",
      "createdAt": "ISO-8601 timestamp"
    }
  ],
  "shipping": {
    "id": "uuid",
    "tradeId": "uuid",
    "initiatorShipped": false,
    "initiatorTrackingNumber": null,
    "initiatorShippedAt": null,
    "initiatorReceived": false,
    "initiatorReceivedAt": null,
    "ownerShipped": false,
    "ownerTrackingNumber": null,
    "ownerShippedAt": null,
    "ownerReceived": false,
    "ownerReceivedAt": null
  },
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp"
}
```

**Possible Errors**:
- 404: Trade not found
- 403: Unauthorized (user not part of trade)

---

### Trade Offers

#### POST /api/trades/:tradeId/offers
Create a new trade offer or counter-offer

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Request Body**:
```json
{
  "offeredCoinId": "uuid-of-coin-optional",
  "message": "I can offer this coin along with cash"
}
```

**Response (Success - 200)**:
```json
{
  "offerId": "uuid",
  "status": "success",
  "message": "Offer created successfully"
}
```

**Possible Errors**:
- 404: Trade not found, Offered coin not found
- 403: Unauthorized, Cannot offer other user's coin
- 400: Validation error

---

#### POST /api/trades/:tradeId/offers/:offerId/accept
Accept a trade offer (coin owner only)

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade
- `offerId`: UUID of the offer

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Offer accepted. Prepare your coin for shipping."
}
```

**Possible Errors**:
- 404: Trade not found, Offer not found
- 403: Only coin owner can accept offers

---

#### POST /api/trades/:tradeId/offers/:offerId/reject
Reject a trade offer (coin owner only)

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade
- `offerId`: UUID of the offer

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Offer rejected."
}
```

**Possible Errors**:
- 404: Trade not found, Offer not found
- 403: Only coin owner can reject offers

---

### Messaging

#### POST /api/trades/:tradeId/messages
Send a message in a trade conversation

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Request Body**:
```json
{
  "content": "Great! I'm excited about this trade. When can you ship?"
}
```

**Response (Success - 200)**:
```json
{
  "messageId": "uuid",
  "status": "success",
  "message": "Message sent successfully"
}
```

**Possible Errors**:
- 404: Trade not found
- 403: Unauthorized (user not part of trade)
- 400: Validation error

---

### Shipping & Fulfillment

#### POST /api/trades/:tradeId/shipping/initiate
Mark coins as shipped with optional tracking number

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Request Body**:
```json
{
  "shipped": true,
  "trackingNumber": "1234567890"
}
```

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Coins marked as shipped"
}
```

**Possible Errors**:
- 404: Trade not found
- 400: Trade not accepted yet
- 403: Unauthorized (user not part of trade)

---

#### POST /api/trades/:tradeId/shipping/received
Mark coins as received (auto-completes trade if both parties received)

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Coins marked as received"
}
```

**Possible Errors**:
- 404: Trade not found
- 403: Unauthorized (user not part of trade)

---

### Trade Reports & Disputes

#### POST /api/trades/:tradeId/report
Report a trade violation or dispute

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Request Body**:
```json
{
  "reason": "Item not as described",
  "description": "The coin I received is damaged and doesn't match the photos"
}
```

**Response (Success - 200)**:
```json
{
  "reportId": "uuid",
  "status": "success",
  "message": "Trade violation reported. Our support team will review this shortly."
}
```

**Possible Errors**:
- 404: Trade not found
- 403: Unauthorized (user not part of trade)
- 400: Validation error

---

#### GET /api/trades/:tradeId/reports
Get all reports for a trade (admin/moderator only)

**Authentication Required**: Yes
**Authorization Required**: Admin or Moderator role
**URL Parameters**:
- `tradeId`: UUID of the trade

**Response (Success - 200)**:
```json
{
  "reports": [
    {
      "id": "uuid",
      "tradeId": "uuid",
      "reporter": {
        "id": "user-id",
        "username": "john",
        "displayName": "John Doe"
      },
      "reportedUser": {
        "id": "user-id",
        "username": "jane",
        "displayName": "Jane Smith"
      },
      "reason": "Item not as described",
      "description": "The coin I received is damaged...",
      "status": "pending",
      "reviewer": null,
      "reviewNotes": null,
      "createdAt": "ISO-8601 timestamp",
      "updatedAt": "ISO-8601 timestamp"
    }
  ]
}
```

**Possible Errors**:
- 404: Trade not found
- 403: Unauthorized (not admin/moderator)

---

### Trade Cancellation

#### POST /api/trades/:tradeId/cancel
Cancel a trade (with restrictions based on status)

**Authentication Required**: Yes
**URL Parameters**:
- `tradeId`: UUID of the trade

**Cancellation Rules**:
- Pending/Countered: Initiator can cancel
- Accepted: Either party can cancel
- Completed/Cancelled/Disputed: Cannot cancel

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Trade cancelled"
}
```

**Possible Errors**:
- 404: Trade not found
- 400: Cannot cancel this trade in its current status
- 403: Unauthorized (user cannot cancel in current status)

---

## Trade Status Flow

```
pending
  ↓
  ├→ countered (if counter-offer made)
  │   ↓
  │   ├→ accepted (offer accepted by coin owner)
  │   │   ↓
  │   │   ├→ completed (both parties shipped and received)
  │   │   ├→ cancelled (either party cancels)
  │   │   └→ disputed (one party reports violation)
  │   │
  │   └→ rejected (offer rejected by coin owner)
  │
  ├→ accepted (initial offer accepted)
  │   ↓
  │   ├→ completed (both parties shipped and received)
  │   ├→ cancelled (either party cancels)
  │   └→ disputed (one party reports violation)
  │
  ├→ cancelled (initiator cancels before offer)
  │
  └→ rejected (if initial offer rejected)
```

## Authentication & Authorization

All endpoints require authentication. Authorization is enforced based on user roles:

- **Regular Users**: Can initiate trades, make offers, send messages, report violations
- **Coin Owners**: Can accept/reject offers, manage shipping
- **Admins/Moderators**: Can view and manage trade reports

## Error Handling

All endpoints follow standard REST conventions:
- 200: Success
- 400: Bad request (validation errors)
- 403: Forbidden (authorization errors)
- 404: Not found
- 500: Internal server error
- 503: Service unavailable

## Notes

- Trade offers are immutable once created
- Messages cannot be edited or deleted
- Shipping status is tracked independently for both parties
- Trade reports automatically set trade status to 'disputed'
- Completed trades become read-only
- All timestamps are in ISO-8601 format
- Avatar URLs are generated as signed URLs for temporary access

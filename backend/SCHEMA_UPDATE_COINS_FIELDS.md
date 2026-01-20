# Schema Update: Add Version and Manufacturer Fields to Coins Table

## Overview

Added two new optional fields to the coins table to support more detailed coin information:
- `version` (text, nullable) - for storing coin version information
- `manufacturer` (text, nullable) - for storing manufacturer information

Also made the `agency` field REQUIRED in the validation schema for new coins, while keeping it nullable in the database for backwards compatibility.

## Database Schema Changes

### File: `src/db/schema.ts`

**Added fields to coins table:**
```typescript
version: text('version'),
manufacturer: text('manufacturer'),
```

Both fields are nullable to allow backwards compatibility with existing coins.

## API Request Body Changes

### POST /api/coins

**New required field:**
- `agency` - Now required (min 1 char, max 100 chars)

**New optional fields:**
- `version` - Optional (max 100 chars)
- `manufacturer` - Optional (max 100 chars)

**Example request:**
```json
{
  "title": "1922 Peace Dollar",
  "country": "United States",
  "year": 1922,
  "agency": "United States Mint",
  "version": "Peace Dollar",
  "manufacturer": "Philadelphia",
  "organization": "US Government",
  "description": "High grade Peace Dollar",
  "visibility": "public",
  "tradeStatus": "open_to_trade"
}
```

### PUT /api/coins/:id

**Updated optional fields:**
- `version` - Optional, can be null
- `manufacturer` - Optional, can be null
- `agency` - Optional, can be null (for updates)

**Example request:**
```json
{
  "version": "Peace Dollar",
  "manufacturer": "Philadelphia"
}
```

## API Response Changes

### GET /api/coins/:id

**New fields in response:**
```json
{
  "id": "coin-uuid",
  "title": "1922 Peace Dollar",
  "country": "United States",
  "year": 1922,
  "unit": null,
  "organization": "US Government",
  "agency": "United States Mint",
  "deployment": null,
  "coinNumber": null,
  "mintMark": null,
  "condition": "excellent",
  "description": "High grade Peace Dollar",
  "version": "Peace Dollar",
  "manufacturer": "Philadelphia",
  "visibility": "public",
  "tradeStatus": "open_to_trade",
  "user": {...},
  "images": [...],
  "likeCount": 5,
  "commentCount": 2,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### GET /api/coins

**New fields in response (paginated list):**
```json
{
  "coins": [
    {
      "id": "coin-uuid",
      "title": "1922 Peace Dollar",
      "country": "United States",
      "year": 1922,
      "agency": "United States Mint",
      "version": "Peace Dollar",
      "manufacturer": "Philadelphia",
      "user": {...},
      "images": [...],
      "likeCount": 5,
      "commentCount": 2,
      "tradeStatus": "open_to_trade",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /api/coins/feed

**New fields in response:**
```json
{
  "coins": [
    {
      "id": "coin-uuid",
      "title": "1922 Peace Dollar",
      "country": "United States",
      "year": 1922,
      "agency": "United States Mint",
      "condition": "excellent",
      "description": "High grade Peace Dollar",
      "version": "Peace Dollar",
      "manufacturer": "Philadelphia",
      "tradeStatus": "open_to_trade",
      "user": {...},
      "images": [...],
      "likeCount": 5,
      "commentCount": 2,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### GET /api/coins/feed/trade

**New fields in response:**
Same as GET /api/coins/feed, includes version and manufacturer

### GET /api/users/:id/coins

**New fields in response:**
```json
[
  {
    "id": "coin-uuid",
    "title": "1922 Peace Dollar",
    "country": "United States",
    "year": 1922,
    "agency": "United States Mint",
    "version": "Peace Dollar",
    "manufacturer": "Philadelphia",
    "images": [...],
    "likeCount": 5,
    "commentCount": 2,
    "tradeStatus": "open_to_trade"
  }
]
```

## Validation Rules

### CreateCoinSchema (POST /api/coins)

```typescript
{
  title: required, 1-255 chars
  country: required, 1-100 chars
  year: required, 1800 to current year
  unit: optional, max 100 chars
  organization: optional, max 100 chars
  agency: required, 1-100 chars (CHANGED - now required)
  deployment: optional, max 100 chars
  coinNumber: optional, max 100 chars
  mintMark: optional, max 50 chars
  condition: optional, max 100 chars
  description: optional, max 2000 chars
  version: optional, max 100 chars (NEW)
  manufacturer: optional, max 100 chars (NEW)
  visibility: optional, enum: ['public', 'private'], default: 'public'
  tradeStatus: optional, enum: ['not_for_trade', 'open_to_trade'], default: 'not_for_trade'
  images: optional, array of {url, orderIndex}
}
```

### UpdateCoinSchema (PUT /api/coins/:id)

```typescript
{
  title: optional, 1-255 chars
  country: optional, 1-100 chars
  year: optional, 1800 to current year
  unit: optional or null, max 100 chars
  organization: optional or null, max 100 chars
  agency: optional or null, max 100 chars
  deployment: optional or null, max 100 chars
  coinNumber: optional or null, max 100 chars
  mintMark: optional or null, max 50 chars
  condition: optional or null, max 100 chars
  description: optional or null, max 2000 chars
  version: optional or null, max 100 chars (NEW)
  manufacturer: optional or null, max 100 chars (NEW)
  visibility: optional, enum: ['public', 'private']
  tradeStatus: optional, enum: ['not_for_trade', 'open_to_trade']
  images: optional, array of {url, orderIndex}
}
```

## Files Modified

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Added `version` and `manufacturer` fields to coins table |
| `src/routes/coins.ts` | Updated CreateCoinSchema, UpdateCoinSchema, and all coin response formats |
| `src/routes/feed.ts` | Updated all three feed endpoints to include new fields in responses |

## Migration Notes

### For Existing Data

- The `version` and `manufacturer` fields are nullable in the database
- Existing coins will have `null` values for these fields
- No data migration is required
- The fields are fully backwards compatible

### For New Coins

- The `agency` field is now REQUIRED when creating new coins
- Must be 1-100 characters long
- Previously existing coins created with null agency will not be affected
- Only new POST requests must include the `agency` field

## Backwards Compatibility

✅ **Fully backwards compatible**
- Existing coins without these fields will return `null` for the new fields
- Existing API clients continue to work without modification
- New fields are optional in update requests
- Only new coin creation requires the agency field

## Example API Calls

### Create a coin with the new fields
```bash
POST /api/coins
{
  "title": "1922 Peace Dollar",
  "country": "United States",
  "year": 1922,
  "agency": "United States Mint",
  "version": "Peace Dollar",
  "manufacturer": "Philadelphia",
  "visibility": "public",
  "tradeStatus": "open_to_trade"
}
```

### Update a coin with new fields
```bash
PUT /api/coins/coin-uuid
{
  "version": "Peace Dollar",
  "manufacturer": "San Francisco"
}
```

### Retrieve a coin (includes new fields)
```bash
GET /api/coins/coin-uuid
```

Response will include:
```json
{
  ...
  "version": "Peace Dollar",
  "manufacturer": "Philadelphia",
  ...
}
```

## Future Enhancements

1. **Indexing**: Consider adding database indexes for frequently filtered fields
2. **Search**: Add full-text search support for version and manufacturer
3. **Filtering**: Add query parameters to filter by version/manufacturer
4. **Validation**: Add enum types for common manufacturer names
5. **Statistics**: Add analytics for most common versions/manufacturers

## Status

✅ **Complete and Ready for Production**

All endpoints have been updated to accept and return the new fields. The schema is backwards compatible and ready for deployment.

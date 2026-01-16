# Coins Up for Trade Feed API

## Endpoint: GET /api/coins/feed/trade

Retrieves all publicly visible coins marked as available for trade, displayed in chronological order (most recent first). This endpoint provides a central discovery location for coins available in the community for trading.

### Access Control
- **Authentication**: Optional (not required, but enhances experience)
- **Visibility**: Public - anyone can view coins available for trade

### Request

#### URL
```
GET /api/coins/feed/trade
```

#### Query Parameters

| Parameter | Type    | Default | Max    | Description                          |
|-----------|---------|---------|--------|--------------------------------------|
| limit     | integer | 20      | 100    | Number of coins per page             |
| offset    | integer | 0       | -      | Number of coins to skip              |
| country   | string  | null    | -      | Filter by country (optional)         |
| year      | integer | null    | -      | Filter by year (optional)            |

#### Example Requests

Get first 20 coins up for trade:
```
GET /api/coins/feed/trade
```

Get specific page with custom limit:
```
GET /api/coins/feed/trade?limit=50&offset=50
```

Filter by country and year:
```
GET /api/coins/feed/trade?country=USA&year=1944&limit=20
```

### Response

#### Success (200 OK)

```json
{
  "coins": [
    {
      "id": "uuid",
      "title": "1944 Penny",
      "country": "USA",
      "year": 1944,
      "condition": "Mint",
      "description": "A rare 1944 penny in mint condition",
      "tradeStatus": "open_to_trade",
      "user": {
        "id": "user-id",
        "username": "coinCollector",
        "displayName": "John Collector",
        "avatarUrl": "https://signed-url-to-avatar.jpg"
      },
      "images": [
        {
          "id": "uuid",
          "url": "https://signed-url-to-coin-image.jpg",
          "orderIndex": 0
        }
      ],
      "likeCount": 15,
      "commentCount": 3,
      "userHasLiked": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

#### Error Responses

**503 Service Unavailable** - Database error
```json
{
  "error": "Database error"
}
```

**500 Internal Server Error** - Unexpected error
```json
{
  "error": "Failed to fetch feed"
}
```

### Response Fields

#### Coin Object

| Field           | Type    | Description                                    |
|-----------------|---------|------------------------------------------------|
| id              | string  | Unique coin identifier (UUID)                  |
| title           | string  | Coin title/name                                |
| country         | string  | Country of origin                              |
| year            | integer | Year the coin was minted                       |
| condition       | string  | Condition of the coin (e.g., "Mint", "Fine")  |
| description     | string  | Detailed description of the coin               |
| tradeStatus     | string  | Always "open_to_trade" for this feed           |
| user            | object  | Owner's user information (see below)           |
| images          | array   | Array of coin images (see below)               |
| likeCount       | integer | Number of users who liked this coin            |
| commentCount    | integer | Number of comments on this coin                |
| userHasLiked    | boolean | Whether authenticated user has liked this coin |
| createdAt       | string  | ISO-8601 timestamp of coin creation            |
| updatedAt       | string  | ISO-8601 timestamp of last update              |

#### User Object

| Field       | Type   | Description                                |
|-------------|--------|-------------------------------------------|
| id          | string | User ID                                    |
| username    | string | Unique username                            |
| displayName | string | User's display name                        |
| avatarUrl   | string | Signed URL to user's avatar (or null)     |

#### Image Object

| Field      | Type    | Description                          |
|------------|---------|--------------------------------------|
| id         | string  | Image identifier (UUID)              |
| url        | string  | Signed URL to the coin image         |
| orderIndex | integer | Display order (0 = primary image)    |

#### Pagination Info

| Field  | Type    | Description                   |
|--------|---------|-------------------------------|
| total  | integer | Total coins matching filters  |
| limit  | integer | Number of coins in response   |
| offset | integer | Number of coins skipped       |

### Features

✅ **Chronological Ordering** - Most recently added coins appear first
✅ **Public & Searchable** - Accessible to all users (authenticated or anonymous)
✅ **Smart Filtering** - Filter by country, year, or both
✅ **Pagination Support** - Configurable page size (1-100 coins per page)
✅ **Like Detection** - Shows if authenticated user has liked each coin
✅ **Engagement Metrics** - Displays like and comment counts
✅ **Complete Metadata** - Includes condition, description, and images
✅ **Image Handling** - All images returned as signed URLs for secure access
✅ **Avatar URLs** - User avatars also provided as signed URLs
✅ **Error Resilience** - Gracefully handles missing/invalid images with null values

### Use Cases

1. **Discovery** - Users browse coins available for trade in their area
2. **Search** - Find specific types of coins by country or year
3. **Market Insight** - See what coins are popular for trading
4. **Trade Initiation** - Users find and initiate trades for coins they want
5. **Mobile Apps** - Perfect for mobile app integration with pagination

### Integration Tips

- Use pagination to handle large result sets efficiently
- Cache results with a TTL of 5-10 minutes to reduce database load
- Implement infinite scroll by incrementing offset with each request
- Display user avatars from avatarUrl to build community presence
- Show like counts to highlight popular coins
- Use the trade_status field to identify coins available for trade
- Handle null image URLs gracefully with placeholder images

### Rate Limiting

Recommended limits:
- **Anonymous users**: 100 requests/minute
- **Authenticated users**: 300 requests/minute

### Example JavaScript Usage

```javascript
// Fetch first page of trade coins
const response = await fetch('/api/coins/feed/trade?limit=20&offset=0');
const { coins, total, limit, offset } = await response.json();

// Filter by country
const usCoins = await fetch('/api/coins/feed/trade?country=USA&limit=20');

// Check if user liked a coin
coins.forEach(coin => {
  if (coin.userHasLiked) {
    console.log(`You liked "${coin.title}"`);
  }
});

// Handle pagination
const nextPage = () => {
  const newOffset = offset + limit;
  return fetch(`/api/coins/feed/trade?limit=${limit}&offset=${newOffset}`);
};
```

### Notes

- Coins must be marked as `open_to_trade` (tradeStatus) to appear in this feed
- Only public coins (visibility: "public") are shown
- The `userHasLiked` field is only accurate for authenticated users
- Avatar and image URLs are temporary signed URLs (typically 1-24 hour expiry)
- Both parties in a trade can offer any of their own coins to complete the trade
- This feed auto-populates when users mark coins as "open_to_trade"

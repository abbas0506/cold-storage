# Statistics API Documentation

This document describes the statistics endpoints for the Cold Storage Management System.

## Base URL
All endpoints are prefixed with `/api/statistics`

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

---

## Endpoints

### 1. Dashboard Summary
Get a quick overview of the entire system with key metrics.

**Endpoint:** `GET /api/statistics/dashboard`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalStores": 5,
      "totalActiveContracts": 150,
      "totalFarmers": 320,
      "totalCapacity": 50000,
      "totalCurrentStock": 38500,
      "utilizationRate": "77.00",
      "monthlyRevenue": 450000,
      "unpaidAmount": 125000,
      "unpaidInvoicesCount": 25
    },
    "recentActivities": [
      {
        "id": 1,
        "type": "IN",
        "quantity": 500,
        "date": "2026-02-12T10:30:00.000Z",
        "item": "Potatoes",
        "farmer": "Ahmed Khan",
        "store": "Main Cold Store",
        "room": "Room A1",
        "rack": "Floor-1-Row-1-Left",
        "note": "Fresh delivery"
      }
    ]
  }
}
```

---

### 2. All Stores Statistics
Get performance metrics for all cold stores.

**Endpoint:** `GET /api/statistics/stores`

**Response:**
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "storeId": 1,
        "storeName": "Main Cold Store",
        "address": "123 Store Street",
        "phone": "0300-1234567",
        "activeContracts": 45,
        "farmersCount": 89,
        "storageCapacity": 15000,
        "currentStock": 12500,
        "utilizationRate": "83.33",
        "monthlyRevenue": 125000
      }
    ],
    "totals": {
      "totalStores": 5,
      "totalActiveContracts": 150,
      "totalFarmers": 320,
      "totalCapacity": 50000,
      "totalCurrentStock": 38500,
      "totalMonthlyRevenue": 450000
    }
  }
}
```

**Key Metrics:**
- **activeContracts**: Number of contracts with status ACTIVE
- **farmersCount**: Total farmers registered at this store
- **storageCapacity**: Sum of all room capacities
- **currentStock**: Sum of current stock in all racks
- **utilizationRate**: (currentStock / storageCapacity) * 100
- **monthlyRevenue**: Net invoice amount for current month

---

### 3. Store Detailed Statistics
Get comprehensive statistics for a specific store.

**Endpoint:** `GET /api/statistics/stores/:storeId`

**Parameters:**
- `storeId` (path): ID of the cold store

**Response:**
```json
{
  "success": true,
  "data": {
    "store": {
      "id": 1,
      "name": "Main Cold Store",
      "address": "123 Store Street",
      "phone": "0300-1234567",
      "manager": {
        "id": 1,
        "username": "admin",
        "role": "ADMIN"
      }
    },
    "activeContractsCount": 45,
    "activeContracts": [],
    "farmersCount": 89,
    "farmers": [],
    "roomUtilization": [
      {
        "roomId": 1,
        "roomName": "Room A1",
        "capacity": 5000,
        "currentStock": 4200,
        "utilizationRate": "84.00",
        "numOfRacks": 20,
        "isActive": true
      }
    ],
    "totalCapacity": 15000,
    "totalCurrentStock": 12500,
    "revenueSummary": {
      "totalInvoiced": 375000,
      "totalPaid": 300000,
      "totalUnpaid": 50000,
      "totalPartial": 25000,
      "invoiceCount": 78
    }
  }
}
```

**Features:**
- Complete store information with manager details
- Active contracts list (first 10 contracts)
- Farmers list (first 20 farmers)
- Room-by-room utilization breakdown
- Revenue summary for last 3 months

---

### 4. Revenue Trend
Get revenue trends for all stores over time with monthly breakdown.

**Endpoint:** `GET /api/statistics/revenue-trend`

**Query Parameters:**
- `months` (optional): Number of months to retrieve (default: 12)

**Example:** `GET /api/statistics/revenue-trend?months=6`

**Response:**
```json
{
  "success": true,
  "data": {
    "byStore": [
      {
        "storeId": 1,
        "storeName": "Main Cold Store",
        "trend": [
          {
            "month": "Aug 2025",
            "date": "2025-08-01",
            "revenue": 125000,
            "activeContracts": 42
          },
          {
            "month": "Sep 2025",
            "date": "2025-09-01",
            "revenue": 135000,
            "activeContracts": 45
          }
        ]
      }
    ],
    "combined": [
      {
        "month": "Aug 2025",
        "date": "2025-08-01",
        "totalRevenue": 425000,
        "totalActiveContracts": 142
      }
    ]
  }
}
```

**Use Cases:**
- Display revenue charts over time
- Compare store performance
- Identify seasonal trends
- Track growth patterns

---

### 5. Items Statistics & Trends
Get stock movement statistics and trends for items over time.

**Endpoint:** `GET /api/statistics/items`

**Query Parameters:**
- `storeId` (optional): Filter by specific store
- `months` (optional): Number of months for trend (default: 6)

**Example:** `GET /api/statistics/items?storeId=1&months=12`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "itemId": 1,
      "itemName": "Potatoes",
      "description": "Fresh potatoes",
      "totalStockIn": 50000,
      "totalStockOut": 35000,
      "currentStock": 15000,
      "monthlyTrend": [
        {
          "month": "Aug 2025",
          "date": "2025-08-01",
          "stockIn": 8000,
          "stockOut": 6000,
          "netChange": 2000
        },
        {
          "month": "Sep 2025",
          "date": "2025-09-01",
          "stockIn": 9000,
          "stockOut": 7000,
          "netChange": 2000
        }
      ]
    }
  ]
}
```

**Use Cases:**
- Track item inventory over time
- Display stock movement charts
- Identify popular items
- Plan storage capacity
- Monitor stock turnover rates

---

## Data Visualization Examples

### 1. Store Performance Dashboard
Use `/api/statistics/stores` to create:
- Bar chart comparing stores by active contracts
- Pie chart showing capacity utilization
- Metrics cards for each store

### 2. Revenue Trends Graph
Use `/api/statistics/revenue-trend` to create:
- Line chart showing revenue over time
- Multi-line chart comparing stores
- Area chart for combined revenue

### 3. Items Inventory Graphs
Use `/api/statistics/items` to create:
- Stacked bar chart (IN vs OUT by month)
- Line chart for stock levels over time
- Heat map showing item popularity

### 4. Storage Utilization
Use `/api/statistics/stores/:storeId` to create:
- Gauge chart for utilization percentage
- Bar chart for room-by-room comparison
- Progress bars for each room

---

## Error Responses

All endpoints return a consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common Status Codes:**
- `200`: Success
- `401`: Unauthorized (missing or invalid token)
- `404`: Resource not found
- `500`: Server error

---

## Integration Examples

### Frontend Chart Integration (React + Chart.js)

```javascript
// Fetch revenue trend
const fetchRevenueTrend = async () => {
  const response = await fetch('/api/statistics/revenue-trend?months=12', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  // Use data.combined for overall trend
  const chartData = {
    labels: data.data.combined.map(d => d.month),
    datasets: [{
      label: 'Revenue',
      data: data.data.combined.map(d => d.totalRevenue)
    }]
  };
  
  return chartData;
};

// Fetch items statistics
const fetchItemsStats = async () => {
  const response = await fetch('/api/statistics/items?months=6', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  // Create chart for each item
  return data.data.map(item => ({
    name: item.itemName,
    trend: item.monthlyTrend
  }));
};
```

---

## Notes

1. **Performance**: The statistics endpoints aggregate data from multiple tables. For large datasets, consider:
   - Caching responses
   - Setting reasonable month limits
   - Filtering by store when possible

2. **Date Ranges**: All date calculations use the server's timezone. Months are calculated from the 1st to the last day of each month.

3. **Real-time Data**: Statistics reflect the current state of the database. There's no caching, so data is always up-to-date.

4. **Pagination**: The store detailed endpoint limits results (first 10 contracts, first 20 farmers) to avoid large payloads. Use dedicated endpoints for complete lists.

---

## Future Enhancements

Potential additions to the statistics API:
- Export to CSV/Excel
- Custom date range filters
- Comparative analysis between periods
- Predictive analytics
- Alert thresholds configuration

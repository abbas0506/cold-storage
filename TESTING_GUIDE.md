# Testing Statistics API Endpoints

## Quick Test Guide

Use these commands to test the statistics endpoints. Replace `YOUR_TOKEN` with your actual JWT token and adjust the base URL if needed.

### 1. Dashboard Summary
```bash
# Get overall dashboard with key metrics
curl -X GET http://localhost:3000/api/statistics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it shows:**
- Total stores, contracts, farmers
- Overall capacity and utilization
- Current month revenue
- Unpaid invoices
- Recent stock movements

---

### 2. All Stores Performance
```bash
# Get statistics for all stores
curl -X GET http://localhost:3000/api/statistics/stores \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it shows:**
- ✅ Active contracts per store
- ✅ Number of farmers per store
- ✅ Storage capacity per store
- ✅ Current stock and utilization rate
- ✅ Monthly revenue per store
- Totals across all stores

---

### 3. Detailed Store Statistics
```bash
# Get detailed stats for store ID 1
curl -X GET http://localhost:3000/api/statistics/stores/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it shows:**
- Store information with manager
- Active contracts list
- Farmers list
- Room-by-room utilization
- Revenue summary (last 3 months)

---

### 4. Revenue Trend
```bash
# Get revenue trend for last 12 months (default)
curl -X GET http://localhost:3000/api/statistics/revenue-trend \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get revenue trend for last 6 months
curl -X GET "http://localhost:3000/api/statistics/revenue-trend?months=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it shows:**
- ✅ Monthly revenue breakdown for each store
- ✅ Active contracts per month
- ✅ Combined trend for all stores
- ✅ Month-by-month comparison

---

### 5. Items Statistics & Graphs
```bash
# Get items stats for all stores (last 6 months)
curl -X GET http://localhost:3000/api/statistics/items \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get items stats for specific store with 12 months trend
curl -X GET "http://localhost:3000/api/statistics/items?storeId=1&months=12" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it shows:**
- ✅ Total stock IN and OUT per item
- ✅ Current stock levels
- ✅ Monthly trend (stock movements over time)
- ✅ Net change per month

---

## Testing with Postman

### Setup
1. Create a new collection "Cold Storage Statistics"
2. Add environment variable `baseUrl`: `http://localhost:3000/api`
3. Add environment variable `token`: Your JWT token

### Requests

#### 1. Dashboard
- Method: GET
- URL: `{{baseUrl}}/statistics/dashboard`
- Headers: `Authorization: Bearer {{token}}`

#### 2. All Stores Stats
- Method: GET
- URL: `{{baseUrl}}/statistics/stores`
- Headers: `Authorization: Bearer {{token}}`

#### 3. Store Details
- Method: GET
- URL: `{{baseUrl}}/statistics/stores/1`
- Headers: `Authorization: Bearer {{token}}`

#### 4. Revenue Trend
- Method: GET
- URL: `{{baseUrl}}/statistics/revenue-trend`
- Headers: `Authorization: Bearer {{token}}`
- Query Params: `months: 12`

#### 5. Items Statistics
- Method: GET
- URL: `{{baseUrl}}/statistics/items`
- Headers: `Authorization: Bearer {{token}}`
- Query Params:
  - `storeId: 1` (optional)
  - `months: 6` (optional)

---

## Sample Frontend Integration

### React Example with Axios

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// 1. Get Dashboard Summary
export const getDashboard = async () => {
  const response = await api.get('/statistics/dashboard');
  return response.data;
};

// 2. Get All Stores Statistics
export const getAllStoresStats = async () => {
  const response = await api.get('/statistics/stores');
  return response.data;
};

// 3. Get Store Detailed Statistics
export const getStoreDetails = async (storeId) => {
  const response = await api.get(`/statistics/stores/${storeId}`);
  return response.data;
};

// 4. Get Revenue Trend
export const getRevenueTrend = async (months = 12) => {
  const response = await api.get('/statistics/revenue-trend', {
    params: { months }
  });
  return response.data;
};

// 5. Get Items Statistics
export const getItemsStats = async (storeId = null, months = 6) => {
  const params = { months };
  if (storeId) params.storeId = storeId;
  
  const response = await api.get('/statistics/items', { params });
  return response.data;
};

// Usage in Component
const StoresDashboard = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    const fetchStats = async () => {
      const data = await getAllStoresStats();
      setStats(data.data);
    };
    
    fetchStats();
  }, []);
  
  return (
    <div>
      <h1>Stores Performance</h1>
      {stats?.stores.map(store => (
        <div key={store.storeId}>
          <h2>{store.storeName}</h2>
          <p>Active Contracts: {store.activeContracts}</p>
          <p>Farmers: {store.farmersCount}</p>
          <p>Capacity: {store.storageCapacity}</p>
          <p>Utilization: {store.utilizationRate}%</p>
          <p>Monthly Revenue: PKR {store.monthlyRevenue}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## Chart.js Integration Examples

### 1. Revenue Trend Line Chart

```javascript
import { Line } from 'react-chartjs-2';

const RevenueTrendChart = () => {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const result = await getRevenueTrend(12);
      const combined = result.data.combined;
      
      setChartData({
        labels: combined.map(d => d.month),
        datasets: [
          {
            label: 'Total Revenue',
            data: combined.map(d => d.totalRevenue),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4
          },
          {
            label: 'Active Contracts',
            data: combined.map(d => d.totalActiveContracts),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      });
    };
    
    fetchData();
  }, []);
  
  const options = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Revenue (PKR)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Contracts'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    }
  };
  
  return chartData ? <Line data={chartData} options={options} /> : <p>Loading...</p>;
};
```

### 2. Store Performance Bar Chart

```javascript
import { Bar } from 'react-chartjs-2';

const StorePerformanceChart = () => {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const result = await getAllStoresStats();
      const stores = result.data.stores;
      
      setChartData({
        labels: stores.map(s => s.storeName),
        datasets: [
          {
            label: 'Active Contracts',
            data: stores.map(s => s.activeContracts),
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
          },
          {
            label: 'Farmers Count',
            data: stores.map(s => s.farmersCount),
            backgroundColor: 'rgba(255, 206, 86, 0.8)',
          }
        ]
      });
    };
    
    fetchData();
  }, []);
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Store Performance Comparison'
      }
    }
  };
  
  return chartData ? <Bar data={chartData} options={options} /> : <p>Loading...</p>;
};
```

### 3. Items Stock Movement Chart

```javascript
import { Line } from 'react-chartjs-2';

const ItemsStockChart = ({ storeId = null }) => {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const result = await getItemsStats(storeId, 12);
      const items = result.data;
      
      // Create a dataset for each item
      const datasets = items.map((item, index) => {
        const colors = [
          'rgb(255, 99, 132)',
          'rgb(54, 162, 235)',
          'rgb(255, 206, 86)',
          'rgb(75, 192, 192)',
          'rgb(153, 102, 255)',
        ];
        
        return {
          label: item.itemName,
          data: item.monthlyTrend.map(t => t.netChange),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.2)'),
          tension: 0.4
        };
      });
      
      setChartData({
        labels: items[0]?.monthlyTrend.map(t => t.month) || [],
        datasets
      });
    };
    
    fetchData();
  }, [storeId]);
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Items Stock Movement Trends'
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Net Change (Quantity)'
        }
      }
    }
  };
  
  return chartData ? <Line data={chartData} options={options} /> : <p>Loading...</p>;
};
```

---

## Response Time Expectations

Based on database size:
- **Small** (< 1000 records): < 100ms
- **Medium** (1000-10000 records): 100-500ms
- **Large** (> 10000 records): 500-2000ms

## Tips

1. **Cache results** on frontend for 5-10 minutes
2. **Use loading states** while fetching
3. **Handle errors gracefully** with user-friendly messages
4. **Add filters** for date ranges if needed
5. **Pagination** for large datasets

---

## All Requirements Completed ✅

1. ✅ **Active contracts** - Per store and total
2. ✅ **Number of farmers** - Per store and total
3. ✅ **Storage capacity** - Per store with utilization rate
4. ✅ **Monthly revenue** - Current month per store
5. ✅ **Trend of all stores with months gaps** - Revenue and contracts over time
6. ✅ **Items graphs over the time** - Stock movements with monthly trends

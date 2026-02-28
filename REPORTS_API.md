# Reports API Documentation

Base URL: `/api/reports`  
All endpoints require **Authentication** (`Bearer` token in `Authorization` header).  
All endpoints return a **PDF file** (`Content-Type: application/pdf`).

---

## Business / Store-Level Reports

---

### 1. Store Summary Report

```
GET /api/reports/store-summary
```

**Params:** None  
**Query:** None  
**Response:** PDF — all stores overview (capacity, utilization, farmers, revenue)

---

### 2. Room Occupancy Report

```
GET /api/reports/stores/:storeId/room-occupancy
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:** None  
**Response:** PDF — room-by-room and rack-by-rack occupancy

---

### 3. Stock Inventory Report

```
GET /api/reports/stores/:storeId/stock-inventory
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:** None  
**Response:** PDF — current stock in all racks with item/farmer info

---

### 4. Stock Movement Report

```
GET /api/reports/stores/:storeId/stock-movements
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (ISO date) | No | Start date filter |
| to | string (ISO date) | No | End date filter |
| type | string | No | `IN` or `OUT` |

**Response:** PDF — stock movement history with totals

---

### 5. Revenue Report

```
GET /api/reports/stores/:storeId/revenue
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (ISO date) | No | Start date filter |
| to | string (ISO date) | No | End date filter |

**Response:** PDF — revenue, tax, payments received, outstanding balance

---

### 6. Contracts Report

```
GET /api/reports/stores/:storeId/contracts
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `ACTIVE`, `COMPLETED`, or `CANCELLED` |
| from | string (ISO date) | No | Start date filter |
| to | string (ISO date) | No | End date filter |

**Response:** PDF — all contracts with items, quantities, amounts

---

### 7. Payments Collection Report

```
GET /api/reports/stores/:storeId/payments
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (ISO date) | No | Start date filter |
| to | string (ISO date) | No | End date filter |
| method | string | No | `CASH`, `BANK`, `EASYPaisa`, `JAZZCASH`, or `CHEQUE` |

**Response:** PDF — payments list with method breakdown summary

---

### 8. Outstanding Dues Report

```
GET /api/reports/stores/:storeId/outstanding-dues
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:** None  
**Response:** PDF — farmers with unpaid balances, sorted highest first

---

### 9. Rate Plans Report

```
GET /api/reports/stores/:storeId/rate-plans
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:** None  
**Response:** PDF — all rate plans for the store

---

### 10. Expiring Contracts Report

```
GET /api/reports/stores/:storeId/expiring-contracts
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| days | number | No | Days to look ahead (default: `30`) |

**Response:** PDF — active contracts expiring within the specified days

---

## Farmer-Level Reports

---

### 11. Farmer Directory Report

```
GET /api/reports/stores/:storeId/farmer-directory
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | number | Yes | Cold store ID |

**Query:** None  
**Response:** PDF — all farmers with contact info, contract counts, balances

---

### 12. Farmer Account Statement

```
GET /api/reports/farmers/:farmerId/statement
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| farmerId | number | Yes | Farmer ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (ISO date) | No | Start date filter |
| to | string (ISO date) | No | End date filter |

**Response:** PDF — full account statement (farmer info, contracts, payments, ledger, signatures)

---

### 13. Farmer Contracts Detail

```
GET /api/reports/farmers/:farmerId/contracts
```

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| farmerId | number | Yes | Farmer ID |

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `ACTIVE`, `COMPLETED`, or `CANCELLED` |

**Response:** PDF — all contracts with line items, stock in/out, remaining, late charges

---

## Error Response (all endpoints)

On failure, returns JSON:

```
Status: 500
Content-Type: application/json

{
  "error": "Failed to generate <report name>",
  "message": "<error details>"
}
```

For not-found cases:

```
Status: 404
Content-Type: application/json

{
  "message": "Store not found" | "Farmer not found"
}
```

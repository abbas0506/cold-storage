# Cold Storage API Documentation

**Base URL:** `/api`  
**Auth:** Bearer token via `Authorization: Bearer <token>` header (JWT).  
**Pagination:** All list endpoints accept `?page=1&pageSize=15` query params and return:

```
{
  data: [...],
  total: number,
  page: number,
  pageSize: number,
  totalPages: number
}
```

---

## Enums

| Enum | Values |
|------|--------|
| `SystemRole` | `SUPER_ADMIN`, `SUBSCRIBER`, `USER` |
| `StoreRole` | `ADMIN`, `EMPLOYEE` |
| `SubscriptionStatus` | `PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`, `SUSPENDED` |
| `ContractStatus` | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `PackagingType` | `BORI`, `TORA`, `CRATE` |
| `MovementType` | `IN`, `OUT` |
| `PaymentMethod` | `CASH`, `BANK`, `EASYPaisa`, `JAZZCASH`, `CHEQUE` |
| `RateType` | `PER_DAY`, `PER_MONTH`, `FIXED` |
| `SalaryStatus` | `DRAFT`, `APPROVED`, `PAID`, `CANCELLED` |

---

## Role Access Summary

| Role | What they can do |
|------|-----------------|
| `SUPER_ADMIN` | Manage subscription plans, subscriptions, all users, all stores |
| `SUBSCRIBER` | Create/manage cold stores, create store users, manage store data |
| `USER` | Access stores they are assigned to |

---

## 1. Auth

### POST `/api/auth/login`
**Access:** Public

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | `string` | Yes | User's username |
| `password` | `string` | Yes | User's password |

**Response `200`:**
```json
{
  "token": "string (JWT, 7d expiry)",
  "user": {
    "id": "number",
    "username": "string",
    "name": "string | null",
    "systemRole": "SystemRole",
    "lastLogin": "ISO datetime"
  }
}
```

**Errors:** `400` missing fields · `401` invalid credentials · `403` account disabled / subscription inactive or expired

---

### GET `/api/auth/me`
**Access:** Authenticated

**Response `200`:**
```json
{
  "id": "number",
  "username": "string",
  "name": "string | null",
  "phone": "string | null",
  "email": "string | null",
  "systemRole": "SystemRole",
  "lastLogin": "ISO datetime | null",
  "storeAccess": [
    {
      "storeId": "number",
      "role": "StoreRole",
      "store": { "id": "number", "name": "string" }
    }
  ],
  "subscription": {
    "id": "number",
    "status": "SubscriptionStatus",
    "startDate": "ISO datetime",
    "endDate": "ISO datetime",
    "plan": {
      "name": "string",
      "maxStores": "number",
      "maxUsersPerStore": "number"
    }
  } | null
}
```

---

### POST `/api/auth/change-password`
**Access:** Authenticated

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPassword` | `string` | Yes | Current password |
| `newPassword` | `string` | Yes | New password (min 6 chars) |

**Response `200`:** `{ "message": "Password changed successfully" }`

**Errors:** `400` missing fields / new password too short / wrong current password

---

## 2. Subscription Plans

> All endpoints require `SUPER_ADMIN`.

### GET `/api/subscription-plans`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | `number` | Page number (default: 1) |
| `pageSize` | `number` | Items per page (default: 20) |
| `showInactive` | `boolean` | Include inactive plans (default: false) |

**Response:** Paginated list of `SubscriptionPlan`.

**SubscriptionPlan object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `description` | `string \| null` |
| `pricePerMonth` | `number` |
| `maxStores` | `number` |
| `maxUsersPerStore` | `number` |
| `durationDays` | `number` |
| `features` | `JSON \| null` |
| `isActive` | `boolean` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### GET `/api/subscription-plans/:id`
**Response `200`:** `SubscriptionPlan` + `_count.subscriptions: number`

---

### POST `/api/subscription-plans`
**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique plan name |
| `pricePerMonth` | `number` | Yes | Monthly price |
| `description` | `string` | No | Plan description |
| `maxStores` | `number` | No | Max stores allowed (default: 1) |
| `maxUsersPerStore` | `number` | No | Max users per store (default: 5) |
| `durationDays` | `number` | No | Plan duration in days (default: 30) |
| `features` | `JSON` | No | Feature list |

**Response `201`:** Created `SubscriptionPlan`

---

### PUT `/api/subscription-plans/:id`
**Body:** Same fields as POST, all optional.

**Response `200`:** Updated `SubscriptionPlan`

---

### DELETE `/api/subscription-plans/:id`
Soft-deletes (sets `isActive = false`). Fails if active subscriptions exist.

**Response `200`:** `{ "message": "Plan deactivated successfully" }`

---

## 3. Subscriptions

### GET `/api/subscriptions`
**Access:** `SUPER_ADMIN`  
**Query Params:** `page`, `pageSize`, `status` (SubscriptionStatus filter)

**Response:** Paginated list. Each item includes:
- `user`: `{ id, username, name, email, isActive }`
- `plan`: `{ id, name, pricePerMonth }`
- `_count.coldStores`: `number`

**Subscription object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `userId` | `number` |
| `planId` | `number` |
| `status` | `SubscriptionStatus` |
| `startDate` | `ISO datetime` |
| `endDate` | `ISO datetime` |
| `notes` | `string \| null` |

---

### GET `/api/subscriptions/my`
**Access:** `SUBSCRIBER`  
Returns the caller's own subscription with `plan` (full) and `coldStores` list.

---

### GET `/api/subscriptions/:id`
**Access:** `SUPER_ADMIN`  
Returns full subscription with `user`, `plan`, and `coldStores` (with `_count.storeUsers`).

---

### POST `/api/subscriptions`
**Access:** `SUPER_ADMIN`  
Creates a subscriber user and their subscription in one transaction.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | `string` | Yes | Login username for the subscriber |
| `password` | `string` | Yes | Password |
| `planId` | `number` | Yes | SubscriptionPlan ID |
| `startDate` | `ISO datetime` | Yes | Subscription start date |
| `name` | `string` | No | Full name |
| `phone` | `string` | No | Phone number |
| `email` | `string` | No | Email |
| `notes` | `string` | No | Admin notes |

End date is auto-calculated as `startDate + plan.durationDays`.

**Response `201`:** Created `Subscription` with `user` and `plan`.

---

### PUT `/api/subscriptions/:id`
**Access:** `SUPER_ADMIN`

**Body:**
| Field | Type | Description |
|-------|------|-------------|
| `planId` | `number` | New plan ID |
| `status` | `SubscriptionStatus` | New status |
| `startDate` | `ISO datetime` | New start date |
| `endDate` | `ISO datetime` | Override end date (optional) |
| `notes` | `string` | Notes |

**Response `200`:** Updated `Subscription` with `user` and `plan`.

---

## 4. Users

### GET `/api/users`
**Access:** `SUPER_ADMIN`  
Returns all users with subscription info.

**Response `200`:** `{ "users": [ UserObject, ... ] }`

**User object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `username` | `string` |
| `name` | `string \| null` |
| `phone` | `string \| null` |
| `email` | `string \| null` |
| `systemRole` | `SystemRole` |
| `isActive` | `boolean` |
| `lastLogin` | `ISO datetime \| null` |
| `createdAt` | `ISO datetime` |

---

### GET `/api/users/my`
**Access:** `SUBSCRIBER`  
Returns users created by the calling subscriber, with `storeAccess` info.

**Response `200`:** `{ "users": [ UserObject, ... ] }`

---

### POST `/api/users`
**Access:** `SUBSCRIBER`  
Creates a new `USER`-role account owned by the subscriber.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `username` | `string` | Yes |
| `password` | `string` | Yes (min 6 chars) |
| `name` | `string` | No |
| `phone` | `string` | No |
| `email` | `string` | No |

**Response `201`:** Created user (no password field).

---

### PUT `/api/users/:id`
**Access:** `SUBSCRIBER` (only their own created users)

**Body:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Full name |
| `phone` | `string` | Phone number |
| `email` | `string` | Email |
| `password` | `string` | New password (min 6 chars) |
| `isActive` | `boolean` | Active status |

**Response `200`:** Updated user object.

---

### PATCH `/api/users/:id/toggle-active`
**Access:** `SUBSCRIBER` (only their own created users)  
Toggles `isActive` on/off.

**Response `200`:** `{ "id": number, "username": string, "isActive": boolean }`

---

### PUT `/api/users/admin/:id`
**Access:** `SUPER_ADMIN`  
Can update any field including `systemRole`.

**Body:** Same as `PUT /users/:id` plus `systemRole: SystemRole`.

**Response `200`:** Updated user.

---

## 5. Cold Stores

### GET `/api/coldstores`
**Access:** Authenticated (filtered by role automatically)  
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `ColdStore` with `subscription.status` and `subscription.plan.name`.

**ColdStore object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `hashCode` | `string` |
| `address` | `string \| null` |
| `phone` | `string \| null` |
| `subscriptionId` | `number \| null` |

---

### POST `/api/coldstores`
**Access:** `SUBSCRIBER` or `SUPER_ADMIN`  
Creates a cold store with optional rooms and auto-generates racks.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Store name |
| `address` | `string` | No | Store address |
| `rooms` | `RoomInput[]` | No | Rooms to create along with the store |

**RoomInput:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Room name |
| `tempMin` | `number` | Min temperature |
| `tempMax` | `number` | Max temperature |
| `numOfFloors` | `number` | Number of floors |
| `numOfRacks` | `number` | Number of racks per floor |
| `roomCapacity` | `number` | Total room capacity |

Racks are auto-generated. Each floor × rack position produces two racks: `{rack}{floorLabel}-L` and `{rack}{floorLabel}-R`.

**Response `201`:** Created `ColdStore`.

---

### GET `/api/coldstores/:id`
**Access:** Authenticated

**Response `200`:** Single `ColdStore` object.

---

### PUT `/api/coldstores/:id`
**Access:** Authenticated

**Body:**
| Field | Type |
|-------|------|
| `name` | `string` |
| `address` | `string` |
| `phone` | `string` |

**Response `200`:** Updated `ColdStore`.

---

### DELETE `/api/coldstores/:id`
**Access:** Authenticated

**Response `200`:** `{ "message": "Cold store deleted successfully" }`

---

## 6. Store Users

Base path: `/api/coldstores/:storeId/store-users`

### GET `/api/coldstores/:storeId/store-users`
**Access:** Authenticated + store access

**Response `200`:**
```json
{
  "storeUsers": [
    {
      "id": "number",
      "storeId": "number",
      "userId": "number",
      "role": "StoreRole",
      "isActive": "boolean",
      "createdAt": "ISO datetime",
      "user": {
        "id": "number",
        "username": "string",
        "name": "string | null",
        "phone": "string | null",
        "email": "string | null",
        "isActive": "boolean",
        "lastLogin": "ISO datetime | null"
      }
    }
  ]
}
```

---

### POST `/api/coldstores/:storeId/store-users`
**Access:** Authenticated + store access  
Assigns an existing user (created by the subscriber) to the store.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `number` | Yes | User ID to assign |
| `role` | `StoreRole` | Yes | `ADMIN` or `EMPLOYEE` |

**Response `201`:** Created `StoreUser` with `user.id, user.username, user.name`.

**Errors:** `403` user not owned by requester · `429` user limit reached per plan

---

### PUT `/api/coldstores/:storeId/store-users/:userId`
**Access:** Authenticated + store access

**Body:**
| Field | Type | Description |
|-------|------|-------------|
| `role` | `StoreRole` | New role (`ADMIN` or `EMPLOYEE`) |
| `isActive` | `boolean` | Active status |

**Response `200`:** Updated `StoreUser`.

---

### DELETE `/api/coldstores/:storeId/store-users/:userId`
**Access:** Authenticated + store access

**Response `200`:** `{ "message": "User removed from store" }`

---

## 7. Rooms

Base path: `/api/coldstores/:storeId/rooms`

### GET `/api/coldstores/:storeId/rooms`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `Room` with `racks` array.

**Room object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `tempMin` | `number \| null` |
| `tempMax` | `number \| null` |
| `numOfFloors` | `number` |
| `numOfRacks` | `number` |
| `roomCapacity` | `number` |
| `isActive` | `boolean` |
| `storeId` | `number` |

---

### POST `/api/coldstores/:storeId/rooms`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |
| `tempMin` | `number` | No |
| `tempMax` | `number` | No |
| `numOfFloors` | `number` | Yes |
| `numOfRacks` | `number` | Yes |
| `roomCapacity` | `number` | Yes |

Racks are auto-generated upon room creation.

**Response `201`:** Created `Room`.

---

### GET `/api/coldstores/:storeId/rooms/:id`
**Response `200`:** Single `Room`.

---

### PUT `/api/coldstores/:storeId/rooms/:id`
**Body:** Same fields as POST, all optional.

**Response `200`:** Updated `Room`.

---

### DELETE `/api/coldstores/:storeId/rooms/:id`
**Response `200`:** `{ "message": "Room deleted successfully" }`

---

## 8. Racks

Base path: `/api/coldstores/:storeId/rooms/:roomId/racks`

### GET `/api/coldstores/:storeId/rooms/:roomId/racks`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `Rack` with `stockMovements` (including `contractLine`).

**Rack object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `capacity` | `number \| null` |
| `currentStock` | `number` |
| `roomId` | `number` |

---

### POST `/api/coldstores/:storeId/rooms/:roomId/racks`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |
| `capacity` | `number` | No |

**Response `201`:** Created `Rack`.

---

### GET `/api/coldstores/:storeId/rooms/:roomId/racks/:id`
**Response `200`:** Single `Rack`.

---

### PUT `/api/coldstores/:storeId/rooms/:roomId/racks/:id`
**Body:**
| Field | Type |
|-------|------|
| `name` | `string` |
| `capacity` | `number` |

**Response `200`:** Updated `Rack`.

---

### DELETE `/api/coldstores/:storeId/rooms/:roomId/racks/:id`
**Response `200`:** `{ "message": "Rack deleted successfully" }`

---

## 9. Farmers

Base path: `/api/coldstores/:storeId/farmers`

### GET `/api/coldstores/:storeId/farmers`
**Query Params:** `page`, `pageSize`, `q` (search by name)

**Response:** Paginated list of `Farmer`.

**Farmer object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `phone` | `string` |
| `cnic` | `string \| null` |
| `address` | `string \| null` |
| `marka` | `string \| null` |
| `storeId` | `number` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/farmers`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |
| `phone` | `string` | Yes |
| `cnic` | `string` | No |
| `address` | `string` | No |
| `marka` | `string` | No |

**Response `201`:** Created `Farmer`.

---

### GET `/api/coldstores/:storeId/farmers/:id`
Returns farmer with last ledger entry, last 5 payments, and all contracts (with items).

**Response `200`:** `Farmer` + `ledgers`, `payments`, `contracts` arrays.

---

### PUT `/api/coldstores/:storeId/farmers/:id`
**Body:** Same fields as POST, all optional.

**Response `200`:** Updated `Farmer`.

---

### DELETE `/api/coldstores/:storeId/farmers/:id`
**Response `200`:** `{ "message": "farmer deleted successfully" }`

---

## 10. Items

Base path: `/api/coldstores/:storeId/items`

### GET `/api/coldstores/:storeId/items`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `Item`.

**Item object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |
| `description` | `string \| null` |
| `storeId` | `number` |

---

### POST `/api/coldstores/:storeId/items`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |
| `description` | `string` | No |

**Response `201`:** Created `Item`.

---

### GET `/api/coldstores/:storeId/items/:id`
**Response `200`:** Single `Item`.

---

### PUT `/api/coldstores/:storeId/items/:id`
**Body:**
| Field | Type |
|-------|------|
| `name` | `string` |
| `description` | `string` |

**Response `200`:** Updated `Item`.

---

### DELETE `/api/coldstores/:storeId/items/:id`
**Response `200`:** `{ "message": "Item deleted successfully" }`

---

## 11. Rate Plans

Base path: `/api/coldstores/:storeId/rate-plans`

### GET `/api/coldstores/:storeId/rate-plans`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `RatePlan`.

**RatePlan object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `packagingType` | `PackagingType \| null` |
| `rateType` | `RateType \| null` |
| `rateAmount` | `number` |
| `storeId` | `number` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/rate-plans`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `packagingType` | `PackagingType` | No |
| `rateType` | `RateType` | No |
| `rateAmount` | `number` | Yes |

**Response `201`:** Created `RatePlan`.

---

### GET `/api/coldstores/:storeId/rate-plans/:id`
**Response `200`:** Single `RatePlan`.

---

### PUT `/api/coldstores/:storeId/rate-plans/:id`
**Body:** Same fields as POST, all optional.

**Response `200`:** Updated `RatePlan`.

---

### DELETE `/api/coldstores/:storeId/rate-plans/:id`
**Response `200`:** `{ "message": "Rate plan deleted successfully" }`

---

## 12. Contracts

Base path: `/api/coldstores/:storeId/contracts`

### GET `/api/coldstores/:storeId/contracts`
**Query Params:** `page`, `pageSize`, `q` (search by farmer name or contract code)

**Response:** Paginated list. Each item includes `farmer`, `items` (with `item`), and `_count.items` (count of lines with IN movements).

**Contract object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `farmerId` | `number` |
| `contractCode` | `string` |
| `startDate` | `ISO datetime` |
| `expectedEndDate` | `ISO datetime \| null` |
| `actualEndDate` | `ISO datetime \| null` |
| `saleTaxRate` | `number` (fractional, e.g., 0.16) |
| `totalAmount` | `number` |
| `salesTaxAmount` | `number` |
| `netAmount` | `number` |
| `status` | `ContractStatus` |
| `notes` | `string \| null` |
| `fbrInvoiceNumber` | `string \| null` |
| `praInvoiceNumber` | `string \| null` |
| `ledgerId` | `number \| null` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/contracts`
Creates a contract, its line items, and a ledger debit entry atomically.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `farmerId` | `number` | Yes | Farmer this contract belongs to |
| `expectedEndDate` | `ISO datetime` | No | Expected pickup/end date |
| `notes` | `string` | No | |
| `taxRate` | `number` | Yes | Sales tax percentage (e.g., `16` for 16%) |
| `items` | `ContractLineInput[]` | Yes | Line items |

**ContractLineInput:**
| Field | Type | Required |
|-------|------|----------|
| `itemId` | `number` | Yes |
| `quantity` | `number` | Yes |
| `packagingType` | `PackagingType` | No |
| `unitRate` | `number` | Yes |

`contractCode` is auto-generated. `netAmount`, `salesTaxAmount`, and `totalAmount` are auto-calculated.

**Response `201`:** Full contract with `farmer` and `items` (including `item`).

---

### GET `/api/coldstores/:storeId/contracts/:id`
**Response `200`:** Contract with `farmer` and `items` (including `item`).

---

### PUT `/api/coldstores/:storeId/contracts/:id`
**Body:**
| Field | Type | Description |
|-------|------|-------------|
| `farmerId` | `number` | |
| `contractCode` | `string` | |
| `startDate` | `ISO datetime` | |
| `expectedEndDate` | `ISO datetime` | |
| `actualEndDate` | `ISO datetime` | |
| `taxRate` | `number` | Tax percentage |
| `status` | `ContractStatus` | |
| `notes` | `string` | |
| `items` | `ContractLineInput[]` | Lines with optional `id` (update if provided, create if absent) |

**Response `200`:** Updated contract.

---

### DELETE `/api/coldstores/:storeId/contracts/:id`
**Response `200`:** `{ "message": "Contract deleted successfully" }`

---

### POST `/api/coldstores/:storeId/contracts/:id/status`
Updates the contract status. If completing with a fine, creates a ledger debit entry.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `ContractStatus` | Yes | New status |
| `fineAmount` | `number` | No | Fine to apply (for COMPLETED status) |
| `numOfStock` | `number` | No | Stock count at completion (used in ledger description) |

**Response `200`:** Updated contract.

---

### GET `/api/coldstores/:storeId/contracts/:id/fine`
Calculates the potential late fine for a contract.

**Response `200`:**
```json
{
  "numberOfStockout": "number",
  "numberOfDaysLate": "number",
  "fineAmount": "number"
}
```

---

### PUT `/api/coldstores/:storeId/contracts/:id/fbr-invoice`
Updates the FBR invoice number on a contract.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `fbrInvoiceNumber` | `string` | Yes |

**Response `200`:** Updated contract.

---

### GET `/api/coldstores/:storeId/contracts/:id/report`
Returns a PDF (A5 landscape) of the contract.

**Response:** `application/pdf` binary stream.

---

## 13. Stock Movements

Base path: `/api/coldstores/:storeId/contracts/:contractId/stock-movements`

### GET `/api/coldstores/:storeId/contracts/:contractId/stock-movements`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `StockMovement` (ordered by `movementDate` desc) with `contractLine`.

**StockMovement object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `contractLineId` | `number \| null` |
| `movementType` | `MovementType` |
| `rackId` | `number \| null` |
| `quantity` | `number` |
| `movementDate` | `ISO datetime` |
| `referenceNote` | `string \| null` |

---

### POST `/api/coldstores/:storeId/contracts/:contractId/stock-movements`
Creates multiple stock movement entries and updates rack `currentStock`.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `lines` | `StockMovementInput[]` | Yes |

**StockMovementInput:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractLineId` | `number` | Yes | Which contract line this belongs to |
| `movementType` | `MovementType` | Yes | `IN` or `OUT` |
| `rackId` | `number` | Yes | Target rack |
| `quantity` | `number` | Yes | Units moved |
| `movementDate` | `ISO datetime` | Yes | Date of movement |
| `referenceNote` | `string` | No | Optional note |

**Response `201`:** `"Successfully created stock movements"`

---

### GET `/api/coldstores/:storeId/contracts/:contractId/stock-movements/:id`
**Response `200`:** Single `StockMovement`.

---

### PUT `/api/coldstores/:storeId/contracts/:contractId/stock-movements/:id`
**Body:**
| Field | Type |
|-------|------|
| `movementType` | `MovementType` |
| `rackId` | `number` |
| `quantity` | `number` |
| `movementDate` | `ISO datetime` |
| `referenceNote` | `string` |

**Response `200`:** Updated `StockMovement`.

---

### DELETE `/api/coldstores/:storeId/contracts/:contractId/stock-movements/:id`
**Response `200`:** `{ "message": "Stock movement deleted successfully" }`

---

### GET `/api/coldstores/:storeId/contracts/:contractId/stock-movements/racks/:lineId`
Returns all racks that have stock movements for a specific contract line.

**Response `200`:** Array of `Rack` objects (with `room`).

---

## 14. Payments

Base path: `/api/coldstores/:storeId/payments`

### GET `/api/coldstores/:storeId/payments`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `Payment` (with `farmer`), ordered by id desc.

**Payment object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `farmerId` | `number` |
| `paymentDate` | `ISO datetime` |
| `amount` | `number` |
| `paymentMethod` | `PaymentMethod` |
| `transactionRef` | `string \| null` |
| `remarks` | `string \| null` |
| `ledgerId` | `number \| null` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/payments`
Creates a payment and automatically creates a ledger credit entry.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `farmerId` | `number` | Yes |
| `paymentDate` | `ISO datetime` | Yes |
| `amount` | `number` | Yes |
| `paymentMethod` | `PaymentMethod` | Yes |
| `transactionRef` | `string` | No |
| `remarks` | `string` | No |

**Response `201`:** Created `Payment`.

---

### GET `/api/coldstores/:storeId/payments/:id`
**Response `200`:** Single `Payment`.

---

### PUT `/api/coldstores/:storeId/payments/:id`
**Body:** Same fields as POST.

**Response `200`:** Updated `Payment`.

---

### DELETE `/api/coldstores/:storeId/payments/:id`
**Response `200`:** `{ "message": "payment deleted successfully" }`

---

## 15. Expenses

Base path: `/api/coldstores/:storeId/expenses`

### GET `/api/coldstores/:storeId/expenses`
**Query Params:** `page`, `pageSize`

**Response:** Paginated list of `Expense` (with `expenseType`), ordered by id desc.

**Expense object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `storeId` | `number` |
| `amount` | `number` |
| `expenseTypeId` | `number` |
| `expenseType` | `ExpenseType` |
| `paymentMethod` | `PaymentMethod` |
| `description` | `string` |
| `expenseDate` | `ISO datetime` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/expenses`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `amount` | `number` | Yes |
| `expenseTypeId` | `number` | Yes |
| `paymentMethod` | `PaymentMethod` | Yes |
| `description` | `string` | Yes |
| `expenseDate` | `ISO datetime` | No (defaults to now) |

**Response `201`:** Created `Expense` with `expenseType`.

---

### GET `/api/coldstores/:storeId/expenses/:id`
**Response `200`:** Single `Expense` with `expenseType`.

---

### PUT `/api/coldstores/:storeId/expenses/:id`
**Body:** Same fields as POST, all optional.

**Response `200`:** Updated `Expense` with `expenseType`.

---

### DELETE `/api/coldstores/:storeId/expenses/:id`
**Response `200`:** `{ "message": "Expense deleted successfully" }`

---

## 16. Expense Types

Base path: `/api/expense-types`  
**Access:** Authenticated (GET); no extra role guard on mutations.

### GET `/api/expense-types`
Returns a flat list of all expense types, ordered by `id`.

**Response `200`:** `ExpenseType[]`

**ExpenseType object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `name` | `string` |

---

### POST `/api/expense-types`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |

**Response `201`:** Created `ExpenseType`.

---

### GET `/api/expense-types/:id`
**Response `200`:** Single `ExpenseType`.

---

### PUT `/api/expense-types/:id`
**Body:**
| Field | Type |
|-------|------|
| `name` | `string` |

**Response `200`:** Updated `ExpenseType`.

---

### DELETE `/api/expense-types/:id`
**Response `200`:** `{ "message": "Expense type deleted successfully" }`

---

## 17. Settings

Base path: `/api/settings`  
**Access:** GET endpoints are authenticated; PUT and DELETE require `SUPER_ADMIN`.

### GET `/api/settings`
Returns all settings as both an array and a key→value map.

**Response `200`:**
```json
{
  "items": [
    { "id": "number", "key": "string", "value": "string" }
  ],
  "map": {
    "key": "value"
  }
}
```

---

### GET `/api/settings/:key`
**Response `200`:** `{ "id": number, "key": string, "value": string }`

**Errors:** `404` key not found

---

### PUT `/api/settings/:key`
**Access:** `SUPER_ADMIN`  
Upserts — creates the key if it does not exist, updates if it does.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `value` | `string` | Yes |

**Response `200`:** `{ "id": number, "key": string, "value": string }`

---

### DELETE `/api/settings/:key`
**Access:** `SUPER_ADMIN`

**Response `200`:** `{ "message": "Setting deleted successfully" }`

---

## 18. Employees

Base path: `/api/coldstores/:storeId/employees`  
**Access:** Authenticated + store access.

### GET `/api/coldstores/:storeId/employees`
**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | |
| `pageSize` | `number` | `15` | |
| `showInactive` | `boolean` | `false` | Include inactive employees |

**Response:** Paginated list of `Employee`.

**Employee object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `storeId` | `number` |
| `joiningDate` | `ISO datetime` |
| `designation` | `string \| null` |
| `baseSalary` | `number` |
| `advanceLimit` | `number` |
| `balance` | `number` (positive = company owes employee; negative = employee owes company) |
| `active` | `boolean` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/employees`
**Body:**
| Field | Type | Required |
|-------|------|----------|
| `baseSalary` | `number` | Yes |
| `joiningDate` | `ISO datetime` | No (defaults to now) |
| `designation` | `string` | No |
| `advanceLimit` | `number` | No (defaults to `0` = no limit) |

**Response `201`:** Created `Employee`.

---

### GET `/api/coldstores/:storeId/employees/:id`
Returns the employee with the most recent 10 ledger entries and most recent 12 salary slips.

**Response `200`:** `Employee` + `ledger[]` + `salarySlips[]`

---

### PUT `/api/coldstores/:storeId/employees/:id`
**Body:** Same fields as POST, all optional; also accepts `active: boolean`.

**Response `200`:** Updated `Employee`.

---

### DELETE `/api/coldstores/:storeId/employees/:id`
Soft-deletes by setting `active = false`. Does **not** permanently delete.

**Response `200`:** `{ "message": "Employee deactivated", "employee": Employee }`

---

## 19. Employee Ledger

Base path: `/api/coldstores/:storeId/employees/:employeeId/ledger`  
**Access:** Authenticated + store access.

Every financial event that affects the employee's balance is stored here. `Employee.balance` is updated atomically inside a `$transaction` on every write/delete.

- **debit > 0** — company owes employee more (e.g. salary credited, advance reversal)
- **credit > 0** — employee owes company more (e.g. advance taken, deduction)

### GET `/api/coldstores/:storeId/employees/:employeeId/ledger`
**Query Params:** `page`, `pageSize` (default 20)

**Response:** Paginated list of `EmployeeLedger`, ordered by `createdAt` desc.

**EmployeeLedger object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `employeeId` | `number` |
| `debit` | `number` |
| `credit` | `number` |
| `note` | `string \| null` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/employees/:employeeId/ledger`
Creates a ledger entry and updates `Employee.balance` atomically.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `debit` | `number` | No | Amount added to employee's balance (default `0`) |
| `credit` | `number` | No | Amount deducted from employee's balance (default `0`) |
| `note` | `string` | No | Description of the transaction |

At least one of `debit` or `credit` must be > 0.

**Response `201`:** Created `EmployeeLedger`.

---

### GET `/api/coldstores/:storeId/employees/:employeeId/ledger/:id`
**Response `200`:** Single `EmployeeLedger`.

---

### DELETE `/api/coldstores/:storeId/employees/:employeeId/ledger/:id`
Deletes the entry and reverses the `balance` effect on the employee.

**Response `200`:** `{ "message": "Ledger entry deleted and balance reversed" }`

---

## 20. Salary Slips

Base path: `/api/coldstores/:storeId/employees/:employeeId/salary-slips`  
**Access:** Authenticated + store access.

**Lifecycle:** `DRAFT` → `APPROVED` → `PAID` (or `CANCELLED` at any pre-paid stage)

### GET `/api/coldstores/:storeId/employees/:employeeId/salary-slips`
**Query Params:** `page`, `pageSize` (default 12)

**Response:** Paginated list of `SalarySlip`, ordered by `year` desc, `month` desc.

**SalarySlip object:**
| Field | Type |
|-------|------|
| `id` | `number` |
| `employeeId` | `number` |
| `year` | `number` |
| `month` | `number` (1–12) |
| `baseSalary` | `number` (snapshot at generation time) |
| `bonus` | `number` |
| `totalAdvances` | `number` |
| `otherDeductions` | `number` |
| `netPayable` | `number` (`baseSalary + bonus - totalAdvances - otherDeductions`) |
| `status` | `SalaryStatus` |
| `paidDate` | `ISO datetime \| null` |
| `note` | `string \| null` |
| `createdAt` | `ISO datetime` |
| `updatedAt` | `ISO datetime` |

---

### POST `/api/coldstores/:storeId/employees/:employeeId/salary-slips`
Generates a **DRAFT** salary slip for the given year/month. Only one slip per employee per period is allowed.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `year` | `number` | Yes |
| `month` | `number` (1–12) | Yes |
| `bonus` | `number` | No (default `0`) |
| `otherDeductions` | `number` | No (default `0`) |
| `note` | `string` | No |

`baseSalary` is snapshotted from `Employee.baseSalary`. `netPayable` is auto-calculated.

**Response `201`:** Created `SalarySlip`.

**Errors:** `404` employee not found · `409` slip already exists for this period

---

### GET `/api/coldstores/:storeId/employees/:employeeId/salary-slips/:id`
**Response `200`:** `SalarySlip` with `employee`.

---

### PUT `/api/coldstores/:storeId/employees/:employeeId/salary-slips/:id`
Updates a `DRAFT` or `APPROVED` slip. Cannot edit `PAID` or `CANCELLED` slips. `netPayable` is recalculated automatically.

**Body:**
| Field | Type |
|-------|------|
| `bonus` | `number` |
| `totalAdvances` | `number` |
| `otherDeductions` | `number` |
| `status` | `SalaryStatus` (`DRAFT` or `APPROVED` only) |
| `note` | `string` |

**Response `200`:** Updated `SalarySlip`.

---

### PATCH `/api/coldstores/:storeId/employees/:employeeId/salary-slips/:id/pay`
Marks an `APPROVED` slip as `PAID`. Atomically:
1. Sets `status = PAID`, `paidDate = now`
2. Creates an `EmployeeLedger` credit entry for `netPayable`
3. Decrements `Employee.balance` by `netPayable`

**Response `200`:** Updated `SalarySlip`.

**Errors:** `400` if slip is not `APPROVED`

---

### PATCH `/api/coldstores/:storeId/employees/:employeeId/salary-slips/:id/cancel`
Cancels a `DRAFT` or `APPROVED` slip.

**Response `200`:** Updated `SalarySlip` with `status = CANCELLED`.

**Errors:** `400` if slip is already `PAID`

---

## 21. Statistics

All endpoints require authentication. Results are filtered by the caller's access level automatically.

### GET `/api/statistics/dashboard`
Returns a high-level dashboard summary (key metrics across all accessible stores).

**Response `200`:** Dashboard metrics object.

---

### GET `/api/statistics/stores`
Returns per-store statistics for all accessible stores plus totals.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "storeId": "number",
        "storeName": "string",
        "address": "string | null",
        "phone": "string | null",
        "activeContracts": "number",
        "farmersCount": "number",
        "storageCapacity": "number",
        "currentStock": "number",
        "utilizationRate": "string (e.g. '72.50')",
        "monthlyRevenue": "number"
      }
    ],
    "totals": {
      "totalStores": "number",
      "totalActiveContracts": "number",
      "totalFarmers": "number",
      "totalCapacity": "number",
      "totalCurrentStock": "number",
      "totalMonthlyRevenue": "number"
    }
  }
}
```

---

### GET `/api/statistics/stores/:storeId`
Detailed statistics for a single store.

---

### GET `/api/statistics/revenue-trend`
**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `months` | `number` | `12` | How many months back to include |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "byStore": [
      {
        "storeId": "number",
        "storeName": "string",
        "trend": [
          {
            "month": "string (e.g. 'Jan 2025')",
            "date": "YYYY-MM-DD",
            "revenue": "number",
            "activeContracts": "number"
          }
        ]
      }
    ],
    "combined": [
      {
        "month": "string",
        "date": "string",
        "totalRevenue": "number",
        "totalActiveContracts": "number"
      }
    ]
  }
}
```

---

### GET `/api/statistics/items`
**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `storeId` | `number` | — | Filter by store (optional) |
| `months` | `number` | `6` | Months to include in trend |

Returns per-item stock statistics and monthly IN/OUT trends.

---

## 22. Ledger (Reports)

### GET `/api/ledger/report`
**Access:** Authenticated  
Returns a PDF ledger report for a farmer within a date range.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `farmerId` | `number` | Filter by farmer (optional) |
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |

**Response:** `application/pdf` binary stream.

---

### GET `/api/ledger/detailed-report`
**Access:** Authenticated  
Returns a multi-page PDF ledger report for all farmers.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |

**Response:** `application/pdf` binary stream.

---

## 23. Reports (PDF)

All report endpoints return `application/pdf`. Require authentication unless noted.

### GET `/api/reports/store-summary`
Overview of all cold stores: capacity, utilization, revenue, farmers, contracts.

---

### GET `/api/reports/stores/:storeId/room-occupancy`
Room-by-room occupancy details with rack-level breakdown and packaging type split (BORI/TORA/CRATE).

---

### GET `/api/reports/stores/:storeId/stock-inventory`
Current stock snapshot across all rooms and racks for a store.

---

### GET `/api/reports/stores/:storeId/stock-movements`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |
| `type` | `MovementType` | `IN` or `OUT` (optional) |

Stock movement history for a store.

---

### GET `/api/reports/stores/:storeId/revenue`
**Query Params:** `from`, `to`

Revenue breakdown: contracts, tax, payments received, outstanding dues.

---

### GET `/api/reports/stores/:storeId/contracts`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `ContractStatus` | Filter by status (optional) |
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |

All contracts for a store with line items.

---

### GET `/api/reports/stores/:storeId/payments`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |
| `method` | `PaymentMethod` | Filter by payment method (optional) |

---

### GET `/api/reports/stores/:storeId/outstanding-dues`
Farmers with unpaid balances, sorted by highest due amount.

---

### GET `/api/reports/stores/:storeId/rate-plans`
All rate plans for the store.

---

### GET `/api/reports/stores/:storeId/expiring-contracts`
**Query Params:**
| Param | Type | Default |
|-------|------|---------|
| `days` | `number` | `30` |

Active contracts expiring within `days` days.

---

### GET `/api/reports/stores/:storeId/farmer-directory`
Directory of all farmers with their outstanding balance and contract summary.

---

### GET `/api/reports/farmers/:farmerId/statement`
**Query Params:** `from`, `to`

Full account statement for a farmer: info, contracts, payments, ledger with running balance.

---

### GET `/api/reports/farmers/:farmerId/contracts`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `ContractStatus` | Filter by status (optional) |

All contracts for a farmer with line items and stock movement details.

---

### GET `/api/reports/stores/:storeId/expenses`
**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | `ISO datetime` | Start date (optional) |
| `to` | `ISO datetime` | End date (optional) |
| `method` | `PaymentMethod` | Filter by payment method (optional) |

Expenses report with method breakdown.

---

## Common Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Bad request – missing or invalid fields |
| `401` | Unauthorized – missing or invalid token |
| `403` | Forbidden – insufficient role/permissions |
| `404` | Resource not found |
| `409` | Conflict – duplicate unique field |
| `429` | Limit exceeded (store or user quota) |
| `500` | Internal server error |

Error body: `{ "error": "string" }` or `{ "message": "string" }`

# API Documentation

This document provides detailed information about the available API endpoints in the JK Tracker Backend application.

## Authentication Routes
Base path: `/api/auth`

### POST /signup
Register a new user in the system.

**Request Body:**
```json
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

**Responses:**
- `201`: User registered successfully
- `400`: User already exists
- `500`: Server error

### POST /login
Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
    "email": "string",
    "password": "string"
}
```

**Responses:**
- `200`: Login successful (returns JWT token)
- `400`: Invalid credentials
- `404`: User not found
- `500`: Server error

## Interior Billing Routes
Base path: `/api/billing`

### POST /bills
Create a new interior bill.

**Request Body:**
```json
{
    "title": "string",
    "clientName": "string",
    "clientEmail": "string",
    "clientPhone": "string",
    "clientAddress": "string",
    "items": [
        {
            "description": "string",
            "unit": "string", // "Sft" or "Lump sum"
            "width": "number", // Required if unit is "Sft"
            "height": "number", // Required if unit is "Sft"
            "pricePerUnit": "number"
        }
    ],
    "companyDetails": "object",
    "paymentTerms": "string",
    "termsAndConditions": "array",
    "documentType": "string"
}
```

**Authentication:** Required (JWT Token)

**Responses:**
- `201`: Bill created successfully
- `400`: Invalid input
- `500`: Server error

### PUT /bills/:id
Update an existing bill.

**Parameters:**
- `id`: Bill ID (path parameter)

**Authentication:** Required (JWT Token)

**Request Body:** Same as POST /bills

**Responses:**
- `200`: Bill updated successfully
- `404`: Bill not found
- `500`: Server error

### POST /bills/:id/duplicate
Create a duplicate of an existing bill.

**Parameters:**
- `id`: Bill ID to duplicate (path parameter)

**Authentication:** Required (JWT Token)

**Responses:**
- `201`: Bill duplicated successfully
- `404`: Original bill not found
- `500`: Server error

## Analytics Routes
Base path: `/api/analytics`

Contains endpoints for retrieving analytics and reporting data.

## Balance Sheet Routes
Base path: `/api/balance`

Manages balance sheet related operations.

## Chat Routes
Base path: `/api/chat`

Handles chat functionality and messaging.

## Entries Routes
Base path: `/api/entries`

Manages entry-related operations.

## Projects Routes
Base path: `/api/projects`

Handles project management functionality.

---

## Authentication
Most endpoints require authentication using JWT (JSON Web Token). To authenticate requests:

1. Obtain a JWT token by logging in through the `/api/auth/login` endpoint
2. Include the token in the Authorization header of subsequent requests:
   ```
   Authorization: Bearer <your_jwt_token>
   ```

## Error Responses
All endpoints may return these common error responses:

- `400`: Bad Request - Invalid input or validation error
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server-side error

## Notes
- All requests and responses are in JSON format
- Dates are in ISO 8601 format
- All monetary values are in Indian Rupees (₹)

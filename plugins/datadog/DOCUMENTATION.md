# Datadog Plugin Documentation

## Overview

The Wave Datadog MCP plugin integrates Datadog's logging and APM (Application Performance Monitoring) capabilities into Executor. It provides read-only access to query logs, stream live logs, read archived logs, and retrieve APM traces.

## Features

- **Logs API**: Query historical logs, live-tail streaming, and archive access
- **APM Traces API**: Query traces and retrieve detailed trace information
- **Flexible Authentication**: Supports API Key (required) + Application Key (optional)
- **Multi-region Support**: US (api.datadoghq.com) and EU (api.datadoghq.eu) regions
- **Error Handling**: Comprehensive error messages and recovery

## Setup Guide

### Step 1: Obtain Datadog Credentials

#### API Key
1. Log in to your Datadog account
2. Navigate to: **Organization Settings** → **API Keys**
3. Click **+ New API Key**
4. Enter a name (e.g., "Executor Integration")
5. Copy the generated key and store it securely

#### Application Key (Optional)
1. Navigate to: **Organization Settings** → **Application Keys**
2. Click **+ New Application Key**
3. Enter a name (e.g., "Executor Integration")
4. Copy the generated key and store it securely

**Note**: The API Key is required for all operations. The Application Key is optional but recommended for access to additional endpoints.

### Step 2: Add Credentials to Executor

Store your Datadog credentials in Executor's secret management:

```bash
# Store API Key
executor secret add datadog-api-key

# Store Application Key (optional)
executor secret add datadog-app-key
```

### Step 3: Create a Datadog Source

Use Executor to create a Datadog source:

```bash
executor datadog create-source \
  --name "Production Datadog" \
  --api-key-secret datadog-api-key \
  --app-key-secret datadog-app-key
```

Or with API Key only:

```bash
executor datadog create-source \
  --name "Production Datadog (Read-Only)" \
  --api-key-secret datadog-api-key
```

## Available Operations

### 1. Query Logs

**Operation**: `datadog.logs.query`

Query historical logs with filtering and time range.

**Parameters**:
- `query` (required): Datadog query language filter (e.g., `status:error`)
- `from` (required): Start timestamp (Unix milliseconds)
- `to` (required): End timestamp (Unix milliseconds)
- `limit` (optional): Maximum results (default: 100, max: 1000)

**Example**:
```bash
executor invoke datadog.logs.query \
  --query "status:error" \
  --from 1609459200000 \
  --to 1609545600000
```

**Response**:
```json
{
  "data": [
    {
      "id": "log-123",
      "attributes": {
        "message": "Connection timeout",
        "status": "error",
        "service": "api",
        "timestamp": 1609459200000
      }
    }
  ]
}
```

### 2. Live Tail Logs

**Operation**: `datadog.logs.live_tail`

Stream real-time logs as they arrive in Datadog.

**Parameters**:
- `query` (required): Datadog query filter (e.g., `service:web`)

**Example**:
```bash
executor invoke datadog.logs.live_tail \
  --query "service:web env:prod"
```

**Response**:
```json
{
  "type": "live_tail",
  "query": "service:web env:prod",
  "endpoint": "https://api.datadoghq.com/api/v2/logs/stream",
  "message": "Live tail stream initiated. Use SSE client to consume events."
}
```

### 3. Read Log Archive

**Operation**: `datadog.logs.archive_read`

Access archived logs from Datadog's long-term storage.

**Parameters**:
- `archiveId` (required): Archive identifier

**Example**:
```bash
executor invoke datadog.logs.archive_read \
  --archiveId "archive-2024-01"
```

### 4. Query APM Traces

**Operation**: `datadog.apm.traces.query`

Query distributed traces with filtering and time range.

**Parameters**:
- `query` (required): Trace query filter (e.g., `service:api status:error`)
- `from` (required): Start timestamp (Unix milliseconds)
- `to` (required): End timestamp (Unix milliseconds)
- `limit` (optional): Maximum results (default: 100)

**Example**:
```bash
executor invoke datadog.apm.traces.query \
  --query "service:payment-api duration:[100ms TO 1s]" \
  --from 1609459200000 \
  --to 1609545600000
```

**Response**:
```json
{
  "meta": {
    "status": 200,
    "version": 1
  },
  "data": [
    {
      "type": "trace",
      "id": "trace-abc123",
      "attributes": {
        "duration": 500,
        "service": "payment-api",
        "resource": "POST /pay",
        "tags": {
          "span.kind": "server"
        }
      }
    }
  ]
}
```

### 5. Get Trace Details

**Operation**: `datadog.apm.traces.get`

Retrieve detailed information for a specific trace.

**Parameters**:
- `traceId` (required): Trace identifier

**Example**:
```bash
executor invoke datadog.apm.traces.get \
  --traceId "trace-abc123"
```

**Response**:
```json
{
  "data": {
    "type": "trace",
    "id": "trace-abc123",
    "attributes": {
      "duration": 500,
      "service": "payment-api",
      "spans": [
        {
          "id": "span-1",
          "resource": "POST /pay",
          "duration": 300
        }
      ]
    }
  }
}
```

## Query Examples

### Find Errors in Production

```bash
executor invoke datadog.logs.query \
  --query "status:error env:prod" \
  --from $(($(date +%s) * 1000 - 3600000)) \
  --to $(date +%s000)
```

### Search Specific Service

```bash
executor invoke datadog.logs.query \
  --query "service:api-gateway status:error OR status:warn" \
  --from 1609459200000 \
  --to 1609545600000
```

### Find Slow Traces

```bash
executor invoke datadog.apm.traces.query \
  --query "service:database duration:[1s TO 10s]" \
  --from $(($(date +%s) * 1000 - 86400000)) \
  --to $(date +%s000)
```

## Authentication Details

### Header Format

The plugin sends requests with the following headers:

```
DD-API-KEY: <your-api-key>
DD-APPLICATION-KEY: <your-app-key> (optional)
Accept: application/json
Content-Type: application/json
```

### Multi-Region Support

The plugin automatically routes requests to the correct region:

- **US**: `https://api.datadoghq.com`
- **EU**: `https://api.datadoghq.eu`

To use the EU region, configure your source accordingly (currently defaults to US).

## Troubleshooting

### Error: "Invalid API Key"

**Cause**: The API key is incorrect or has been revoked.

**Solution**:
1. Verify the API key in Datadog: Organization Settings → API Keys
2. Update the credential in Executor
3. Test connectivity with a simple query

### Error: "Unauthorized (403)"

**Cause**: The API key or Application Key doesn't have required permissions.

**Solution**:
1. Check that the API key is active in Datadog
2. Verify the key's permissions in Organization Settings
3. If using Application Key, ensure it has the required scopes

### Error: "No results returned"

**Cause**: The query parameters or time range may not match any logs.

**Solution**:
1. Expand the time range
2. Simplify the query filter
3. Verify logs exist in Datadog for the service/query
4. Check the query syntax using Datadog's Log Explorer

### Connection Timeouts

**Cause**: Network connectivity issues or Datadog API is slow.

**Solution**:
1. Verify your internet connection
2. Check Datadog's status page: https://status.datadoghq.com
3. Retry the request
4. Contact Datadog support if timeouts persist

## Limits and Quotas

- **API Rate Limit**: 300 requests/minute per API key
- **Query Results**: Maximum 1000 results per request
- **Time Range**: Maximum 90 days per query (some operations)
- **Live Tail**: Real-time streaming (connection may timeout after 60 minutes)

## Security Considerations

1. **API Keys**: Treat API and Application keys as secrets. Never commit them to version control.
2. **Scope**: The plugin uses read-only operations only. No data modification is possible.
3. **Audit**: All Datadog API calls are logged in Datadog's audit trail.
4. **Regional Data**: Ensure your Datadog account region aligns with data residency requirements.

## API Reference

For detailed API documentation, refer to:
- **Logs API**: https://docs.datadoghq.com/api/latest/logs/
- **Traces API**: https://docs.datadoghq.com/api/latest/traces/
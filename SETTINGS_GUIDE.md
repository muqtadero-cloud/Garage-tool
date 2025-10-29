# Merchant Settings Feature

## Overview
The merchant settings page provides a dedicated interface for configuring merchant-specific settings, separate from the main contract processing interface.

## Features

### 1. Merchant Tier Configuration
- **Location**: Merchant Configurations section
- **Tiers Available**:
  - **Basic** ($99/month): Up to 50 contracts/month, basic AI models
  - **Professional** ($299/month): Up to 200 contracts/month, all AI models, priority support
  - **Enterprise** (Custom): Unlimited contracts, dedicated support, custom integrations, SLA guarantees

### 2. Demo Stage Settings
- Configure default model for demo/training mode
- Set default agreement runs for consistency checking
- Manage demo-specific extraction settings

### 3. Production Stage Settings
- Configure default model for production/live mode
- Toggle auto-application of demo training data
- Manage production-specific extraction settings

## Accessing Settings

1. From the main page, click the **"Merchant Settings"** button at the bottom of the sidebar
2. Select a merchant from the dropdown
3. Navigate between different settings sections using the sidebar buttons:
   - **Merchant Configurations**: Tier selection
   - **Demo Settings**: Demo stage configuration
   - **Production Settings**: Production stage configuration

## API Endpoints

### Update Merchant Tier
```
POST /api/merchant/:merchantId/tier
Body: { "tier": "basic" | "professional" | "enterprise" }
```

### Get Merchant Details (includes tier)
```
GET /api/merchant/:merchantId
Response: { "merchant": { "id", "name", "tier", "tabsApiKey", "tabsEnv", ... } }
```

## Database Schema

The `merchants` table now includes a `tier` field:
```sql
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tabs_api_key TEXT,
  tabs_env TEXT DEFAULT 'dev',
  tier TEXT DEFAULT 'basic',  -- NEW FIELD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Migration

For existing databases, run the migration script:
```bash
npm run migrate:tier
```

This will:
- Add the `tier` column to the merchants table
- Set all existing merchants to the 'basic' tier by default
- Display a summary of current merchant tiers

## UI Design

The settings page follows the same modern, clean design as the main page:
- Responsive sidebar navigation
- Card-based settings sections
- Interactive tier selection with visual feedback
- Success/error alerts for user feedback
- Dark mode support

## Future Enhancements

Potential additions to the settings page:
- Billing and payment information
- Usage statistics and limits
- Custom field mappings per merchant
- Notification preferences
- API key management
- Team member access control




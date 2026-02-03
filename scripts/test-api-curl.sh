#!/bin/bash
# Load env vars
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Testing API endpoint..."
curl -X POST http://localhost:3000/api/admin/upload-papers \
  -H "Authorization: Bearer $PAPER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"categories": ["cs.AI"]}'

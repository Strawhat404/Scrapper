#!/bin/bash

echo "🔧 Fixing database schema (integer → bigint for likes, views, comments)..."

# Run the SQL fix
docker-compose exec -T postgres psql -U admin -d socialpulse <<EOF
ALTER TABLE scraped_posts 
ALTER COLUMN likes TYPE bigint,
ALTER COLUMN views TYPE bigint,
ALTER COLUMN comments TYPE bigint;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database schema updated successfully!"
    echo ""
    echo "The following columns are now bigint:"
    echo "  - likes"
    echo "  - views"
    echo "  - comments"
    echo ""
    echo "This fixes the 'value out of range for type integer' error."
else
    echo "❌ Failed to update database schema"
    exit 1
fi

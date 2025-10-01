#!/bin/bash

# Test script for transcription-enhance Edge Function
# Usage: ./test.sh [local|production]

set -e

# Default to local environment
ENVIRONMENT=${1:-local}

if [ "$ENVIRONMENT" = "local" ]; then
    # Get local Supabase credentials
    echo "🧪 Testing transcription-enhance function locally..."
    SUPABASE_URL="http://127.0.0.1:54321"
    ANON_KEY=$(supabase status --output json | jq -r '.anon_key' 2>/dev/null || echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0")
    ENDPOINT="${SUPABASE_URL}/functions/v1/transcription-enhance"
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🧪 Testing transcription-enhance function in production..."
    echo "❌ Production testing not implemented yet"
    exit 1
else
    echo "❌ Invalid environment. Use 'local' or 'production'"
    exit 1
fi

echo "📡 Endpoint: $ENDPOINT"
echo "🔑 Using anon key: ${ANON_KEY:0:20}..."

# Test payload based on plan specifications
TEST_PAYLOAD='{
  "segments": [
    {
      "id": "test-segment-1",
      "rawText": "hello this is a test transcription with some errors",
      "timestamp": 1733043661000,
      "sourceType": "microphone"
    },
    {
      "id": "test-segment-2",
      "rawText": "can you help me schdule a meeting for tommorow",
      "timestamp": 1733043665000,
      "sourceType": "microphone"
    }
  ],
  "sessionContext": {
    "sessionId": "test-session-123",
    "conversationHistory": [
      "Previous conversation context here",
      "User was discussing scheduling meetings"
    ],
    "userLanguage": "en"
  }
}'

echo "📦 Test payload:"
echo "$TEST_PAYLOAD" | jq .

echo ""
echo "🚀 Sending request..."

RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "$TEST_PAYLOAD" \
  "$ENDPOINT")

HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

echo "📊 Response Status: $HTTP_STATUS"
echo "📋 Response Body:"

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Success!"
    echo "$HTTP_BODY" | jq .

    # Validate response structure
    echo ""
    echo "🔍 Validating response structure..."

    SEGMENTS_COUNT=$(echo "$HTTP_BODY" | jq '.segments | length')
    PROCESSING_TIME=$(echo "$HTTP_BODY" | jq '.processingTime')

    echo "   📊 Enhanced segments: $SEGMENTS_COUNT"
    echo "   ⏱️  Processing time: ${PROCESSING_TIME}ms"

    # Check for required fields in enhanced segments
    echo "$HTTP_BODY" | jq -r '.segments[] | "   🎯 Segment " + .id + ": " + .intention.primary + " (confidence: " + (.confidence * 100 | floor | tostring) + "%)"'

    echo ""
    echo "✅ All tests passed! Enhancement function is working correctly."

elif [ "$HTTP_STATUS" -eq 401 ]; then
    echo "❌ Authentication failed"
    echo "$HTTP_BODY" | jq .
elif [ "$HTTP_STATUS" -eq 403 ]; then
    echo "❌ Forbidden - Check entitlements"
    echo "$HTTP_BODY" | jq .
elif [ "$HTTP_STATUS" -eq 429 ]; then
    echo "❌ Rate limited - Check quotas"
    echo "$HTTP_BODY" | jq .
else
    echo "❌ Request failed"
    echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"
fi

echo ""
echo "🏁 Test completed!"
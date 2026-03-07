#!/bin/bash

# Prompt the user for input
read -p "Product: " PRODUCT
read -p "Value: " VALUE
read -p "Price: " PRICE
read -p "Target: " TARGET
read -p "Stop: " STOP
echo
# Ask for confirmation
echo "Product: $PRODUCT"
echo "Value: $VALUE"
echo "Price: $PRICE"
echo "Target: $TARGET"
echo "Stop: $STOP"

read -p "Do you want to invoke the Lambda function with the above payload? (y/n): " CONFIRMATION

if [ "$CONFIRMATION" != "y" ]; then
  echo "Aborted by the user."
  exit 0
fi

# Send the POST request using curl
curl -X POST http://localhost:3000/open \
    -H "Content-Type: application/json" \
    -d "{\"product\": \"$PRODUCT\", \"price\": \"$PRICE\", \"value\": \"$VALUE\", \"target\": \"$TARGET\", \"stop\": \"$STOP\"}" \
    | jq -r

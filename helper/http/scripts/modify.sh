#!/bin/bash

# Ensure jq and curl are installed
if ! command -v jq &>/dev/null || ! command -v curl &>/dev/null; then
  echo "Error: jq and curl must be installed to run this script."
  exit 1
fi

# Prompt the user for required input
while :; do
  read -p "Position: " POSITION
  if [ -n "$POSITION" ]; then
    break
  else
    echo "Position cannot be empty. Please try again."
  fi
done

while :; do
  read -p "Price: " PRICE
  if [ -n "$PRICE" ]; then
    break
  else
    echo "Price cannot be empty. Please try again."
  fi
done

# Prompt the user for optional inputs
read -p "Stop Loss (optional): " STOP_PRICE
read -p "Take Profit (optional): " TARGET_PRICE

echo
# Display entered data
echo "Position: $POSITION"
echo "Price: $PRICE"
if [ -n "$STOP_PRICE" ]; then
  echo "Stop Loss: $STOP_PRICE"
fi
if [ -n "$TARGET_PRICE" ]; then
  echo "Take Profit: $TARGET_PRICE"
fi

# Confirm the action
read -p "Do you want to modify the position with the above payload? (y/n): " CONFIRMATION

# Make confirmation case-insensitive
CONFIRMATION=${CONFIRMATION,,}

if [[ "$CONFIRMATION" != "y" ]]; then
  echo "Aborted by the user."
  exit 0
fi

# Build the JSON payload dynamically
PAYLOAD="{\"position\": \"$POSITION\", \"price\": \"$PRICE\""
if [ -n "$STOP_PRICE" ]; then
  PAYLOAD+=", \"stop_price\": \"$STOP_PRICE\""
fi
if [ -n "$TARGET_PRICE" ]; then
  PAYLOAD+=", \"target_price\": \"$TARGET_PRICE\""
fi
PAYLOAD+="}"

# Send the PATCH request using curl
RESPONSE=$(curl -s -X PATCH http://localhost:3000/modify \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

if [ $? -eq 0 ]; then
  echo "Response from server:"
  echo "$RESPONSE" | jq -r
else
  echo "Error: Failed to send the request."
  exit 1
fi

#!/bin/bash
# Default URL
URL="http://localhost:3000/state"

# Check if the position argument is provided
if [ -n "$1" ]; then
    # If provided, append the position to the URL as a query string
    URL="$URL?position=$1"
fi

# Make the GET request and pretty print the result using jq
curl -s "$URL" | jq -r '
                       .[] |
                       "\n-------------------------------------------------------------------",
                       "Position Name: \(.name)\nStatus: \(.status)\n",
                       "Buy Order:",
                       "  Status: \(.buy.status)",
                       "  Limit Price: \(.buy.limitPrice)",
                       "  Base Size: \(.buy.baseSize)",
                       "  Fill Price: \(.buy.fillPrice)",
                       "  Filled Size: \(.buy.filledSize)",
                       "Target Price: \(.targetPrice)",
                       "Stop Price: \(.stopPrice)",
                       "\nSell Order:",
                       "  Status: \(.sell.status)",
                       "  Limit Price: \(.sell.limitPrice)",
                       "  Stop Price: \(.sell.stopPrice)",
                       "  Base Size: \(.sell.baseSize)",
                       "  Fill Price: \(.sell.fillPrice)",
                       "  Filled Size: \(.sell.filledSize)",
                       "Coverage: \(.coverage)%",
                       "Covered: \(.covered)",
                       "Current Price: \(.currentPrice)",
                       "PnL: \(.PnL)",
                       "Percent Complete: \(.percentComplete)",
                       "\nLog:",
                       (.log[] | "  \(.)")
                     '

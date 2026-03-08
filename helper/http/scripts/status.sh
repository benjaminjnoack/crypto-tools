#!/bin/bash

# Default URL
URL="http://localhost:3000/status"

# Check if the position argument is provided
if [ -n "$1" ]; then
    # If provided, append the position to the URL as a query string
    URL="$URL?position=$1"
fi

# Make the GET request and pretty print the result using jq
curl -s "$URL" | jq

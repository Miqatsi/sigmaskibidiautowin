#!/bin/bash
# Start YOLO AI service + ngrok tunnel

echo "🚀 Starting YOLOv8 AI service on port 8000..."
cd ai
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
AI_PID=$!
sleep 3

echo "🌐 Starting ngrok tunnel..."
ngrok http 8000 &
NGROK_PID=$!
sleep 2

echo ""
echo "✅ AI service running (PID: $AI_PID)"
echo "✅ ngrok running (PID: $NGROK_PID)"
echo ""
echo "📋 Your ngrok URL:"
curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; data=json.load(sys.stdin); [print('   ' + t['public_url']) for t in data['tunnels']]" 2>/dev/null
echo ""
echo "Press Ctrl+C to stop everything"

trap "kill $AI_PID $NGROK_PID 2>/dev/null; echo '🛑 Stopped.'; exit" INT
wait

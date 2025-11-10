#!/bin/bash

echo "===================================="
echo "Portfolio Conversion Tool Deployment"
echo "===================================="
echo ""

echo "[1/5] Installing Backend Dependencies..."
cd api
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Python dependencies"
    exit 1
fi
cd ..

echo ""
echo "[2/5] Installing Frontend Dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Node dependencies"
    exit 1
fi

echo ""
echo "[3/5] Building Frontend for Production..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build frontend"
    exit 1
fi
cd ..

echo ""
echo "[4/5] Verifying Files..."
[ ! -f "Portfolio_Syskomp_pA.csv" ] && echo "WARNING: Portfolio_Syskomp_pA.csv not found!"
[ ! -d "ALVARIS_CATALOG" ] && echo "WARNING: ALVARIS_CATALOG folder not found!"
[ ! -d "ASK_CATALOG" ] && echo "WARNING: ASK_CATALOG folder not found!"

echo ""
echo "[5/5] Deployment Complete!"
echo ""
echo "===================================="
echo "Next Steps:"
echo "===================================="
echo "1. Start Backend:  cd api && python app.py"
echo "2. Access at:      http://localhost:5000"
echo ""
echo "For production, see DEPLOY.md"
echo "===================================="

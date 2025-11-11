#!/bin/bash
# Installation script for MQTT Telemetry Service on Raspberry Pi

set -e

echo "========================================="
echo "MQTT Telemetry Service Installer"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/mqtt-telemetry"
CONFIG_DIR="/etc/mqtt-telemetry"
LOG_DIR="/var/log/mqtt-telemetry"
DATA_DIR="/data/mqtt-telemetry"
SERVICE_USER="pi"

echo "Installation configuration:"
echo "  Install directory: $INSTALL_DIR"
echo "  Config directory: $CONFIG_DIR"
echo "  Log directory: $LOG_DIR"
echo "  Data directory: $DATA_DIR"
echo "  Service user: $SERVICE_USER"
echo ""

read -p "Continue with installation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

echo ""
echo "Step 1: Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

echo "Step 2: Installing system dependencies..."
apt-get update
apt-get install -y python3 python3-pip python3-venv git

echo "Step 3: Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"

echo "Step 4: Installing MQTT Telemetry package..."
cd "$INSTALL_DIR"
if [ ! -d "Mqtt-base" ]; then
    git clone https://github.com/yayoboy/Mqtt-base.git
fi
cd Mqtt-base/raspberry
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r requirements.txt
"$INSTALL_DIR/venv/bin/pip" install -e .

echo "Step 5: Copying configuration..."
if [ ! -f "$CONFIG_DIR/config.yaml" ]; then
    cp config.example.yaml "$CONFIG_DIR/config.yaml"
    echo "  Configuration file created at $CONFIG_DIR/config.yaml"
    echo "  IMPORTANT: Edit this file with your MQTT broker settings!"
else
    echo "  Configuration file already exists, skipping..."
fi

echo "Step 6: Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 755 "$INSTALL_DIR"
chmod 600 "$CONFIG_DIR/config.yaml"

echo "Step 7: Installing systemd service..."
cp mqtt-telemetry.service /etc/systemd/system/
systemctl daemon-reload

echo ""
echo "========================================="
echo "Installation completed successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Edit configuration: sudo nano $CONFIG_DIR/config.yaml"
echo "  2. Start service: sudo systemctl start mqtt-telemetry"
echo "  3. Enable on boot: sudo systemctl enable mqtt-telemetry"
echo "  4. Check status: sudo systemctl status mqtt-telemetry"
echo "  5. View logs: sudo journalctl -u mqtt-telemetry -f"
echo "  6. Access web interface: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Troubleshooting:"
echo "  - Check logs: journalctl -u mqtt-telemetry --no-pager"
echo "  - Test manually: sudo -u $SERVICE_USER $INSTALL_DIR/venv/bin/python -m mqtt_telemetry --config $CONFIG_DIR/config.yaml"
echo ""

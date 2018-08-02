# Farbton

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/7efbc14b733442bfb0bf26f5643bec72)](https://app.codacy.com/app/amsdams/farbton?utm_source=github.com&utm_medium=referral&utm_content=amsdams/farbton&utm_campaign=badger)
[![CircleCI](https://circleci.com/gh/amsdams/farbton.svg?style=svg)](https://circleci.com/gh/amsdams/farbton)
[![Build Status](https://travis-ci.org/amsdams/farbton.svg?branch=master)](https://travis-ci.org/amsdams/farbton)
[![Run Status](https://api.shippable.com/projects/5b409da31e57690700751750/badge?branch=master)](https://app.shippable.com/github/amsdams/farbton)
[ ![Codeship Status for amsdams/farbton](https://app.codeship.com/projects/6db89b00-6401-0136-f3cd-761b5b8f694f/status?branch=master)](https://app.codeship.com/projects/297073)
[![Build status](https://ci.appveyor.com/api/projects/status/vxikpr6nhdvekqok?svg=true)](https://ci.appveyor.com/project/amsdams/farbton)
[![dependencies Status](https://david-dm.org/amsdams/farbton/status.svg)](https://david-dm.org/amsdams/farbton)
[![Maintainability](https://api.codeclimate.com/v1/badges/af4d357616fb18f983f0/maintainability)](https://codeclimate.com/github/amsdams/farbton/maintainability)
[![Known Vulnerabilities](https://snyk.io/test/github/amsdams/farbton/badge.svg?targetFile=package.json)](https://snyk.io/test/github/amsdams/farbton?targetFile=package.json)
[![codebeat badge](https://codebeat.co/badges/2a824828-e0ca-46e5-b004-8f3007b88fd2)](https://codebeat.co/projects/github-com-amsdams-farbton-master)

This is a small daemon written in TypeScript to control my Philips Hue setup. Note that currently
not much is configurable and most is hardcoded to match my setup.

## Example config.json

```json
{
    "username": "V5-XXX-XXX",
    "bridgeIp": "192.168.XXX.XXX",
    "influx": {
        "host": "localhost",
        "database": "hue"
    }
}
```

## Setup / Building

```
npm install && npm run-script compile
```

## Launching

```
node build/main.js
```

## Install and run:

```
npm install && npm start
```

## Addons

### Add InfluxDB, Grafana, Telegraf and Chronograf to Raspberry Pi

As the script can write to InfluxDB, it is useful to install these programs and configure Graphana
to obtain some nice plots.

```bash
curl https://repos.influxdata.com/influxdb.key > ikey.key
sudo apt-key add ikey.key

echo "deb https://repos.influxdata.com/debian stretch stable" | sudo tee /etc/apt/sources.list.d/influxdb.list

sudo apt-get update
sudo apt-get install influxdb telegraf chronograf
sudo service influxdb start
sudo service telegraf start
sudo service chronograf start

wget https://github.com/fg2it/grafana-on-raspberry/releases/download/v5.1.4/grafana_5.1.4_armhf.deb
sudo dpkg -i grafana_5.1.4_armhf.deb 

sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

### Supervisor Sample Config

```
[program:farbton]
command=/home/pi/.nvm/versions/node/v6.1.0/bin/node build/main.js
directory=/home/pi/devel/farbton
autostart=true
autostart=true
autorestart=unexpected
startsecs=10
startretries=3
exitcodes=0,2
stopsignal=TERM
stopwaitsecs=10
stopasgroup=false
killasgroup=false
user=pi
redirect_stderr=false
stdout_logfile=/var/log/farbton/farbton.log
stdout_logfile_maxbytes=1MB
stdout_logfile_backups=10
stdout_capture_maxbytes=1MB
stdout_events_enabled=false
stderr_logfile=/var/log/farbton/farbton.err
stderr_logfile_maxbytes=1MB
stderr_logfile_backups=10
stderr_capture_maxbytes=1MB
stderr_events_enabled=false
```


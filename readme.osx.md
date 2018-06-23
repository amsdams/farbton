brew install influxdb
brew services start influxdb

brew install telegraf
brew services start telegraf

brew install  chronograf
brew services start chronograf

brew install grafana
brew services start grafana

influx:
CREATE DATABASE hue

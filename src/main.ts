import * as huejay from 'huejay';
import * as fs from 'fs';
import * as moment from 'moment';
import * as influx from 'influx';

interface IConfig {
  username?: string;
  bridgeIp?: string;
  influx?: {
    host: string;
    database: string;
  };
}

function timeout(time: number): Promise<void> {
  return new Promise((resolve, /*reject*/_) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}
async function saveLight(light: any, db: influx.InfluxDB) {

  await db.writePoints([
    {
      measurement: 'light',
      tags: {
        light: light.name,
      },
      fields: {
        type: light.type,
        name: light.name,
        on: light.on ? 1 : 0,
        reachable: light.reachable ? 1 : 0,
      },
    },
  ]);
}
async function printLight(light: any) {
  try {
    console.log('light.attributes');
    console.table(light.attributes);
    console.log('light.state.attributes:');
    console.table(light.state.attributes);
  } catch (e) {
    console.error(e);
  }
}
async function doLight(light: any, db: influx.InfluxDB | null) {
  await printLight(light);

  if (db) {
    await saveLight(light, db);
  }
}
async function doLights(client: any, db: influx.InfluxDB | null) {
  const lights = await client.lights.getAll();

  for (const light of lights) {
    await doLight(light, db);
  }
}
async function saveSensor(sensor: any, db: influx.InfluxDB) {
  await db.writePoints([
    {
      measurement: 'sensor',
      tags: {
        sensor: sensor.name,
      },
      fields: {
        type: sensor.type,
        name: sensor.name,
        presence: sensor.state.attributes.attributes.presence ? 1 : 0,
        temperature: sensor.state.attributes.attributes.temperature || 0,
        lightlevel: sensor.state.attributes.attributes.lightlevel || 0,
      },
    },
  ]);
}
async function printSensor(sensor: any) {
  try {
    console.log('sensor.attributes:');
    console.table(sensor.attributes);
    console.log('sensor.state.attributes:');
    console.table(sensor.state.attributes);
    console.log('sensor.config.attributes:');
    console.table(sensor.config.attributes);
  } catch (e) {
    console.error(e);
  }
}

async function doSensor(sensor: any, db: influx.InfluxDB | null) {
  await printSensor(sensor);
  if (db) {
    await saveSensor(sensor, db);
  }
}
async function doSensors(client: any, db: influx.InfluxDB | null) {
  const sensors = await client.sensors.getAll();

  for (const sensor of sensors) {
    await doSensor(sensor, db);
  }
}

async function loop(client: any, db: influx.InfluxDB | null) {
  // let's find some sensors

  doSensors(client, db);
  console.log('Current hour: ' + moment());

  // let's find the lights
  doLights(client, db);
}
function setupInflux(config: any): influx.InfluxDB {
  return new influx.InfluxDB({
    host: config.influx.host,
    database: config.influx.database,
    schema: [
      {
        measurement: 'light',
        tags: ['light'],
        fields: {
          type: influx.FieldType.STRING,
          name: influx.FieldType.STRING,
          on: influx.FieldType.INTEGER,
          reachable: influx.FieldType.INTEGER,
        },
      },
      {
        measurement: 'sensor',
        tags: ['sensor'],
        fields: {
          type: influx.FieldType.STRING,
          name: influx.FieldType.STRING,
          presence: influx.FieldType.INTEGER,
          temperature: influx.FieldType.FLOAT,
          lightlevel: influx.FieldType.INTEGER,
        },
      },
    ],
  });
}
async function main() {
  const config: IConfig = JSON.parse(fs.readFileSync('config.json').toString());

  // find the bridge
  if (!config.bridgeIp) {
    const bridges = await huejay.discover();
    if (bridges.length === 0) {
      throw new Error('No bridges found');
    }
    for (const b of bridges) {
      console.log(' + Found ' + b.id + ' at ' + b.ip);
    }

    const bridge = bridges[0];
    console.log('Using bridge ' + bridge.id + ' at ' + bridge.ip);

    config.bridgeIp = bridge.ip;
  }

  // get a new user if needed
  if (!config.username) {
    console.log('No username provided, trying to register a new one');

    const cli = new huejay.Client({
      host: config.bridgeIp,
    });

    const user = new cli.users.User();
    user.deviceType = 'Farbton-ts';

    const u = await cli.users.create(user);
    console.log('New user is: ' + u.username);

    config.username = u.username;
  }

  // create the real client and check auth
  const client = new huejay.Client({
    host: config.bridgeIp,
    username: config.username,
  });

  console.log('Checking bridge auth ...');
  const authOk = await client.bridge.isAuthenticated();
  if (!authOk) {
    console.log('Not authenticated.');
    return;
  }

  let db: influx.InfluxDB | null = null;
  if (config.influx) {
    console.log('InfluxDB is enabled');
    db = setupInflux(config);
  }

  while (true) {
    try {
      await loop(client, db);
    } catch (E) {
      console.log('E', E);
    } finally {
      await timeout(1000);
    }
  }
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
}

run();

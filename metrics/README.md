# Arbitrum Nitro Metrics

You can run this docker compose file it will run

- prometheus
- grafana
- setup the default dashboard

The default username/password is `admin`/`admin`.

## Run the metrics services

Simply start docker compose in this `metrics/` folder:

```sh
docker compose up
```

## Enable metrics on Nitro node

Don't forget to run the Nitro node with metrics exporting on, to do so add the following flags to your Nitro node startup command:

```sh
--metrics --metrics-server.addr=0.0.0.0
```

> ⚠️ Warning: Using 0.0.0.0 is recommended for cross-platform compatibility,
especially when accessing metrics from Docker, Linux, WSL, or remote containers.

## View the Dashboard

View the dashboard at http://localhost:3000

## How to add more grafana dashboards

To add more grafana dashboards you can drop json files into the `grafana/dashboards/` folder.
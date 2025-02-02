# All In Analytics
This repositroy is home to the core backend components of the All In Analytics project. This project is the primary home of a custom hold-em insight tool. This tool will allow users to track historical hands / odds at the end of each game. Most of the initial logic will be centered around odds calculations, visualization, and the aggregation of historical-hand data. Hardware based components will slowly be introduced when the system is up and running so we can pass in input from games in real-time.

# Developers Guide

Below is the structure of the All In Analytics  backend system.

```
all-in-analytics-core/
├─ src/
│  ├─ app/
│  │  ├─ database/
│  │  ├─ routes/
│  │  ├─ config.py
│  │  ├─ main.py
│  ├─ pydantic_models/
│  │  ├─ app_models.py
│  ├─ Dockerfile
│  ├─ pyproject.toml
```
This system is comprised of a FastAPI application that uses a docker image to run in. The API will provide a simple CRUD interface to in memory relational database. This interface will support:

- Updating historical game records
- Querying specific user filters for searching historical games
- And so much more...[WIP]

## Environment Setup

Some environement setup to get everything working together nicely is necessary. We need the following tools below to be installed on our system in order to test / run the application:

- [Poetry Package Manager](https://python-poetry.org/docs/)

Once this is installed you can setup the poetry environement locally with the following command executed at the root of the repository:

`poetry install --no-root --with dev`

## Running Unit Tests Locally

Users can easily run unit tests locally by using the following commands below:

```bash
poetry install --no-root --with test
cd ~/all-in-analytics-core
PYTHONPATH=src/ pytest test/
```

## Building Docker Container and Running FastAPI application

Users can easily build the docker container and run the app locally within a uvicorn server running within the docker container. First ensure that you have the Docker Engine installed:

- [Docker Engine](https://docs.docker.com/engine/install/ubuntu/)

Then we can simply type in the following build / run commands:

```bash
cd ~/all-in-analytics-core

# Build the Docker image using the Dockerfile
docker build -t all-in-analytics-core .

# Spin up the Docker contianer with app
docker run -p 8000:8000 all-in-analytics-core
```

You can then navigate to the following [URL](http://localhost:8000/) to see a simple JSON output below:

```
{"message":"Welcome to the All In Analytics Core Backend!"}
```
You can also navigate to the [docs route](http://localhost:8000/docs) to interact directly with the API and see the docuemntation! Isn't that so cool???

![Docs Image](docs/image/docs_page_screenshot.png)


## Interacting with the FastAPI application
**WIP**

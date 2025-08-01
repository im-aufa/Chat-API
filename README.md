# Aufa AI Portfolio & RAG Chat API

This repository contains the source code for my personal portfolio website and a sophisticated AI-powered chat API. The entire project is containerized with Docker and orchestrated with Docker Compose, featuring a CI/CD pipeline for automated deployments to a Virtual Private Server (VPS).

## Project Overview

The project consists of two main services:

1.  **Portfolio Site (`portfolio-site`):** A lightweight, static frontend built with vanilla HTML, CSS, and JavaScript. It is served by an Nginx container and showcases my projects, skills, and experience.
2.  **Chat API (`chat-api`):** A backend service built with Python and FastAPI that implements a Retrieval-Augmented Generation (RAG) system. It uses AI to answer questions based on a knowledge base of documents I provide.

The entire stack is deployed behind a **Traefik** reverse proxy, which handles SSL termination and routing. User authentication is managed by **Auth0**.

## Architecture

![image](https://github.com/user-attachments/assets/e7f458f7-1e2a-4e9c-b80c-901311487292)

### 1. Portfolio Site (Frontend)

-   **Technology:** Vanilla HTML, CSS, JavaScript
-   **Web Server:** Nginx (running in a Docker container)
-   **Styling:** Pico.css with custom styles for a clean, modern UI.
-   **Features:**
    -   **Dynamic Project Loading:** Projects are loaded from a static `projects.json` file.
    -   **Interactive Chat Widget:** A chat interface that communicates with the `chat-api` to provide AI-driven answers. Access is secured and requires user login.
    -   **Responsive Design:** Fully responsive for an optimal experience on all devices.

### 2. Chat API (Backend)

-   **Framework:** FastAPI (Python)
-   **Core Logic:** Implements a Retrieval-Augmented Generation (RAG) pipeline.
    -   **Document Ingestion:** Processes documents (PDFs, Google Docs) from sources like Google Drive or local folders.
    -   **Chunking & Embedding:** Splits documents into manageable chunks (`docling`) and creates vector embeddings using OpenAI's `text-embedding-3-large` model.
    -   **Vector Storage:** Stores the chunks and their embeddings in a **PostgreSQL** database with the `pgvector` extension.
    -   **Retrieval & Generation:** When a user asks a question, the API embeds the query, retrieves the most relevant document chunks from the database using vector similarity search, and then uses an OpenAI chat model (`gpt-3.5-turbo`) to generate a coherent answer based on the retrieved context.
-   **API Endpoints:**
    -   `/chat`: Receives user queries and returns AI-generated responses.
    -   `/process`: An endpoint to trigger the document ingestion and embedding process.
-   **Authentication:** API endpoints are secured using JWTs (JSON Web Tokens) provided by **Auth0**. The API validates the token on every request.

### 3. Infrastructure & DevOps

-   **Containerization:** All services (`portfolio`, `chat-api`, `postgres`, `traefik`) are containerized using **Docker**.
-   **Orchestration:** **Docker Compose** is used to define and manage the multi-container application stack.
-   **Reverse Proxy:** **Traefik** manages incoming traffic, routes requests to the appropriate services, and automatically handles SSL certificates from Let's Encrypt.
-   **Authentication:** **Auth0** is used as the identity provider, handling user login, signup, and the issuance of JWTs.
-   **CI/CD:** A **GitHub Actions** workflow automatically deploys the latest version of the application to the VPS on every push to the `main` branch. The workflow uses SSH to connect to the server, pulls the latest code, and restarts the Docker Compose stack.

## Tech Stack

-   **Frontend:** HTML, CSS, JavaScript, Pico.css
-   **Backend:** Python, FastAPI, OpenAI API
-   **Database:** PostgreSQL + `pgvector`
-   **Authentication:** Auth0
-   **Infrastructure:** Docker, Docker Compose, Traefik, Nginx
-   **DevOps:** GitHub Actions, SSH

## How to Run Locally

1.  **Prerequisites:**
    -   Docker and Docker Compose must be installed.
    -   Git.

2.  **Clone the repository:**
    ```bash
    git clone https://github.com/im-aufa/aufaim-portfolio.git
    cd aufaim-portfolio
    ```

3.  **Set up environment variables:**
    -   Create a `.env` file in the root directory.
    -   Fill in the required values (OpenAI keys, database credentials, Auth0 Domain and Audience, etc.).

4.  **Update Frontend Configuration:**
    -   Open `portfolio-site/script.js`.
    -   Replace the placeholder values for `clientId` and `audience` with your actual Auth0 credentials.

5.  **Build and run the application:**
    ```bash
    docker-compose up --build
    ```

6.  **Access the services:**
    -   **Portfolio:** `http://localhost:80` (or the port you've mapped)
    -   **Traefik Dashboard:** `http://localhost:8080`
    -   **Chat API Docs:** `http://localhost/docs` (or the configured API domain)
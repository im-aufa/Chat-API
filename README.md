# Aufa AI Portfolio & RAG Chat API

This repository contains the source code for my personal portfolio website and a sophisticated AI-powered chat API. The entire project is containerized with Docker and orchestrated with Docker Compose, featuring a CI/CD pipeline for automated deployments to a Virtual Private Server (VPS).

## Project Overview

The project consists of two main services:

1.  **Portfolio Site (`portfolio-site`):** A lightweight, static frontend built with vanilla HTML, CSS, and JavaScript, served by an Nginx container.
2.  **Chat API (`chat-api`):** A Python/FastAPI backend that implements a Retrieval-Augmented Generation (RAG) system. It serves both the portfolio's chat widget and is ready for mobile (Flutter) integration.

The entire stack is deployed behind a **Traefik** reverse proxy, with user authentication managed by **Auth0**.

## Project Status & History

This project was developed in distinct phases, resulting in a mature and feature-complete application.

### Feature Completion Status

| Feature | Status |
| --- | --- |
| Automated CI/CD Pipeline | ✅ Complete |
| Containerized Infrastructure (Docker/Traefik) | ✅ Complete |
| RAG API with Google Drive & PostgreSQL | ✅ Complete |
| Dynamic Portfolio Website | ✅ Complete |
| Interactive AI Chat Widget | ✅ Complete |
| User Authentication (Auth0) | ✅ Complete |

### Development Summary

*   **Phase 1: Infrastructure & CI/CD:** The project's foundation was built first, establishing a fully automated deployment pipeline using GitHub Actions, Docker, Docker Compose, and Traefik. This phase focused on creating a stable, production-like environment from the start.
*   **Phase 2: Core RAG API:** The backend FastAPI was developed, implementing the core RAG logic. This involved integrating Google Drive for knowledge management, using `docling` for document processing, and setting up a `pgvector` database. Performance tuning and dependency management were key activities.
*   **Phase 3: Frontend & Integration:** The final phase involved building the portfolio UI and integrating the chat functionality with the backend. This included implementing a robust Auth0 authentication flow to secure the API, which required significant effort to debug and solidify the frontend-to-backend security model.

## Architecture

![image](https://github.com/user-attachments/assets/e7f458f7-1e2a-4e9c-b80c-901311487292)

### 1. Portfolio Site (Frontend)

-   **Technology:** Vanilla HTML, CSS, JavaScript
-   **Web Server:** Nginx (running in a Docker container)
-   **Styling:** Pico.css with custom styles.
-   **Features:** Dynamically loads project data from `projects.json` and features a responsive chat widget.

### 2. Chat API (Backend)

-   **Framework:** FastAPI (Python) served by Gunicorn with Uvicorn workers for asynchronous request handling.
-   **Core Logic:** Implements a Retrieval-Augmented Generation (RAG) pipeline.
    -   **Document Ingestion:** Processes documents (PDFs, Google Docs) from Google Drive or local folders via the `/process` endpoint.
    -   **Chunking & Embedding:** Splits documents into chunks using `docling` and creates 3072-dimension vector embeddings with OpenAI's `text-embedding-3-large` model.
    -   **Vector Storage:** Stores embeddings in a PostgreSQL database with the `pgvector` extension.
    -   **Retrieval & Generation:** For an incoming query, the API retrieves relevant chunks via vector search and uses OpenAI's `gpt-3.5-turbo` model to generate a context-aware answer.
-   **Mobile Ready:** The API is designed and documented to serve as a backend for a Flutter application. See `chat-api/FLUTTER_INTEGRATION.md`.

### 3. Infrastructure & DevOps

-   **Containerization:** All services (`portfolio`, `chat-api`, `postgres`, `traefik`) are containerized using Docker.
-   **Orchestration:** Docker Compose defines and manages the multi-container application stack.
-   **Reverse Proxy:** Traefik manages ingress traffic, routing `aufaim.com` to the portfolio and `api.aufaim.com` to the chat API, with auto-managed SSL certificates.
-   **Authentication:** Auth0 handles user login/signup and issues JWTs, which are validated by the API on protected endpoints.
-   **CI/CD:** A GitHub Actions workflow triggers on every push to the `master` branch, using SSH to deploy to the VPS, pull the latest code, and restart the Docker Compose stack.

## Tech Stack

-   **Frontend:** HTML, CSS, JavaScript, Pico.css
-   **Backend:** Python, FastAPI, Gunicorn, OpenAI API (`gpt-3.5-turbo`, `text-embedding-3-large`)
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
    -   Create a `.env` file in the root directory. Fill in the required values (OpenAI keys, database credentials, Auth0 Domain and Audience, etc.).

4.  **Configure Hostnames:**
    -   For Traefik to route requests correctly, map the service hostnames to your localhost address by editing your hosts file (`/etc/hosts` on Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` on Windows).
    -   Add the following lines:
        ```
        127.0.0.1 aufaim.com
        127.0.0.1 api.aufaim.com
        ```

5.  **Build and run the application:**
    ```bash
    docker-compose up --build
    ```

6.  **Access the services:**
    -   **Portfolio:** `http://aufaim.com`
    -   **Chat API Docs:** `http://api.aufaim.com/docs`
    -   **Traefik Dashboard:** `http://localhost:8080`